import assert from "node:assert/strict";
import { test } from "node:test";
import { mockHass, mockNetwork, mockZ2m, mockZ2mHass, NOW } from "../scripts/screenshots/mock.mjs";
import { load } from "./load.mjs";

const zb = load([
  "buildNetwork",
  "layoutMap",
  "barsOf",
  "fetchZha",
  "zhaEntry",
  "fetchZ2m",
  "releaseZ2m",
  "sourceEntry",
  "sourceOf",
  "z2mDevices",
  "z2mMessage",
  "plural",
  "STRINGS",
  "ZigbeeCard",
  "ZigbeeMiniCard",
  "ZigbeeCardEditor",
  "ZigbeeMiniCardEditor",
  "document",
  "window",
  "history",
]);

const card = async (Cls, config = {}, hass = mockHass()) => {
  const el = new Cls();
  el._now = () => NOW;
  el.setConfig({ type: "custom:x", ...config });
  el._hass = hass;
  await zb.fetchZha(hass, 1e9);
  return el;
};
const net = (config = {}, opts = {}) => {
  const hass = mockHass(opts);
  return zb.buildNetwork(hass.__zha.devices, hass, config);
};
const byName = (n, name) => n.devices.find((d) => d.name === name);
const count = (html, re) => (html.match(re) || []).length;

test("the network: counts by role and status, the coordinator apart, issues first", () => {
  const n = net();
  assert.equal(n.coordinator.name, "Nabu Casa ZBT-2");
  assert.equal(n.total, 42);
  assert.equal(n.online, 41);
  assert.equal(n.offline, 1);
  assert.equal(n.routers, 14);
  assert.equal(n.ends, 28);
  assert.equal(n.lowBattery, 1);
  assert.equal(n.weak, 1);
  assert.equal(n.attention, 3);
  assert.deepEqual([...n.devices.slice(0, 3).map((d) => d.name)], ["Garage door", "Bathroom climate", "Front door"]);
  assert.equal(byName(n, "Kitchen motion").battery, 82);
  assert.equal(byName(n, "Kitchen motion").icon, "mdi:run");
  assert.equal(byName(n, "Living room ceiling").icon, "mdi:lightbulb");
  assert.equal(byName(n, "Hallway plug").icon, "mdi:power-plug");
  assert.equal(byName(n, "Garage door").icon, "mdi:garage");
  assert.equal(byName(n, "Kitchen motion").area, "Kitchen");
});

test("links: end devices hang from the router that lists them as children, routers from the coordinator", () => {
  const n = net();
  const front = byName(n, "Front door");
  assert.equal(n.byIeee.get(front.parent).name, "Office plug");
  assert.equal(front.linkLqi, 94);
  assert.equal(front.link, "ok");
  assert.equal(byName(n, "Garage door").link, "lost");
  assert.equal(byName(n, "Bathroom climate").link, "weak");
  assert.equal(byName(n, "Hallway plug").parent, n.coordinator.ieee);
  // A device seen in no neighbor table hangs from the coordinator.
  const lone = mockNetwork().devices.filter((d) => d.device_type !== "Router");
  const n2 = zb.buildNetwork(lone, mockHass(), {});
  assert.equal(n2.devices[0].parent, n2.coordinator.ieee);
});

test("thresholds: weak signal and low battery follow the options", () => {
  assert.equal(byName(net({ weak_lqi: 110 }), "Garden climate").issue, "weak");
  assert.equal(byName(net(), "Garden climate").issue, null);
  assert.equal(net({ low_battery: 60 }).lowBattery, 4);
  assert.equal(net({ exclude: ["Garage door"] }).total, 41);
  assert.equal(net({}, { healthy: true }).attention, 0);
});

test("signal bars from the LQI", () => {
  const b = (lqi, available = true) => zb.barsOf({ lqi, available }, 80);
  assert.deepEqual([b(230), b(156), b(94), b(61), b(null), b(200, false)], [4, 3, 2, 1, 0, 0]);
});

test("the full card: banner stats, status chips, filter tabs, one tile per device up to max_devices", async () => {
  const html = (await card(zb.ZigbeeCard))._render();
  assert.match(html, /class="name">Zigbee network</);
  assert.match(html, /<span>ZHA<\/span><span>Channel 15<\/span><span>42 devices<\/span>/);
  assert.match(html, /data-tab="devices" aria-selected="true"/);
  assert.match(html, /41 \/ 42 online/);
  assert.match(html, /1 offline/);
  assert.match(html, /1 low battery/);
  for (const f of ["All · 42", "Routers · 14", "End devices · 28", "Attention · 3"]) assert.ok(html.includes(f), f);
  assert.equal(count(html, /class="tile /g), 12);
  assert.match(html, /Show all · 42/);
  assert.match(html, /Offline · 3 h/);
  assert.match(html, /Weak signal · LQI 61/);
  assert.match(html, /Battery 12%/);
  assert.match(html, /<ha-icon icon="mdi:zigbee"><\/ha-icon>/);
  const all = (await card(zb.ZigbeeCard, { max_devices: 0 }))._render();
  assert.equal(count(all, /class="tile /g), 42);
  assert.match(all, /Router · LQI 230/);
  assert.match(all, /LQI 156 · battery 82%/);
  // Healthy tiles are neutral, issues coloured.
  assert.match(all, /class="tile ok"[^>]*data-device="[^"]+">\s*<span class="ic"><ha-icon icon="mdi:lightbulb">/);
  assert.match(all, /class="tile alert"/);
});

test("filters, show all and the tabs", async () => {
  const el = await card(zb.ZigbeeCard);
  el._update = () => {};
  el._click({ composedPath: () => [{ dataset: { filter: "attention" } }], detail: 1 });
  assert.equal(count(el._render(), /class="tile /g), 3);
  el._click({ composedPath: () => [{ dataset: { filter: "routers" } }], detail: 1 });
  assert.equal(count(el._render(), /class="tile /g), 12);
  el._click({ composedPath: () => [{ dataset: { action: "more" } }], detail: 1 });
  assert.equal(count(el._render(), /class="tile /g), 14);
  assert.match(el._render(), /Show less/);
  el._click({ composedPath: () => [{ dataset: { tab: "map" } }], detail: 1 });
  assert.match(el._render(), /class="mesh"/);
  assert.equal((await card(zb.ZigbeeCard, { default_filter: "end_devices", max_devices: 50 }))._render().match(/class="tile /g).length, 28);
});

test("the map tab: mesh, legend, issues, channel and PAN, rows of the devices needing attention", async () => {
  const html = (await card(zb.ZigbeeCard, { default_tab: "map" }))._render();
  assert.match(html, /<span>42 devices<\/span><span>14 routers<\/span>/);
  assert.match(html, /3 issues/);
  assert.match(html, /93% healthy/);
  assert.match(html, /Channel 15 · PAN 0x4C7E/);
  assert.equal(count(html, /class="node"/g), 42);
  assert.match(html, /class="node core-node"/);
  assert.equal(count(html, /class="flow ok"/g), 14);
  assert.equal(count(html, /<line class="lost"/g), 1);
  assert.equal(count(html, /<line class="weak"/g), 1);
  assert.match(html, /aria-label="Mesh map: the coordinator in the centre, 14 routers and 28 end devices around it"/);
  for (const l of ["Coordinator", "Router", "End device", "Weak", "Lost"]) assert.ok(html.includes(`</span>${l}</span>`), l);
  assert.equal(count(html, /class="row /g), 3);
  assert.match(html, /Last seen 3 h ago · via Hallway plug/);
  assert.match(html, /LQI 94 · via Office plug/);
  assert.match(html, /Needs attention <span class="count">· 3/);
});

test("the map's layout: routers on the inner ring, end devices on the outer one, near their parent", () => {
  const n = net();
  const { pos, cx, cy, sx } = zb.layoutMap(n);
  // 14 routers: the rings stretch sideways to use the map's width.
  assert.equal(sx, 1.75);
  const dist = (d) => Math.hypot((pos.get(d.ieee).x - cx) / sx, pos.get(d.ieee).y - cy);
  for (const d of n.devices) assert.ok(Math.abs(dist(d) - (d.role === "router" ? 64 : 96)) < 0.2, d.name);
  // Each end device within 60° of its parent router.
  for (const d of n.devices.filter((x) => x.role === "end")) {
    const a = pos.get(d.ieee).a;
    const b = pos.get(d.parent).a;
    const diff = Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
    assert.ok(diff < Math.PI / 3, `${d.name} ${((diff * 180) / Math.PI).toFixed(0)}°`);
  }
});

test("a click on a device opens its popup at the top of the card; a click elsewhere, Escape or leaving closes it", async () => {
  const el = await card(zb.ZigbeeCard);
  el._update = () => {};
  const n = net();
  const front = byName(n, "Front door");
  el._click({ composedPath: () => [{ dataset: { device: front.ieee } }], detail: 1 });
  let html = el._render();
  assert.match(html, /class="backdrop"/);
  assert.match(html, /<h3 id="zb-dlg-title">Front door<\/h3>/);
  assert.match(html, /End device · Hallway/);
  assert.match(html, /<dt>Connected via<\/dt><dd>Office plug · LQI 94<\/dd>/);
  assert.match(html, /<dt>Battery<\/dt><dd>12 %<\/dd>/);
  assert.match(html, /Neighbors/);
  // The neighbors section starts folded (chevron right) and unfolds (chevron down).
  assert.doesNotMatch(html, /class="nbrs"/);
  assert.match(html, /chevron closed/);
  el._click({ composedPath: () => [{ dataset: { action: "nbrs" } }], detail: 1 });
  html = el._render();
  assert.match(html, /<ul class="nbrs"><li><span>Office plug<\/span><span>LQI 94<\/span><\/li><\/ul>/);
  const hallway = byName(n, "Hallway plug");
  el._detail = hallway.ieee;
  el._nbrsOpen = true;
  assert.match(el._render(), /<li><span>Nabu Casa ZBT-2<\/span><span>LQI 198<\/span><\/li>/);
  el._onOutside({ composedPath: () => [] });
  assert.equal(el._detail, null);
  el._openDetail(front.ieee);
  zb.window.on_keydown({ key: "Escape", stopPropagation() {} });
  assert.equal(el._detail, null);
  el._openDetail(front.ieee);
  el.disconnectedCallback();
  assert.equal(el._detail, null);
  // The device page link.
  el._openDetail(front.ieee);
  el._click({ composedPath: () => [{ dataset: { action: "device" } }], detail: 1 });
  assert.equal(zb.history.path, "/config/devices/device/dev_e2");
  assert.equal(el._detail, null);
});

test("errors: no administrator, no ZHA, no device", async () => {
  assert.match((await card(zb.ZigbeeCard, {}, mockHass({ error: "unauthorized" })))._render(), /Only an administrator can read the Zigbee network/);
  assert.match((await card(zb.ZigbeeCard, {}, mockHass({ error: "unknown_command" })))._render(), /The ZHA integration is not set up/);
  assert.match((await card(zb.ZigbeeMiniCard, {}, mockHass({ error: "unauthorized" })))._render(), /Only an administrator/);
  const el = new zb.ZigbeeCard();
  el.setConfig({});
  el._hass = { ...mockHass(), callWS: async () => [] };
  await zb.fetchZha(el._hass, 1e9);
  assert.match(el._render(), /No Zigbee device found/);
});

test("the ZHA data is read once for every card and again after the refresh interval", async () => {
  let calls = 0;
  const base = mockHass();
  const hass = {
    ...base,
    callWS: async (m) => {
      calls++;
      return base.callWS(m);
    },
  };
  await Promise.all([zb.fetchZha(hass, 60000), zb.fetchZha(hass, 60000)]);
  assert.equal(calls, 2); // zha/devices and zha/network/settings
  assert.equal(zb.fetchZha(hass, 60000), null);
  await zb.fetchZha(hass, 0);
  assert.equal(calls, 3); // the settings are kept
  assert.equal(zb.zhaEntry(hass).version, 2);
});

test("the mini card: banner, status and chips; the health bar layout; the classic line", async () => {
  const html = (await card(zb.ZigbeeMiniCard))._render();
  // The full card's banner, its sky holding the device count and the status; the icon red (a device is offline).
  assert.match(html, /class="banner"/);
  assert.match(html, /class="scene"/);
  assert.match(html, /class="badge alert"><ha-icon icon="mdi:zigbee">/);
  assert.match(html, /class="name">Zigbee</);
  // The status in the pill right after the title (the icon's colour), not repeated in the statistics.
  assert.match(html, /<div class="trow"><div class="name">Zigbee<\/div><span class="chip hpill alert" title="3 issues" aria-label="3 issues"><span class="dot"><\/span><span class="txt">3 issues<\/span><\/span><\/div>/);
  assert.match(html, /<div class="stats"[^>]*><span>42 devices<\/span><\/div>/);
  assert.match(html, /class="r ok"><ha-icon icon="mdi:router-wireless"><\/ha-icon><span>14 routers/);
  assert.match(html, /class="r alert pill">.*1 offline/s);
  assert.match(html, /class="r warn pill">.*1 low battery/s);
  assert.match(html, /aria-label="Show the full card"/);
  const ok = (await card(zb.ZigbeeMiniCard, {}, mockHass({ healthy: true })))._render();
  assert.match(ok, /class="badge ok"/);
  assert.match(ok, /<span class="chip hpill ok" title="Healthy" aria-label="Healthy">/);
  assert.match(ok, /42 online/);
  assert.match(ok, /LQI \d+/);
  const bar = (await card(zb.ZigbeeMiniCard, { mini_layout: "bar" }))._render();
  assert.match(bar, /class="hbar"/);
  assert.match(bar, /<span class="ok" style="flex-grow: 39"><\/span><span class="warn" style="flex-grow: 2"><\/span><span class="alert" style="flex-grow: 1"><\/span>/);
  assert.match(bar, /1 offline · 1 low battery · 14 routers/);
  // Without the illustration: the badge, the title and the status in one line.
  const classic = (await card(zb.ZigbeeMiniCard, { illustration: false }))._render();
  assert.match(classic, /class="mini warn"/);
  assert.match(classic, /class="title">Zigbee<\/span>\s*<span class="chip hpill alert" title="3 issues" aria-label="3 issues">/);
  assert.match(classic, /class="badge alert"/);
  assert.doesNotMatch(classic, /class="banner/);
});

test("the mini card's zoom button unfolds the full card; a click outside folds it back", async () => {
  const el = await card(zb.ZigbeeMiniCard);
  el._update = () => {};
  const zoom = { classList: { contains: (c) => c === "zoom" }, dataset: {} };
  el._click({ composedPath: () => [zoom], detail: 1, stopPropagation() {} });
  assert.equal(el._zoomed, true);
  assert.match(el._render(), /class="tile /);
  assert.match(el._render(), /<button class="zoom on-night|<button class="zoom "[^>]*>|mdi:arrow-collapse/);
  assert.match(el._render(), /icon="mdi:arrow-collapse"/);
  assert.doesNotMatch(el._render(), /magnify/);
  assert.deepEqual({ ...el.getGridOptions() }, { columns: 12, min_columns: 8 });
  // A device popup open: the click outside only closes the popup.
  el._click({ composedPath: () => [{ dataset: { device: net().devices[0].ieee } }], detail: 1 });
  const out = { composedPath: () => [] };
  el._onOutside(out);
  el._onFold(out);
  assert.equal(el._detail, null);
  assert.equal(el._zoomed, true);
  el._onFold({ composedPath: () => [] });
  assert.equal(el._zoomed, false);
  assert.deepEqual({ ...el.getGridOptions() }, { columns: 6, min_columns: 6 });
  el._setZoom(true);
  el.disconnectedCallback();
  assert.equal(el._zoomed, false);
  assert.doesNotMatch((await card(zb.ZigbeeMiniCard, { zoom: false }))._render(), /class="zoom/);
});

test("illustration: night by the dark theme or forced, classic header without it", async () => {
  assert.match((await card(zb.ZigbeeCard, { illustration_theme: "night" }))._render(), /class="banner night"/);
  assert.match((await card(zb.ZigbeeCard, {}, mockHass({ dark: true })))._render(), /class="banner night"/);
  assert.doesNotMatch((await card(zb.ZigbeeCard, { illustration_theme: "day" }, mockHass({ dark: true })))._render(), /banner night/);
  const classic = (await card(zb.ZigbeeCard, { illustration: false }))._render();
  assert.doesNotMatch(classic, /class="scene"/);
  assert.match(classic, /<div class="header"><div class="badge alert">/);
  // Automatic: the dark theme alone, the sun left aside.
  const sun = (state, dark) => {
    const h = mockHass({ dark });
    h.states = { ...h.states, "sun.sun": { state } };
    return h;
  };
  assert.doesNotMatch((await card(zb.ZigbeeCard, {}, sun("below_horizon", false)))._render(), /banner night/);
  assert.match((await card(zb.ZigbeeCard, {}, sun("below_horizon", true)))._render(), /class="banner night"/);
  assert.match((await card(zb.ZigbeeCard, {}, sun("above_horizon", true)))._render(), /class="banner night"/);
  assert.doesNotMatch((await card(zb.ZigbeeCard, {}, sun("above_horizon", false)))._render(), /banner night/);
  assert.doesNotMatch((await card(zb.ZigbeeCard, { illustration_theme: "day" }, sun("below_horizon", true)))._render(), /banner night/);
  // The scene and the icon follow the network: a device offline (the lock red, its link lost), another issue (an
  // amber weak link), all well (no issue, the icon green).
  const off = (await card(zb.ZigbeeCard))._render();
  assert.match(off, /class="dev lost"/);
  assert.match(off, /class="ln lost"/);
  assert.match(off, /class="badge alert"/);
  const warn = (await card(zb.ZigbeeCard, { exclude: ["Garage door"] }))._render();
  assert.match(warn, /class="dev weak"/);
  assert.doesNotMatch(warn, /class="dev lost"/);
  assert.match(warn, /class="badge warn"/);
  const ok = (await card(zb.ZigbeeCard, {}, mockHass({ healthy: true })))._render();
  assert.doesNotMatch(ok, /class="dev (weak|lost)"/);
  assert.match(ok, /class="badge ok"/);
  assert.match(ok, /class="strip g-mesh zig"/);
  // No id in the scene: several cards on a page never clash.
  assert.doesNotMatch(ok.match(/<svg class="scene"[\s\S]*?<\/svg>/)[0], /\sid="/);
  assert.doesNotMatch((await card(zb.ZigbeeCard, { show_status: false }))._render(), /class="status"/);
});

test("the editors keep the YAML minimal and the mini card's editor has the full card's options", () => {
  const ed = new zb.ZigbeeCardEditor();
  let form;
  zb.document.createElement = (tag) => {
    form = { tag, listeners: {}, addEventListener(t, f) { this.listeners[t] = f; } };
    return form;
  };
  ed.appendChild = () => {};
  ed.dispatchEvent = (ev) => {
    ed.last = ev.detail.config;
  };
  ed.setConfig({ type: "custom:zigbee-card" });
  ed.hass = mockHass();
  assert.equal(form.data.weak_lqi, 80);
  assert.equal(form.data.illustration, true);
  form.listeners["value-changed"]({
    stopPropagation() {},
    detail: { value: { type: "custom:zigbee-card", weak_lqi: 80, low_battery: 15, max_devices: 12, illustration: true, default_tab: "devices", title: "" } },
  });
  assert.deepEqual({ ...ed.last }, { type: "custom:zigbee-card", low_battery: 15 });
  const names = (schema) => schema.flatMap((s) => (s.schema ? names(s.schema) : [s.name]));
  const full = names(ed._schema());
  const mini = new zb.ZigbeeMiniCardEditor();
  mini._config = {};
  const miniNames = names(mini._schema());
  for (const n of full) assert.ok(miniNames.includes(n), n);
  for (const n of ["zoom", "mini_layout"]) assert.ok(miniNames.includes(n) && !full.includes(n), n);
});

const LANGS = ["en", "fr", "de", "es", "sr", "sr-Latn", "it", "nl", "pt", "pl", "ro", "da", "sv", "bg", "ru", "uk", "hu", "sk", "cs", "sl", "lv", "el"];
const vars = (s) => s.match(/\{\w+\}/g)?.sort() ?? [];

test("every language has every English text, with the same placeholders", () => {
  assert.deepEqual([...Object.keys(zb.STRINGS)], LANGS);
  const ref = [...Object.keys(zb.STRINGS.en)].sort();
  for (const l of LANGS.slice(1)) {
    const table = zb.STRINGS[l];
    // Extra plural forms (zero, two, few, many) only next to an English one / other pair.
    const extra = Object.keys(table).filter((k) => !(k in zb.STRINGS.en));
    for (const k of extra) assert.match(k, /^(devices|routers|end_devices|issues)_(zero|two|few|many)$/, `${l}.${k}`);
    assert.deepEqual([...Object.keys(table).filter((k) => k in zb.STRINGS.en)].sort(), ref, l);
    for (const k of Object.keys(table)) {
      const en = zb.STRINGS.en[k] ?? zb.STRINGS.en[k.replace(/_(zero|two|few|many)$/, "_other")];
      assert.ok(table[k].trim(), `${l}.${k} empty`);
      assert.deepEqual(vars(table[k]), vars(en), `${l}.${k} placeholders`);
    }
  }
});

test("plural forms follow the language", () => {
  const n = (language, key, count) => zb.plural({ language }, {}, key, count);
  assert.equal(n("en", "devices", 1), "1 device");
  assert.equal(n("en", "devices", 42), "42 devices");
  assert.equal(n("fr", "routers", 14), "14 routeurs");
  assert.equal(n("pl", "devices", 3), "3 urządzenia");
  assert.equal(n("pl", "devices", 42), "42 urządzenia");
  assert.equal(n("pl", "devices", 25), "25 urządzeń");
  assert.equal(n("ru", "issues", 5), "5 проблем");
  assert.equal(n("sl", "routers", 2), "2 usmerjevalnika");
  assert.equal(n("lv", "devices", 10), "10 ierīču");
});

test("a French card is translated, numbers included", async () => {
  const html = (await card(zb.ZigbeeCard, { language: "fr", default_tab: "map" }))._render();
  assert.match(html, /Réseau Zigbee/);
  assert.match(html, /3 problèmes/);
  assert.match(html, /93\s% en bonne santé/);
  assert.match(html, /Canal 15 · PAN 0x4C7E/);
});

test("status pill on every header: full card, loading or unavailable, classic; banner style day and night", async () => {
  const full = (await card(zb.ZigbeeCard))._render();
  assert.match(full, /<div class="trow"><div class="name">[^<]+<\/div><span class="chip hpill alert" title="3 issues" aria-label="3 issues">/);
  const classic = (await card(zb.ZigbeeCard, { illustration: false }))._render();
  assert.match(classic, /<span class="chip hpill alert" title="3 issues" aria-label="3 issues">/);
  const css = full;
  assert.match(css, /\.banner \.hpill \{ background: color-mix\(in srgb, var\(--c\) 18%, rgba\(255,255,255,\.78\)\); color: color-mix\(in srgb, var\(--c\) 45%, #0d2a45\); \}/);
  assert.match(css, /\.banner\.night \.hpill \{ background: color-mix\(in srgb, var\(--c\) 30%, rgba\(8,18,38,\.55\)\); color: color-mix\(in srgb, var\(--c\) 35%, #ffffff\); \}/);
  // Its place is measured (placePill): data-wrap puts it on its own line, data-dot keeps its dot alone; no width tier
  assert.match(css, /\.hpill \{ flex: none; max-width: 100%; \}/);
  assert.match(css, /\[data-wrap\] \.trow \{ display: contents; \}/);
  assert.match(css, /\[data-dot\] \.hpill \.txt \{ position: absolute;/);
  assert.doesNotMatch(css, /@container \(max-width: 260px\)/);
  // The mini card's buttons: the reference corner button, arrows, never a magnifier
  const mini = (await card(zb.ZigbeeMiniCard))._render();
  assert.match(mini, /icon="mdi:arrow-expand"/);
  assert.match(mini, /\.zoom \{ all: unset; position: absolute; z-index: 2; top: 5px; right: 5px; cursor: pointer; width: 24px; height: 24px; border-radius: 50%;\s*display: grid; place-items: center; color: #33506b; background: rgba\(255,255,255,\.55\)/);
});

// Zigbee2MQTT: the retained messages of the mock, read into an entry as the subscription does.
const z2mEntry = (opts = {}, withMap = true) => {
  const z = mockZ2m(opts);
  const e = { z: { devices: null, info: null, avail: new Map(), state: new Map(), map: null } };
  for (const m of z.retained) zb.z2mMessage(e, "zigbee2mqtt", m);
  if (withMap) zb.z2mMessage(e, "zigbee2mqtt", z.networkmap);
  return { e, hass: mockZ2mHass(opts) };
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

test("zigbee2mqtt: the same network as ZHA from the bridge, availability, states and the raw network map", () => {
  const { e, hass } = z2mEntry();
  const n = zb.buildNetwork(zb.z2mDevices(e.z, hass), hass, {});
  const ref = net();
  for (const k of ["total", "online", "offline", "routers", "ends", "lowBattery", "weak", "attention", "avgLqi"]) assert.equal(n[k], ref[k], k);
  assert.equal(n.coordinator.model, "EmberZNet 8.0.2");
  const front = byName(n, "Front door");
  assert.equal(n.byIeee.get(front.parent).name, "Office plug");
  assert.equal(front.linkLqi, 94);
  assert.equal(front.battery, 12);
  assert.equal(front.area, "Hallway");
  assert.equal(front.icon, "mdi:door-closed");
  assert.equal(front.deviceId, "dev_e2");
  assert.equal(byName(n, "Garage door").link, "lost");
  assert.equal(byName(n, "Hallway plug").parent, n.coordinator.ieee);
  assert.equal(byName(n, "Hallway plug").power, "Mains");
  assert.match(front.ieee, /^0x[0-9a-f]{16}$/);
});

test("zigbee2mqtt: without a network map, every device hangs from the coordinator with its own LQI", () => {
  const { e, hass } = z2mEntry({}, false);
  const n = zb.buildNetwork(zb.z2mDevices(e.z, hass), hass, {});
  assert.equal(n.total, 42);
  assert.ok(n.devices.every((d) => d.parent === n.coordinator.ieee));
  assert.equal(byName(n, "Kitchen motion").lqi, 156);
});

test("zigbee2mqtt: the link quality sensor when the state carries none; availability off means online", () => {
  const { e, hass } = z2mEntry({}, false);
  e.z.state.clear();
  e.z.avail.clear();
  hass.states["sensor.kitchen_motion_linkquality"] = { entity_id: "sensor.kitchen_motion_linkquality", state: "77", attributes: { unit_of_measurement: "lqi" } };
  hass.entities["sensor.kitchen_motion_linkquality"] = { entity_id: "sensor.kitchen_motion_linkquality", device_id: "dev_e1", entity_category: "diagnostic" };
  const n = zb.buildNetwork(zb.z2mDevices(e.z, hass), hass, {});
  assert.equal(n.offline, 0);
  assert.equal(byName(n, "Kitchen motion").lqi, 77);
  assert.equal(byName(n, "Kitchen motion").issue, "weak");
});

test("zigbee2mqtt: the integration follows the option, else ZHA when loaded, else MQTT", () => {
  assert.equal(zb.sourceOf({ config: { components: ["mqtt"] } }, {}), "zigbee2mqtt");
  assert.equal(zb.sourceOf({ config: { components: ["mqtt", "zha"] } }, {}), "zha");
  assert.equal(zb.sourceOf({ config: { components: ["zha"] } }, { integration: "zigbee2mqtt" }), "zigbee2mqtt");
  assert.equal(zb.sourceOf({}, {}), "zha");
});

test("zigbee2mqtt card: no bridge, no MQTT, not an administrator", async () => {
  const e = zb.sourceEntry(mockZ2mHass(), "z2m:x");
  assert.equal(e.data, null);
  for (const [code, key] of [["unauthorized", "Only an administrator"], ["unknown_command", "MQTT integration is not set up"]]) {
    const hass = mockZ2mHass({ error: code });
    const el = new zb.ZigbeeCard();
    el._update = () => {};
    el.setConfig({ type: "custom:zigbee-card" });
    el._hass = hass;
    el._fetch();
    await wait(20);
    assert.ok(el._render().includes(key), code);
  }
  const hass = mockZ2mHass();
  const el = new zb.ZigbeeCard();
  el._update = () => {};
  el.setConfig({ type: "custom:zigbee-card", base_topic: "z2m-other" });
  el._hass = hass;
  el._fetch();
  assert.match(el._render(), /Loading/);
  zb.sourceEntry(hass, "z2m:z2m-other").error = "no_z2m";
  assert.match(el._render(), /base topic &quot;z2m-other&quot;/);
});

// Fake timers for the subscription's lifecycle: run by hand, oldest first.
const timers = [];
const delays = [];
const fake = load(["fetchZ2m", "releaseZ2m", "sourceEntry", "ZigbeeCard", "z2mDevices", "buildNetwork"], {
  setTimeout: (fn, ms) => delays.push(ms) && timers.push({ fn, ms }) && timers.length,
  clearTimeout: (id) => id && timers[id - 1] && (timers[id - 1].fn = null),
});
const runTimers = () => {
  while (timers.length) timers.shift().fn?.();
};
const z2mConn = (hass) => {
  const calls = { sub: 0, unsub: 0, cbs: [] };
  hass.connection = {
    subscribeMessage: async (cb) => {
      calls.sub++;
      calls.cbs.push(cb);
      if (hass.failWith) throw { code: hass.failWith };
      for (const m of mockZ2m().retained) cb(m);
      return () => calls.unsub++;
    },
  };
  return calls;
};

test("zigbee2mqtt subscription: shared, released a minute after the last card, late messages ignored", async () => {
  timers.length = 0;
  const hass = mockZ2mHass();
  const calls = z2mConn(hass);
  const a = {};
  const b = {};
  fake.fetchZ2m(hass, "zigbee2mqtt", 0, a);
  fake.fetchZ2m(hass, "zigbee2mqtt", 0, b);
  await wait(0);
  assert.equal(calls.sub, 1);
  const e = fake.sourceEntry(hass, "z2m:zigbee2mqtt");
  assert.equal(e.data.length, 43);
  fake.releaseZ2m(hass, "zigbee2mqtt", a);
  runTimers();
  assert.equal(calls.unsub, 0, "another card still uses it");
  fake.releaseZ2m(hass, "zigbee2mqtt", b);
  runTimers();
  await wait(0);
  assert.equal(calls.unsub, 1);
  assert.equal(e.data, null);
  // A message of the ended subscription, before its unsubscribe lands: ignored, no crash.
  calls.cbs[0](mockZ2m().retained[2]);
  assert.equal(e.data, null);
  fake.fetchZ2m(hass, "zigbee2mqtt", 0, a);
  await wait(0);
  assert.equal(calls.sub, 2);
  assert.equal(e.data.length, 43);
});

test("zigbee2mqtt subscription: tried again after a failure (MQTT loaded late)", async () => {
  timers.length = 0;
  const hass = mockZ2mHass();
  const calls = z2mConn(hass);
  hass.failWith = "unknown_command";
  fake.fetchZ2m(hass, "zigbee2mqtt", 0, {});
  await wait(0);
  const e = fake.sourceEntry(hass, "z2m:zigbee2mqtt");
  assert.equal(e.error, "no_mqtt");
  fake.fetchZ2m(hass, "zigbee2mqtt", 0, {});
  assert.equal(calls.sub, 1, "not before the retry delay");
  hass.failWith = null;
  e.at -= 31000;
  fake.fetchZ2m(hass, "zigbee2mqtt", 0, {});
  await wait(0);
  assert.equal(calls.sub, 2);
  assert.equal(e.error, null);
});

test("zigbee2mqtt card: a card off the page does not take the subscription again", async () => {
  timers.length = 0;
  const hass = mockZ2mHass();
  const calls = z2mConn(hass);
  const el = new fake.ZigbeeCard();
  el._update = () => {};
  el.setConfig({ type: "custom:zigbee-card", base_topic: "detached" });
  el.isConnected = false;
  el._hass = hass;
  el._fetch();
  await wait(0);
  assert.equal(calls.sub, 0);
  // Put on the page: it reads the network at once (Home Assistant set its state before).
  el.isConnected = true;
  el.connectedCallback();
  await wait(0);
  assert.equal(calls.sub, 1);
  el._unlisten();
  assert.equal(el._unlisten, null);
});

test("zigbee2mqtt card: asks a raw network map after a random delay, renders the Zigbee2MQTT header", async () => {
  timers.length = 0;
  delays.length = 0;
  const hass = mockZ2mHass();
  const el = new fake.ZigbeeCard();
  el._now = () => NOW;
  el._update = () => {};
  el.setConfig({ type: "custom:zigbee-card", default_tab: "map" });
  el._hass = hass;
  el._fetch();
  assert.equal(hass.published.length, 0, "not before the network is in");
  await wait(0);
  runTimers();
  await wait(0);
  // Its rendering (a second after the messages) fetched again: the scan, after its random delay.
  assert.ok(delays.some((ms) => ms > 1000 && ms <= 15000));
  assert.equal(hass.published.length, 1);
  assert.equal(hass.published[0].data.topic, "zigbee2mqtt/bridge/request/networkmap");
  assert.deepEqual(JSON.parse(hass.published[0].data.payload), { type: "raw", routes: false });
  runTimers();
  el._fetch();
  runTimers();
  assert.equal(hass.published.length, 1, "one scan per networkmap_interval");
  assert.match(el._render(), /42 devices/);
  el._tab = "devices";
  assert.match(el._render(), /Zigbee2MQTT · Channel 15 · 42 devices/);
  const net = el._net();
  assert.equal(net.byIeee.get(net.devices.find((d) => d.name === "Front door").parent).name, "Office plug");
  el._unlisten();
});

test("zigbee2mqtt: a scan asked by another browser in the meantime is not asked again", async () => {
  timers.length = 0;
  const hass = mockZ2mHass();
  const calls = z2mConn(hass);
  hass.callService = async (d, sv, data) => hass.published.push(data);
  fake.fetchZ2m(hass, "zigbee2mqtt", 3600e3, {});
  await wait(0);
  fake.fetchZ2m(hass, "zigbee2mqtt", 3600e3, {});
  // Another browser's request goes through the broker before this one's delay is over.
  calls.cbs[0]({ topic: "zigbee2mqtt/bridge/request/networkmap", payload: '{"type":"raw","routes":false}' });
  runTimers();
  await wait(0);
  assert.equal(hass.published.length, 0);
});

test("zigbee2mqtt: HA devices from the registry list by identifier, live name and area from hass.devices", () => {
  const z = mockZ2m();
  const e = { z: { devices: null, info: null, avail: new Map(), state: new Map(), map: null } };
  for (const m of z.retained) zb.z2mMessage(e, "zigbee2mqtt", m);
  const hass = mockZ2mHass();
  const list = Object.values(z.devices);
  // A device of another integration with the same name is never taken.
  list.unshift({ id: "hue_1", name: "Front door", area_id: "garage", identifiers: [["hue", "x"]] });
  hass.devices.dev_e2 = { ...hass.devices.dev_e2, name_by_user: "Main door", area_id: "office" };
  const front = zb.z2mDevices(e.z, hass, list).find((d) => d.friendly_name === undefined && d.name === "Front door");
  assert.equal(front.device_reg_id, "dev_e2");
  assert.equal(front.user_given_name, "Main door");
  assert.equal(front.area_id, "office");
});
