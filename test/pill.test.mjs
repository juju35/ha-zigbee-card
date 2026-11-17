// Browser test (Chromium through Playwright) of the status pill's place, in en, fr, de, hu, el and ru, from 190 to
// 500 px, on the full card (banner and classic header) and the mini card (compact, unfolded and classic): on the
// title row only with the whole title beside it; else on its own line under the statistics, its label whole; or its
// dot alone (always at 190 px). Nothing below the top of the banner's strip or out of the banner.
// Skipped when Playwright or Chromium is not installed, except in CI, where it must run.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, before, test } from "node:test";
import { mockHass, NOW } from "../scripts/screenshots/mock.mjs";

const read = (name) => readFileSync(new URL(`../src/${name}.js`, import.meta.url), "utf8");
const src = `{\n${read("strings")}\n${read("zigbee-card")}\n}`;
const HA_CARD = `customElements.define("ha-card", class extends HTMLElement { constructor() { super();
  this.attachShadow({ mode: "open" }).innerHTML = "<style>:host{display:block;overflow:hidden;background:var(--card-background-color);color:var(--primary-text-color)}</style><slot></slot>"; } });
customElements.define("ha-icon", class extends HTMLElement { connectedCallback() { if (!this.shadowRoot) this.attachShadow({ mode: "open" }).innerHTML =
  "<style>:host{display:inline-flex}</style><span style='display:block;width:var(--mdc-icon-size,24px);height:var(--mdc-icon-size,24px)'></span>"; } });`;

let browser;
let skip = false;
before(async () => {
  try {
    const { chromium } = await import("playwright");
    browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  } catch (err) {
    if (process.env.CI) throw err;
    skip = `Chromium not available: ${err.message.split("\n")[0]}`;
  }
});
after(() => browser?.close());


// Each case: the card mounted in a box of its width, then what the pill rule needs measured.
const measure = async (cases) => {
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.clock.setFixedTime(new Date(NOW));
  await page.setContent("<!doctype html><body style='margin:0;font-family:Roboto,Arial,sans-serif'></body>");
  await page.addScriptTag({ content: HA_CARD });
  await page.addScriptTag({ content: src });
  const { callWS, ...hass } = mockHass();
  const out = await page.evaluate(
    async ({ cases, hass }) => {
      const frames = (n) =>
        new Promise((r) => {
          const step = () => (n-- > 0 ? requestAnimationFrame(step) : r());
          step();
        });
      const results = [];
      const zha = hass.__zha;
      const ws = async (m) => (m.type === "zha/devices" ? zha.devices : zha.settings);
      for (const c of cases) {
        const box = document.createElement("div");
        box.style.width = `${c.width}px`;
        document.body.appendChild(box);
        const el = document.createElement(c.type);
        el.setConfig({ type: `custom:${c.type}`, language: c.lang, ...c.config });
        el.hass = { ...hass, callWS: ws, themes: { darkMode: false } };
        box.appendChild(el);
        await frames(2);
        const sr = el.shadowRoot;
        if (c.zoom) sr.querySelector(".zoom")?.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true, detail: 1 }));
        await frames(3);
        const res = [];
        const pill = sr.querySelector(".hpill");
        if (!pill) {
          results.push(["no pill"]);
          box.remove();
          continue;
        }
        const txt = pill.querySelector(".txt");
        const dotOnly = txt.getBoundingClientRect().width <= 1;
        if (c.width <= 200 && !dotOnly) res.push("label shown");
        if (!dotOnly && (txt.scrollWidth > txt.clientWidth + 0.5 || !txt.clientWidth)) res.push(`label "${txt.textContent}" cut`);
        const name = sr.querySelector(".name, .mhd .title");
        const nb = name.getBoundingClientRect();
        const pb = pill.getBoundingClientRect();
        const onRow = Math.abs(pb.top + pb.height / 2 - (nb.top + nb.height / 2)) < 3;
        if (onRow && !dotOnly && name.scrollWidth > name.clientWidth + 0.5) res.push("title cut beside the pill");
        if (!onRow && dotOnly) res.push("dot alone off the title row");
        if (!onRow && pb.top < nb.bottom - 0.5) res.push("pill over the title");
        const banner = sr.querySelector(".banner");
        if (banner) {
          const bb = banner.getBoundingClientRect();
          const floor = banner.querySelector(".strip").getBoundingClientRect().top;
          for (const [what, e] of [["title", name], ["pill", pill], ["statistics", banner.querySelector(".stats")]]) {
            const b = e?.getBoundingClientRect();
            if (b && (b.bottom > floor + 0.5 || b.top < bb.top - 0.5 || b.right > bb.right + 0.5)) res.push(`${what} out of the banner or over its strip`);
          }
        }
        results.push(res);
        box.remove();
      }
      return results;
    },
    { cases, hass },
  );
  await page.close();
  assert.deepEqual(errors, []);
  return out;
};

test("status pill: whole title beside it, whole label or dot alone, inside the banner", { timeout: 300000 }, async (t) => {
  if (skip) return t.skip(skip);
  const cases = [];
  const variants = [
    { type: "zigbee-card", config: {} },
    { type: "zigbee-card", config: { illustration: false } },
    { type: "zigbee-mini-card", config: {} },
    { type: "zigbee-mini-card", config: {}, zoom: true },
    { type: "zigbee-mini-card", config: { illustration: false } },
  ];
  for (const v of variants)
    for (const lang of ["en", "fr", "de", "hu", "el", "ru"])
      for (const width of [190, 245, 300, 400, 460, 500])
        for (const title of [undefined, "A very long name for the Zigbee network of the house"]) cases.push({ ...v, config: { ...v.config, ...(title ? { title } : {}) }, lang, width });
  const results = await measure(cases);
  const failures = [];
  results.forEach((r, i) => {
    const c = cases[i];
    for (const f of r) failures.push(`${c.type} ${JSON.stringify(c.config)}${c.zoom ? " zoomed" : ""} ${c.lang} ${c.width}px: ${f}`);
  });
  assert.deepEqual(failures, []);
});
