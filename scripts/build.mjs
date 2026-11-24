// Bundles src/ into the single Marketplace file dist/zigbee-card.js, stamping the version.
// Usage: node scripts/build.mjs  (dist/ is not committed: CI and the release workflow build it)
// The texts (strings.js) come first, then the cards, all in one block so that nothing leaks into the page.
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { splitDist } from "./i18n-split.mjs";
import { sourceOf } from "./bundle.mjs";

export const SOURCES = ["strings", "zigbee-card"];
const root = fileURLToPath(new URL("..", import.meta.url));
const pkg = JSON.parse(readFileSync(`${root}package.json`, "utf8"));
const src = (name) => sourceOf(name).replaceAll("__VERSION__", pkg.version);

const out = [`/*! ha-zigbee-card v${pkg.version} — https://github.com/juju35/ha-zigbee-card */`, "{", ...SOURCES.map(src), "}", ""].join("\n");

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  mkdirSync(`${root}dist`, { recursive: true });
  writeFileSync(`${root}dist/zigbee-card.js`, out);
  console.log(`Built dist/zigbee-card.js (${(out.length / 1024).toFixed(1)} KB)`);
  // Translations: English stays in the bundle, each other language goes to dist/zigbee-card.i18n.<lang>.js,
  // fetched when a card needs it (scripts/i18n-split.mjs).
  splitDist(`${root}dist`, "zigbee-card.js", { version: pkg.version });
}
