// ---------------------------------------------------------------------------
// Zigbee2MQTT data
// ---------------------------------------------------------------------------
import { num } from "./helpers.js";
import { MAINS, sourceEntry } from "./zha-data.js";

// The integration a card reads: `integration`, or by itself ZHA when it is loaded, else Zigbee2MQTT when MQTT is.
export const INTEGRATIONS = ["auto", "zha", "zigbee2mqtt"];
export const sourceOf = (hass, config) => {
  const s = config?.integration;
  if (s === "zha" || s === "zigbee2mqtt") return s;
  const c = hass?.config?.components;
  return Array.isArray(c) && !c.includes("zha") && c.includes("mqtt") ? "zigbee2mqtt" : "zha";
};
export const baseTopic = (config) => String(config?.base_topic || "zigbee2mqtt").replace(/^\/+|\/+$/g, "") || "zigbee2mqtt";

// The neighbor relationship of a raw network map's link (ZDO LQI table): the source is the target's parent, child…
export const RELATIONS = ["Parent", "Child", "Sibling"];
export const Z2M_ERRORS = { unauthorized: "not_admin", unknown_command: "no_mqtt" };
// No `bridge/devices` (retained) this long after subscribing: no Zigbee2MQTT under this base topic.
export const Z2M_WAIT_MS = 10000;
export const Z2M_THROTTLE_MS = 1000;
// A failed subscription (MQTT not loaded yet, a lost connection) is tried again after this.
export const Z2M_RETRY_MS = 30000;
// A scan is asked after a random delay (1 to 15 s): the browsers of a home that load or fall due together see the
// first one's request and keep from asking again.
export const Z2M_JITTER_MS = 14000;
export const Z2M_REG_MS = 60000;

// The HA device of each Zigbee2MQTT device, by its `mqtt` identifier `zigbee2mqtt_<ieee>`: from the device registry
// (`config/device_registry/list`, read with the network) or `hass.devices` when it carries the identifiers; by name
// only when neither gives identifiers. Its name and area come from `hass.devices` when it is there (live).
export const _z2mReg = new WeakMap();
export const z2mRegistry = (hass, list) => {
  const key = list || hass?.devices;
  if (!key) return null;
  let idx = _z2mReg.get(key);
  if (!idx) {
    idx = { ieee: new Map(), name: new Map() };
    for (const d of Array.isArray(key) ? key : Object.values(key)) {
      for (const [dom, id] of d?.identifiers || []) {
        const m = dom === "mqtt" && /^zigbee2mqtt_(0x[0-9a-f]+)$/i.exec(String(id));
        if (m) idx.ieee.set(m[1].toLowerCase(), d);
      }
      // By name only when the registry gives no identifiers: never a device of another integration.
      if (!d?.identifiers) for (const n of [d?.name_by_user, d?.name]) if (n && !idx.name.has(n)) idx.name.set(n, d);
    }
    _z2mReg.set(key, idx);
  }
  return idx;
};

export const z2mPower = (v) => (!v ? "" : /^(mains|dc)/i.test(String(v)) ? MAINS : "Battery");
// `last_seen` of Zigbee2MQTT: ISO 8601 or epoch milliseconds; in seconds for seenAt.
export const z2mSeen = (v) => (typeof v === "number" ? v / 1000 : v || null);

// The Zigbee2MQTT network in the shape of `zha/devices`: the bridge's devices, their availability and last state
// (link quality, last seen), and their neighbor tables from the last raw network map.
export const z2mDevices = (z, hass, list = null) => {
  const nbrs = new Map();
  const heard = new Map();
  const seen = new Map();
  for (const l of z.map?.links || []) {
    const src = String(l?.source?.ieeeAddr ?? l?.sourceIeeeAddr ?? "");
    const dst = String(l?.target?.ieeeAddr ?? l?.targetIeeeAddr ?? "");
    if (!src || !dst) continue;
    const lqi = num(l.lqi ?? l.linkquality);
    (nbrs.get(dst) ?? nbrs.set(dst, []).get(dst)).push({ ieee: src, lqi, relationship: RELATIONS[l.relationship] || "Sibling" });
    if (lqi !== null) heard.set(src, Math.max(heard.get(src) ?? 0, lqi));
  }
  for (const n of z.map?.nodes || []) if (n?.ieeeAddr && n.lastSeen) seen.set(String(n.ieeeAddr), n.lastSeen);
  const reg = z2mRegistry(hass, list);
  const coord = z.info?.coordinator;
  return (Array.isArray(z.devices) ? z.devices : [])
    .filter((d) => d?.ieee_address && !d.disabled)
    .map((d) => {
      const ieee = String(d.ieee_address);
      const name = d.friendly_name || ieee;
      const st = z.state.get(name) || {};
      const found = reg?.ieee.get(ieee.toLowerCase()) || reg?.name.get(name) || null;
      const hd = (found && hass?.devices?.[found.id]) || found;
      const isCoord = d.type === "Coordinator";
      return {
        ieee,
        nwk: d.network_address,
        name,
        user_given_name: hd?.name_by_user || null,
        device_type: d.type,
        power_source: isCoord ? MAINS : z2mPower(d.power_source),
        available: z.avail.has(name) ? z.avail.get(name) : true,
        lqi: isCoord ? null : (num(st.linkquality) ?? heard.get(ieee) ?? null),
        rssi: null,
        last_seen: z2mSeen(st.last_seen ?? seen.get(ieee)),
        manufacturer: d.definition?.vendor || d.manufacturer || "",
        model: isCoord ? [coord?.type, coord?.meta?.revision].filter(Boolean).join(" ") : d.definition?.model || d.model_id || "",
        entities: [],
        neighbors: nbrs.get(ieee) || [],
        device_reg_id: hd?.id || null,
        area_id: hd?.area_id || null,
      };
    });
};

// One Zigbee2MQTT message (`mqtt/subscribe` event) into the entry.
export const z2mMessage = (e, topic, m) => {
  const t = String(m?.topic ?? "");
  if (!t.startsWith(`${topic}/`)) return false;
  const rest = t.slice(topic.length + 1);
  let p = m.payload;
  try {
    p = JSON.parse(m.payload);
  } catch (_e) {
    /* a plain text payload (legacy availability) */
  }
  const z = e.z;
  if (rest === "bridge/devices") z.devices = Array.isArray(p) ? p : [];
  else if (rest === "bridge/info") z.info = p && typeof p === "object" ? p : null;
  else if (rest === "bridge/response/networkmap") {
    e.mapAsked = Math.max(e.mapAsked ?? 0, Date.now());
    if (p?.status !== "ok" || p.data?.type !== "raw" || !p.data.value) return false;
    z.map = p.data.value;
  } else if (rest === "bridge/request/networkmap") {
    // A scan asked by any client (another browser, the Zigbee2MQTT frontend): this one does not ask again.
    e.mapAsked = Date.now();
    return false;
  } else if (rest.startsWith("bridge/")) return false;
  else if (rest.endsWith("/availability")) z.avail.set(rest.slice(0, -13), (p && typeof p === "object" ? p.state : p) === "online");
  else if (p && typeof p === "object" && !Array.isArray(p) && !/\/(set|get)(\/|$)/.test(rest)) {
    if (!("linkquality" in p) && !("last_seen" in p)) return false;
    const prev = z.state.get(rest) || {};
    z.state.set(rest, { linkquality: p.linkquality ?? prev.linkquality, last_seen: p.last_seen ?? prev.last_seen });
  } else return false;
  return true;
};

export const z2mBump = (e) => {
  e.version++;
  for (const fn of e.listeners) fn();
};

// The topics read, not the whole `<topic>/#`: four of the bridge (not its logs, events, groups, extensions or
// definitions), the devices' states and availability one level under the base topic (not their `set` / `get`
// requests), and the exact topics of the devices named with a slash (`z2mNamedTopics`, as `bridge/devices` lists them).
export const Z2M_BRIDGE = ["bridge/devices", "bridge/info", "bridge/response/networkmap", "bridge/request/networkmap"];
export const z2mTopics = (topic) => [...Z2M_BRIDGE.map((t) => `${topic}/${t}`), `${topic}/+`, `${topic}/+/availability`];
export const z2mNamedTopics = (topic, devices) =>
  (Array.isArray(devices) ? devices : [])
    .map((d) => String(d?.friendly_name ?? ""))
    .filter((n) => n.includes("/") && !/[+#]/.test(n))
    .flatMap((n) => [`${topic}/${n}`, `${topic}/${n}/availability`]);

// Zigbee2MQTT under `topic`: one set of subscriptions (z2mTopics) for every card of the page, kept while a card uses
// it; a raw network map is asked when the last one is older than `mapEveryMs` (0: never).
export const fetchZ2m = (hass, topic, mapEveryMs, card) => {
  const e = sourceEntry(hass, `z2m:${topic}`);
  if (!e) return null;
  e.listeners ??= new Set();
  e.users ??= new Set();
  if (card) {
    e.users.add(card);
    clearTimeout(e.drop);
  }
  if (!e.sub && (!e.error || Date.now() - e.at >= Z2M_RETRY_MS)) {
    const conn = hass.connection;
    if (typeof conn?.subscribeMessage !== "function") {
      e.error = "load_error";
      e.at = Date.now();
      return null;
    }
    // Each subscription has its own generation: the messages and the failure of an ended one are ignored.
    const gen = (e.gen = (e.gen ?? 0) + 1);
    const live = () => e.gen === gen;
    e.z = { devices: null, info: null, avail: new Map(), state: new Map(), map: null };
    e.mapAsked = 0;
    e.regAt = 0;
    e.reg = null;
    clearTimeout(e.mapTimer);
    e.mapTimer = null;
    let timer = null;
    // Every subscription of this generation, by topic: ended together (e.sub resolves to the function ending them).
    const subs = new Map();
    const endAll = () => {
      for (const p of subs.values()) p.then((unsub) => typeof unsub === "function" && unsub()).catch(() => {});
    };
    const subscribe = (t) => {
      if (!subs.has(t)) subs.set(t, Promise.resolve(conn.subscribeMessage((m) => onMsg(m), { type: "mqtt/subscribe", topic: t })));
      return subs.get(t);
    };
    const onMsg = (m) => {
      if (!live() || !z2mMessage(e, topic, m)) return;
      // The devices named with a slash are not one level under the base topic: their own topics, once known.
      if (String(m.topic).endsWith("/bridge/devices")) for (const t of z2mNamedTopics(topic, e.z.devices)) subscribe(t).catch(() => {});
      if (e.z.devices) {
        // The device registry with the first devices, then at most once a minute when they change (a new device).
        if (String(m.topic).endsWith("/bridge/devices") && Date.now() - (e.regAt ?? 0) >= Z2M_REG_MS && typeof hass.callWS === "function") {
          e.regAt = Date.now();
          Promise.resolve(hass.callWS({ type: "config/device_registry/list" }))
            .then((list) => {
              if (live() && Array.isArray(list)) {
                e.reg = list;
                z2mBump(e);
              }
            })
            .catch(() => {});
        }
        e.data = e.z.devices;
        const ni = e.z.info?.network;
        e.settings = ni ? { settings: { network_info: { channel: ni.channel, pan_id: num(ni.pan_id) !== null ? Number(ni.pan_id).toString(16) : ni.pan_id } } } : null;
        e.error = null;
      }
      // A busy network sends many states: one render a second at most.
      timer ??= setTimeout(() => {
        timer = null;
        if (live()) z2mBump(e);
      }, Z2M_THROTTLE_MS);
    };
    e.sub = Promise.all(z2mTopics(topic).map(subscribe)).then(
      () => endAll,
      (err) => {
        endAll();
        throw err;
      },
    );
    e.sub = e.sub.catch((err) => {
      if (!live()) return null;
      e.error = Z2M_ERRORS[err?.code] || "load_error";
      e.at = Date.now();
      e.sub = null;
      clearTimeout(e.wait);
      z2mBump(e);
      return null;
    });
    clearTimeout(e.wait);
    e.wait = setTimeout(() => {
      if (live() && !e.data && !e.error) {
        e.error = "no_z2m";
        z2mBump(e);
      }
    }, Z2M_WAIT_MS);
  }
  const due = () => mapEveryMs > 0 && e.data && Date.now() - e.mapAsked >= mapEveryMs;
  if (due() && !e.mapTimer && typeof hass.callService === "function") {
    const gen = e.gen;
    e.mapTimer = setTimeout(
      () => {
        e.mapTimer = null;
        if (e.gen !== gen || !due()) return;
        e.mapAsked = Date.now();
        Promise.resolve(
          hass.callService("mqtt", "publish", { topic: `${topic}/bridge/request/networkmap`, payload: JSON.stringify({ type: "raw", routes: false }) }),
        ).catch(() => {});
      },
      1000 + Math.random() * Z2M_JITTER_MS,
    );
  }
  return null;
};

// A card left the page: the subscription ends a minute after the last card of its topic.
export const releaseZ2m = (hass, topic, card) => {
  const e = sourceEntry(hass, `z2m:${topic}`);
  if (!e?.users?.delete(card) || e.users.size) return;
  clearTimeout(e.drop);
  e.drop = setTimeout(() => {
    if (e.users.size) return;
    const sub = e.sub;
    e.gen = (e.gen ?? 0) + 1;
    e.sub = null;
    clearTimeout(e.wait);
    clearTimeout(e.mapTimer);
    Object.assign(e, { data: null, settings: null, error: null, z: null, reg: null, mapTimer: null });
    if (!sub) return;
    sub.then((unsub) => typeof unsub === "function" && unsub()).catch(() => {});
  }, 60000);
};
