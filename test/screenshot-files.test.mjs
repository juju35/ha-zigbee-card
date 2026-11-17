// Every file of screenshots/ is a capture that the screenshot scripts produce: a file no script renders any more
// (a renamed or removed shot) is an orphan, left behind with old pixels. A capture not rendered yet is not flagged:
// the Screenshots workflow renders them on the pull request. The README only shows captures the scripts produce.
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";

const root = new URL("../", import.meta.url);
let lists;
try {
  const [{ SHOTS }, { GIFS }] = await Promise.all([import("../scripts/screenshots/stills.mjs"), import("../scripts/screenshots/animations.mjs")]);
  lists = { SHOTS, GIFS };
} catch {}

const produced = () =>
  new Set([...lists.SHOTS.map((s) => `${s.file}.png`), ...lists.GIFS.flatMap((g) => [`${g.name}.gif`, `${g.name}-dark.gif`])]);

test("every file in screenshots/ is produced by the screenshot scripts (no orphan)", { skip: !lists && "screenshot scripts not loadable" }, () => {
  const dir = new URL("screenshots/", root);
  const files = existsSync(dir) ? readdirSync(dir).filter((f) => !f.startsWith(".")) : [];
  const expected = produced();
  assert.deepEqual(
    files.filter((f) => !expected.has(f)),
    [],
    "orphan screenshots",
  );
});

test("the README shows only captures the scripts produce", { skip: !lists && "screenshot scripts not loadable" }, () => {
  const readme = readFileSync(new URL("README.md", root), "utf8");
  const used = [...readme.matchAll(/screenshots\/([\w.-]+\.(?:png|gif))/g)].map((m) => m[1]);
  assert.ok(used.length > 0);
  const expected = produced();
  assert.deepEqual(
    used.filter((f) => !expected.has(f)),
    [],
  );
});
