// Renders the cards with the mock network (scripts/screenshots/mock.mjs) into screenshots/*.png, light and dark.
// Usage: npm install && npm run build && node scripts/screenshots/stills.mjs
// The animations are paused at a chosen moment of their cycle (`at`).
import { cardClip, freeze, launch, mountCard, openPage, pair, root, writeIfChanged } from "./harness.mjs";

const FULL = 480;
const MINI = 380;
export const SHOTS = [
  // The Devices tab: status chips, filters and the device tiles.
  ...pair("card", { tag: "zigbee-card", config: {} }),
  // The Map tab: the mesh, its legend and the devices that need attention.
  ...pair("card-map", { tag: "zigbee-card", config: { default_tab: "map" } }),
  // The Attention filter.
  ...pair("card-attention", { tag: "zigbee-card", config: { default_filter: "attention" } }),
  // The popup of a device, at the top of the card.
  ...pair("card-detail", { tag: "zigbee-card", config: {}, clicks: [".tile.warn"] }),
  // Zigbee2MQTT: the same home read from its MQTT topics, its Devices and Map tabs.
  ...pair("card-z2m", { tag: "zigbee-card", config: { max_devices: 8 }, hass: { z2m: true } }),
  ...pair("card-z2m-map", { tag: "zigbee-card", config: { default_tab: "map" }, hass: { z2m: true } }),
  // The night banner.
  ...pair("card-night", { tag: "zigbee-card", config: { illustration_theme: "night", default_tab: "map" } }),
  // Without the illustration: the classic header.
  ...pair("card-classic", { tag: "zigbee-card", config: { illustration: false, max_devices: 6 } }),
  // The mini card: chips, healthy network, health bar, and unfolded by its zoom button.
  ...pair("mini-card", { tag: "zigbee-mini-card", config: {}, width: MINI }),
  ...pair("mini-card-healthy", { tag: "zigbee-mini-card", config: {}, width: MINI, hass: { healthy: true } }),
  ...pair("mini-card-bar", { tag: "zigbee-mini-card", config: { mini_layout: "bar" }, width: MINI }),
  ...pair("mini-card-classic", { tag: "zigbee-mini-card", config: { illustration: false }, width: MINI }),
  ...pair("mini-card-zoom", { tag: "zigbee-mini-card", config: { max_devices: 6 }, clicks: [".zoom"] }),
];

if (process.argv[1]?.endsWith("stills.mjs")) {
  const browser = await launch();
  for (const s of SHOTS) {
    const width = s.width ?? FULL;
    const page = await openPage(browser, { theme: s.theme, width, label: s.file });
    await mountCard(page, { tag: s.tag, config: s.config, dark: s.theme === "dark", hass: s.hass, clicks: s.clicks });
    await page.waitForTimeout(300);
    await freeze(page, s.at ?? 0.3);
    const out = `screenshots/${s.file}.png`;
    const png = await page.screenshot({ clip: await cardClip(page, width), animations: "allow" });
    console.log(`${out}${(await writeIfChanged(page, `${root}${out}`, png)) ? "" : " (unchanged)"}`);
    await page.close();
  }
  await browser.close();
}
