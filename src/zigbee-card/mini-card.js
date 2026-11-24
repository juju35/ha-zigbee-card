// ---------------------------------------------------------------------------
// The mini card: the network's health in one line; its zoom button unfolds the full card
// ---------------------------------------------------------------------------
import { esc, icon } from "./helpers.js";
import { baseTopic } from "./zigbee2mqtt-data.js";
import { inDialog, watchOutside } from "./shadow-dom-patching.js";
import { MINI_STYLE, STYLE, ZOOM_STYLE } from "./styles.js";
import { ZigbeeCard } from "./full-card.js";

export class ZigbeeMiniCard extends ZigbeeCard {
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
    // The status is in the pill: the devices count alone.
    return [this._p("devices", net.total)];
  }

  _badgeLevel(net) {
    if (!this._zoomed && this._problem_ && this._problem_ !== "loading") return "alert";
    return super._badgeLevel(net);
  }

  _zoomButton(cls = "") {
    if (this._config.zoom === false) return "";
    const z = this._zoomed;
    const label = esc(this._t(z ? "zoom_out" : "zoom_in"));
    return `<button class="zoom ${cls}" title="${label}" aria-label="${label}" aria-expanded="${z}">${icon(z ? "mdi:arrow-collapse" : "mdi:arrow-expand")}</button>`;
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
    if (net) this._watched = net.devices.flatMap((n) => [n.batteryId, n.mainId, n.lqiId]).filter(Boolean);
    const level = problem && problem !== "loading" ? "alert" : this._level(net);
    const bar = this._config.mini_layout === "bar";
    const body = problem
      ? `<div class="${problem === "loading" ? "msub" : "msub warning"}">${esc(this._t(problem, { topic: baseTopic(this._config) }))}</div>`
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
              ${this._pill(net)}
              ${this._zoomButton()}
            </div>
            ${body}
          </div>
        </div>
      </ha-card>`;
  }
}
