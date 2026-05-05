import fs from "node:fs/promises";
import path from "node:path";

import {
  PresentationFile,
} from "file:///C:/Users/hyper/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs";

const inputPath = "C:/Users/hyper/Downloads/Sprint 3.pptx";
const outDir = path.join(process.cwd(), "scratch", "presentation", "teammate-previews");

await fs.mkdir(outDir, { recursive: true });

const bytes = new Uint8Array(await fs.readFile(inputPath));
const presentation = await PresentationFile.importPptx(bytes);

for (let i = 0; i < presentation.slides.items.length; i += 1) {
  const png = await presentation.slides.items[i].export();
  const filePath = path.join(outDir, `slide-${String(i + 1).padStart(2, "0")}.png`);
  await fs.writeFile(filePath, new Uint8Array(await png.arrayBuffer()));
}

console.log(JSON.stringify({
  inputPath,
  outDir,
  slideCount: presentation.slides.items.length,
}, null, 2));
