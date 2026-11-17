/*
 * Zigbee Card for Home Assistant
 * https://github.com/juju35/ha-zigbee-card
 *
 * The Zigbee network of Home Assistant's ZHA integration: its devices (routers, end devices, their link quality,
 * battery and availability) and a map of its mesh, read from the ZHA websocket API (`zha/devices`, the same data
 * as the integration's network visualization, and `zha/network/settings` for the channel and the PAN id).
 * The batteries come from the devices' battery sensors. Reading the network needs an administrator.
 */

const VERSION = "__VERSION__";

// mdi:zigbee, drawn inside the SVG scenes (an <ha-icon> cannot sit in an SVG).
const ZIGBEE_PATH =
  "M4.06,6.15C3.97,6.17 3.88,6.22 3.8,6.28C2.66,7.9 2,9.87 2,12A10,10 0 0,0 12,22C15,22 17.68,20.68 19.5,18.6L17,18.85C14.25,19.15 11.45,19.19 8.66,18.96C7.95,18.94 7.24,18.76 6.59,18.45C5.73,18.06 5.15,17.23 5.07,16.29C5.06,16.13 5.12,16 5.23,15.87L7.42,13.6L15.03,5.7V5.6H10.84C8.57,5.64 6.31,5.82 4.06,6.15M20.17,17.5C20.26,17.47 20.35,17.44 20.43,17.39C21.42,15.83 22,14 22,12A10,10 0 0,0 12,2C9.22,2 6.7,3.13 4.89,4.97H5.17C8.28,4.57 11.43,4.47 14.56,4.65C15.5,4.64 16.45,4.82 17.33,5.17C18.25,5.53 18.89,6.38 19,7.37C19,7.53 18.93,7.7 18.82,7.82L9.71,17.19L9,17.95V18.06H13.14C15.5,18 17.84,17.81 20.17,17.5Z";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const esc = (v) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const lang = (hass, config) => {
  const l = config?.language || (hass && (hass.locale?.language || hass.language)) || "en";
  return STRINGS[l] ? l : STRINGS[l.split("-")[0]] ? l.split("-")[0] : "en";
};

// Locale for Intl: Home Assistant's full locale when its base matches the card's language (keeps the region),
// otherwise the card's language. Home Assistant's "pt" is European Portuguese, which Intl would format as Brazilian.
const fmtLang = (hass, config) => {
  const l = lang(hass, config);
  const ha = hass && (hass.locale?.language || hass.language);
  const loc = ha && ha.split("-")[0] === l.split("-")[0] && l !== "sr-Latn" ? ha : l;
  return loc === "pt" ? "pt-PT" : loc;
};

// A text of the card's language, English when missing, with its {placeholders} filled.
const t = (hass, config, key, vars = {}) => {
  const s = STRINGS[lang(hass, config)][key] ?? STRINGS.en[key] ?? key;
  return String(s).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
};

// "12 devices": the plural form of the card's language (Intl.PluralRules), `_other` when the language has none.
const plural = (hass, config, key, n) => {
  let cat = "other";
  try {
    cat = new Intl.PluralRules(fmtLang(hass, config)).select(n);
  } catch (_e) {
    /* default form */
  }
  const table = STRINGS[lang(hass, config)];
  const k = `${key}_${cat}` in table ? `${key}_${cat}` : `${key}_other`;
  return t(hass, config, k, { n });
};

const num = (v) => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));
const icon = (name, cls = "") => `<ha-icon${cls ? ` class="${cls}"` : ""} icon="${esc(name)}"></ha-icon>`;

// ---------------------------------------------------------------------------
// ZHA data
// ---------------------------------------------------------------------------

// ZHADeviceType of the frontend (zha.ts): the logical type of the node descriptor, "GreenPower" or "unknown".
const ROLES = { Coordinator: "coordinator", Router: "router", EndDevice: "end", GreenPower: "end" };
const MAINS = "Mains";
const DEFAULTS = { weak_lqi: 80, low_battery: 20, max_devices: 12, refresh_interval: 60 };

const roleOf = (d) => ROLES[d.device_type] || (d.power_source === MAINS ? "router" : "end");

// The device's icon: from its main entity (its own icon, else its device class, else its domain).
const DOMAIN_ICONS = {
  light: "mdi:lightbulb",
  switch: "mdi:power-plug",
  cover: "mdi:window-shutter",
  lock: "mdi:lock",
  climate: "mdi:thermostat",
  fan: "mdi:fan",
  valve: "mdi:valve",
  siren: "mdi:bullhorn",
  alarm_control_panel: "mdi:shield-home",
  binary_sensor: "mdi:checkbox-blank-circle-outline",
  sensor: "mdi:eye",
  button: "mdi:gesture-tap-button",
  event: "mdi:gesture-tap-button",
};
const CLASS_ICONS = {
  motion: "mdi:run",
  occupancy: "mdi:run",
  presence: "mdi:run",
  door: "mdi:door-closed",
  opening: "mdi:door-closed",
  garage_door: "mdi:garage",
  garage: "mdi:garage",
  window: "mdi:window-closed",
  moisture: "mdi:water-alert",
  smoke: "mdi:smoke-detector",
  gas: "mdi:smoke-detector",
  carbon_monoxide: "mdi:smoke-detector",
  vibration: "mdi:vibrate",
  temperature: "mdi:thermometer",
  humidity: "mdi:thermometer",
  illuminance: "mdi:brightness-5",
  power: "mdi:flash",
  energy: "mdi:flash",
  pressure: "mdi:gauge",
  curtain: "mdi:curtains",
  blind: "mdi:blinds",
  shutter: "mdi:window-shutter",
  outlet: "mdi:power-plug",
};
const DOMAIN_RANK = Object.keys(DOMAIN_ICONS);
// Entities that describe the device itself rather than what it does.
const SIDE_CLASSES = new Set(["battery", "voltage", "signal_strength", "current", "update", "firmware"]);

// The entity ids of each device (registry), rebuilt when the registry changes.
const _byDevice = new WeakMap();
const entitiesOfDevice = (hass, deviceId) => {
  const reg = hass?.entities;
  if (!reg || !deviceId) return [];
  let idx = _byDevice.get(reg);
  if (!idx) {
    idx = new Map();
    for (const e of Object.values(reg)) if (e?.device_id) (idx.get(e.device_id) ?? idx.set(e.device_id, []).get(e.device_id)).push(e.entity_id);
    _byDevice.set(reg, idx);
  }
  return idx.get(deviceId) || [];
};

// The battery (percent, or a low flag) and the main entity of a device, from its entities' states.
const deviceEntities = (hass, d) => {
  const ids = [...new Set([...(d.entities || []).map((e) => e?.entity_id).filter(Boolean), ...entitiesOfDevice(hass, d.device_reg_id)])];
  let battery = null;
  let batteryLow = false;
  let batteryId = null;
  let main = null;
  let rank = Infinity;
  for (const id of ids) {
    const st = hass?.states?.[id];
    if (!st) continue;
    const domain = id.split(".")[0];
    const dc = st.attributes?.device_class;
    if (dc === "battery" && domain === "sensor" && num(st.state) !== null) {
      battery = Math.round(num(st.state));
      batteryId = id;
      continue;
    }
    if (dc === "battery" && domain === "binary_sensor") {
      batteryLow = st.state === "on";
      batteryId ??= id;
      continue;
    }
    if (hass?.entities?.[id]?.entity_category || SIDE_CLASSES.has(dc)) continue;
    const r = DOMAIN_RANK.indexOf(domain);
    if (r >= 0 && r < rank) {
      rank = r;
      main = st;
    }
  }
  return { battery, batteryLow, batteryId, main };
};

const iconOf = (role, main) => {
  if (role === "coordinator") return "mdi:zigbee";
  if (main?.attributes?.icon) return main.attributes.icon;
  const domain = main?.entity_id?.split(".")[0];
  const dc = main?.attributes?.device_class;
  if (domain === "switch" && dc !== "outlet" && role === "router") return "mdi:power-plug";
  return CLASS_ICONS[dc] || DOMAIN_ICONS[domain] || (role === "router" ? "mdi:access-point" : "mdi:zigbee");
};

// `last_seen` of ZHA: the server's local time without an offset ("2026-06-12T09:38:00"), read as local time.
const seenAt = (v) => {
  const ms = typeof v === "number" ? v * 1000 : Date.parse(v ?? "");
  return Number.isFinite(ms) ? ms : null;
};

const LEVEL_RANK = { alert: 0, warn: 1, ok: 2 };

// One device of the card: what it is, how it is doing, and its issue (offline, low battery, weak signal).
const nodeOf = (d, hass, config) => {
  const role = roleOf(d);
  const { battery, batteryLow, batteryId, main } = deviceEntities(hass, d);
  const lqi = num(d.lqi);
  const weak = num(config.weak_lqi) ?? DEFAULTS.weak_lqi;
  const low = num(config.low_battery) ?? DEFAULTS.low_battery;
  const available = d.available !== false;
  let issue = null;
  if (!available) issue = "offline";
  else if (role !== "coordinator" && ((battery !== null && battery <= low) || (battery === null && batteryLow))) issue = "battery";
  else if (role !== "coordinator" && lqi !== null && lqi < weak) issue = "weak";
  return {
    ieee: String(d.ieee),
    nwk: d.nwk,
    name: d.user_given_name || d.name || String(d.ieee),
    role,
    available,
    lqi,
    rssi: num(d.rssi),
    battery,
    batteryLow: battery !== null ? battery <= low : batteryLow,
    batteryId,
    mainId: main?.entity_id || null,
    icon: iconOf(role, main),
    area: d.area_id ? hass?.areas?.[d.area_id]?.name || "" : "",
    deviceId: d.device_reg_id || null,
    model: d.model || "",
    manufacturer: d.manufacturer || "",
    power: d.power_source || "",
    lastSeen: seenAt(d.last_seen),
    neighbors: Array.isArray(d.neighbors) ? d.neighbors : [],
    issue,
    level: issue === "offline" ? "alert" : issue ? "warn" : "ok",
  };
};

// The link of each device to the mesh: its parent (the router or the coordinator it talks through) and the link
// quality between them, from the neighbor tables (both ways). An end device's parent is the router that lists it as
// its child (or that it lists as its parent); a router goes to the coordinator when it hears it well, else to the
// neighbor it hears best. A device seen in no table hangs from the coordinator, with its own LQI.
const linkUp = (nodes, weak) => {
  const byIeee = new Map(nodes.map((n) => [n.ieee, n]));
  const coord = nodes.find((n) => n.role === "coordinator");
  for (const n of nodes) {
    if (n.role === "coordinator") continue;
    const cands = new Map();
    const add = (p, lqi, preferred) => {
      if (!p || p === n || p.role === "end") return;
      const c = cands.get(p.ieee) || { p, lqi: null, preferred: false };
      if (lqi !== null) c.lqi = Math.max(c.lqi ?? 0, lqi);
      c.preferred ||= preferred;
      cands.set(p.ieee, c);
    };
    for (const p of nodes) {
      if (!p.available) continue;
      const e = p.neighbors.find((x) => String(x?.ieee) === n.ieee);
      if (e) add(p, num(e.lqi), e.relationship === "Child");
    }
    if (n.available) for (const e of n.neighbors) add(byIeee.get(String(e?.ieee)), num(e?.lqi), e?.relationship === "Parent");
    const list = [...cands.values()];
    const best = (l) => l.sort((a, b) => (b.lqi ?? -1) - (a.lqi ?? -1))[0];
    let pick;
    if (n.role === "end") pick = best(list.filter((c) => c.preferred)) || best(list);
    else pick = list.find((c) => c.p.role === "coordinator" && (c.lqi ?? 0) >= weak) || best(list);
    n.parent = pick?.p.ieee ?? coord?.ieee ?? null;
    n.linkLqi = pick ? (pick.lqi ?? n.lqi) : n.lqi;
    n.link = !n.available ? "lost" : n.linkLqi !== null && n.linkLqi < weak ? "weak" : "ok";
  }
  return byIeee;
};

// The whole network as the cards show it.
const buildNetwork = (devices, hass, config = {}) => {
  const exclude = new Set((Array.isArray(config.exclude) ? config.exclude : []).map((x) => String(x).toLowerCase()));
  const weak = num(config.weak_lqi) ?? DEFAULTS.weak_lqi;
  const nodes = (Array.isArray(devices) ? devices : [])
    .filter((d) => d?.ieee)
    .map((d) => nodeOf(d, hass, config))
    .filter((n) => n.role === "coordinator" || !(exclude.has(n.ieee.toLowerCase()) || exclude.has(n.name.toLowerCase())));
  const byIeee = linkUp(nodes, weak);
  const coordinator = nodes.find((n) => n.role === "coordinator") || null;
  const list = nodes
    .filter((n) => n.role !== "coordinator")
    .sort((a, b) => LEVEL_RANK[a.level] - LEVEL_RANK[b.level] || a.name.localeCompare(b.name));
  const lqis = list.filter((n) => n.available && n.lqi !== null).map((n) => n.lqi);
  const count = (f) => list.filter(f).length;
  return {
    coordinator,
    devices: list,
    byIeee,
    total: list.length,
    online: count((n) => n.available),
    offline: count((n) => !n.available),
    routers: count((n) => n.role === "router"),
    ends: count((n) => n.role === "end"),
    lowBattery: count((n) => n.issue === "battery"),
    weak: count((n) => n.issue === "weak"),
    attention: count((n) => n.issue),
    avgLqi: lqis.length ? Math.round(lqis.reduce((a, b) => a + b, 0) / lqis.length) : null,
  };
};

// Four signal bars from the LQI (0 when offline or unknown).
const barsOf = (n, weak) => {
  if (!n.available || n.lqi === null) return 0;
  if (n.lqi >= 180) return 4;
  if (n.lqi >= 130) return 3;
  return n.lqi >= weak ? 2 : 1;
};

// The ZHA data, shared by every card of the page (one websocket call for all of them), read again after
// `refresh_interval` seconds. Each read bumps `version`, which the cards' render signature follows. Returns the
// read in progress, or null when the data is fresh.
const _zha = new WeakMap();
const zhaEntry = (hass) => {
  const key = hass?.connection || hass?.callWS;
  if (!key) return null;
  let e = _zha.get(key);
  if (!e) _zha.set(key, (e = { version: 0, data: null, settings: null, error: null, at: 0, pending: null }));
  return e;
};
const ERRORS = { unauthorized: "not_admin", unknown_command: "no_zha" };
const fetchZha = (hass, maxAgeMs) => {
  const e = zhaEntry(hass);
  if (!e || typeof hass.callWS !== "function") return null;
  if (e.pending) return e.pending;
  if ((e.data || e.error) && Date.now() - e.at < maxAgeMs) return null;
  const settings = e.settings ? Promise.resolve(e.settings) : Promise.resolve(hass.callWS({ type: "zha/network/settings" })).catch(() => null);
  e.pending = Promise.all([hass.callWS({ type: "zha/devices" }), settings])
    .then(([devices, s]) => {
      e.data = Array.isArray(devices) ? devices : [];
      e.settings = s;
      e.error = null;
    })
    .catch((err) => {
      e.error = ERRORS[err?.code] || "load_error";
    })
    .then(() => {
      e.at = Date.now();
      e.version++;
      e.pending = null;
      return e;
    });
  return e.pending;
};

// ---------------------------------------------------------------------------
// Shadow DOM patching (kept nodes keep their focus, hover and running animations)
// ---------------------------------------------------------------------------

const patchAttrs = (cur, next) => {
  for (const { name } of [...cur.attributes]) if (!next.hasAttribute(name)) cur.removeAttribute(name);
  for (const { name, value } of next.attributes) if (cur.getAttribute(name) !== value) cur.setAttribute(name, value);
};
const keyOf = (n) => (n.nodeType === 1 ? n.getAttribute("data-key") : null);
const sameNode = (a, b) => !!a && a.nodeType === b.nodeType && a.nodeName === b.nodeName;
const patchChildren = (cur, next) => {
  const old = [...cur.childNodes];
  const fresh = [...next.childNodes];
  const byKey = new Map();
  for (const o of old) {
    const k = keyOf(o);
    if (k !== null && !byKey.has(k)) byKey.set(k, o);
  }
  const used = new Set();
  fresh.forEach((n, i) => {
    const k = keyOf(n);
    let o = k !== null ? byKey.get(k) : old[i];
    if (!sameNode(o, n) || used.has(o) || (k === null && keyOf(o) !== null)) o = null;
    const ref = cur.childNodes[i] ?? null;
    if (!o) {
      cur.insertBefore(n, ref);
      return;
    }
    used.add(o);
    if (o !== ref) cur.insertBefore(o, ref);
    if (n.nodeType === 1) {
      patchAttrs(o, n);
      patchChildren(o, n);
    } else if (o.nodeValue !== n.nodeValue) o.nodeValue = n.nodeValue;
  });
  while (cur.childNodes.length > fresh.length) cur.removeChild(cur.lastChild);
};
const morph = (root, html) => {
  const tpl = document.createElement("template");
  tpl.innerHTML = html;
  patchChildren(root, tpl.content);
};

// A click inside a dialog (more-info opened from the card) is not a click outside the card.
const inDialog = (ev) => ev.composedPath().some((n) => ["ha-more-info-dialog", "ha-dialog", "dialog"].includes(n.localName));

// "A click elsewhere" is caught on the pointer, not only on the click event: on iOS (Safari and the companion app)
// a tap on something that is not clickable sends no click to the page. The handler runs when the press and the
// release are both outside the card; keyboard clicks (no click count) still go through the click event.
const watchOutside = (card, handler) => {
  let downOutside = false;
  const outside = (ev) => !ev.composedPath().includes(card);
  const onDown = (ev) => {
    downOutside = outside(ev);
  };
  const onUp = (ev) => {
    if (downOutside && outside(ev)) handler(ev);
    downOutside = false;
  };
  const onClick = (ev) => {
    if (ev.detail === 0 && outside(ev)) handler(ev);
  };
  return {
    on() {
      document.addEventListener("pointerdown", onDown, true);
      document.addEventListener("pointerup", onUp, true);
      document.addEventListener("click", onClick, true);
    },
    off() {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("pointerup", onUp, true);
      document.removeEventListener("click", onClick, true);
    },
  };
};

const navigate = (path) => {
  history.pushState(null, "", path);
  window.dispatchEvent(new CustomEvent("location-changed", { detail: { replace: false } }));
};

// ---------------------------------------------------------------------------
// The illustration: a house and its Zigbee mesh flowing from the coordinator, packets running on the bottom strip
// ---------------------------------------------------------------------------

// Every animation of the cards lasts a divisor of 6 s (flow, blink and packets 1.5 s, 2 s or 3 s, the ping 2 s), so
// a recording of 6 s loops. The scene: a section of a house standing on the strip, the coordinator in its middle and
// six devices around it (a bulb, a plug, a thermometer, a motion sensor, a lock and a blind), packets running along
// their links. Its state: "ok", "warn" (the thermometer's link weak, amber and dashed) or "off" (the lock offline,
// red, its link lost). Drawn in the right part (x 84 to 200) of a 200 × 80 box; no ids, so cards never clash.
const SCENE_GLYPHS = {
  light: "M12,2A7,7 0 0,0 5,9C5,11.38 6.19,13.47 8,14.74V17A1,1 0 0,0 9,18H15A1,1 0 0,0 16,17V14.74C17.81,13.47 19,11.38 19,9A7,7 0 0,0 12,2M9,21A1,1 0 0,0 10,22H14A1,1 0 0,0 15,21V20H9V21Z",
  plug: "M7.5,10.5A1.5,1.5 0 0,1 9,12A1.5,1.5 0 0,1 7.5,13.5C6.66,13.5 6,12.83 6,12A1.5,1.5 0 0,1 7.5,10.5M16.5,10.5A1.5,1.5 0 0,1 18,12A1.5,1.5 0 0,1 16.5,13.5A1.5,1.5 0 0,1 15,12A1.5,1.5 0 0,1 16.5,10.5M4.22,2H19.78C21,2 22,3 22,4.22V19.78A2.22,2.22 0 0,1 19.78,22H4.22C3,22 2,21 2,19.78V4.22A2.22,2.22 0 0,1 4.22,2M12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20A8,8 0 0,0 20,12A8,8 0 0,0 12,4Z",
  temp: "M15 13V5A3 3 0 0 0 9 5V13A5 5 0 1 0 15 13M12 4A1 1 0 0 1 13 5V8H11V5A1 1 0 0 1 12 4Z",
  motion: "M10,0.2C9,0.2 8.2,1 8.2,2C8.2,3 9,3.8 10,3.8C11,3.8 11.8,3 11.8,2C11.8,1 11,0.2 10,0.2M15.67,1A7.33,7.33 0 0,0 23,8.33V7A6,6 0 0,1 17,1H15.67M18.33,1C18.33,3.58 20.42,5.67 23,5.67V4.33C21.16,4.33 19.67,2.84 19.67,1H18.33M21,1A2,2 0 0,0 23,3V1H21M7.92,4.03C7.75,4.03 7.58,4.06 7.42,4.11L2,5.8V11H3.8V7.33L5.91,6.67L2,22H3.8L6.67,13.89L9,17V22H10.8V15.59L8.31,11.05L9.04,8.18L10.12,10H15V8.2H11.38L9.38,4.87C9.08,4.37 8.54,4.03 7.92,4.03Z",
  lock: "M12,17A2,2 0 0,0 14,15C14,13.89 13.1,13 12,13A2,2 0 0,0 10,15A2,2 0 0,0 12,17M18,8A2,2 0 0,1 20,10V20A2,2 0 0,1 18,22H6A2,2 0 0,1 4,20V10C4,8.89 4.9,8 6,8H7V6A5,5 0 0,1 12,1A5,5 0 0,1 17,6V8H18M12,3A3,3 0 0,0 9,6V8H15V6A3,3 0 0,0 12,3Z",
  blinds: "M20 19V3H4V19H2V21H22V19H20M16 9H18V11H16V9M14 11H6V9H14V11M18 7H16V5H18V7M14 5V7H6V5H14M6 19V13H14V14.82C13.55 15.14 13.25 15.66 13.25 16.25C13.25 17.22 14.03 18 15 18S16.75 17.22 16.75 16.25C16.75 15.66 16.45 15.13 16 14.82V13H18V19H6Z",
};
const SCENE_DEVICES = [
  ["light", 114, 36],
  ["plug", 146, 21],
  ["temp", 178, 36],
  ["motion", 110, 65],
  ["lock", 184, 65],
  ["blinds", 146, 70.5],
];
const SCENE_HUB = [146, 46];
const SCENE_WEAK = 2;
const SCENE_OFF = 4;
const PACKET_S = [1.5, 2, 3, 1.5, 3, 2];
const sceneSvg = (state) => {
  const [hx, hy] = SCENE_HUB;
  const linkOf = (i) => (state === "off" && i === SCENE_OFF ? "lost" : state === "warn" && i === SCENE_WEAK ? "weak" : "ok");
  const links = SCENE_DEVICES.map(([, x, y], i) => {
    const l = linkOf(i);
    const line = `<line class="ln ${l}" x1="${hx}" y1="${hy}" x2="${x}" y2="${y}"/>`;
    const pkt = l === "lost" ? "" : `<line class="pkt" pathLength="100" x1="${hx}" y1="${hy}" x2="${x}" y2="${y}" style="animation-duration:${PACKET_S[i]}s;animation-delay:-${(i * 0.5) % PACKET_S[i]}s"/>`;
    return line + pkt;
  }).join("");
  const devices = SCENE_DEVICES.map(([k, x, y], i) => {
    const l = linkOf(i);
    return `<g class="dev ${l}" transform="translate(${x} ${y})"><circle r="9.5"/><path transform="translate(-6.5 -6.5) scale(.5417)" d="${SCENE_GLYPHS[k]}"/>${
      l === "lost" ? '<circle class="alarm blink" cx="7" cy="-7" r="2.6"/>' : ""
    }</g>`;
  }).join("");
  return `<svg class="scene" viewBox="84 0 116 80" preserveAspectRatio="xMaxYMax meet" aria-hidden="true" focusable="false">
    <path class="house" d="M92 80 V31 L146 4 L198 31 V80"/><line class="floor" x1="92" y1="${hy}" x2="198" y2="${hy}"/>
    ${links}${devices}
    <g class="hub" transform="translate(${hx} ${hy})"><circle class="ping" r="11"/><circle class="core" r="11"/><path class="mark" transform="translate(-7.5 -7.5) scale(.625)" d="${ZIGBEE_PATH}"/></g>
  </svg>`;
};

// ---------------------------------------------------------------------------
// The mesh map: the coordinator in the centre, the routers on the inner ring, the end devices outside
// ---------------------------------------------------------------------------

const MAP_W = 452;
const MAP_H = 214;
const R_IN = 64;
const R_OUT = 96;

// Positions of every device on the map. The routers are spread evenly on the inner ring; the end devices on the
// outer ring, in the order of their parent's angle, the whole ring turned so that each one sits as close as possible
// to its parent. Beyond 8 routers or 24 end devices the rings stretch sideways (the map is wider than tall).
const layoutMap = (net) => {
  const cx = MAP_W / 2;
  const cy = MAP_H / 2;
  const routers = net.devices.filter((n) => n.role === "router").sort((a, b) => a.name.localeCompare(b.name));
  const ends = net.devices.filter((n) => n.role === "end");
  const sx = Math.min(2.1, Math.max(1, routers.length / 8, ends.length / 24));
  const pos = new Map();
  if (net.coordinator) pos.set(net.coordinator.ieee, { x: cx, y: cy, a: null });
  const at = (r, a) => ({ x: +(cx + r * sx * Math.cos(a)).toFixed(1), y: +(cy + r * Math.sin(a)).toFixed(1), a });
  routers.forEach((n, i) => {
    pos.set(n.ieee, at(R_IN, (i * 2 * Math.PI) / routers.length));
  });
  const want = (n) => pos.get(n.parent)?.a ?? null;
  const sorted = [...ends].sort((a, b) => (want(a) ?? 99) - (want(b) ?? 99) || a.name.localeCompare(b.name));
  const step = (2 * Math.PI) / Math.max(1, sorted.length);
  let s = 0;
  let c = 0;
  sorted.forEach((n, i) => {
    const w = want(n);
    if (w === null) return;
    s += Math.sin(w - i * step);
    c += Math.cos(w - i * step);
  });
  const offset = s || c ? Math.atan2(s, c) : 0;
  sorted.forEach((n, i) => {
    pos.set(n.ieee, at(R_OUT, offset + i * step));
  });
  return { pos, sx, cx, cy };
};

const mapSvg = (net, label) => {
  const { pos, sx, cx, cy } = layoutMap(net);
  const line = (n, cls) => {
    const a = pos.get(n.parent);
    const b = pos.get(n.ieee);
    return a && b ? `<line class="${cls}" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"/>` : "";
  };
  const routers = net.devices.filter((n) => n.role === "router");
  const ends = net.devices.filter((n) => n.role === "end");
  const node = (n, inner) => {
    const p = pos.get(n.ieee);
    return `<g class="node" role="button" tabindex="0" data-device="${esc(n.ieee)}" aria-label="${esc(n.name)}"><circle class="hit" cx="${p.x}" cy="${p.y}" r="11"/>${inner(p)}</g>`;
  };
  const co = net.coordinator;
  return `<svg class="mesh" viewBox="0 0 ${MAP_W} ${MAP_H}" role="img" aria-label="${esc(label)}">
      <g class="rings"><ellipse cx="${cx}" cy="${cy}" rx="${R_IN * sx}" ry="${R_IN}"/><ellipse class="outer" cx="${cx}" cy="${cy}" rx="${R_OUT * sx}" ry="${R_OUT}"/></g>
      <g class="trunk">${routers.map((n) => line(n, `flow ${n.level}`)).join("")}</g>
      <g class="twigs">${ends.map((n) => line(n, n.link)).join("")}</g>
      <g class="leaves">${ends.map((n) => node(n, (p) => `<circle class="leaf ${n.level}${n.level === "ok" ? "" : " blink"}" cx="${p.x}" cy="${p.y}" r="${n.level === "alert" ? 5 : 4.5}"/>`)).join("")}</g>
      <g class="hubs">${routers.map((n) => node(n, (p) => `<circle class="hub ${n.level}${n.level === "ok" ? "" : " blink"}" cx="${p.x}" cy="${p.y}" r="8"/>`)).join("")}</g>
      ${
        co
          ? `<g class="node core-node" role="button" tabindex="0" data-device="${esc(co.ieee)}" aria-label="${esc(co.name)}">
        <circle class="core${co.available ? "" : " down"}" cx="${cx}" cy="${cy}" r="15"/>
        <path class="mark" transform="translate(${cx - 8} ${cy - 8}) scale(0.667)" d="${ZIGBEE_PATH}"/></g>`
          : ""
      }
    </svg>`;
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const STYLE = `
  :host { --zb-accent: #b07a00; --zb-ok: var(--success-color, #43a047); --zb-warn: var(--warning-color, #ffa600);
          --zb-alert: var(--error-color, #db4437); --zb-idle: var(--secondary-text-color, #9e9e9e); display: block; min-width: 0; }
  ha-card { overflow: hidden; position: relative; container-type: inline-size; }
  /* A size container has no width of its own content: in a parent sized by its content the card would fall to a
     few pixels. This empty grid gives it a natural width of 400 px without any minimum. */
  :host::before { content: ""; display: grid; grid-template-columns: minmax(0, 400px); height: 0; }
  [role="button"] { cursor: pointer; }
  [role="button"]:focus-visible, button:focus-visible { outline: 2px solid var(--primary-color, #03a9f4); outline-offset: 2px; }
  .ok { --c: var(--zb-ok); } .warn { --c: var(--zb-warn); } .alert { --c: var(--zb-alert); }
  /* Status pill: the state colour on a tint, the text mixed with the text colour to stay readable. */
  .chip { display: inline-flex; align-items: center; gap: 4px; padding: 1px 8px; border-radius: 12px; font-size: 11px; font-weight: 500;
          line-height: 16px; white-space: nowrap; min-width: 0; max-width: 100%; box-sizing: border-box; overflow: hidden; flex: none;
          background: color-mix(in srgb, var(--c) 16%, transparent); color: color-mix(in srgb, var(--c) 40%, var(--primary-text-color, #212121)); }
  .chip .txt { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
  .dot { width: 6px; height: 6px; border-radius: 50%; background: var(--c); flex: none; }
  .warning, .empty { padding: 14px 16px; font-size: 13px; color: var(--secondary-text-color); }
  .warning { color: color-mix(in srgb, var(--zb-warn) 40%, var(--primary-text-color, #212121)); }

  /* ── Illustrated header: 90 px, the title on the left, the house on the right, a 10 px mesh strip ── */
  .banner { position: relative; height: var(--banner-h, 90px); overflow: hidden; --strip-h: 10px; --scene-w: calc((var(--banner-h, 90px) - var(--strip-h)) * 1.45);
            --sky-text: #3d2a00; --sky-muted: #6b5320; --line: #b07a00; --dev-bg: #fff8ea; --dev-st: #e9c77a; --wall: #d8cfc1;
            --house: rgba(255,255,255,.55); --weak: #f5b400; --lost: #e5484d;
            background: linear-gradient(90deg, #fffaf0 0%, #fdf1d8 34%, #f8dfa8 70%, #f3cf86 100%); }
  .banner.night { --sky-text: #ffffff; --sky-muted: rgba(255,255,255,.78); --line: #ffc94d; --dev-bg: #2b2214; --dev-st: #5a4520;
                  --wall: #3a4456; --house: rgba(255,255,255,.03);
                  background: linear-gradient(90deg, #2e2412 0%, #281f0f 36%, #21190b 72%, #1a1308 100%); }
  .banner .scene { position: absolute; right: var(--scene-shift, 0px); bottom: var(--strip-h); height: calc(100% - var(--strip-h));
                   width: min(var(--scene-w), var(--scene-max, 58%)); overflow: hidden; }
  .scene .house { fill: var(--house); stroke: var(--wall); stroke-width: 1.6; stroke-linejoin: round; }
  .scene .floor { stroke: var(--wall); stroke-width: 1; stroke-dasharray: 3 3; }
  .scene .ln { stroke: var(--line); stroke-width: 1.3; stroke-opacity: .6; }
  .scene .ln.weak { stroke: var(--weak); stroke-opacity: .9; stroke-dasharray: 4 2; }
  .scene .ln.lost { stroke: var(--lost); stroke-opacity: .85; stroke-dasharray: 2 3; }
  .scene .pkt { stroke: var(--line); stroke-width: 3.4; stroke-linecap: round; stroke-dasharray: .1 99.9; fill: none;
                animation: zb-pkt 2s linear infinite; }
  .scene .dev > circle:first-child { fill: var(--dev-bg); stroke: var(--dev-st); stroke-width: 1.5; }
  .scene .dev path { fill: var(--line); }
  .scene .dev.weak > circle:first-child { stroke: var(--weak); }
  .scene .dev.lost > circle:first-child { stroke: var(--lost); }
  .scene .dev.lost path, .scene .alarm { fill: var(--lost); }
  .scene .core { fill: var(--line); }
  .scene .ping { fill: none; stroke: var(--line); stroke-width: 1; transform-box: fill-box; transform-origin: center; animation: zb-ping 2s ease-out infinite; }
  .scene .mark { fill: #ffffff; }
  /* The mesh strip: amber dots on a line, running like packets. */
  .strip { position: absolute; left: 0; right: 0; bottom: 0; height: var(--strip-h); --mc: #d49a16;
           background-color: color-mix(in srgb, var(--mc) 18%, #e9eef5);
           background-image: radial-gradient(circle, var(--mc) 2px, transparent 2.5px), linear-gradient(var(--mc), var(--mc));
           background-size: 24px 100%, 100% 1px; background-repeat: repeat-x, no-repeat; background-position: 0 50%, 0 50%;
           box-shadow: inset 0 2px 0 color-mix(in srgb, var(--mc) 50%, #fff); animation: zb-run 2s linear infinite; }
  .night .strip { background-color: color-mix(in srgb, var(--mc) 20%, #1a202c); }
  .head { position: absolute; z-index: 1; left: 0; top: 0; bottom: var(--strip-h); box-sizing: border-box;
          right: calc(min(var(--scene-w), var(--scene-max, 58%)) + var(--scene-shift, 0px));
          display: flex; align-items: center; gap: 10px; padding: 8px 8px 8px 14px; min-width: 0; color: var(--sky-text); }
  /* The header icon takes the network's status colour: green, amber, red, grey while loading. */
  .idle { --c: var(--zb-idle); }
  .badge { width: 40px; height: 40px; flex: none; border-radius: 50%; display: grid; place-items: center; color: var(--c, var(--zb-accent));
           background: rgba(255,255,255,.62); box-shadow: inset 0 0 0 1px rgba(176,122,0,.2); }
  .night .badge { background: rgba(255,255,255,.12); box-shadow: inset 0 0 0 1px rgba(255,255,255,.14); }
  .badge ha-icon { --mdc-icon-size: 24px; }
  .titles { flex: 1 1 0; min-width: 0; overflow: hidden; }
  .name { font-size: 16px; font-weight: 500; line-height: 1.25; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  /* The statistics on two lines at most: a part that does not fit goes to a third line, clipped away; the "·" that
     starts a line sits in the negative margin, clipped too. */
  .stats { display: flex; flex-wrap: wrap; max-height: 32px; overflow: hidden; margin-left: -10px; font-size: 12px; line-height: 16px; color: var(--sky-muted); }
  .stats span { white-space: nowrap; }
  .stats span::before { content: "·"; display: inline-block; width: 10px; text-align: center; }
  /* A narrow card keeps the gradient and the strip for its texts: no scene. */
  @container (max-width: 300px) {
    .banner .scene { display: none; }
    .head { right: var(--scene-shift, 0px); }
  }

  /* ── Classic header (illustration: false) ── */
  .header { display: flex; align-items: center; gap: 10px; padding: 12px 14px 8px; position: relative; }
  .header .badge { background: color-mix(in srgb, var(--c, var(--zb-accent)) 16%, transparent); box-shadow: none; }
  .header .stats { color: var(--secondary-text-color); }

  /* ── Text tabs ── */
  .tabs { display: flex; gap: 18px; padding: 0 16px; border-bottom: 1px solid var(--divider-color, rgba(127,127,127,.2));
          overflow-x: auto; scrollbar-width: none; }
  .tabs::-webkit-scrollbar { display: none; }
  .tabs.filters { padding: 0 12px; margin-top: 6px; }
  .tab { all: unset; cursor: pointer; padding: 9px 0 7px; font-size: 14px; font-weight: 500; color: var(--secondary-text-color);
         border-bottom: 2px solid transparent; margin-bottom: -1px; white-space: nowrap; flex: none; }
  .tab:hover { color: var(--primary-text-color); }
  .tab[aria-selected="true"] { color: var(--primary-text-color); border-bottom-color: var(--zb-accent); }

  /* ── Status chips ── */
  .status { display: flex; align-items: center; flex-wrap: wrap; gap: 6px 8px; padding: 10px 12px 0; }
  .status .aside { margin-left: auto; font-size: 12px; color: var(--secondary-text-color); white-space: nowrap; min-width: 0;
                   overflow: hidden; text-overflow: ellipsis; }

  /* ── Device tiles: neutral when healthy, the issue colour on the icon and the state line ── */
  .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; padding: 10px 12px 12px; }
  @container (max-width: 300px) { .grid { grid-template-columns: minmax(0, 1fr); } }
  .tile { all: unset; position: relative; box-sizing: border-box; cursor: pointer; min-width: 0; min-height: 56px;
          display: flex; align-items: center; gap: 10px; padding: 8px 10px 8px 8px; border-radius: 12px;
          --t: var(--zb-idle); background: var(--secondary-background-color, #f1f1f1); transition: background .2s; }
  .tile.warn { --t: var(--zb-warn); } .tile.alert { --t: var(--zb-alert); }
  .tile:hover { background: color-mix(in srgb, var(--t) 10%, var(--secondary-background-color, #f1f1f1)); }
  .tile:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 2px; }
  .ic { position: relative; flex: none; width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center;
        color: var(--t); background: color-mix(in srgb, var(--t) 16%, transparent); }
  .tile.ok .ic { color: var(--primary-text-color); background: color-mix(in srgb, var(--zb-idle) 14%, transparent); }
  .ic ha-icon { --mdc-icon-size: 24px; }
  .ic .sdot { position: absolute; right: -1px; bottom: -1px; width: 10px; height: 10px; border-radius: 50%;
              background: var(--zb-ok); box-shadow: 0 0 0 2px var(--secondary-background-color, #f1f1f1); }
  .tile.warn .sdot { background: var(--zb-warn); } .tile.alert .sdot { background: var(--zb-alert); }
  .txt { flex: 1; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .tile .nm { font-size: 14px; font-weight: 500; line-height: 1.25; color: var(--primary-text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .tile .st { font-size: 12px; line-height: 1.25; color: var(--secondary-text-color); overflow-wrap: break-word; }
  .tile:not(.ok) .st { color: var(--t); }
  .bars { display: flex; align-items: flex-end; gap: 2px; height: 14px; flex: none; }
  .bars span { width: 3px; border-radius: 1.5px; background: color-mix(in srgb, var(--zb-idle) 35%, transparent); }
  .bars span:nth-child(1) { height: 4px; } .bars span:nth-child(2) { height: 7px; } .bars span:nth-child(3) { height: 10px; } .bars span:nth-child(4) { height: 13px; }
  .bars span.on { background: var(--secondary-text-color); }
  .tile:not(.ok) .bars span.on { background: var(--t); }
  .grid .empty { grid-column: 1 / -1; padding: 6px 4px; }

  /* ── Folding sections: a chevron pointing right when folded, down when open ── */
  .fold { all: unset; box-sizing: border-box; cursor: pointer; display: flex; align-items: center; gap: 4px; min-width: 0;
          font-size: 13px; font-weight: 500; color: var(--secondary-text-color); }
  .fold:hover { color: var(--primary-text-color); }
  .chevron { flex: none; color: var(--secondary-text-color); --mdc-icon-size: 20px; transition: transform .2s ease; }
  .chevron.closed { transform: rotate(-90deg); }
  .more { margin: -4px 12px 10px; }
  .sec { padding: 10px 12px 2px; width: 100%; }
  .sec .count { font-weight: 400; }

  /* ── Mesh map ── */
  .map { margin: 10px 12px 0; border-radius: 12px; background: var(--secondary-background-color, #f1f1f1); overflow: hidden; }
  .mesh { display: block; width: 100%; height: auto; }
  .mesh .rings { stroke: color-mix(in srgb, var(--zb-idle) 22%, transparent); stroke-width: 1; fill: none; }
  .mesh .rings .outer { stroke-dasharray: 2 4; }
  .mesh .trunk line { stroke-width: 2; fill: none; stroke-linecap: round; stroke-dasharray: 2 5; stroke: var(--c); }
  .mesh .twigs line { stroke-width: 1.3; fill: none; stroke: color-mix(in srgb, var(--zb-ok) 45%, transparent); }
  .mesh .twigs line.weak { stroke: var(--zb-warn); stroke-dasharray: 3 3; }
  .mesh .twigs line.lost { stroke: var(--zb-alert); stroke-dasharray: 2 4; }
  .mesh .leaf { fill: var(--c); }
  .mesh .hub { fill: var(--card-background-color, #fff); stroke: var(--c); stroke-width: 2; }
  .mesh .core { fill: var(--card-background-color, #fff); stroke: var(--zb-accent); stroke-width: 2.2; }
  .mesh .core.down { stroke: var(--zb-alert); }
  .mesh .mark { fill: var(--zb-accent); }
  .mesh .hit { fill: transparent; }
  .mesh .node:hover .hub, .mesh .node:hover .leaf, .mesh .node:hover .core { filter: brightness(1.08); stroke-width: 2.6; }
  .mesh .node:focus-visible { outline: none; }
  .mesh .node:focus-visible .hit { stroke: var(--primary-color, #03a9f4); stroke-width: 1.5; }
  .legend { display: flex; gap: 6px 12px; flex-wrap: wrap; padding: 0 10px 8px; font-size: 11px; color: var(--secondary-text-color); }
  .legend > span { display: flex; align-items: center; gap: 5px; white-space: nowrap; }
  .legend .k { width: 8px; height: 8px; border-radius: 50%; background: var(--card-background-color, #fff); flex: none; }
  .legend .k.co { box-shadow: inset 0 0 0 2px var(--zb-accent); } .legend .k.ro { box-shadow: inset 0 0 0 2px var(--zb-ok); }
  .legend .k.ed { width: 7px; height: 7px; background: var(--zb-ok); }
  .legend .ln { width: 12px; border-top: 2px dashed var(--zb-warn); flex: none; } .legend .ln.lost { border-top-color: var(--zb-alert); }

  /* ── Rows of the devices that need attention ── */
  .list { padding: 2px 0 4px; }
  .row { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 10px; padding: 7px 16px; }
  .row + .row { border-top: 1px solid color-mix(in srgb, var(--divider-color, rgba(127,127,127,.2)) 70%, transparent); }
  .row:hover { background: color-mix(in srgb, var(--zb-accent) 6%, transparent); }
  .row .ri { width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center; color: var(--c);
             background: color-mix(in srgb, var(--c) 16%, transparent); }
  .row .ri ha-icon { --mdc-icon-size: 16px; }
  .row .rn { display: block; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .row .rm { display: block; font-size: 12px; color: var(--secondary-text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .row .chip { max-width: 40cqw; }
  .list .empty { padding: 6px 16px 8px; }

  /* ── Device popup, at the top of the card ── */
  .backdrop { position: absolute; inset: 0; background: rgba(0,0,0,.4); display: flex; align-items: flex-start; justify-content: center;
              padding-top: 10px; box-sizing: border-box; z-index: 9; border-radius: inherit; }
  .modal { background: var(--card-background-color, #fff); color: var(--primary-text-color); width: min(94%, 380px); max-height: calc(100% - 20px);
           overflow: auto; box-sizing: border-box; border-radius: 14px; padding: 14px; box-shadow: 0 8px 30px rgba(0,0,0,.35);
           display: flex; flex-direction: column; gap: 10px; }
  .mhead { display: flex; align-items: flex-start; gap: 10px; }
  .mhead .badge { width: 36px; height: 36px; color: var(--c); background: color-mix(in srgb, var(--c) 16%, transparent); box-shadow: none; }
  .mhead .badge.ok { color: var(--primary-text-color); background: color-mix(in srgb, var(--zb-idle) 14%, transparent); }
  .mhead .badge ha-icon { --mdc-icon-size: 20px; }
  .mhead h3 { margin: 0; font-size: 16px; font-weight: 500; line-height: 1.3; overflow-wrap: anywhere; }
  .mhead .sub { font-size: 12px; color: var(--secondary-text-color); overflow-wrap: anywhere; }
  .mhead > div:not(.badge) { flex: 1 1 auto; min-width: 0; }
  .close { all: unset; flex: none; cursor: pointer; width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center;
           color: var(--secondary-text-color); box-shadow: inset 0 0 0 1px var(--divider-color, rgba(127,127,127,.3)); }
  .close:hover { color: var(--primary-text-color); background: color-mix(in srgb, var(--secondary-text-color) 12%, transparent); }
  .close ha-icon { --mdc-icon-size: 16px; }
  .facts { display: grid; grid-template-columns: max-content minmax(0, 1fr); gap: 5px 12px; margin: 0; font-size: 13px; }
  .facts dt { color: var(--secondary-text-color); }
  .facts dd { margin: 0; overflow-wrap: anywhere; }
  .facts .mono { font-family: var(--code-font-family, monospace); font-size: 12px; }
  .modal .sec { padding: 0; }
  .nbrs { margin: -4px 0 0; padding: 0; list-style: none; font-size: 13px; display: flex; flex-direction: column; gap: 3px; }
  .nbrs li { display: flex; gap: 8px; justify-content: space-between; min-width: 0; }
  .nbrs li span:first-child { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .nbrs li span:last-child { flex: none; color: var(--secondary-text-color); font-variant-numeric: tabular-nums; }
  /* No filled button: an outlined link to the device's page. */
  .link { all: unset; align-self: flex-start; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; padding: 5px 12px;
          border-radius: 18px; font-size: 13px; font-weight: 500; color: var(--primary-color, #03a9f4);
          box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--primary-color, #03a9f4) 45%, transparent); }
  .link:hover { background: color-mix(in srgb, var(--primary-color, #03a9f4) 10%, transparent); }
  .link ha-icon { --mdc-icon-size: 16px; }

  /* ── Animations (each one a divisor of 6 s) ── */
  .flow { animation: zb-flow 1.5s linear infinite; }
  .blink { animation: zb-blink 1.5s ease-in-out infinite; }
  @keyframes zb-flow { to { stroke-dashoffset: -14; } }
  @keyframes zb-blink { 0%, 100% { opacity: 1; } 50% { opacity: .35; } }
  @keyframes zb-run { from { background-position: 0 50%, 0 50%; } to { background-position: 24px 50%, 0 50%; } }
  @keyframes zb-pkt { from { stroke-dashoffset: 0; } to { stroke-dashoffset: -100; } }
  @keyframes zb-ping { from { transform: scale(1); opacity: .9; } to { transform: scale(2.2); opacity: 0; } }
  @media (prefers-reduced-motion: reduce) {
    .flow, .blink, .strip, .scene .pkt, .scene .ping { animation: none !important; }
    .scene .pkt, .scene .ping { display: none; }
    .tile, .chevron { transition: none; }
  }
`;

// The mini card: the full card's banner (the title, the device count and the status on its sky, the zoom button at
// its top right), then chips or a health bar. Without the illustration: a 40 px badge, the title, its status and the
// zoom button in one line, the look of the other ha-* mini cards.
const MINI_STYLE = `
  ha-card.classic { padding: 12px; }
  .mbody { display: flex; flex-direction: column; gap: 4px; padding: 8px 12px 10px; }
  .mbody.bar { gap: 6px; }
  .mini { display: flex; align-items: flex-start; gap: 10px; }
  .mini .badge { color: var(--c); background: color-mix(in srgb, var(--c) 16%, transparent); box-shadow: none; }
  .body { flex: 1; min-width: 0; min-height: 40px; display: flex; flex-direction: column; justify-content: center; gap: 4px; }
  .body.bar { gap: 6px; }
  .mhd { display: flex; align-items: center; gap: 8px; }
  .title { flex: 1 1 0; min-width: 5ch; font-size: 16px; font-weight: 500; line-height: 1.25; color: var(--primary-text-color);
           white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .mst { flex: 0 1 auto; min-width: 0; font-size: 11px; font-weight: 500; color: var(--c); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .mini .zoom { all: unset; flex: none; cursor: pointer; width: 24px; height: 24px; margin: -4px -4px -4px 0; border-radius: 50%;
          display: grid; place-items: center; color: var(--secondary-text-color); }
  .mini .zoom ha-icon { --mdc-icon-size: 16px; }
  .mini .zoom:hover { background: color-mix(in srgb, var(--zb-idle) 16%, transparent); color: var(--primary-text-color); }
  .mini .zoom:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 1px; }
  .rs { display: flex; flex-wrap: wrap; gap: 2px 4px; margin-left: -4px; }
  .rs:empty { display: none; }
  /* A chip is plain (icon and text) until it needs a look: then a tinted pill. */
  .r { display: inline-flex; align-items: baseline; gap: 1px; padding: 0 5px 0 4px; box-sizing: border-box; min-width: 0; max-width: 100%;
       overflow: hidden; border-radius: 999px; font-size: 12px; font-weight: 500; line-height: 18px; white-space: nowrap; --t: var(--zb-ok);
       color: var(--primary-text-color); }
  .r.warn { --t: var(--zb-warn); } .r.alert { --t: var(--zb-alert); }
  .r ha-icon { --mdc-icon-size: 13px; flex: none; color: var(--t); align-self: center; margin-right: 2px; }
  .r > span { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
  .r.pill { color: var(--t); background: color-mix(in srgb, var(--t) 14%, transparent); }
  .hbar { display: flex; height: 6px; border-radius: 3px; overflow: hidden; gap: 2px; }
  .hbar span { border-radius: 3px; background: var(--c); min-width: 3px; }
  .msub { font-size: 12px; color: var(--secondary-text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .mini .warning { padding: 0; }
  /* Narrow: the status is only its dot, its text kept for screen readers. */
  @container (max-width: 200px) {
    .mst { position: relative; flex: none; width: 10px; height: 18px; display: grid; place-items: center; }
    .mst::before { content: ""; width: 8px; height: 8px; border-radius: 50%; background: var(--c); }
    .mst .pt { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
  }
`;
// The unfolded mini card: the full card, with the zoom button at the top right of its banner (the scene moves aside).
const ZOOM_STYLE = `
  .banner { --scene-shift: 26px; }
  .zoom { all: unset; position: absolute; z-index: 2; top: 5px; right: 5px; cursor: pointer; width: 24px; height: 24px; border-radius: 50%;
          display: grid; place-items: center; color: #6b4a14; background: rgba(255,255,255,.55); box-shadow: inset 0 0 0 1px rgba(255,255,255,.7); }
  .zoom.on-night { color: #ffffff; background: rgba(255,255,255,.12); box-shadow: inset 0 0 0 1px rgba(255,255,255,.2); }
  .zoom.plain { color: var(--secondary-text-color); background: none; box-shadow: inset 0 0 0 1px var(--divider-color, rgba(127,127,127,.3)); top: 18px; right: 12px; }
  .zoom ha-icon { --mdc-icon-size: 16px; }
  .zoom:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 1px; }
  .header { padding-right: 48px; }
`;

// ---------------------------------------------------------------------------
// The full card
// ---------------------------------------------------------------------------

const TABS = ["devices", "map"];
const FILTERS = ["all", "routers", "end_devices", "attention"];
const FILTER_OF = { all: () => true, routers: (n) => n.role === "router", end_devices: (n) => n.role === "end", attention: (n) => !!n.issue };

class ZigbeeCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._html = "";
    this._tab = null;
    this._filter = null;
    this._detail = null;
    this._showAll = false;
    this._attnOpen = true;
    this._nbrsOpen = false;
    this.shadowRoot.addEventListener("click", (ev) => this._click(ev));
    this.shadowRoot.addEventListener("keydown", (ev) => {
      if ((ev.key === "Enter" || ev.key === " ") && ev.target.getAttribute?.("role") === "button") {
        ev.preventDefault();
        ev.target.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true, detail: 0 }));
      }
    });
    this._onKey = (ev) => {
      if (this._detail && ev.key === "Escape") {
        ev.stopPropagation();
        this._closeDetail(true);
      }
    };
    // A click elsewhere on the page closes the device popup (and only that: a zoomed mini card stays zoomed).
    this._onOutside = (ev) => {
      if (this._detail && !inDialog(ev)) {
        this._detailClosedBy = ev;
        this._closeDetail(false);
      }
    };
  }

  static getConfigElement() {
    return document.createElement("zigbee-card-editor");
  }

  static getStubConfig() {
    return {};
  }

  getCardSize() {
    return 8;
  }

  // 8 columns: 208 px on a phone.
  getGridOptions() {
    return { columns: 12, min_columns: 8 };
  }

  setConfig(config) {
    if (!config) throw new Error("Invalid configuration");
    this._config = { ...config };
    this._tab = null;
    this._filter = null;
    this._html = "";
    this._update();
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._config) return;
    this._fetch();
    const sig = this._signature();
    if (this._sig && sig.length === this._sig.length && sig.every((v, i) => v === this._sig[i])) return;
    this._update(sig);
  }

  get hass() {
    return this._hass;
  }

  connectedCallback() {
    (this._outsideWatch ??= watchOutside(this, (ev) => this._onOutside(ev))).on();
    // The network is read again every `refresh_interval`; the relative times follow the clock.
    clearInterval(this._timer);
    this._timer = setInterval(() => {
      if (!this._hass || !this._config) return;
      this._fetch();
      this.hass = this._hass;
    }, 15000);
    this._update();
  }

  disconnectedCallback() {
    this._outsideWatch?.off();
    clearInterval(this._timer);
    // Left (another view, a conditional card hidden): the popup closes without anything else.
    this._detail = null;
    window.removeEventListener("keydown", this._onKey);
  }

  _t(key, vars) {
    return t(this._hass, this._config, key, vars);
  }

  _p(key, n) {
    return plural(this._hass, this._config, key, n);
  }

  _now() {
    return Date.now();
  }

  _entry() {
    return zhaEntry(this._hass);
  }

  _fetch() {
    const every = Math.max(10, num(this._config.refresh_interval) ?? DEFAULTS.refresh_interval) * 1000;
    const p = fetchZha(this._hass, every);
    if (p && p !== this._pending) {
      this._pending = p;
      p.then(() => this._hass && this._config && (this.hass = this._hass));
    }
  }

  _net() {
    const e = this._entry();
    if (!e?.data) return null;
    return buildNetwork(e.data, this._hass, this._config);
  }

  // What the render depends on: language, dark mode, the ZHA data, the minute and the battery and main entities.
  _signature() {
    const h = this._hass;
    const e = this._entry();
    const ids = this._watched || [];
    return [h.language, h.locale, h.themes?.darkMode, h.states?.["sun.sun"]?.state, e?.version, e?.error, Math.floor(this._now() / 60000), ...ids.map((id) => h.states?.[id])];
  }

  _update(sig) {
    if (!this._hass || !this._config) return;
    const html = this._render();
    this._sig = sig ?? this._signature();
    if (html !== this._html) {
      this._html = html;
      morph(this.shadowRoot, html);
    }
  }

  _night() {
    const mode = this._config.illustration_theme;
    if (mode === "night") return true;
    if (mode === "day") return false;
    // Automatic: night when the sun is down (sun.sun), else with the dark theme.
    const sun = this._hass?.states?.["sun.sun"]?.state;
    if (sun === "below_horizon" || sun === "above_horizon") return sun === "below_horizon";
    return !!this._hass?.themes?.darkMode;
  }

  _weak() {
    return num(this._config.weak_lqi) ?? DEFAULTS.weak_lqi;
  }

  // "just now", "12 min ago", "3 h ago", "2 d ago".
  _ago(ms) {
    const s = Math.max(0, (this._now() - ms) / 1000);
    if (s < 60) return this._t("just_now");
    if (s < 3600) return this._t("ago_min", { n: Math.floor(s / 60) });
    if (s < 172800) return this._t("ago_h", { n: Math.floor(s / 3600) });
    return this._t("ago_d", { n: Math.floor(s / 86400) });
  }

  // "12 min", "3 h", "2 d".
  _dur(ms) {
    const s = Math.max(60, (this._now() - ms) / 1000);
    if (s < 3600) return this._t("dur_min", { n: Math.floor(s / 60) });
    if (s < 172800) return this._t("dur_h", { n: Math.floor(s / 3600) });
    return this._t("dur_d", { n: Math.floor(s / 86400) });
  }

  _pct(x) {
    return new Intl.NumberFormat(fmtLang(this._hass, this._config), { style: "percent", maximumFractionDigits: 0 }).format(x);
  }

  _channel() {
    const ni = this._entry()?.settings?.settings?.network_info;
    return { channel: num(ni?.channel), pan: ni?.pan_id ? `0x${String(ni.pan_id).replace(/^0x/i, "").toUpperCase()}` : "" };
  }

  // The state line of a tile.
  _stateText(n) {
    if (n.issue === "offline") return n.lastSeen ? `${this._t("offline")} · ${this._dur(n.lastSeen)}` : this._t("offline");
    if (n.issue === "battery") return n.battery !== null ? this._t("battery", { n: n.battery }) : this._t("battery_low");
    if (n.issue === "weak") return `${this._t("weak_signal")} · ${this._t("lqi", { n: n.lqi })}`;
    const lqi = n.lqi !== null ? this._t("lqi", { n: n.lqi }) : "";
    if (n.role === "router") return [this._t("router"), lqi].filter(Boolean).join(" · ");
    if (n.battery !== null) return lqi ? `${lqi} · ${this._t("battery_lower", { n: n.battery })}` : this._t("battery", { n: n.battery });
    return lqi || this._t("online_state");
  }

  // The status text of a device's chip (rows and popup).
  _issueText(n) {
    if (n.issue === "offline") return this._t("offline");
    if (n.issue === "battery") return n.battery !== null ? this._t("battery", { n: n.battery }) : this._t("battery_low");
    if (n.issue === "weak") return this._t("weak_signal");
    return this._t("online_state");
  }

  _chip(level, text) {
    return `<span class="chip ${level}" title="${esc(text)}"><span class="dot"></span><span class="txt">${esc(text)}</span></span>`;
  }

  _title() {
    return this._config.title || this._t("network");
  }

  _stats(net, tab) {
    if (!net) return [];
    if (tab === "map") return [this._p("devices", net.total), this._p("routers", net.routers)];
    const { channel } = this._channel();
    return ["ZHA", channel !== null ? this._t("channel", { n: channel }) : "", this._p("devices", net.total)].filter(Boolean);
  }

  // The network's level: alert when the coordinator or every device is offline, warn with an issue, else ok.
  _level(net) {
    if (!net) return "ok";
    if ((net.coordinator && !net.coordinator.available) || (net.total && net.offline === net.total)) return "alert";
    return net.attention ? "warn" : "ok";
  }

  // The scene's state: a device offline (or the coordinator) shows red, another issue an amber weak link.
  _sceneState(net) {
    if (!net) return "ok";
    if (net.offline || (net.coordinator && !net.coordinator.available)) return "off";
    return net.attention ? "warn" : "ok";
  }

  // The header icon's status, as the scene: red with a device offline, amber with another issue, green when all is
  // well, grey while there is nothing to show.
  _badgeLevel(net) {
    if (!net) return "idle";
    return { off: "alert", warn: "warn", ok: "ok" }[this._sceneState(net)];
  }

  _titleBlock(net, tab) {
    const stats = this._stats(net, tab);
    return `<div class="badge ${this._badgeLevel(net)}">${icon("mdi:zigbee")}</div>
      <div class="titles">
        <div class="name">${esc(this._title())}</div>
        ${stats.length ? `<div class="stats">${stats.map((s) => `<span>${esc(s)}</span>`).join("")}</div>` : ""}
      </div>`;
  }

  _header(net, tab) {
    if (this._config.illustration === false) return `<div class="header">${this._titleBlock(net, tab)}${this._zoomButton("plain")}</div>`;
    const night = this._night();
    return `<div class="banner${night ? " night" : ""}">
      ${sceneSvg(this._sceneState(net))}
      <div class="strip g-mesh zig"></div>
      <div class="head">${this._titleBlock(net, tab)}</div>
      ${this._zoomButton(night ? "on-night" : "")}
    </div>`;
  }

  _tabs(tab) {
    return `<div class="tabs" role="tablist">${TABS.map(
      (k) => `<button class="tab" role="tab" data-tab="${k}" aria-selected="${k === tab}">${esc(this._t(`tab_${k}`))}</button>`,
    ).join("")}</div>`;
  }

  _activeTab() {
    if (this._tab) return this._tab;
    return this._config.default_tab === "map" ? "map" : "devices";
  }

  _activeFilter() {
    if (this._filter) return this._filter;
    return FILTERS.includes(this._config.default_filter) ? this._config.default_filter : "all";
  }

  _statusRow(aside, chips) {
    if (this._config.show_status === false) return "";
    return `<div class="status">${chips.join("")}${aside ? `<span class="aside">${esc(aside)}</span>` : ""}</div>`;
  }

  _bars(n) {
    const on = barsOf(n, this._weak());
    return `<span class="bars" role="img" aria-label="${esc(this._t("signal_bars", { n: on }))}">${[1, 2, 3, 4]
      .map((i) => `<span${i <= on ? ' class="on"' : ""}></span>`)
      .join("")}</span>`;
  }

  _tile(n) {
    return `<div class="tile ${n.level}" role="button" tabindex="0" data-key="d-${esc(n.ieee)}" data-device="${esc(n.ieee)}">
      <span class="ic">${icon(n.icon)}<span class="sdot"></span></span>
      <span class="txt"><span class="nm">${esc(n.name)}</span><span class="st">${esc(this._stateText(n))}</span></span>
      ${this._bars(n)}
    </div>`;
  }

  _devicesView(net) {
    const e = this._entry();
    const chips = [this._chip("ok", this._t("online_of", { n: net.online, total: net.total }))];
    if (net.offline) chips.push(this._chip("alert", this._t("offline_count", { n: net.offline })));
    if (net.lowBattery) chips.push(this._chip("warn", this._t("low_battery_count", { n: net.lowBattery })));
    const filter = this._activeFilter();
    const counts = Object.fromEntries(FILTERS.map((f) => [f, net.devices.filter(FILTER_OF[f]).length]));
    const tabs = `<div class="tabs filters" role="tablist">${FILTERS.map(
      (f) =>
        `<button class="tab" role="tab" data-filter="${f}" aria-selected="${f === filter}">${esc(this._t(`filter_${f}`))} · ${counts[f]}</button>`,
    ).join("")}</div>`;
    const list = net.devices.filter(FILTER_OF[filter]);
    const max = Math.max(0, Math.round(num(this._config.max_devices) ?? DEFAULTS.max_devices));
    const cut = max > 0 && list.length > max && !this._showAll;
    const shown = cut ? list.slice(0, max) : list;
    const empty = this._t(filter === "attention" ? "nothing_attention" : "nothing_filter");
    const more =
      max > 0 && list.length > max
        ? `<button class="fold more" data-action="more" aria-expanded="${!cut}">${icon("mdi:chevron-down", `chevron${cut ? " closed" : ""}`)}<span>${esc(
            cut ? `${this._t("show_all")} · ${list.length}` : this._t("show_less"),
          )}</span></button>`
        : "";
    return `${this._statusRow(e?.at ? this._t("updated", { when: this._ago(e.at) }) : "", chips)}
      ${tabs}
      <div class="grid">${shown.length ? shown.map((n) => this._tile(n)).join("") : `<div class="empty">${esc(empty)}</div>`}</div>
      ${more}`;
  }

  _via(n) {
    const p = this._net_?.byIeee.get(n.parent);
    return p ? this._t("via", { name: p.name }) : "";
  }

  _row(n) {
    const meta =
      n.issue === "offline"
        ? [n.lastSeen ? this._t("last_seen_ago", { when: this._ago(n.lastSeen) }) : "", this._via(n)]
        : [n.lqi !== null ? this._t("lqi", { n: n.lqi }) : "", this._via(n)];
    const ic = n.issue === "battery" ? "mdi:battery-low" : n.icon;
    return `<div class="row ${n.level}" role="button" tabindex="0" data-key="r-${esc(n.ieee)}" data-device="${esc(n.ieee)}">
      <span class="ri">${icon(ic)}</span>
      <span><span class="rn">${esc(n.name)}</span><span class="rm">${esc(meta.filter(Boolean).join(" · "))}</span></span>
      ${this._chip(n.level, this._issueText(n))}
    </div>`;
  }

  _mapView(net) {
    const healthy = net.total ? (net.total - net.attention) / net.total : 1;
    const chips = [
      net.attention ? this._chip("warn", this._p("issues", net.attention)) : this._chip("ok", this._t("healthy")),
      this._chip("ok", this._t("healthy_pct", { pct: this._pct(healthy) })),
    ];
    const { channel, pan } = this._channel();
    const aside = [channel !== null ? this._t("channel", { n: channel }) : "", pan ? this._t("pan", { id: pan }) : ""].filter(Boolean).join(" · ");
    const label = this._t("map_label", { routers: this._p("routers", net.routers), ends: this._p("end_devices", net.ends) });
    const legend = [
      ["k co", this._t("coordinator")],
      ["k ro", this._t("router")],
      ["k ed", this._t("end_device")],
      ["ln", this._t("legend_weak")],
      ["ln lost", this._t("legend_lost")],
    ];
    const issues = net.devices.filter((n) => n.issue);
    const open = this._attnOpen;
    return `${this._statusRow(aside, chips)}
      <div class="map">
        ${mapSvg(net, label)}
        <div class="legend">${legend.map(([k, txt]) => `<span><span class="${k}"></span>${esc(txt)}</span>`).join("")}</div>
      </div>
      <button class="fold sec" data-action="attn" aria-expanded="${open}">${icon("mdi:chevron-down", `chevron${open ? "" : " closed"}`)}<span>${esc(
        this._t("needs_attention"),
      )} <span class="count">· ${issues.length}</span></span></button>
      ${open ? `<div class="list">${issues.length ? issues.map((n) => this._row(n)).join("") : `<div class="empty">${esc(this._t("nothing_attention"))}</div>`}</div>` : ""}`;
  }

  _shell(net, tab, body) {
    return `<style>${STYLE}${this._extraStyle()}</style>
      <ha-card>
        ${this._header(net, tab)}
        ${body}
      </ha-card>`;
  }

  _problem() {
    const e = this._entry();
    if (!e || (!e.data && !e.error)) return "loading";
    if (e.error) return e.error;
    return e.data.length ? null : "no_devices";
  }

  _render() {
    const problem = this._problem();
    const tab = this._activeTab();
    if (problem) return this._shell(null, tab, `<div class="${problem === "loading" ? "empty" : "warning"}">${esc(this._t(problem))}</div>`);
    const net = (this._net_ = this._net());
    this._watched = net.devices.flatMap((n) => [n.batteryId, n.mainId]).filter(Boolean);
    return this._shell(net, tab, `${this._tabs(tab)}${tab === "map" ? this._mapView(net) : this._devicesView(net)}${this._detailHtml(net)}`);
  }

  _extraStyle() {
    return "";
  }

  // The full card has no zoom button.
  _zoomButton() {
    return "";
  }

  _detailHtml(net) {
    const n = this._detail && net.byIeee.get(this._detail);
    if (!n) return "";
    const role = this._t(n.role === "end" ? "end_device" : n.role);
    const fmtNwk = (v) => (typeof v === "number" ? `0x${v.toString(16).toUpperCase().padStart(4, "0")}` : v ? String(v) : "");
    const parent = n.role !== "coordinator" ? net.byIeee.get(n.parent) : null;
    const facts = [
      [this._t("model"), n.model],
      [this._t("manufacturer"), n.manufacturer],
      ["LQI", n.lqi !== null ? String(n.lqi) : ""],
      [this._t("rssi"), n.rssi !== null ? `${n.rssi} dBm` : ""],
      [this._t("battery_power"), n.battery !== null ? `${n.battery} %` : n.batteryLow ? this._t("battery_low") : ""],
      [this._t("power_source"), n.power ? this._t(n.power === MAINS ? "mains" : "battery_power") : ""],
      [this._t("last_seen"), n.lastSeen ? this._ago(n.lastSeen) : ""],
      [this._t("parent"), parent ? `${parent.name}${n.linkLqi !== null && n.linkLqi !== undefined ? ` · LQI ${n.linkLqi}` : ""}` : ""],
      [this._t("area"), n.area],
      [this._t("ieee"), n.ieee, true],
      [this._t("nwk"), fmtNwk(n.nwk), true],
    ].filter(([, v]) => v);
    // Its neighbors, from its own table and from the tables that list it (an end device keeps none of its own).
    const seen = new Map();
    const addNbr = (ieee, lqi) => {
      const k = String(ieee ?? "");
      if (!k || k === n.ieee) return;
      const cur = seen.get(k);
      if (!cur || (lqi ?? -1) > (cur.lqi ?? -1)) seen.set(k, { name: net.byIeee.get(k)?.name || k, lqi });
    };
    for (const e of n.neighbors) addNbr(e?.ieee, num(e?.lqi));
    for (const o of net.byIeee.values()) {
      const e = o.neighbors.find((x) => String(x?.ieee) === n.ieee);
      if (e) addNbr(o.ieee, num(e.lqi));
    }
    const nbrs = [...seen.values()].sort((a, b) => (b.lqi ?? -1) - (a.lqi ?? -1));
    const open = this._nbrsOpen;
    const sub = [role, n.area].filter(Boolean).join(" · ");
    return `<div class="backdrop" data-action="backdrop">
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="zb-dlg-title">
        <div class="mhead">
          <div class="badge ${n.level}">${icon(n.icon)}</div>
          <div><h3 id="zb-dlg-title">${esc(n.name)}</h3><div class="sub">${esc(sub)}</div></div>
          <button class="close" data-action="close" title="${esc(this._t("close"))}" aria-label="${esc(this._t("close"))}">${icon("mdi:close")}</button>
        </div>
        <div>${this._chip(n.level, this._issueText(n))}</div>
        <dl class="facts">${facts.map(([k, v, mono]) => `<dt>${esc(k)}</dt><dd${mono ? ' class="mono"' : ""}>${esc(v)}</dd>`).join("")}</dl>
        ${
          nbrs.length
            ? `<button class="fold sec" data-action="nbrs" aria-expanded="${open}">${icon("mdi:chevron-down", `chevron${open ? "" : " closed"}`)}<span>${esc(
                this._t("neighbors"),
              )} <span class="count">· ${nbrs.length}</span></span></button>
        ${open ? `<ul class="nbrs">${nbrs.map((x) => `<li><span>${esc(x.name)}</span><span>${x.lqi !== null ? `LQI ${x.lqi}` : ""}</span></li>`).join("")}</ul>` : ""}`
            : ""
        }
        ${n.deviceId ? `<button class="link" data-action="device">${icon("mdi:open-in-new")}<span>${esc(this._t("device_page"))}</span></button>` : ""}
      </div>
    </div>`;
  }

  // Opens the device popup; from the keyboard (no click count), the focus goes to its close button.
  _openDetail(ieee, keyboard = false) {
    this._detail = ieee;
    this._nbrsOpen = false;
    window.addEventListener("keydown", this._onKey);
    this._update(this._sig);
    if (keyboard) this.shadowRoot.querySelector?.(".modal .close")?.focus({ preventScroll: true });
  }

  _closeDetail(refocus) {
    if (!this._detail) return;
    const ieee = this._detail;
    this._detail = null;
    window.removeEventListener("keydown", this._onKey);
    this._update(this._sig);
    if (refocus) this.shadowRoot.querySelector?.(`[data-device="${CSS.escape(ieee)}"]`)?.focus({ preventScroll: true });
  }

  _click(ev) {
    const path = ev.composedPath();
    const action = path.find((n) => n.dataset?.action)?.dataset.action;
    if (this._detail) {
      // While the popup is open, its close button and the backdrop close it; a click in it does nothing else.
      if (action === "close" || (action === "backdrop" && path[0]?.dataset?.action === "backdrop")) this._closeDetail(true);
      else if (action === "nbrs") {
        this._nbrsOpen = !this._nbrsOpen;
        this._update(this._sig);
      } else if (action === "device") {
        const n = this._net_?.byIeee.get(this._detail);
        this._closeDetail(false);
        if (n?.deviceId) navigate(`/config/devices/device/${n.deviceId}`);
      }
      return;
    }
    const tab = path.find((n) => n.dataset?.tab)?.dataset.tab;
    if (tab) {
      if (tab !== this._activeTab()) {
        this._tab = tab;
        this._update(this._sig);
      }
      return;
    }
    const filter = path.find((n) => n.dataset?.filter)?.dataset.filter;
    if (filter) {
      this._filter = filter;
      this._showAll = false;
      this._update(this._sig);
      return;
    }
    if (action === "more" || action === "attn") {
      if (action === "more") this._showAll = !this._showAll;
      else this._attnOpen = !this._attnOpen;
      this._update(this._sig);
      return;
    }
    const device = path.find((n) => n.dataset?.device)?.dataset.device;
    if (device) this._openDetail(device, ev.detail === 0);
  }
}

// ---------------------------------------------------------------------------
// The mini card: the network's health in one line; its zoom button unfolds the full card
// ---------------------------------------------------------------------------

class ZigbeeMiniCard extends ZigbeeCard {
  constructor() {
    super();
    this._zoomed = false;
    this._onFold = (ev) => {
      // The click that closed the device popup only closes the popup.
      if (this._detailClosedBy === ev) return;
      if (this._zoomed && !inDialog(ev)) this._setZoom(false);
    };
  }

  static getConfigElement() {
    return document.createElement("zigbee-mini-card-editor");
  }

  connectedCallback() {
    super.connectedCallback();
    (this._foldWatch ??= watchOutside(this, (ev) => this._onFold(ev))).on();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._foldWatch?.off();
    this._zoomed = false;
  }

  getCardSize() {
    return this._zoomed ? super.getCardSize() : this._config?.illustration === false ? 2 : 3;
  }

  getGridOptions() {
    return this._zoomed ? super.getGridOptions() : { columns: 6, min_columns: 6 };
  }

  _setZoom(zoomed) {
    this._zoomed = zoomed;
    if (!zoomed) {
      this._detail = null;
      window.removeEventListener("keydown", this._onKey);
    }
    this._update(this._sig);
  }

  _click(ev) {
    if (!this._detail && ev.composedPath().some((n) => n.classList?.contains("zoom"))) {
      ev.stopPropagation();
      this._setZoom(!this._zoomed);
      if (ev.detail === 0) this.shadowRoot.querySelector(".zoom")?.focus({ preventScroll: true });
      return;
    }
    super._click(ev);
  }

  _title() {
    return this._config.title || this._t(this._zoomed ? "network" : "zigbee");
  }

  _extraStyle() {
    return this._zoomed ? ZOOM_STYLE : "";
  }

  // Folded, the banner's sky holds the device count and the network's status.
  _stats(net, tab) {
    if (this._zoomed) return super._stats(net, tab);
    if (!net) return [];
    return [this._p("devices", net.total), net.attention ? this._p("issues", net.attention) : this._t("healthy")];
  }

  _badgeLevel(net) {
    if (!this._zoomed && this._problem_ && this._problem_ !== "loading") return "alert";
    return super._badgeLevel(net);
  }

  _zoomButton(cls = "") {
    if (this._config.zoom === false) return "";
    const z = this._zoomed;
    const label = esc(this._t(z ? "zoom_out" : "zoom_in"));
    return `<button class="zoom ${cls}" title="${label}" aria-label="${label}" aria-expanded="${z}">${icon(z ? "mdi:magnify-minus-outline" : "mdi:magnify-plus-outline")}</button>`;
  }

  _miniChips(net) {
    const chip = (ic, text, level = "ok", pill = false) => `<span class="r ${level}${pill ? " pill" : ""}">${icon(ic)}<span>${esc(text)}</span></span>`;
    const routers = chip("mdi:router-wireless", this._p("routers", net.routers));
    if (!net.attention)
      return [
        chip("mdi:zigbee", this._t("online", { n: net.online })),
        routers,
        net.avgLqi !== null ? chip("mdi:signal", this._t("lqi", { n: net.avgLqi })) : "",
      ].join("");
    return [
      routers,
      net.offline ? chip("mdi:close-circle", this._t("offline_count", { n: net.offline }), "alert", true) : "",
      net.lowBattery ? chip("mdi:battery-low", this._t("low_battery_count", { n: net.lowBattery }), "warn", true) : "",
    ].join("");
  }

  _miniBar(net) {
    const ok = net.total - net.attention;
    const warn = net.attention - net.offline;
    const segs = [
      ["ok", ok],
      ["warn", warn],
      ["alert", net.offline],
    ].filter(([, v]) => v > 0);
    const aria = [`${ok} ${this._t("healthy").toLowerCase()}`, warn ? `${warn} ${this._t("filter_attention").toLowerCase()}` : "", net.offline ? this._t("offline_count", { n: net.offline }) : ""]
      .filter(Boolean)
      .join(", ");
    const sub = net.attention
      ? [
          net.offline ? this._t("offline_count", { n: net.offline }) : "",
          net.lowBattery ? this._t("low_battery_count", { n: net.lowBattery }) : "",
          this._p("routers", net.routers),
        ]
      : [this._t("online", { n: net.online }), this._p("routers", net.routers), net.avgLqi !== null ? this._t("lqi", { n: net.avgLqi }) : ""];
    return `<div class="hbar" role="img" aria-label="${esc(aria)}">${segs.map(([c, v]) => `<span class="${c}" style="flex-grow: ${v}"></span>`).join("")}</div>
      <div class="msub">${esc(sub.filter(Boolean).join(" · "))}</div>`;
  }

  _render() {
    if (this._zoomed) return super._render();
    const problem = (this._problem_ = this._problem());
    const net = problem ? null : (this._net_ = this._net());
    if (net) this._watched = net.devices.flatMap((n) => [n.batteryId, n.mainId]).filter(Boolean);
    const level = problem && problem !== "loading" ? "alert" : this._level(net);
    const status = problem ? "" : net.attention ? this._p("issues", net.attention) : this._t("healthy");
    const bar = this._config.mini_layout === "bar";
    const body = problem
      ? `<div class="${problem === "loading" ? "msub" : "msub warning"}">${esc(this._t(problem))}</div>`
      : bar
        ? this._miniBar(net)
        : `<div class="rs">${this._miniChips(net)}</div>`;
    if (this._config.illustration !== false) {
      return `<style>${STYLE}${MINI_STYLE}${ZOOM_STYLE}</style>
      <ha-card>
        ${this._header(net, null)}
        <div class="mbody${bar ? " bar" : ""}">${body}</div>
      </ha-card>`;
    }
    return `<style>${STYLE}${MINI_STYLE}</style>
      <ha-card class="classic">
        <div class="mini ${level}">
          <div class="badge ${this._badgeLevel(net)}">${icon("mdi:zigbee")}</div>
          <div class="body${bar ? " bar" : ""}">
            <div class="mhd">
              <span class="title">${esc(this._title())}</span>
              ${status ? `<span class="mst"><span class="pt">${esc(status)}</span></span>` : ""}
              ${this._zoomButton()}
            </div>
            ${body}
          </div>
        </div>
      </ha-card>`;
  }
}

// ---------------------------------------------------------------------------
// Visual editors (ha-form)
// ---------------------------------------------------------------------------

// Options on by default (left out of the YAML while on), and the defaults left out of the YAML.
const ON_BY_DEFAULT = ["show_status", "illustration", "zoom"];
const VALUE_DEFAULTS = { default_tab: "devices", default_filter: "all", illustration_theme: "auto", mini_layout: "chips", ...DEFAULTS };
const LANGUAGES = [
  ["en", "English"], ["fr", "Français"], ["de", "Deutsch"], ["es", "Español"], ["sr", "Српски"], ["sr-Latn", "Srpski (latinica)"],
  ["it", "Italiano"], ["nl", "Nederlands"], ["pt", "Português (Portugal)"], ["pl", "Polski"], ["ro", "Română"], ["da", "Dansk"],
  ["sv", "Svenska"], ["bg", "Български"], ["ru", "Русский"], ["uk", "Українська"], ["hu", "Magyar"], ["sk", "Slovenčina"],
  ["cs", "Čeština"], ["sl", "Slovenščina"], ["lv", "Latviešu"], ["el", "Ελληνικά"],
];

class ZigbeeCardEditor extends HTMLElement {
  static get mini() {
    return false;
  }

  setConfig(config) {
    this._config = { ...config };
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  _schema() {
    const tr = (k) => t(this._hass, this._config, k);
    const select = (name, values, label) => ({
      name,
      selector: { select: { mode: "dropdown", options: values.map((v) => ({ value: v, label: tr(label(v)) })) } },
    });
    const selects = [
      select("default_tab", TABS, (v) => `tab_${v}`),
      select("default_filter", FILTERS, (v) => `filter_${v}`),
      select("illustration_theme", ["auto", "day", "night"], (v) => `theme_${v}`),
    ];
    if (this.constructor.mini) selects.push(select("mini_layout", ["chips", "bar"], (v) => `layout_${v}`));
    const toggles = ["show_status", "illustration"];
    if (this.constructor.mini) toggles.push("zoom");
    return [
      { name: "title", selector: { text: {} } },
      { type: "grid", name: "", schema: selects },
      {
        type: "grid",
        name: "",
        schema: [
          { name: "weak_lqi", selector: { number: { min: 1, max: 254, step: 1, mode: "box" } } },
          { name: "low_battery", selector: { number: { min: 1, max: 100, step: 1, mode: "box", unit_of_measurement: "%" } } },
          { name: "max_devices", selector: { number: { min: 0, max: 500, step: 1, mode: "box" } } },
          { name: "refresh_interval", selector: { number: { min: 10, max: 3600, step: 5, mode: "box", unit_of_measurement: "s" } } },
        ],
      },
      { type: "grid", name: "", schema: toggles.map((name) => ({ name, selector: { boolean: {} } })) },
      {
        name: "language",
        selector: { select: { mode: "dropdown", options: [{ value: "", label: tr("lang_auto") }, ...LANGUAGES.map(([value, label]) => ({ value, label }))] } },
      },
    ];
  }

  _render() {
    if (!this._hass || !this._config) return;
    if (!this._form) {
      this._form = document.createElement("ha-form");
      this._form.computeLabel = (s) => t(this._hass, this._config, s.name);
      this._form.addEventListener("value-changed", (ev) => {
        ev.stopPropagation();
        const config = { ...ev.detail.value };
        for (const [k, v] of Object.entries(config)) {
          // A minimal YAML: no empty values, no options left at their default.
          if (v === "" || v === undefined || v === null || (ON_BY_DEFAULT.includes(k) && v === true) || VALUE_DEFAULTS[k] === v) delete config[k];
        }
        this._config = config;
        this.dispatchEvent(new CustomEvent("config-changed", { detail: { config }, bubbles: true, composed: true }));
      });
      this.appendChild(this._form);
    }
    const data = { ...VALUE_DEFAULTS, ...this._config };
    for (const k of ON_BY_DEFAULT) if (data[k] === undefined) data[k] = true;
    this._form.hass = this._hass;
    this._form.data = data;
    this._form.schema = this._schema();
  }
}

class ZigbeeMiniCardEditor extends ZigbeeCardEditor {
  static get mini() {
    return true;
  }
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

const define = (name, cls) => {
  if (!customElements.get(name)) customElements.define(name, cls);
};
define("zigbee-card", ZigbeeCard);
define("zigbee-mini-card", ZigbeeMiniCard);
define("zigbee-card-editor", ZigbeeCardEditor);
define("zigbee-mini-card-editor", ZigbeeMiniCardEditor);

window.customCards = window.customCards || [];
for (const card of [
  { type: "zigbee-card", name: "Zigbee Card", description: "The devices and the mesh map of the ZHA Zigbee network, under an animated mesh banner." },
  { type: "zigbee-mini-card", name: "Zigbee Mini Card", description: "The health of the ZHA Zigbee network in one line, with a zoom button to the full card." },
]) {
  if (!window.customCards.some((c) => c.type === card.type))
    window.customCards.push({ ...card, preview: true, documentationURL: "https://github.com/juju35/ha-zigbee-card" });
}

console.info(`%c ZIGBEE-CARD %c v${VERSION} `, "color: white; background: #b07a00; font-weight: 700;", "color: #b07a00; background: white; font-weight: 700;");
