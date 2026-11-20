// Mock ZHA network for the screenshots and the tests: a fictional home of 42 Zigbee devices (14 routers, 28 end
// devices) around a Home Assistant Connect ZBT-2 coordinator, on a fixed clock (NOW) so that every run renders the
// same times. `zha/devices` and `zha/network/settings` answer with the shapes of the ZHA websocket API.
export const NOW = Date.parse("2026-06-12T09:41:00+02:00");

// `last_seen` as ZHA sends it: the local time, without an offset.
const local = (ms) => {
  const d = new Date(ms);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_");

// [name, area, domain, device class, LQI, RSSI]
const ROUTERS = [
  ["Living room ceiling", "living_room", "light", null, 230, -48],
  ["Hallway plug", "hallway", "switch", "outlet", 198, -55],
  ["Office plug", "office", "switch", "outlet", 182, -58],
  ["Kitchen ceiling", "kitchen", "light", null, 214, -51],
  ["Dining room lamp", "dining_room", "light", null, 204, -53],
  ["Bedroom ceiling", "bedroom", "light", null, 176, -60],
  ["TV plug", "living_room", "switch", "outlet", 222, -49],
  ["Garden plug", "garden", "switch", "outlet", 138, -68],
  ["Guest room lamp", "guest_room", "light", null, 168, -62],
  ["Stairs light", "hallway", "light", null, 190, -56],
  ["Desk lamp", "office", "light", null, 186, -57],
  ["Coffee machine plug", "kitchen", "switch", "outlet", 208, -52],
  ["Living room shutter", "living_room", "cover", "shutter", 172, -61],
  ["Laundry plug", "laundry", "switch", "outlet", 150, -65],
];
// [name, area, domain, device class, LQI, battery, parent router index]
const ENDS = [
  ["Kitchen motion", "kitchen", "binary_sensor", "motion", 156, 82, 3],
  ["Front door", "hallway", "binary_sensor", "door", 94, 12, 2],
  ["Bedroom climate", "bedroom", "sensor", "temperature", 141, 64, 5],
  ["Garage door", "garage", "binary_sensor", "garage_door", null, 71, 1],
  ["Bathroom climate", "bathroom", "sensor", "temperature", 61, 58, 2],
  ["Living room climate", "living_room", "sensor", "temperature", 188, 90, 0],
  ["Office climate", "office", "sensor", "temperature", 170, 77, 10],
  ["Hallway motion", "hallway", "binary_sensor", "motion", 162, 69, 9],
  ["Back door", "kitchen", "binary_sensor", "door", 148, 88, 11],
  ["Living room window", "living_room", "binary_sensor", "window", 176, 93, 6],
  ["Bedroom window", "bedroom", "binary_sensor", "window", 133, 80, 5],
  ["Office window", "office", "binary_sensor", "window", 152, 85, 10],
  ["Kitchen leak", "kitchen", "binary_sensor", "moisture", 144, 96, 11],
  ["Bathroom leak", "bathroom", "binary_sensor", "moisture", 121, 74, 9],
  ["Laundry leak", "laundry", "binary_sensor", "moisture", 128, 67, 13],
  ["Hallway smoke", "hallway", "binary_sensor", "smoke", 166, 92, 9],
  ["Bedroom remote", "bedroom", "event", null, 118, 55, 5],
  ["Living room remote", "living_room", "event", null, 181, 61, 0],
  ["Doorbell button", "hallway", "event", null, 137, 79, 1],
  ["Garden climate", "garden", "sensor", "temperature", 102, 66, 7],
  ["Garage motion", "garage", "binary_sensor", "motion", 114, 72, 1],
  ["Stairs motion", "hallway", "binary_sensor", "motion", 158, 83, 9],
  ["Guest room climate", "guest_room", "sensor", "temperature", 149, 87, 8],
  ["Mailbox", "garden", "binary_sensor", "vibration", 98, 59, 7],
  ["Dining room climate", "dining_room", "sensor", "temperature", 171, 91, 4],
  ["Kitchen window", "kitchen", "binary_sensor", "window", 160, 86, 3],
  ["Bathroom window", "bathroom", "binary_sensor", "window", 126, 78, 12],
  ["Laundry climate", "laundry", "sensor", "temperature", 139, 70, 13],
];
export const AREAS = {
  living_room: "Living room", hallway: "Hallway", office: "Office", kitchen: "Kitchen", dining_room: "Dining room", bedroom: "Bedroom",
  garden: "Garden", guest_room: "Guest room", laundry: "Laundry", garage: "Garage", bathroom: "Bathroom",
};

const ieee = (i) => `00:12:4b:00:2a:${(0x10 + Math.floor(i / 256)).toString(16)}:${(i % 256).toString(16).padStart(2, "0")}:7e`;

// `healthy`: the same network with every device online, its batteries full and its signal good.
export const mockNetwork = ({ healthy = false } = {}) => {
  const states = {};
  const devices = [];
  const st = (entity_id, state, attributes = {}) => (states[entity_id] = { entity_id, state: String(state), attributes, last_changed: new Date(NOW).toISOString() });
  const coordinator = {
    ieee: "f4:b3:b1:ff:fe:02:6a:10",
    nwk: 0,
    name: "Nabu Casa ZBT-2",
    manufacturer: "Nabu Casa",
    model: "Home Assistant Connect ZBT-2",
    device_type: "Coordinator",
    power_source: "Mains",
    available: true,
    lqi: null,
    rssi: null,
    last_seen: local(NOW - 2000),
    entities: [],
    neighbors: [],
    routes: [],
    user_given_name: null,
    device_reg_id: "dev_coordinator",
    area_id: null,
    active_coordinator: true,
  };
  devices.push(coordinator);
  const routers = ROUTERS.map(([name, area, domain, dc, lqi, rssi], i) => {
    const id = `${domain}.${slug(name)}`;
    st(id, domain === "cover" ? "open" : "on", { friendly_name: name, ...(dc ? { device_class: dc } : {}) });
    return {
      ieee: ieee(i + 1),
      nwk: 0x1a00 + i * 0x37,
      name: `Mock ${domain} ${i + 1}`,
      user_given_name: name,
      manufacturer: domain === "light" ? "Lumen" : "Plugwise Mock",
      model: domain === "light" ? "Bulb E27 RGBW" : domain === "cover" ? "Shutter module" : "Smart plug 16A",
      device_type: "Router",
      power_source: "Mains",
      available: true,
      lqi,
      rssi,
      last_seen: local(NOW - (20 + i * 7) * 1000),
      entities: [{ entity_id: id, name }],
      neighbors: [{ ieee: coordinator.ieee, nwk: "0x0000", lqi: String(lqi), depth: "0", relationship: "Parent", device_type: "Coordinator" }],
      routes: [],
      device_reg_id: `dev_r${i + 1}`,
      area_id: area,
      active_coordinator: false,
    };
  });
  coordinator.neighbors = routers.map((r) => ({ ieee: r.ieee, nwk: `0x${r.nwk.toString(16)}`, lqi: String(r.lqi), depth: "1", relationship: "Child", device_type: "Router" }));
  devices.push(...routers);
  ENDS.forEach(([name, area, domain, dc, lqi0, battery0, parent], i) => {
    const offline = !healthy && name === "Garage door";
    const battery = healthy && battery0 < 20 ? 82 : battery0;
    const lqi = offline ? null : healthy && lqi0 < 80 ? 140 : lqi0;
    const id = `${domain}.${slug(name)}${domain === "event" ? "_button" : ""}`;
    st(id, offline ? "unavailable" : domain === "binary_sensor" ? "off" : domain === "sensor" ? "21.4" : "unknown", {
      friendly_name: name,
      ...(dc ? { device_class: dc } : {}),
    });
    const bat = `sensor.${slug(name)}_battery`;
    st(bat, offline ? "unavailable" : battery, { device_class: "battery", unit_of_measurement: "%", friendly_name: `${name} Battery` });
    const d = {
      ieee: ieee(100 + i),
      nwk: 0x5c00 + i * 0x29,
      name: `Mock sensor ${i + 1}`,
      user_given_name: name,
      manufacturer: "Sensorio",
      model: domain === "event" ? "Wireless button" : dc === "temperature" ? "Climate sensor" : "Contact sensor",
      device_type: "EndDevice",
      power_source: "Battery or Unknown",
      available: !offline,
      lqi,
      rssi: lqi === null ? null : Math.round(-100 + lqi / 4.5),
      last_seen: local(NOW - (offline ? 3 * 3600 + 720 : 60 + i * 23) * 1000),
      entities: [
        { entity_id: id, name },
        { entity_id: bat, name },
      ],
      neighbors: [],
      routes: [],
      device_reg_id: `dev_e${i + 1}`,
      area_id: area,
      active_coordinator: false,
    };
    devices.push(d);
    routers[parent].neighbors.push({ ieee: d.ieee, nwk: `0x${d.nwk.toString(16)}`, lqi: String(lqi ?? 0), depth: "2", relationship: "Child", device_type: "EndDevice" });
  });
  const settings = { radio_type: "ezsp", device: { path: "/dev/ttyACM0" }, settings: { network_info: { channel: 15, pan_id: "4C7E", extended_pan_id: "aa:bb:cc:dd:ee:ff:00:11" } } };
  return { devices, settings, states };
};

export const mockHass = ({ language = "en", dark = false, healthy = false, error = null } = {}) => {
  const zha = mockNetwork({ healthy });
  const callWS = async (msg) => {
    if (error) throw { code: error, message: error };
    if (msg.type === "zha/devices") return zha.devices;
    if (msg.type === "zha/network/settings") return zha.settings;
    throw { code: "unknown_command" };
  };
  return {
    states: zha.states,
    entities: {},
    areas: Object.fromEntries(Object.entries(AREAS).map(([area_id, name]) => [area_id, { area_id, name }])),
    language,
    locale: { language, time_format: "24", time_zone: "server" },
    config: { time_zone: "Europe/Paris" },
    themes: { darkMode: dark },
    user: { is_admin: true },
    callWS,
    __zha: { ...zha, error },
  };
};

// The same home on Zigbee2MQTT: the retained messages of `zigbee2mqtt/#` (bridge devices and info, availability,
// last states with their link quality) and the answer to a raw network map request, built from the ZHA mock; the HA
// devices carry their `mqtt` identifier `zigbee2mqtt_<ieee>`, the entities their device.
const z2mIeee = (ieee) => `0x${ieee.replace(/:/g, "")}`;
export const mockZ2m = ({ healthy = false, topic = "zigbee2mqtt" } = {}) => {
  const zha = mockNetwork({ healthy });
  const byIeee = new Map(zha.devices.map((d) => [d.ieee, d]));
  const nameOf = (d) => (d.device_type === "Coordinator" ? "Coordinator" : d.user_given_name);
  const msg = (t, payload) => ({ topic: `${topic}/${t}`, payload: JSON.stringify(payload), qos: 0, retain: true });
  const devices = zha.devices.map((d) => ({
    ieee_address: z2mIeee(d.ieee),
    friendly_name: nameOf(d),
    type: d.device_type,
    network_address: d.nwk,
    power_source: d.device_type === "EndDevice" ? "Battery" : "Mains (single phase)",
    model_id: d.model,
    manufacturer: d.manufacturer,
    supported: true,
    disabled: false,
    interview_completed: true,
    definition: d.device_type === "Coordinator" ? null : { model: d.model, vendor: d.manufacturer, description: d.model },
  }));
  const info = {
    version: "2.6.3",
    coordinator: { ieee_address: z2mIeee(zha.devices[0].ieee), type: "EmberZNet", meta: { revision: "8.0.2" } },
    network: { channel: 15, pan_id: 0x4c7e, extended_pan_id: "0xaabbccddeeff0011" },
    config: {},
  };
  const retained = [msg("bridge/state", { state: "online" }), msg("bridge/info", info), msg("bridge/devices", devices)];
  for (const d of zha.devices) {
    if (d.device_type === "Coordinator") continue;
    retained.push(msg(`${nameOf(d)}/availability`, { state: d.available ? "online" : "offline" }));
    if (d.lqi !== null) retained.push(msg(nameOf(d), { linkquality: d.lqi, last_seen: new Date(Date.parse(`${d.last_seen}+02:00`)).toISOString() }));
  }
  // The raw network map: each router's (and the coordinator's) neighbor table, a link per neighbor.
  const REL = { Parent: 0, Child: 1, Sibling: 2 };
  const links = [];
  for (const d of zha.devices)
    for (const n of d.neighbors) {
      const o = byIeee.get(n.ieee);
      links.push({
        source: { ieeeAddr: z2mIeee(n.ieee), networkAddress: o?.nwk ?? 0 },
        target: { ieeeAddr: z2mIeee(d.ieee), networkAddress: d.nwk },
        linkquality: Number(n.lqi),
        lqi: Number(n.lqi),
        depth: Number(n.depth),
        relationship: REL[n.relationship] ?? 3,
        routes: [],
      });
    }
  const nodes = zha.devices.map((d) => ({ ieeeAddr: z2mIeee(d.ieee), friendlyName: nameOf(d), type: d.device_type, networkAddress: d.nwk, failed: [] }));
  const networkmap = { topic: `${topic}/bridge/response/networkmap`, payload: JSON.stringify({ data: { routes: false, type: "raw", value: { nodes, links } }, status: "ok" }), qos: 0, retain: false };
  const haDevices = {};
  const entities = {};
  for (const d of zha.devices) {
    haDevices[d.device_reg_id] = { id: d.device_reg_id, name: nameOf(d), name_by_user: null, area_id: d.area_id, identifiers: [["mqtt", `zigbee2mqtt_${z2mIeee(d.ieee)}`]] };
    for (const e of d.entities) entities[e.entity_id] = { entity_id: e.entity_id, device_id: d.device_reg_id };
  }
  return { retained, networkmap, devices: haDevices, entities, states: zha.states };
};

// A hass on Zigbee2MQTT (no ZHA, MQTT loaded): `mqtt/subscribe` replays the retained messages, a published
// network map request is answered.
export const mockZ2mHass = ({ language = "en", dark = false, healthy = false, error = null } = {}) => {
  const z = mockZ2m({ healthy });
  const subs = new Set();
  return {
    states: z.states,
    entities: z.entities,
    devices: z.devices,
    areas: Object.fromEntries(Object.entries(AREAS).map(([area_id, name]) => [area_id, { area_id, name }])),
    language,
    locale: { language, time_format: "24", time_zone: "server" },
    config: { time_zone: "Europe/Paris", components: ["mqtt", "sun"] },
    themes: { darkMode: dark },
    user: { is_admin: true },
    published: [],
    connection: {
      subscribeMessage: async (cb, msg) => {
        if (error) throw { code: error, message: error };
        if (msg.type !== "mqtt/subscribe") throw { code: "unknown_command" };
        subs.add(cb);
        for (const m of z.retained) cb(m);
        return async () => subs.delete(cb);
      },
    },
    callWS: async () => {
      throw { code: "unknown_command" };
    },
    callService: async function (domain, service, data) {
      this.published.push({ domain, service, data });
      if (domain === "mqtt" && service === "publish" && data.topic.endsWith("/bridge/request/networkmap")) for (const cb of subs) cb(z.networkmap);
    },
    __z2m: { ...z, error },
  };
};
