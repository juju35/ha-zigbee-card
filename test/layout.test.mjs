// Browser test (Chromium through Playwright) of the cards' layout: at their minimum width (8 columns of a sections
// view on a phone for the full card, 6 for the mini card) and wider, in long languages and both themes, on both tabs
// and without the illustration: nothing leaves the card, no text lies under the banner's scene, the title keeps a
// few characters, the header icon keeps its 40 px, and the device popup opens at the top of the card.
// Skipped when Playwright or Chromium is not installed, except in CI, where it must run.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, before, test } from "node:test";
import { mockHass, NOW } from "../scripts/screenshots/mock.mjs";
import { sources } from "./source.mjs";

const read = (name) => (sources[`${name}.js`] ?? readFileSync(new URL(`../src/${name}.js`, import.meta.url), "utf8"));
const src = `{\n${read("strings")}\n${read("zigbee-card")}\n}`;
const THEMES = {
  light: { "--card-background-color": "#fff", "--secondary-background-color": "#f1f1f1", "--primary-text-color": "#212121", "--secondary-text-color": "#727272" },
  dark: { "--card-background-color": "#1c1c1c", "--secondary-background-color": "#282828", "--primary-text-color": "#e1e1e1", "--secondary-text-color": "#9b9b9b" },
};
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
    async ({ cases, hass, THEMES }) => {
      const results = [];
      const zha = hass.__zha;
      const ws = async (m) => (m.type === "zha/devices" ? zha.devices : zha.settings);
      for (const c of cases) {
        const box = document.createElement("div");
        box.style.cssText = `width:${c.width}px;${Object.entries(THEMES[c.theme]).map(([k, v]) => `${k}:${v}`).join(";")}`;
        document.body.appendChild(box);
        const el = document.createElement(c.type);
        el.setConfig({ type: `custom:${c.type}`, language: c.lang, ...c.config });
        el.hass = { ...hass, callWS: ws, themes: { darkMode: c.theme === "dark" } };
        box.appendChild(el);
        await new Promise((r) => setTimeout(r, 0));
        const sr = el.shadowRoot;
        const click = (sel) => sr.querySelector(sel)?.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true, detail: 1 }));
        if (c.zoom) click(".zoom");
        if (c.detail) click("[data-device]");
        const card = sr.querySelector("ha-card").getBoundingClientRect();
        const rect = (n) => n.getBoundingClientRect();
        const shown = (n) => n.getClientRects().length > 0 && getComputedStyle(n).visibility !== "hidden" && getComputedStyle(n).display !== "none";
        // What shows of an element: its box clipped by its ancestors that hide their overflow (an ellipsis, a
        // scrolling row of tabs).
        const visible = (n) => {
          let { left, right } = rect(n);
          for (let p = n.parentElement; p && p.localName !== "ha-card"; p = p.parentElement) {
            if (getComputedStyle(p).overflowX !== "visible") {
              left = Math.max(left, rect(p).left);
              right = Math.min(right, rect(p).right);
            }
          }
          return { left, right };
        };
        const outside = [...sr.querySelectorAll("*")]
          .filter((n) => shown(n) && !n.closest("svg") && !n.closest(".strip"))
          .filter((n) => {
            const v = visible(n);
            return v.right > v.left && (v.right > card.right + 0.5 || v.left < card.left - 0.5);
          })
          .map((n) => n.className?.baseVal ?? n.className);
        const scene = sr.querySelector(".scene");
        const head = sr.querySelector(".head");
        const sceneShown = scene && shown(scene);
        const under =
          sceneShown && head
            ? [...head.querySelectorAll("*")].filter((n) => shown(n) && n.children.length === 0 && n.textContent && rect(n).right > rect(scene).left + 0.5).map((n) => n.textContent)
            : [];
        const name = sr.querySelector(".name, .title");
        const badge = sr.querySelector(".head .badge, .header .badge, .mini > .badge");
        const modal = sr.querySelector(".modal");
        results.push({
          outside,
          under,
          nameWidth: name ? rect(name).width : 0,
          ch: name ? parseFloat(getComputedStyle(name).fontSize) * 2 : 0,
          badge: badge ? [Math.round(rect(badge).width), Math.round(rect(badge).height)] : null,
          modalTop: modal ? rect(modal).top - card.top : null,
          modalOut: modal ? rect(modal).right > card.right + 0.5 || rect(modal).bottom > card.bottom + 0.5 : false,
        });
        box.remove();
      }
      return results;
    },
    { cases, hass, THEMES },
  );
  await page.close();
  assert.deepEqual(errors, []);
  return out;
};

const LANGS = ["en", "de", "el", "sr", "lv", "hu", "pt"];
const matrix = (variants, widths) => {
  const cases = [];
  for (const v of variants) for (const lang of LANGS) for (const theme of ["light", "dark"]) for (const width of widths) cases.push({ ...v, lang, theme, width });
  return cases;
};

test("at their minimum width and wider, nothing leaves the card and no text lies under the scene", { timeout: 180000 }, async (t) => {
  if (skip) return t.skip(skip);
  const cases = [
    ...matrix(
      [
        { type: "zigbee-card", config: {} },
        { type: "zigbee-card", config: { default_tab: "map" } },
        { type: "zigbee-card", config: { illustration: false, default_filter: "attention" } },
      ],
      [208, 245, 300, 380, 480, 560],
    ),
    ...matrix(
      [
        { type: "zigbee-mini-card", config: {} },
        { type: "zigbee-mini-card", config: { mini_layout: "bar" } },
      ],
      [156, 208, 245, 300, 380],
    ),
    ...matrix([{ type: "zigbee-mini-card", config: {}, zoom: true }], [208, 300, 480]),
  ];
  const results = await measure(cases);
  results.forEach((r, i) => {
    const c = cases[i];
    const at = `${c.type} ${JSON.stringify(c.config)}${c.zoom ? " zoomed" : ""} ${c.lang} ${c.theme} ${c.width}px`;
    assert.deepEqual(r.outside, [], `outside the card: ${at}`);
    assert.deepEqual(r.under, [], `text under the scene: ${at}`);
    assert.ok(r.nameWidth >= r.ch, `title ${r.nameWidth.toFixed(0)} px: ${at}`);
    assert.deepEqual(r.badge, [40, 40], `header icon: ${at}`);
  });
});

test("the device popup opens at the top of the card and stays in it", { timeout: 60000 }, async (t) => {
  if (skip) return t.skip(skip);
  const cases = matrix(
    [
      { type: "zigbee-card", config: {}, detail: true },
      { type: "zigbee-card", config: { default_tab: "map" }, detail: true },
      { type: "zigbee-mini-card", config: {}, zoom: true, detail: true },
    ],
    [245, 480],
  );
  const results = await measure(cases);
  results.forEach((r, i) => {
    const c = cases[i];
    const at = `${c.type} ${JSON.stringify(c.config)} ${c.lang} ${c.theme} ${c.width}px`;
    assert.ok(r.modalTop !== null && r.modalTop <= 12, `popup top ${r.modalTop}: ${at}`);
    assert.equal(r.modalOut, false, `popup outside the card: ${at}`);
  });
});
