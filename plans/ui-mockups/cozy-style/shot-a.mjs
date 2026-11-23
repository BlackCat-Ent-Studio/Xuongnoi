import { chromium } from "file:///C:/Users/trong/AppData/Local/Temp/claude/D--workspace-GameBuilder/091c5a2d-ceff-4dfe-a2af-61a656b30d1c/scratchpad/smoke/node_modules/playwright/index.mjs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const dir = path.dirname(fileURLToPath(import.meta.url));
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 940, height: 1300 } });
const errs = [];
p.on("console", m => m.type() === "error" && errs.push(m.text()));
p.on("pageerror", e => errs.push(String(e)));
await p.goto(pathToFileURL(path.join(dir, "style-a-workshop.html")).href);
await p.waitForTimeout(1500);
for (const t of ["title", "map", "level"]) {
  await p.evaluate(x => document.querySelector(`.tab[data-tab=${x}]`).click(), t);
  await p.waitForTimeout(600);
  await (await p.$("#main")).screenshot({ path: path.join(dir, `shot-a-${t}.png`) });
}
await p.screenshot({ path: path.join(dir, "shot-a-full.png"), fullPage: true });
console.log("errors:", JSON.stringify(errs));
await b.close();
