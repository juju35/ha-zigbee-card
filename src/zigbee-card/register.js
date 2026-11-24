// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------
import { pickerDefine } from "./card-picker.js";
import { VERSION } from "./core.js";
import { ZigbeeCard } from "./full-card.js";
import { ZigbeeMiniCard } from "./mini-card.js";
import { ZigbeeCardEditor, ZigbeeMiniCardEditor } from "./visual-editors.js";

export const define = (name, cls) => {
  if (!customElements.get(name)) pickerDefine(name, cls);
};
define("zigbee-card", ZigbeeCard);
define("zigbee-mini-card", ZigbeeMiniCard);
define("zigbee-card-editor", ZigbeeCardEditor);
define("zigbee-mini-card-editor", ZigbeeMiniCardEditor);

window.customCards = window.customCards || [];
for (const card of [
  { type: "zigbee-card", name: "Zigbee Card", description: "The devices and the mesh map of the Zigbee network (ZHA or Zigbee2MQTT), under an animated mesh banner." },
  { type: "zigbee-mini-card", name: "Zigbee Mini Card", description: "The health of the Zigbee network (ZHA or Zigbee2MQTT) in one line, with a zoom button to the full card." },
]) {
  if (!window.customCards.some((c) => c.type === card.type))
    window.customCards.push({ ...card, preview: true, documentationURL: "https://github.com/juju35/ha-zigbee-card" });
}

console.info(`%c ZIGBEE-CARD %c v${VERSION} `, "color: white; background: #b07a00; font-weight: 700;", "color: #b07a00; background: white; font-weight: 700;");
