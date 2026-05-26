import "dotenv/config";

import { importRemoteSpaceDrum } from "../lib/spacedrumRemoteImport.js";

async function main() {
  const shouldWriteJson = !process.argv.includes("--no-write-json");
  const result = await importRemoteSpaceDrum({ writeJson: shouldWriteJson });

  console.log(`Imported remote SpaceDrum with ${result.summary.chapters} chapters and ${result.summary.pages} pages.`);
  for (const item of result.summary.byLanguage) {
    console.log(`- ${item.language}: ${item.chapters} chapters, ${item.pages} pages.`);
  }
  if (result.localDataFile) {
    console.log(`Wrote ${result.localDataFile} as local fallback.`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
