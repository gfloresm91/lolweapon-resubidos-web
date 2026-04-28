"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

function getOkruEmbedUrl(href) {
  try {
    const url = new URL(href);

    if (!url.hostname.includes("ok.ru")) {
      return "";
    }

    const videoId = url.pathname.match(/\/video(?:embed)?\/(\d+)/)?.[1];

    if (!videoId) {
      return "";
    }

    return `https://ok.ru/videoembed/${videoId}`;
  } catch {
    return "";
  }
}

function clampPartIndex(index, total) {
  return Math.min(Math.max(index, 0), Math.max(total - 1, 0));
}

function isTypingTarget(target) {
  const tagName = target?.tagName?.toLowerCase();
  return tagName === "input" || tagName === "textarea" || tagName === "select" || target?.isContentEditable;
}

function buildSafeFilename(title, partNumber) {
  const base = String(title || "resubido")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64)
    .toLowerCase();

  return `${base || "resubido"}-parte-${partNumber}.mp4`;
}

export default function OkruWatchPlayer({ links, liveId, title, telegramFallbackHref }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const storageKey = `kala_okru_part_${liveId || pathname}`;
  const playableLinks = useMemo(
    () =>
      (Array.isArray(links) ? links : [])
        .map((href, index) => ({
          href,
          index,
          embedUrl: getOkruEmbedUrl(href),
        }))
        .filter((item) => item.embedUrl),
    [links],
  );
  const [activeIndex, setActiveIndex] = useState(() => {
    const requestedPart = Number(searchParams.get("parte"));
    return Number.isFinite(requestedPart) && requestedPart > 0 ? requestedPart - 1 : 0;
  });
  const [isTheaterMode, setIsTheaterMode] = useState(false);
  const [isPlayerLoading, setIsPlayerLoading] = useState(false);
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
  const [copyPageLabel, setCopyPageLabel] = useState("Copiar pagina");
  const [copyPartLabel, setCopyPartLabel] = useState("Copiar parte");
  const [copyCommandLabel, setCopyCommandLabel] = useState("Copiar comando");
  const [copyOkruLabel, setCopyOkruLabel] = useState("Copiar URL OK.RU");
  const activeLink = playableLinks[activeIndex] || null;
  const activePartLabel = activeLink ? `Parte ${activeIndex + 1}` : "";
  const activePartSummary = activeLink ? `${activePartLabel} de ${playableLinks.length}` : "Sin parte seleccionada";
  const streamlinkCommand = activeLink
    ? `streamlink "${activeLink.href}" best -o "${buildSafeFilename(title, activeIndex + 1)}"`
    : "";

  useEffect(() => {
    function handleKeyDown(event) {
      if (isTypingTarget(event.target)) {
        return;
      }

      if (isDownloadModalOpen) {
        if (event.key === "Escape") {
          event.preventDefault();
          setIsDownloadModalOpen(false);
        }
        return;
      }

      if (event.key === "Escape") {
        setIsTheaterMode(false);
      } else if (event.key.toLowerCase() === "t") {
        event.preventDefault();
        setIsTheaterMode((current) => !current);
      } else if (event.key === "ArrowLeft" && playableLinks.length) {
        event.preventDefault();
        updateActivePart(clampPartIndex(activeIndex - 1, playableLinks.length));
      } else if (event.key === "ArrowRight" && playableLinks.length) {
        event.preventDefault();
        updateActivePart(clampPartIndex(activeIndex + 1, playableLinks.length));
      } else if (event.key.toLowerCase() === "c") {
        event.preventDefault();
        copyPartUrl();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeIndex, playableLinks.length, isTheaterMode, isDownloadModalOpen, searchParams]);

  useEffect(() => {
    const requestedPart = Number(searchParams.get("parte"));
    let savedPart = 0;

    try {
      savedPart = Number(window.localStorage.getItem(storageKey));
    } catch {
      savedPart = 0;
    }
    const hasRequestedPart = Number.isFinite(requestedPart) && requestedPart > 0;
    const hasSavedPart = Number.isFinite(savedPart) && savedPart > 0;
    const nextIndex = hasRequestedPart ? requestedPart - 1 : hasSavedPart ? savedPart - 1 : 0;
    const clampedIndex = clampPartIndex(nextIndex, playableLinks.length);

    setActiveIndex(clampedIndex);
    setIsPlayerLoading(Boolean(playableLinks[clampedIndex]));
  }, [playableLinks, searchParams, storageKey]);

  function updateActivePart(index) {
    const params = new URLSearchParams(searchParams.toString());
    const clampedIndex = clampPartIndex(index, playableLinks.length);

    params.set("parte", String(clampedIndex + 1));
    setActiveIndex(clampedIndex);
    setIsPlayerLoading(Boolean(playableLinks[clampedIndex]));
    try {
      window.localStorage.setItem(storageKey, String(clampedIndex + 1));
    } catch {
      // Some browser privacy modes can block localStorage.
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function buildPartUrl() {
    const url = new URL(window.location.href);
    url.searchParams.set("parte", String(activeIndex + 1));
    return url.toString();
  }

  async function copyText(value, setLabel, resetLabel) {
    try {
      await navigator.clipboard.writeText(value);
      setLabel("Copiado");
      window.setTimeout(() => setLabel(resetLabel), 1600);
    } catch {
      setLabel("No se pudo copiar");
      window.setTimeout(() => setLabel(resetLabel), 1600);
    }
  }

  function copyPageUrl() {
    const url = new URL(window.location.href);
    url.searchParams.delete("parte");
    copyText(url.toString(), setCopyPageLabel, "Copiar pagina");
  }

  function copyPartUrl() {
    copyText(buildPartUrl(), setCopyPartLabel, "Copiar parte");
  }

  function copyStreamlinkCommand() {
    if (!streamlinkCommand) {
      return;
    }

    copyText(streamlinkCommand, setCopyCommandLabel, "Copiar comando");
  }

  function copyOkruUrl() {
    if (!activeLink) {
      return;
    }

    copyText(activeLink.href, setCopyOkruLabel, "Copiar URL OK.RU");
  }

  return (
    <div className={`watch-player-stage ${isTheaterMode ? "is-theater" : ""}`}>
      {isTheaterMode ? (
        <button type="button" className="watch-theater-exit" onClick={() => setIsTheaterMode(false)}>
          Salir modo teatro
        </button>
      ) : null}

      <div className="watch-mini-header">
        <div>
          <span>{activePartSummary}</span>
          <strong>{title || "Resubido"}</strong>
        </div>
        <button type="button" className="watch-tool-button" onClick={() => setIsTheaterMode((current) => !current)}>
          {isTheaterMode ? "Salir modo teatro" : "Modo teatro"}
        </button>
      </div>

      <div className="watch-player-topline">
        <span>{activeLink ? `Reproduciendo ${activePartSummary}` : "Sin parte seleccionada"}</span>
        <div className="watch-player-actions">
          {activeLink ? (
            <a href={activeLink.href} target="_blank" rel="noreferrer" className="watch-tool-button">
              Abrir OK.RU
            </a>
          ) : null}
          {activeLink ? (
            <button type="button" className="watch-tool-button" onClick={() => setIsDownloadModalOpen(true)}>
              Descargar con Streamlink
            </button>
          ) : null}
          <button type="button" className="watch-tool-button" onClick={copyPageUrl}>
            {copyPageLabel}
          </button>
          <button type="button" className="watch-tool-button" onClick={copyPartUrl}>
            {copyPartLabel}
          </button>
        </div>
      </div>

      {activeLink ? (
        <div className="watch-player-wrap">
          <iframe
            key={activeLink.embedUrl}
            src={activeLink.embedUrl}
            title={`Player OK.RU - ${title || "Resubido"} - ${activePartLabel}`}
            allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
            allowFullScreen
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
            onLoad={() => setIsPlayerLoading(false)}
          />
          {isPlayerLoading ? <div className="watch-loading-overlay">Cargando parte...</div> : null}
        </div>
      ) : (
        <div className="watch-player-placeholder is-telegram-fallback">
          <span className="watch-placeholder-label">Player no disponible</span>
          <p>Este resubido no tiene un link OK.RU reproducible.</p>
          {telegramFallbackHref ? (
            <a href={telegramFallbackHref} target="_blank" rel="noreferrer" className="platform-btn platform-telegram">
              Ver en Telegram
            </a>
          ) : null}
        </div>
      )}

      <div className="watch-link-group">
        <h3>{activeLink ? `OK.RU · ${activePartSummary}` : "OK.RU"}</h3>
        {playableLinks.length ? (
          <ol className="detail-link-list">
            {playableLinks.map((item, index) => (
              <li key={`${item.href}-${index}`}>
                <button
                  type="button"
                  className={`platform-btn platform-okru ${index === activeIndex ? "is-active" : ""}`}
                  onClick={() => updateActivePart(index)}
                >
                  Parte {index + 1} de {playableLinks.length}
                </button>
              </li>
            ))}
          </ol>
        ) : (
          <p className="detail-empty">Sin links cargados.</p>
        )}
      </div>

      {isDownloadModalOpen && activeLink ? (
        <div className="modal-backdrop download-modal-backdrop" onClick={() => setIsDownloadModalOpen(false)}>
          <div
            className="modal-content download-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="download-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="download-modal-header">
              <div>
                <span className="detail-section-kicker">Descarga local</span>
                <h2 className="modal-title" id="download-modal-title">
                  Descargar con Streamlink
                </h2>
              </div>
              <button
                type="button"
                className="download-modal-close"
                aria-label="Cerrar modal de descarga"
                onClick={() => setIsDownloadModalOpen(false)}
              >
                ×
              </button>
            </div>

            <p className="download-modal-note">
              La descarga se realiza en tu computador. Esta web no descarga ni guarda el video, solo prepara el
              comando para la parte seleccionada.
            </p>

            <div className="download-command-card download-step">
              <span className="download-step-label">Paso 3</span>
              <h3>Copiar y ejecutar el comando</h3>
              <p>
                El archivo se guardará en la carpeta actual de la terminal. Para elegir otra carpeta, cambia lo que va
                después de <code>-o</code>.
              </p>
              <span>Comando para {activePartSummary}</span>
              <code className="download-command-code">{streamlinkCommand}</code>
              <div className="download-command-actions">
                <button type="button" className="btn-modal btn-modal-primary" onClick={copyStreamlinkCommand}>
                  {copyCommandLabel}
                </button>
                <button type="button" className="btn-modal btn-modal-secondary" onClick={copyOkruUrl}>
                  {copyOkruLabel}
                </button>
              </div>
              <div className="download-path-examples">
                <span>Ejemplos para guardar en Descargas</span>
                <code>macOS/Linux: -o "~/Downloads/{buildSafeFilename(title, activeIndex + 1)}"</code>
                <code>Windows: -o "%USERPROFILE%\Downloads\{buildSafeFilename(title, activeIndex + 1)}"</code>
              </div>
            </div>

            <div className="download-help">
              <details open>
                <summary>Paso 1: Instalar Streamlink</summary>
                <div className="download-help-body">
                  <p>
                    Windows: descarga el instalador oficial desde la pagina de releases. En macOS se recomienda
                    Homebrew y luego ejecutar <code>brew install streamlink</code>. En Linux revisa las opciones
                    oficiales para tu distribucion.
                  </p>
                  <a href="https://streamlink.github.io/install.html" target="_blank" rel="noreferrer">
                    Guia oficial de Streamlink
                  </a>
                  <a href="https://github.com/streamlink/streamlink/releases" target="_blank" rel="noreferrer">
                    Releases de Streamlink
                  </a>
                  <a href="https://brew.sh/" target="_blank" rel="noreferrer">
                    Homebrew para macOS
                  </a>
                </div>
              </details>

              <details>
                <summary>Paso 2: Instalar FFmpeg si hace falta</summary>
                <div className="download-help-body">
                  <p>
                    Streamlink puede necesitar FFmpeg para guardar o unir correctamente algunos streams. En Windows
                    puedes usar <code>winget install Gyan.FFmpeg</code>. En macOS puedes usar{" "}
                    <code>brew install ffmpeg</code>. En Linux usa el gestor de paquetes de tu distro.
                  </p>
                  <a href="https://ffmpeg.org/download.html" target="_blank" rel="noreferrer">
                    Descargas oficiales de FFmpeg
                  </a>
                </div>
              </details>

              <details>
                <summary>Verificar y ejecutar en terminal</summary>
                <div className="download-help-body">
                  <p>
                    Abre PowerShell o CMD en Windows, Terminal en macOS o Linux, pega el comando y presiona Enter.
                    Puedes verificar la instalacion con <code>streamlink --version</code> y{" "}
                    <code>ffmpeg -version</code>.
                  </p>
                  <p>
                    Si quieres guardar en una carpeta concreta, cambia el valor despues de <code>-o</code> por una
                    ruta local de tu equipo.
                  </p>
                </div>
              </details>
            </div>

            <div className="modal-actions">
              <button type="button" className="btn-modal btn-modal-secondary" onClick={() => setIsDownloadModalOpen(false)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
