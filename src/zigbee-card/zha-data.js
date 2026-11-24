// ---------------------------------------------------------------------------
// ZHA data
// ---------------------------------------------------------------------------
import { num } from "./helpers.js";

// ZHADeviceType of the frontend (zha.ts): the logical type of the node descriptor, "GreenPower" or "unknown".
export const ROLES = { Coordinator: "coordinator", Router: "router", EndDevice: "end", GreenPower: "end" };
export const MAINS = "Mains";
export const DEFAULTS = { weak_lqi: 80, low_battery: 20, max_devices: 12, refresh_interval: 60, networkmap_interval: 3600 };

export const roleOf = (d) => ROLES[d.device_type] || (d.power_source === MAINS ? "router" : "end");

// The device's icon: from its main entity (its own icon, else its device class, else its domain).
export const DOMAIN_ICONS = {
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
export const CLASS_ICONS = {
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
export const DOMAIN_RANK = Object.keys(DOMAIN_ICONS);
// Entities that describe the device itself rather than what it does.
export const SIDE_CLASSES = new Set(["battery", "voltage", "signal_strength", "current", "update", "firmware"]);

// The entity ids of each device (registry), rebuilt when the registry changes.
export const _byDevice = new WeakMap();
export const entitiesOfDevice = (hass, deviceId) => {
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
export const deviceEntities = (hass, d) => {
  const ids = [...new Set([...(d.entities || []).map((e) => e?.entity_id).filter(Boolean), ...entitiesOfDevice(hass, d.device_reg_id)])];
  let battery = null;
  let batteryLow = false;
  let batteryId = null;
  let main = null;
  let rank = Infinity;
  let lqi = null;
  let lqiId = null;
  for (const id of ids) {
    const st = hass?.states?.[id];
    if (!st) continue;
    const domain = id.split(".")[0];
    const dc = st.attributes?.device_class;
    // The link quality sensor of Zigbee2MQTT (`sensor.<name>_linkquality`, in « lqi »).
    if (domain === "sensor" && (st.attributes?.unit_of_measurement === "lqi" || id.endsWith("_linkquality"))) {
      lqi = num(st.state);
      lqiId = id;
      continue;
    }
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
  return { battery, batteryLow, batteryId, main, lqi, lqiId };
};

export const iconOf = (role, main) => {
  if (role === "coordinator") return "mdi:zigbee";
  if (main?.attributes?.icon) return main.attributes.icon;
  const domain = main?.entity_id?.split(".")[0];
  const dc = main?.attributes?.device_class;
  if (domain === "switch" && dc !== "outlet" && role === "router") return "mdi:power-plug";
  return CLASS_ICONS[dc] || DOMAIN_ICONS[domain] || (role === "router" ? "mdi:access-point" : "mdi:zigbee");
};

// `last_seen` of ZHA: the server's local time without an offset ("2026-06-12T09:38:00"), read as local time.
export const seenAt = (v) => {
  const ms = typeof v === "number" ? v * 1000 : Date.parse(v ?? "");
  return Number.isFinite(ms) ? ms : null;
};

export const LEVEL_RANK = { alert: 0, warn: 1, ok: 2 };

// One device of the card: what it is, how it is doing, and its issue (offline, low battery, weak signal).
export const nodeOf = (d, hass, config) => {
  const role = roleOf(d);
  const ent = deviceEntities(hass, d);
  const { battery, batteryLow, batteryId, main } = ent;
  const lqi = num(d.lqi) ?? (d.available !== false ? ent.lqi : null);
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
    lqiId: ent.lqiId,
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
export const linkUp = (nodes, weak) => {
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
export const buildNetwork = (devices, hass, config = {}) => {
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
export const barsOf = (n, weak) => {
  if (!n.available || n.lqi === null) return 0;
  if (n.lqi >= 180) return 4;
  if (n.lqi >= 130) return 3;
  return n.lqi >= weak ? 2 : 1;
};

// The data of a network (ZHA, or one Zigbee2MQTT base topic), shared by every card of the page. Each change
// bumps `version`, which the cards' render signature follows.
export const _zha = new WeakMap();
export const sourceEntry = (hass, key) => {
  const conn = hass?.connection || hass?.callWS;
  if (!conn) return null;
  let all = _zha.get(conn);
  if (!all) _zha.set(conn, (all = new Map()));
  let e = all.get(key);
  if (!e) all.set(key, (e = { key, version: 0, data: null, settings: null, error: null, at: 0, pending: null }));
  return e;
};
// ZHA, read again after `refresh_interval` seconds. Returns the read in progress, or null when the data is fresh.
export const zhaEntry = (hass) => sourceEntry(hass, "zha");
export const ERRORS = { unauthorized: "not_admin", unknown_command: "no_zha" };
export const fetchZha = (hass, maxAgeMs) => {
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
