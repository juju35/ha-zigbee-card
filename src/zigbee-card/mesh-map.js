// ---------------------------------------------------------------------------
// The mesh map: the coordinator in the centre, the routers on the inner ring, the end devices outside
// ---------------------------------------------------------------------------
import { ZIGBEE_PATH } from "./core.js";
import { esc } from "./helpers.js";

export const MAP_W = 452;
export const MAP_H = 214;
export const R_IN = 64;
export const R_OUT = 96;

// Positions of every device on the map. The routers are spread evenly on the inner ring; the end devices on the
// outer ring, in the order of their parent's angle, the whole ring turned so that each one sits as close as possible
// to its parent. Beyond 8 routers or 24 end devices the rings stretch sideways (the map is wider than tall).
export const layoutMap = (net) => {
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

export const mapSvg = (net, label) => {
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
