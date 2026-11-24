// ---------------------------------------------------------------------------
// The full card
// ---------------------------------------------------------------------------
import { esc, fmtLang, icon, num, plural, t } from "./helpers.js";
import { DEFAULTS, MAINS, barsOf, buildNetwork, fetchZha, sourceEntry, zhaEntry } from "./zha-data.js";
import { baseTopic, fetchZ2m, releaseZ2m, sourceOf, z2mDevices } from "./zigbee2mqtt-data.js";
import { inDialog, morph, navigate, watchOutside } from "./shadow-dom-patching.js";
import { sceneSvg } from "./illustration.js";
import { mapSvg } from "./mesh-map.js";
import { STYLE } from "./styles.js";

export const TABS = ["devices", "map"];
export const FILTERS = ["all", "routers", "end_devices", "attention"];
export const FILTER_OF = { all: () => true, routers: (n) => n.role === "router", end_devices: (n) => n.role === "end", attention: (n) => !!n.issue };


// The status pill's place, decided by measurement after each render and each new width (the same rule on every
// card): on the title row, right after the title, only when the whole title and the pill's whole label fit there;
// otherwise on its own line under the statistics (one line), the title whole on its row (cut only when it does not
// fit alone). When the label is still cut there, or the text block leaves the banner or runs over its ground strip,
// the pill keeps its dot alone, on the title row (its label stays in title and aria-label). A card of 200 px or less
// shows the dot alone anyway (CSS), beside the title.
export const placePill = (head, row, ground) => {
  if (!head) return;
  head.removeAttribute("data-wrap");
  head.removeAttribute("data-dot");
  const pill = row.querySelector(":scope > .hpill");
  const text = pill?.querySelector(".txt");
  if (!text?.getBoundingClientRect || text.getBoundingClientRect().width <= 1) return;
  const name = row.querySelector(":scope > .name, :scope > .title");
  const zoom = row.querySelector(":scope > .zoom");
  const gap = parseFloat(getComputedStyle(row).columnGap) || 0;
  const title = name ? (name.scrollWidth > name.clientWidth ? name.scrollWidth : name.getBoundingClientRect().width) + gap : 0;
  const room = row.getBoundingClientRect().width - (zoom ? zoom.getBoundingClientRect().width + gap : 0);
  if (title + pill.getBoundingClientRect().width <= room + 0.5) return;
  head.setAttribute("data-wrap", "");
  const box = (row.closest(".titles") || row).getBoundingClientRect();
  const frame = (ground ? ground.closest(".banner") : head).getBoundingClientRect();
  const out = ground && (box.bottom > ground.getBoundingClientRect().top + 0.5 || box.top < frame.top - 0.5);
  if (text.scrollWidth > text.clientWidth + 0.5 || out) {
    head.removeAttribute("data-wrap");
    head.setAttribute("data-dot", "");
  }
};

export class ZigbeeCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._html = "";
    this._tab = null;
    this._filter = null;
    this._detail = null;
    this._showAll = false;
    // « Needs attention » starts folded, as every collapsible section of the ha-* cards.
    this._attnOpen = false;
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
    // A click elsewhere also folds the « Show all » list and « Needs attention » back (the charter's auto-collapse).
    this._onOutside = (ev) => {
      if (inDialog(ev)) return;
      if (this._detail) {
        this._detailClosedBy = ev;
        this._closeDetail(false);
      } else if (this._showAll || this._attnOpen) {
        this._showAll = false;
        this._attnOpen = false;
        this._update(this._sig);
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
    // Another integration or base topic: the next fetch follows the new one.
    this._unlisten?.();
    if (this._hass) this._fetch();
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
    // A new width (or the web font loaded): the status pill is fitted again, in the next frame.
    if (typeof ResizeObserver === "function") {
      this._resize ??= new ResizeObserver((entries) => {
        const w = Math.round(entries.at(-1).contentRect.width);
        if (w === this._fitWidth) return;
        this._fitWidth = w;
        cancelAnimationFrame(this._fitFrame);
        this._fitFrame = requestAnimationFrame(() => this._fitPill());
      });
      this._resize.observe(this);
    }
    if (typeof document !== "undefined") document.fonts?.ready?.then(() => this._fitPill());
    // The network is read again every `refresh_interval`; the relative times follow the clock.
    clearInterval(this._timer);
    this._timer = setInterval(() => {
      if (!this._hass || !this._config) return;
      this._fetch();
      this.hass = this._hass;
    }, 15000);
    // Home Assistant hands the state over before the card is on the page: the network is read once it is.
    if (this._hass && this._config) this._fetch();
    this._update();
  }

  disconnectedCallback() {
    this._resize?.disconnect();
    if (typeof cancelAnimationFrame === "function") cancelAnimationFrame(this._fitFrame);
    this._fitWidth = null;
    this._outsideWatch?.off();
    clearInterval(this._timer);
    this._unlisten?.();
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

  _source() {
    return sourceOf(this._hass, this._config);
  }

  _entry() {
    return this._source() === "zigbee2mqtt" ? sourceEntry(this._hass, `z2m:${baseTopic(this._config)}`) : zhaEntry(this._hass);
  }

  _fetch() {
    if (this._source() === "zigbee2mqtt") {
      // Home Assistant may still hand its state to a card off the page: it does not hold the subscription.
      if (this.isConnected === false) return;
      const topic = baseTopic(this._config);
      const map = num(this._config.networkmap_interval) ?? DEFAULTS.networkmap_interval;
      fetchZ2m(this._hass, topic, map > 0 ? Math.max(300, map) * 1000 : 0, this);
      const e = this._entry();
      if (e && this._listening !== e) {
        this._unlisten?.();
        const fn = () => this._hass && this._config && (this.hass = this._hass);
        e.listeners.add(fn);
        this._listening = e;
        const hass = this._hass;
        this._unlisten = () => {
          e.listeners.delete(fn);
          releaseZ2m(hass, topic, this);
          this._listening = null;
          this._unlisten = null;
        };
      }
      return;
    }
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
    return buildNetwork(e.z ? z2mDevices(e.z, this._hass, e.reg) : e.data, this._hass, this._config);
  }

  // What the render depends on: language, dark mode, the ZHA data, the minute and the battery and main entities.
  _signature() {
    const h = this._hass;
    const e = this._entry();
    const ids = this._watched || [];
    return [h.language, h.locale, h.themes?.darkMode, e?.version, e?.error, Math.floor(this._now() / 60000), ...ids.map((id) => h.states?.[id])];
  }

  _update(sig) {
    if (!this._hass || !this._config) return;
    const html = this._render();
    this._sig = sig ?? this._signature();
    if (html !== this._html) {
      this._html = html;
      morph(this.shadowRoot, html);
    }
    this._fitPill();
  }

  // The status pill's place, on the banner, the classic header and the classic mini card's row (see placePill).
  _fitPill() {
    for (const row of this.shadowRoot?.querySelectorAll?.(".trow, .mhd") || []) {
      const banner = row.closest(".banner");
      placePill(row.matches(".mhd") ? row : banner || row.closest(".header"), row, banner?.querySelector(".strip"));
    }
  }

  _night() {
    const mode = this._config.illustration_theme;
    if (mode === "night") return true;
    if (mode === "day") return false;
    // Automatic: Home Assistant's dark theme alone (a light theme keeps the day picture after sunset).
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
    return [this._source() === "zigbee2mqtt" ? "Zigbee2MQTT" : "ZHA", channel !== null ? this._t("channel", { n: channel }) : "", this._p("devices", net.total)].filter(Boolean);
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

  // The status pill: a dot and the network's status (Healthy, N issues, Loading, Unavailable) in the colour of the
  // header icon; its label stays in its title and for screen readers when a very narrow card shows the dot alone.
  _pill(net) {
    const problem = net ? null : this._problem();
    const text = problem ? this._t(problem === "loading" ? "st_loading" : "st_unavailable") : net.attention ? this._p("issues", net.attention) : this._t("healthy");
    const level = problem && problem !== "loading" ? "alert" : this._badgeLevel(net);
    return `<span class="chip hpill ${level}" title="${esc(text)}" aria-label="${esc(text)}"><span class="dot"></span><span class="txt">${esc(text)}</span></span>`;
  }

  // The title and the status pill on one row (the pill right after the title), the statistics under them.
  _titleBlock(net, tab) {
    const stats = this._stats(net, tab);
    return `<div class="badge ${this._badgeLevel(net)}">${icon("mdi:zigbee")}</div>
      <div class="titles">
        <div class="trow"><div class="name">${esc(this._title())}</div>${this._pill(net)}</div>
        ${stats.length ? `<div class="stats" title="${esc(stats.join(" · "))}">${stats.map((s) => `<span>${esc(s)}</span>`).join("")}</div>` : ""}
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
    if (problem) return this._shell(null, tab, `<div class="${problem === "loading" ? "empty" : "warning"}">${esc(this._t(problem, { topic: baseTopic(this._config) }))}</div>`);
    const net = (this._net_ = this._net());
    this._watched = net.devices.flatMap((n) => [n.batteryId, n.mainId, n.lqiId]).filter(Boolean);
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
