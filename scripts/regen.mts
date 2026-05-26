import { parseArchiFormat } from "../src/archi-parser.js";
import { renderViewToSvg } from "../src/renderer.js";
import { readFileSync, writeFileSync, mkdirSync } from "fs";

const xml = readFileSync("data/archisurance.archimate", "utf-8");
const model = parseArchiFormat(xml);

mkdirSync("exports/views", { recursive: true });

const target = process.argv[2];
if (target === "--all") {
  for (const view of model.views) {
    const fname = view.name.replace(/[^A-Za-z0-9._-]/g, "_") + ".svg";
    writeFileSync(`exports/views/${fname}`, renderViewToSvg(view, model));
  }
  console.log("wrote", model.views.length, "views");
} else {
  const view = model.views.find(v => v.name.includes(target!));
  if (!view) { console.error("not found:", target); process.exit(1); }
  const svg = renderViewToSvg(view, model);
  const fname = view.name.replace(/[^A-Za-z0-9._-]/g, "_") + ".svg";
  writeFileSync(`exports/views/${fname}`, svg);
  console.log("wrote", `exports/views/${fname}`, svg.length, "bytes");
}
