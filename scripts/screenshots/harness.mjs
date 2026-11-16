// Shared by the screenshot scripts: theme variables, the <ha-card> / <ha-icon> stand-ins, a fixed clock, the mock
// ZHA websocket and the render loop.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as mdi from "@mdi/js";
import { chromium } from "playwright";
import { mockHass, NOW } from "./mock.mjs";

export const root = fileURLToPath(new URL("../..", import.meta.url));
// Read on first use: the tests import writeIfChanged without a built bundle.
let bundle;
const cardJs = () => (bundle ??= readFileSync(`${root}dist/zigbee-card.js`, "utf8"));

// Every mdi:* icon the card can use, as SVG paths for the <ha-icon> stand-in.
const iconsFor = () => {
  const icons = {};
  for (const name of new Set(cardJs().match(/mdi:[a-z0-9-]+/g))) {
    const key = `mdi${name.slice(4).replace(/(^|-)([a-z0-9])/g, (_, __, c) => c.toUpperCase())}`;
    if (mdi[key]) icons[name.slice(4)] = mdi[key];
  }
  return icons;
};

const THEMES = {
  light: {
    "--primary-background-color": "#e8eaed", "--secondary-background-color": "#f1f1f1", "--card-background-color": "#ffffff",
    "--primary-text-color": "#212121", "--secondary-text-color": "#727272", "--divider-color": "rgba(0,0,0,.12)",
  },
  dark: {
    "--primary-background-color": "#111111", "--secondary-background-color": "#282828", "--card-background-color": "#1c1c1c",
    "--primary-text-color": "#e1e1e1", "--secondary-text-color": "#9b9b9b", "--divider-color": "rgba(225,225,225,.12)",
  },
};
const COMMON = { "--primary-color": "#03a9f4", "--success-color": "#43a047", "--warning-color": "#ffa600", "--error-color": "#db4437", "--info-color": "#039be5" };

const STANDINS = (icons) => `customElements.define("ha-card", class extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" }).innerHTML =
      "<style>:host{display:block;background:var(--ha-card-background,var(--card-background-color));" +
      "border-radius:var(--ha-card-border-radius,12px);border:1px solid var(--divider-color);color:var(--primary-text-color);overflow:hidden}</style><slot></slot>";
  }
});
const ICONS = ${JSON.stringify(icons)};
customElements.define("ha-icon", class extends HTMLElement {
  static get observedAttributes() { return ["icon"]; }
  connectedCallback() { this._draw(); }
  attributeChangedCallback() { this._draw(); }
  _draw() {
    const path = ICONS[(this.getAttribute("icon") || "").replace("mdi:", "")] || "";
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = '<style>:host{display:inline-flex}</style><svg viewBox="0 0 24 24" style="width:var(--mdc-icon-size,24px);height:var(--mdc-icon-size,24px);fill:currentColor"><path d="' + path + '"/></svg>';
  }
});`;

const pageHtml = (theme, width) => `<!doctype html><html><head><meta charset="utf-8">
<style>
  :root { ${Object.entries({ ...THEMES[theme], ...COMMON }).map(([k, v]) => `${k}:${v};`).join("")} }
  body { margin: 0; padding: 16px; background: var(--primary-background-color); color: var(--primary-text-color);
         font-family: Roboto, "Segoe UI", Helvetica, Arial, sans-serif; width: ${width}px; }
</style></head><body><div id="root"></div></body></html>`;

// A light shot and its dark twin, both in English.
export const pair = (file, extra = {}) => [
  { file, theme: "light", ...extra },
  { file: `${file}-dark`, theme: "dark", ...extra },
];

export const launch = () => chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});

// A page ready to host a card, its clock fixed at the mock's NOW (the timers keep running).
export const openPage = async (browser, { theme, width, label = "" }) => {
  const page = await browser.newPage({ deviceScaleFactor: 2, viewport: { width: 1000, height: 1600 } });
  page.on("pageerror", (err) => console.error(`pageerror${label ? ` (${label})` : ""}: ${err.message}`));
  await page.clock.setFixedTime(new Date(NOW));
  await page.setContent(pageHtml(theme, width));
  await page.addScriptTag({ content: STANDINS(iconsFor()) });
  await page.addScriptTag({ content: cardJs() });
  return page;
};

// The mock hass in the page: its data crosses as JSON, its websocket is rebuilt there.
export const pageHass = (opts = {}) => {
  const { callWS, ...hass } = mockHass(opts);
  return hass;
};

// Creates the card in the page, waits for its ZHA data, then clicks each selector of `clicks` (a mouse click: no
// focus ring in the shot).
export const mountCard = async (page, { tag, config, dark = false, hass = {}, clicks = [] }) => {
  await page.evaluate(
    ({ tag, config, hass }) => {
      const el = document.createElement(tag);
      el.setConfig({ type: `custom:${tag}`, ...config });
      const zha = hass.__zha;
      el.hass = {
        ...hass,
        callService: async () => {},
        callWS: async (m) => {
          if (zha.error) throw { code: zha.error };
          return m.type === "zha/devices" ? zha.devices : zha.settings;
        },
      };
      document.getElementById("root").appendChild(el);
    },
    { tag, config, hass: pageHass({ dark, ...hass }) },
  );
  await page.waitForTimeout(100);
  for (const sel of clicks)
    await page.evaluate((sel) => {
      const el = document.querySelector("#root > *");
      el.shadowRoot.querySelector(sel).dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true, detail: 1 }));
    }, sel);
};

// The card on the theme background, with the body's 16px padding around it; `banner` clips to the banner and the
// tabs under it.
export const cardClip = async (page, width, { banner = false } = {}) => {
  const box = await page.locator("#root").boundingBox();
  if (!banner) return { x: 0, y: 0, width: width + 32, height: Math.ceil(box.height) + 32 };
  const h = await page.evaluate(() => {
    const el = document.querySelector("#root > *");
    const b = el.shadowRoot.querySelector(".tabs") || el.shadowRoot.querySelector(".banner") || el.shadowRoot.querySelector("ha-card");
    return b.getBoundingClientRect().bottom;
  });
  return { x: 0, y: 0, width: width + 32, height: Math.ceil(h) };
};

// The period every animation of the cards divides.
export const PERIOD = 6000;

// Pauses every CSS animation of the page at `frac` of the period (every animation of the cards lasts a divisor of
// it, so a recording stepped this way loops seamlessly at its real speed). The cards' shadow trees are walked by hand.
export const freeze = (page, frac) =>
  page.evaluate(
    ({ f, period }) => {
      const anims = [];
      const walk = (root) => {
        for (const el of root.querySelectorAll("*")) {
          anims.push(...el.getAnimations());
          if (el.shadowRoot) walk(el.shadowRoot);
        }
      };
      walk(document);
      for (const a of anims) {
        a.pause();
        a.currentTime = 3 * period + f * period;
      }
    },
    { f: frac, period: PERIOD },
  );

// Writes a PNG screenshot to `path` only when its pixels differ from the file already there. PNG encoding is not
// byte-stable from one run (or machine) to the next: comparing bytes would commit pictures that did not change.
export const writeIfChanged = async (page, path, png) => {
  if (existsSync(path)) {
    const same = await page.evaluate(
      async ([a, b]) => {
        const pixels = async (b64) => {
          const blob = await (await fetch(`data:image/png;base64,${b64}`)).blob();
          const bmp = await createImageBitmap(blob, { colorSpaceConversion: "none", premultiplyAlpha: "none" });
          const ctx = new OffscreenCanvas(bmp.width, bmp.height).getContext("2d");
          ctx.drawImage(bmp, 0, 0);
          return { w: bmp.width, h: bmp.height, d: ctx.getImageData(0, 0, bmp.width, bmp.height).data };
        };
        const [x, y] = await Promise.all([pixels(a), pixels(b)]);
        if (x.w !== y.w || x.h !== y.h) return false;
        for (let i = 0; i < x.d.length; i++) if (x.d[i] !== y.d[i]) return false;
        return true;
      },
      [readFileSync(path).toString("base64"), png.toString("base64")],
    );
    if (same) return false;
  }
  writeFileSync(path, png);
  return true;
};
