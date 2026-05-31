const SPACE_DRUM_SECOND_PAGE_THUMBNAIL_TITLES = new Set([
  "Ciclo 1.1",
  "Ciclo 2",
  "Ciclo 3",
  "Ciclo 4",
  "Ciclo 5",
  "Cycle 1",
  "Cycle 1.1",
]);

function toString(value) {
  return String(value || "").trim();
}

export function getSpaceDrumThumbnailPage(chapter) {
  const pages = Array.isArray(chapter?.pages) ? chapter.pages : [];
  const title = toString(chapter?.title);

  if (SPACE_DRUM_SECOND_PAGE_THUMBNAIL_TITLES.has(title) && pages[1]) {
    return pages[1];
  }

  return pages[0] || pages[1] || null;
}
