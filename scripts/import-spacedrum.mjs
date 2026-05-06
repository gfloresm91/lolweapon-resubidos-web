import "dotenv/config";

import { readJsonSpaceDrum } from "../lib/spacedrum.js";
import { writeSpaceDrum } from "../lib/repositories/spaceDrumRepository.js";

async function main() {
  const data = await readJsonSpaceDrum();
  const saved = await writeSpaceDrum(data);

  console.log(`Imported SpaceDrum with ${saved.chapters.length} chapters and ${saved.chapters.reduce((sum, chapter) => sum + chapter.pages.length, 0)} pages.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
