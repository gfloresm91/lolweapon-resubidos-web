#!/usr/bin/env python3
"""Generate deterministic poster and preview assets for Piero VOD files."""

from __future__ import annotations

import argparse
import errno
import json
import math
import os
import re
import shutil
import subprocess
import sys
import tempfile
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path


DEFAULT_SOURCE_ROOT = Path("/archive/drive")
DEFAULT_OUTPUT_ROOT = Path("/archive/drive/posters")

# Fotograma base para extraer y puntuar candidatos (16:9). El poster y el sprite
# se derivan escalando desde aqui, sin volver a leer el MP4.
CANDIDATE_WIDTH = 1280
CANDIDATE_HEIGHT = 720

# Escalera de posters servida con srcset: el navegador elige segun ancho de
# layout x densidad de pantalla. Ver docs/operations/vod-posters-plan.md.
POSTER_SIZES = ((320, 180), (640, 360), (960, 540), (1280, 720))
# Ancho del poster ".poster.webp" sin sufijo (alias y fallback simple).
POSTER_ALIAS_WIDTH = 960

# El sprite de preview se genera en un solo tamano: solo se usa en hover de
# escritorio sobre la card comoda (~530-620 px CSS de ancho).
SPRITE_FRAME_WIDTH = 960
SPRITE_FRAME_HEIGHT = 540

DEFAULT_FRAME_COUNT = 5
CANDIDATE_COUNT = 11
MIN_FILE_AGE_SECONDS = 60


@dataclass(frozen=True)
class VideoInfo:
    duration: float
    width: int
    height: int


@dataclass(frozen=True)
class Candidate:
    timestamp: float
    path: Path
    score: float
    valid: bool


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Genera poster y preview WebP para uno o más MP4 de Piero.")
    parser.add_argument("input", type=Path, help="Archivo MP4 o directorio a procesar")
    parser.add_argument("--source-root", type=Path, default=DEFAULT_SOURCE_ROOT)
    parser.add_argument("--output-root", type=Path, default=DEFAULT_OUTPUT_ROOT)
    parser.add_argument("--recursive", action="store_true", help="Busca MP4 recursivamente")
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--missing-only", action="store_true", help="Omite conjuntos completos")
    mode.add_argument("--force", action="store_true", help="Reemplaza recursos existentes")
    output = parser.add_mutually_exclusive_group()
    output.add_argument("--poster-only", action="store_true")
    output.add_argument("--preview-only", action="store_true")
    parser.add_argument("--poster-time", help="Instante HH:MM:SS, MM:SS o segundos para el poster")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--min-age-seconds", type=int, default=MIN_FILE_AGE_SECONDS)
    args = parser.parse_args(argv)

    if args.poster_time and args.preview_only:
        parser.error("--poster-time no puede combinarse con --preview-only")
    if args.min_age_seconds < 0:
        parser.error("--min-age-seconds no puede ser negativo")

    return args


def run(command: list[str], *, capture: bool = True) -> subprocess.CompletedProcess[str]:
    try:
        return subprocess.run(command, check=True, text=True, capture_output=capture)
    except subprocess.CalledProcessError as error:
        details = "\n".join((error.stderr or error.stdout or "").strip().splitlines()[-6:])
        message = f"Falló {Path(command[0]).name} con código {error.returncode}"
        if details:
            message = f"{message}:\n{details}"
        raise RuntimeError(message) from error


def ensure_tools() -> None:
    missing = [tool for tool in ("ffmpeg", "ffprobe") if shutil.which(tool) is None]
    if missing:
        raise RuntimeError(f"Faltan herramientas requeridas: {', '.join(missing)}")
    encoders = run(["ffmpeg", "-hide_banner", "-encoders"]).stdout
    if "libwebp" not in encoders:
        raise RuntimeError("FFmpeg no incluye el encoder libwebp requerido")


def resolved_within(path: Path, root: Path) -> tuple[Path, Path]:
    resolved_path = path.expanduser().resolve()
    resolved_root = root.expanduser().resolve()
    try:
        resolved_path.relative_to(resolved_root)
    except ValueError as error:
        raise ValueError(f"El input debe estar dentro de {resolved_root}") from error
    return resolved_path, resolved_root


def output_paths(video: Path, source_root: Path, output_root: Path) -> dict[str, Path]:
    relative = video.relative_to(source_root)
    base = output_root.resolve() / relative.parent / relative.stem
    paths = {
        "poster": base.with_name(f"{base.name}.poster.webp"),
        "preview": base.with_name(f"{base.name}.preview.webp"),
        "manifest": base.with_name(f"{base.name}.preview.json"),
        "lock": base.with_name(f".{base.name}.posters.lock"),
    }
    for width, _height in POSTER_SIZES:
        paths[f"poster_{width}"] = base.with_name(f"{base.name}.poster-{width}.webp")
    return paths


def discover_videos(input_path: Path, recursive: bool) -> list[Path]:
    if input_path.is_file():
        if input_path.suffix.lower() != ".mp4":
            raise ValueError("El archivo de entrada debe ser MP4")
        return [input_path]
    if not input_path.is_dir():
        raise ValueError(f"No existe el input: {input_path}")
    pattern = "**/*.mp4" if recursive else "*.mp4"
    videos = []
    for path in input_path.glob(pattern):
        relative_parts = path.relative_to(input_path).parts
        if not path.is_file() or any(part.startswith(".") for part in relative_parts):
            continue
        videos.append(path)
    return sorted(videos)


def parse_time(value: str) -> float:
    parts = value.split(":")
    try:
        numbers = [float(part) for part in parts]
    except ValueError as error:
        raise ValueError(f"Instante inválido: {value}") from error
    if len(numbers) == 1:
        seconds = numbers[0]
    elif len(numbers) == 2:
        seconds = numbers[0] * 60 + numbers[1]
    elif len(numbers) == 3:
        seconds = numbers[0] * 3600 + numbers[1] * 60 + numbers[2]
    else:
        raise ValueError(f"Instante inválido: {value}")
    if not math.isfinite(seconds) or seconds < 0:
        raise ValueError(f"Instante inválido: {value}")
    return seconds


def probe_video(video: Path) -> VideoInfo:
    result = run([
        "ffprobe", "-v", "error", "-select_streams", "v:0",
        "-show_entries", "stream=width,height:format=duration", "-of", "json", str(video),
    ])
    payload = json.loads(result.stdout)
    stream = (payload.get("streams") or [{}])[0]
    duration = float((payload.get("format") or {}).get("duration") or 0)
    width = int(stream.get("width") or 0)
    height = int(stream.get("height") or 0)
    if not math.isfinite(duration) or duration <= 0 or width <= 0 or height <= 0:
        raise ValueError("El MP4 no contiene duración o video válidos")
    return VideoInfo(duration=duration, width=width, height=height)


def candidate_times(duration: float) -> list[float]:
    return [duration * (0.10 + index * 0.80 / (CANDIDATE_COUNT - 1)) for index in range(CANDIDATE_COUNT)]


def parse_signalstats(output: str) -> dict[str, float]:
    stats: dict[str, float] = {}
    for key, value in re.findall(r"lavfi\.signalstats\.([A-Z]+)=([\d.]+)", output):
        stats[key] = float(value)
    return stats


def score_stats(stats: dict[str, float]) -> tuple[float, bool]:
    average = stats.get("YAVG", 0)
    low = stats.get("YLOW", average)
    high = stats.get("YHIGH", average)
    saturation = stats.get("SATAVG", 0)
    contrast = high - low
    valid = 24 <= average <= 232 and contrast >= 18
    score = contrast * 2.0 - abs(average - 118) * 0.7 + min(saturation, 110) * 0.12
    return score, valid


def extract_candidate(video: Path, timestamp: float, destination: Path) -> Candidate:
    filter_chain = (
        f"scale={CANDIDATE_WIDTH}:{CANDIDATE_HEIGHT}:force_original_aspect_ratio=decrease,"
        f"pad={CANDIDATE_WIDTH}:{CANDIDATE_HEIGHT}:(ow-iw)/2:(oh-ih)/2:black,"
        "signalstats,metadata=print"
    )
    result = run([
        "ffmpeg", "-hide_banner", "-loglevel", "info", "-ss", f"{timestamp:.3f}", "-i", str(video),
        "-frames:v", "1", "-an", "-vf", filter_chain, "-y", str(destination),
    ])
    stats = parse_signalstats(f"{result.stdout}\n{result.stderr}")
    score, valid = score_stats(stats)
    return Candidate(timestamp=timestamp, path=destination, score=score, valid=valid)


def select_preview_candidates(candidates: list[Candidate], count: int) -> list[Candidate]:
    available = [candidate for candidate in candidates if candidate.valid] or candidates
    if len(available) < count:
        raise ValueError(f"Solo se pudieron extraer {len(available)} fotogramas; se requieren {count}")
    if count == 1:
        return [available[len(available) // 2]]
    indexes = [round(index * (len(available) - 1) / (count - 1)) for index in range(count)]
    return [available[index] for index in indexes]


def encode_webp(
    source: Path,
    destination: Path,
    *,
    width: int | None = None,
    height: int | None = None,
    quality: int = 82,
) -> None:
    command = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-i", str(source), "-frames:v", "1"]
    if width and height:
        command += ["-vf", f"scale={width}:{height}:flags=lanczos"]
    command += [
        "-c:v", "libwebp", "-quality", str(quality), "-compression_level", "6",
        "-y", str(destination),
    ]
    run(command)


def encode_sprite(candidates: list[Candidate], destination: Path) -> None:
    command = ["ffmpeg", "-hide_banner", "-loglevel", "error"]
    for candidate in candidates:
        command.extend(["-i", str(candidate.path)])
    count = len(candidates)
    scaled = "".join(
        f"[{index}:v]scale={SPRITE_FRAME_WIDTH}:{SPRITE_FRAME_HEIGHT}:flags=lanczos[s{index}];"
        for index in range(count)
    )
    inputs = "".join(f"[s{index}]" for index in range(count))
    command.extend([
        "-filter_complex", f"{scaled}{inputs}hstack=inputs={count}[sprite]", "-map", "[sprite]",
        "-frames:v", "1", "-c:v", "libwebp", "-quality", "80", "-compression_level", "6",
        "-y", str(destination),
    ])
    run(command)


def atomic_replace(source: Path, destination: Path) -> None:
    if not source.is_file() or source.stat().st_size == 0:
        raise RuntimeError(f"Salida inválida: {source}")
    os.replace(source, destination)


def is_complete(paths: dict[str, Path], args: argparse.Namespace) -> bool:
    required = []
    if not args.preview_only:
        required.append(paths["poster"])
        required.extend(paths[f"poster_{width}"] for width, _height in POSTER_SIZES)
    if not args.poster_only:
        required.extend([paths["preview"], paths["manifest"]])
    return all(path.is_file() and path.stat().st_size > 0 for path in required)


def acquire_lock(lock_path: Path) -> int:
    try:
        return os.open(lock_path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o644)
    except FileExistsError:
        try:
            pid = int(lock_path.read_text(encoding="utf-8").strip())
            os.kill(pid, 0)
        except ProcessLookupError:
            lock_path.unlink(missing_ok=True)
            return os.open(lock_path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o644)
        except PermissionError as error:
            if error.errno != errno.EPERM:
                raise
        except (OSError, ValueError):
            age = datetime.now(timezone.utc).timestamp() - lock_path.stat().st_mtime
            if age >= 600:
                lock_path.unlink(missing_ok=True)
                return os.open(lock_path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o644)
        raise RuntimeError(f"Ya existe un procesamiento activo o lock no verificable: {lock_path}")


def process_video(video: Path, source_root: Path, output_root: Path, args: argparse.Namespace) -> str:
    paths = output_paths(video, source_root, output_root)
    if args.missing_only and is_complete(paths, args):
        print(f"OMIT {video}")
        return "omitted"
    if not args.force and is_complete(paths, args):
        print(f"OMIT {video}")
        return "omitted"
    if args.dry_run:
        print(f"PLAN {video}")
        keys = ["poster", *(f"poster_{width}" for width, _height in POSTER_SIZES), "preview", "manifest"]
        for key in keys:
            is_poster = key == "poster" or key.startswith("poster_")
            if (is_poster and args.preview_only) or (not is_poster and args.poster_only):
                continue
            print(f"  {key}: {paths[key]}")
        return "planned"

    age = datetime.now(timezone.utc).timestamp() - video.stat().st_mtime
    if age < args.min_age_seconds:
        raise RuntimeError(f"El archivo fue modificado hace {age:.0f}s; espera antes de procesarlo")

    paths["poster"].parent.mkdir(parents=True, exist_ok=True)
    lock_fd = acquire_lock(paths["lock"])

    try:
        os.write(lock_fd, f"{os.getpid()}\n".encode())
        os.close(lock_fd)
        info = probe_video(video)
        manual_time = parse_time(args.poster_time) if args.poster_time else None
        if manual_time is not None and manual_time >= info.duration:
            raise ValueError("--poster-time debe ser menor que la duración del video")

        # El prefijo no incluye el nombre del video: un "%" en el nombre haría que
        # el muxer image2 de FFmpeg interpretara la ruta como patrón printf.
        with tempfile.TemporaryDirectory(prefix=".vodposters-tmp-", dir=paths["poster"].parent) as temp_name:
            temp_dir = Path(temp_name)
            times = candidate_times(info.duration)
            if manual_time is not None:
                times.append(manual_time)
            candidates = [
                extract_candidate(video, timestamp, temp_dir / f"candidate-{index:02d}.png")
                for index, timestamp in enumerate(times)
            ]
            automatic = candidates[:CANDIDATE_COUNT]
            poster_candidate = candidates[-1] if manual_time is not None else max(
                (candidate for candidate in automatic if candidate.valid),
                key=lambda candidate: candidate.score,
                default=max(automatic, key=lambda candidate: candidate.score),
            )

            # Nombres temporales fijos y sin "%": solo el destino final (vía
            # os.replace) conserva el nombre real del video.
            temp_preview = temp_dir / "preview.webp"
            temp_manifest = temp_dir / "preview.json"
            temp_alias = temp_dir / "poster.webp"
            temp_posters = {width: temp_dir / f"poster-{width}.webp" for width, _h in POSTER_SIZES}

            poster_sources = []
            if not args.preview_only:
                for width, height in POSTER_SIZES:
                    encode_webp(poster_candidate.path, temp_posters[width], width=width, height=height)
                    poster_sources.append({
                        "width": width,
                        "height": height,
                        "file": paths[f"poster_{width}"].name,
                    })
                shutil.copyfile(temp_posters[POSTER_ALIAS_WIDTH], temp_alias)

            selected = []
            if not args.poster_only:
                selected = select_preview_candidates(automatic, DEFAULT_FRAME_COUNT)
                encode_sprite(selected, temp_preview)
                manifest = {
                    "version": 2,
                    "source": video.name,
                    "durationSeconds": round(info.duration, 3),
                    "posterTimeSeconds": round(poster_candidate.timestamp, 3),
                    "poster": {
                        "default": paths["poster"].name,
                        "sources": poster_sources or [
                            {"width": width, "height": height, "file": paths[f"poster_{width}"].name}
                            for width, height in POSTER_SIZES
                        ],
                    },
                    "sprite": {
                        "file": paths["preview"].name,
                        "frameCount": len(selected),
                        "frameWidth": SPRITE_FRAME_WIDTH,
                        "frameHeight": SPRITE_FRAME_HEIGHT,
                        "columns": len(selected),
                        "rows": 1,
                        "timesSeconds": [round(candidate.timestamp, 3) for candidate in selected],
                    },
                    "generatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
                }
                temp_manifest.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

            if not args.preview_only:
                for width, _height in POSTER_SIZES:
                    atomic_replace(temp_posters[width], paths[f"poster_{width}"])
                atomic_replace(temp_alias, paths["poster"])
            if not args.poster_only:
                atomic_replace(temp_preview, paths["preview"])
                atomic_replace(temp_manifest, paths["manifest"])

        print(f"OK {video}")
        return "processed"
    finally:
        paths["lock"].unlink(missing_ok=True)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    try:
        ensure_tools()
        input_path, source_root = resolved_within(args.input, args.source_root)
        output_root = args.output_root.expanduser().resolve()
        videos = discover_videos(input_path, args.recursive)
        if not videos:
            print("No se encontraron archivos MP4.")
            return 0

        counts = {"processed": 0, "omitted": 0, "planned": 0, "errors": 0}
        for position, video in enumerate(videos, start=1):
            print(f"[{position}/{len(videos)}] {video}")
            try:
                result = process_video(video, source_root, output_root, args)
                counts[result] += 1
            except (OSError, ValueError, RuntimeError, json.JSONDecodeError) as error:
                counts["errors"] += 1
                print(f"ERROR {video}: {error}", file=sys.stderr)

        print(
            "Resumen: "
            f"procesados={counts['processed']} "
            f"omitidos={counts['omitted']} "
            f"planificados={counts['planned']} "
            f"errores={counts['errors']}"
        )
        return 1 if counts["errors"] else 0
    except (OSError, ValueError, RuntimeError) as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
