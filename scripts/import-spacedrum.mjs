import "dotenv/config";

import { readJsonSpaceDrumLibrary } from "../lib/spacedrum.js";
import { writeSpaceDrum } from "../lib/repositories/spaceDrumRepository.js";

async function main() {
  const data = await readJsonSpaceDrumLibrary();
  const saved = await writeSpaceDrum(data);
  const chapters = Object.values(saved.languages || {}).reduce((sum, language) => sum + language.chapters.length, 0);
  const pages = Object.values(saved.languages || {}).reduce(
    (sum, language) => sum + language.chapters.reduce((pageSum, chapter) => pageSum + chapter.pages.length, 0),
    0,
  );

  console.log(`Imported SpaceDrum with ${chapters} chapters and ${pages} pages.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
