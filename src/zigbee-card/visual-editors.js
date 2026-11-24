// ---------------------------------------------------------------------------
// Visual editors (ha-form)
// ---------------------------------------------------------------------------
import { t } from "./helpers.js";
import { DEFAULTS } from "./zha-data.js";
import { INTEGRATIONS, sourceOf } from "./zigbee2mqtt-data.js";
import { FILTERS, TABS } from "./full-card.js";

// Options on by default (left out of the YAML while on), and the defaults left out of the YAML.
export const ON_BY_DEFAULT = ["show_status", "illustration", "zoom"];
export const VALUE_DEFAULTS = { integration: "auto", base_topic: "zigbee2mqtt", default_tab: "devices", default_filter: "all", illustration_theme: "auto", mini_layout: "chips", ...DEFAULTS };
export const LANGUAGES = [
  ["en", "English"], ["fr", "Français"], ["de", "Deutsch"], ["es", "Español"], ["sr", "Српски"], ["sr-Latn", "Srpski (latinica)"],
  ["it", "Italiano"], ["nl", "Nederlands"], ["pt", "Português (Portugal)"], ["pl", "Polski"], ["ro", "Română"], ["da", "Dansk"],
  ["sv", "Svenska"], ["bg", "Български"], ["ru", "Русский"], ["uk", "Українська"], ["hu", "Magyar"], ["sk", "Slovenčina"],
  ["cs", "Čeština"], ["sl", "Slovenščina"], ["lv", "Latviešu"], ["el", "Ελληνικά"],
];

export class ZigbeeCardEditor extends HTMLElement {
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
      select("integration", INTEGRATIONS, (v) => `integration_${v}`),
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
      ...(sourceOf(this._hass, this._config) === "zigbee2mqtt"
        ? [
            {
              type: "grid",
              name: "",
              schema: [
                { name: "base_topic", selector: { text: {} } },
                { name: "networkmap_interval", selector: { number: { min: 0, max: 86400, step: 60, mode: "box", unit_of_measurement: "s" } } },
              ],
            },
          ]
        : []),
      {
        type: "grid",
        name: "",
        schema: [
          { name: "weak_lqi", selector: { number: { min: 1, max: 254, step: 1, mode: "box" } } },
          { name: "low_battery", selector: { number: { min: 1, max: 100, step: 1, mode: "box", unit_of_measurement: "%" } } },
          { name: "max_devices", selector: { number: { min: 0, max: 500, step: 1, mode: "box" } } },
          ...(sourceOf(this._hass, this._config) === "zigbee2mqtt"
            ? []
            : [{ name: "refresh_interval", selector: { number: { min: 10, max: 3600, step: 5, mode: "box", unit_of_measurement: "s" } } }]),
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

export class ZigbeeMiniCardEditor extends ZigbeeCardEditor {
  static get mini() {
    return true;
  }
}
