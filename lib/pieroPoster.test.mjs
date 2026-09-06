import assert from "node:assert/strict";
import test from "node:test";

import {
  getLivePosterResources,
  getPieroPosterResources,
  PIERO_POSTER_WIDTHS,
} from "./pieroPoster.js";

test("derives poster resources while preserving encoded paths and suffixes", () => {
  const base = "https://drive.kala-vods.com/posters/2026/08%20-%20AGOSTO/video%20_vk%20(2-2)";
  assert.deepEqual(
    getPieroPosterResources("https://drive.kala-vods.com/2026/08%20-%20AGOSTO/video%20_vk%20(2-2).mp4"),
    {
      posterUrl: `${base}.poster.webp`,
      posterSrcset: [
        `${base}.poster-320.webp 320w`,
        `${base}.poster-640.webp 640w`,
        `${base}.poster-960.webp 960w`,
        `${base}.poster-1280.webp 1280w`,
      ].join(", "),
      posterSources: [
        { width: 320, url: `${base}.poster-320.webp` },
        { width: 640, url: `${base}.poster-640.webp` },
        { width: 960, url: `${base}.poster-960.webp` },
        { width: 1280, url: `${base}.poster-1280.webp` },
      ],
      previewUrl: `${base}.preview.webp`,
      manifestUrl: `${base}.preview.json`,
    },
  );
});

test("poster ladder matches the documented widths", () => {
  assert.deepEqual(PIERO_POSTER_WIDTHS, [320, 640, 960, 1280]);
});

test("rejects unsupported hosts and non-MP4 resources", () => {
  assert.equal(getPieroPosterResources("https://example.com/2026/video.mp4"), null);
  assert.equal(getPieroPosterResources("https://drive.kala-vods.com/2026/video.m3u8"), null);
  assert.equal(getPieroPosterResources("not-a-url"), null);
});

test("uses the first supported Piero link", () => {
  assert.equal(
    getLivePosterResources({ links: { piero: ["invalid", "https://drive.kala-vods.com/2026/video.mp4"] } })?.posterUrl,
    "https://drive.kala-vods.com/posters/2026/video.poster.webp",
  );
});
