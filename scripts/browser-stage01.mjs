import { chromium } from "../.runtime/stage00/tools/qa/node_modules/playwright/index.mjs";
import fs from "node:fs";
import path from "node:path";
const root = path.resolve(import.meta.dirname, "..");
const base = JSON.parse(
  fs.readFileSync(path.join(root, ".runtime/stage01/preview.json"))
).url;
const run = "UI-" + new Date().toISOString().replace(/[:.]/g, "-");
const out = path.join(root, ".runtime/stage01", run);
fs.mkdirSync(out, { recursive: true });
const context = await chromium.launchPersistentContext(
  path.join(out, "profile"),
  { channel: "msedge", headless: true, viewport: { width: 1366, height: 768 } }
);
const results = [],
  errors = [];
context.on("page", (p) =>
  p.on("pageerror", (e) => errors.push({ url: p.url(), message: e.message }))
);
await context.route("**/*", (route) =>
  /^(data:|blob:)/.test(route.request().url()) ||
  route
    .request()
    .url()
    .startsWith(base + "/")
    ? route.continue()
    : route.abort()
);
for (const [app, route] of [
  ["web", "/property/bills"],
  ["resident", "/pages/stage01/fees/index"],
  ["staff", "/pages/stage01/tasks/index"],
]) {
  const p = await context.newPage();
  if (app !== "web") await p.setViewportSize({ width: 390, height: 844 });
  await p.goto(base + "/" + app + "/?session=stage01-" + run + "#" + route);
  await p.waitForTimeout(1300);
  const text = await p.locator("body").innerText();
  const file = path.join(out, app + ".png");
  await p.screenshot({ path: file, fullPage: true });
  results.push({
    app,
    route,
    text,
    screenshot: path.relative(root, file).replaceAll("\\", "/"),
    overflow: await p.evaluate(
      () => document.documentElement.scrollWidth > innerWidth
    ),
  });
  console.log(app + ": " + text.slice(0, 1500));
}
fs.writeFileSync(
  path.join(root, "docs/stages/stage-01/evidence/browser-smoke.json"),
  JSON.stringify({ run, base, results, errors }, null, 2) + "\n"
);
await context.close();
process.exitCode = errors.length ? 1 : 0;
