// ---------------------------------------------------------------------------
// The illustration: a house and its Zigbee mesh flowing from the coordinator, packets running on the bottom strip
// ---------------------------------------------------------------------------
import { ZIGBEE_PATH } from "./core.js";

// Every animation of the cards lasts a divisor of 6 s (flow, blink and packets 1.5 s, 2 s or 3 s, the ping 2 s), so
// a recording of 6 s loops. The scene: a section of a house standing on the strip, the coordinator in its middle and
// six devices around it (a bulb, a plug, a thermometer, a motion sensor, a lock and a blind), packets running along
// their links. Its state: "ok", "warn" (the thermometer's link weak, amber and dashed) or "off" (the lock offline,
// red, its link lost). Drawn in the right part (x 84 to 200) of a 200 × 80 box; no ids, so cards never clash.
export const SCENE_GLYPHS = {
  light: "M12,2A7,7 0 0,0 5,9C5,11.38 6.19,13.47 8,14.74V17A1,1 0 0,0 9,18H15A1,1 0 0,0 16,17V14.74C17.81,13.47 19,11.38 19,9A7,7 0 0,0 12,2M9,21A1,1 0 0,0 10,22H14A1,1 0 0,0 15,21V20H9V21Z",
  plug: "M7.5,10.5A1.5,1.5 0 0,1 9,12A1.5,1.5 0 0,1 7.5,13.5C6.66,13.5 6,12.83 6,12A1.5,1.5 0 0,1 7.5,10.5M16.5,10.5A1.5,1.5 0 0,1 18,12A1.5,1.5 0 0,1 16.5,13.5A1.5,1.5 0 0,1 15,12A1.5,1.5 0 0,1 16.5,10.5M4.22,2H19.78C21,2 22,3 22,4.22V19.78A2.22,2.22 0 0,1 19.78,22H4.22C3,22 2,21 2,19.78V4.22A2.22,2.22 0 0,1 4.22,2M12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20A8,8 0 0,0 20,12A8,8 0 0,0 12,4Z",
  temp: "M15 13V5A3 3 0 0 0 9 5V13A5 5 0 1 0 15 13M12 4A1 1 0 0 1 13 5V8H11V5A1 1 0 0 1 12 4Z",
  motion: "M10,0.2C9,0.2 8.2,1 8.2,2C8.2,3 9,3.8 10,3.8C11,3.8 11.8,3 11.8,2C11.8,1 11,0.2 10,0.2M15.67,1A7.33,7.33 0 0,0 23,8.33V7A6,6 0 0,1 17,1H15.67M18.33,1C18.33,3.58 20.42,5.67 23,5.67V4.33C21.16,4.33 19.67,2.84 19.67,1H18.33M21,1A2,2 0 0,0 23,3V1H21M7.92,4.03C7.75,4.03 7.58,4.06 7.42,4.11L2,5.8V11H3.8V7.33L5.91,6.67L2,22H3.8L6.67,13.89L9,17V22H10.8V15.59L8.31,11.05L9.04,8.18L10.12,10H15V8.2H11.38L9.38,4.87C9.08,4.37 8.54,4.03 7.92,4.03Z",
  lock: "M12,17A2,2 0 0,0 14,15C14,13.89 13.1,13 12,13A2,2 0 0,0 10,15A2,2 0 0,0 12,17M18,8A2,2 0 0,1 20,10V20A2,2 0 0,1 18,22H6A2,2 0 0,1 4,20V10C4,8.89 4.9,8 6,8H7V6A5,5 0 0,1 12,1A5,5 0 0,1 17,6V8H18M12,3A3,3 0 0,0 9,6V8H15V6A3,3 0 0,0 12,3Z",
  blinds: "M20 19V3H4V19H2V21H22V19H20M16 9H18V11H16V9M14 11H6V9H14V11M18 7H16V5H18V7M14 5V7H6V5H14M6 19V13H14V14.82C13.55 15.14 13.25 15.66 13.25 16.25C13.25 17.22 14.03 18 15 18S16.75 17.22 16.75 16.25C16.75 15.66 16.45 15.13 16 14.82V13H18V19H6Z",
};
export const SCENE_DEVICES = [
  ["light", 114, 36],
  ["plug", 146, 21],
  ["temp", 178, 36],
  ["motion", 110, 65],
  ["lock", 184, 65],
  ["blinds", 146, 70.5],
];
export const SCENE_HUB = [146, 46];
export const SCENE_WEAK = 2;
export const SCENE_OFF = 4;
export const PACKET_S = [1.5, 2, 3, 1.5, 3, 2];
export const sceneSvg = (state) => {
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
