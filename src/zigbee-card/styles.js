// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

export const STYLE = `
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
  .titles { flex: 1 1 0; min-width: 0; overflow: hidden; display: flex; flex-direction: column; }
  /* The title row: the pill 8 px after the title with its whole label, only when the whole title fits beside it
     (measured by the card, see placePill); otherwise on its own line under the statistics (kept to one line); when
     even that cuts its label or leaves the banner, and at 200 px or less, its dot alone. */
  .trow { display: flex; align-items: center; gap: 8px; min-width: 0; }
  .trow .name { flex: 0 1 auto; min-width: 0; }
  .hpill { flex: none; max-width: 100%; }
  [data-wrap] .trow { display: contents; }
  [data-wrap] .titles > .stats { order: 2; max-height: 16px; }
  [data-wrap] .titles .hpill { order: 3; align-self: flex-start; margin-top: 2px; }
  [data-wrap].mhd { flex-wrap: wrap; row-gap: 2px; }
  [data-wrap].mhd .hpill { order: 3; }
  [data-dot] .hpill { padding: 3px; }
  [data-dot] .hpill .txt { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
  .banner .hpill { background: color-mix(in srgb, var(--c) 18%, rgba(255,255,255,.78)); color: color-mix(in srgb, var(--c) 45%, #0d2a45); }
  .banner.night .hpill { background: color-mix(in srgb, var(--c) 30%, rgba(8,18,38,.55)); color: color-mix(in srgb, var(--c) 35%, #ffffff); }
  /* 200 px or less: its dot alone. */
  @container (max-width: 200px) {
    .hpill { padding: 3px; }
    .hpill .txt { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
  }
  .name { font-size: 16px; font-weight: 500; line-height: 1.25; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  /* The statistics on two lines at most: a part that does not fit goes to a third line, clipped away; the "·" that
     starts a line sits in the negative margin, clipped too. */
  .stats { display: flex; flex-wrap: wrap; max-height: 32px; overflow: hidden; margin-left: -10px; font-size: 12px; line-height: 16px; color: var(--sky-muted); }
  .stats span { white-space: nowrap; }
  .stats span::before { content: "·"; display: inline-block; width: 10px; text-align: center; }
  /* Narrower cards: the mesh is drawn smaller (about 70 %), so that the title stays whole and the status pill keeps its
     label beside it. */
  @container (max-width: 380px) { .banner { --scene-w: 80px; } }
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
export const MINI_STYLE = `
  ha-card.classic { padding: 12px; }
  .mbody { display: flex; flex-direction: column; gap: 4px; padding: 8px 12px 10px; }
  .mbody.bar { gap: 6px; }
  .mini { display: flex; align-items: flex-start; gap: 10px; }
  .mini .badge { color: var(--c); background: color-mix(in srgb, var(--c) 16%, transparent); box-shadow: none; }
  .body { flex: 1; min-width: 0; min-height: 40px; display: flex; flex-direction: column; justify-content: center; gap: 4px; }
  .body.bar { gap: 6px; }
  .mhd { display: flex; align-items: center; gap: 8px; }
  .mhd .title { flex: 0 1 auto; min-width: 0; }
  .mhd .zoom { margin-left: auto; }
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
export const ZOOM_STYLE = `
  .banner { --scene-shift: 26px; }
  .zoom { all: unset; position: absolute; z-index: 2; top: 5px; right: 5px; cursor: pointer; width: 24px; height: 24px; border-radius: 50%;
          display: grid; place-items: center; color: #33506b; background: rgba(255,255,255,.55); box-shadow: inset 0 0 0 1px rgba(255,255,255,.7);
          -webkit-backdrop-filter: blur(4px); backdrop-filter: blur(4px); }
  .zoom:hover { background: rgba(255,255,255,.75); }
  .zoom.on-night:hover { background: rgba(255,255,255,.22); }
  .zoom.on-night { color: #ffffff; background: rgba(255,255,255,.12); box-shadow: inset 0 0 0 1px rgba(255,255,255,.2); }
  .zoom.plain { color: var(--secondary-text-color); background: none; box-shadow: inset 0 0 0 1px var(--divider-color, rgba(127,127,127,.3)); top: 18px; right: 12px; }
  .zoom ha-icon { --mdc-icon-size: 16px; }
  .zoom:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 1px; }
  .header { padding-right: 48px; }
`;
