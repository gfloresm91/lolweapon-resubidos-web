import importlib.util
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


SCRIPT = Path(__file__).resolve().parents[1] / "generate-vod-posters.py"
SPEC = importlib.util.spec_from_file_location("generate_vod_posters", SCRIPT)
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


class GenerateVodPostersTest(unittest.TestCase):
    def test_output_paths_preserve_relative_hierarchy_and_suffix(self):
        with tempfile.TemporaryDirectory() as root_name, tempfile.TemporaryDirectory() as output_name:
            root = Path(root_name).resolve()
            output = Path(output_name).resolve()
            video = root / "2026" / "08 - AGOSTO" / "prueba_vk (2-2).mp4"
            expected = output / "2026" / "08 - AGOSTO"
            paths = MODULE.output_paths(video, root, output)

            self.assertEqual(paths["poster"], expected / "prueba_vk (2-2).poster.webp")
            self.assertEqual(paths["preview"], expected / "prueba_vk (2-2).preview.webp")
            self.assertEqual(paths["manifest"], expected / "prueba_vk (2-2).preview.json")

    def test_output_paths_include_poster_size_ladder(self):
        with tempfile.TemporaryDirectory() as root_name, tempfile.TemporaryDirectory() as output_name:
            root = Path(root_name).resolve()
            output = Path(output_name).resolve()
            video = root / "2026" / "08 - AGOSTO" / "prueba_vk (2-2).mp4"
            expected = output / "2026" / "08 - AGOSTO"
            paths = MODULE.output_paths(video, root, output)

            self.assertIn((960, 540), MODULE.POSTER_SIZES)
            for width, _height in MODULE.POSTER_SIZES:
                self.assertEqual(
                    paths[f"poster_{width}"],
                    expected / f"prueba_vk (2-2).poster-{width}.webp",
                )

    def test_parse_time(self):
        self.assertEqual(MODULE.parse_time("75"), 75)
        self.assertEqual(MODULE.parse_time("01:15"), 75)
        self.assertEqual(MODULE.parse_time("01:02:03"), 3723)

    def test_candidate_times_avoid_video_edges(self):
        times = MODULE.candidate_times(1000)
        self.assertEqual(len(times), MODULE.CANDIDATE_COUNT)
        self.assertAlmostEqual(times[0], 100)
        self.assertAlmostEqual(times[-1], 900)

    def test_candidate_preserves_non_widescreen_frame(self):
        completed = MODULE.subprocess.CompletedProcess([], 0, stdout="", stderr="")

        with patch.object(MODULE, "run", return_value=completed) as mocked_run:
            MODULE.extract_candidate(Path("vertical.mp4"), 10, Path("candidate.png"))

        command = mocked_run.call_args.args[0]
        filter_chain = command[command.index("-vf") + 1]
        self.assertIn("force_original_aspect_ratio=decrease", filter_chain)
        self.assertIn("pad=1280:720", filter_chain)
        self.assertNotIn("crop=", filter_chain)

    def test_discovery_ignores_hidden_partial_directories(self):
        with tempfile.TemporaryDirectory() as root_name:
            root = Path(root_name)
            visible = root / "2026" / "video.mp4"
            partial = root / "2026" / ".rsync-partial" / "video.mp4"
            visible.parent.mkdir(parents=True)
            partial.parent.mkdir(parents=True)
            visible.touch()
            partial.touch()

            self.assertEqual(MODULE.discover_videos(root, recursive=True), [visible])


if __name__ == "__main__":
    unittest.main()
