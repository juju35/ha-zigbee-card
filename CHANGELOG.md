# Changelog

## 1.2.0 - 2026-11-20

### Features
- **Zigbee2MQTT** support ([#8](https://github.com/juju35/ha-zigbee-card/issues/8)): the same cards on a Zigbee2MQTT network, read from its MQTT topics through Home Assistant (`mqtt/subscribe` on `<base_topic>/#`): devices, channel and PAN id, availability, link quality and last seen, live; the mesh map from a raw network map scan asked when the card loads and every `networkmap_interval` (3600 s, `0` never); battery, area and device page from the Home Assistant device.
- New options `integration` (`auto`, `zha`, `zigbee2mqtt`; `auto` takes ZHA when it is loaded, else Zigbee2MQTT when MQTT is), `base_topic` (`zigbee2mqtt`) and `networkmap_interval`, in the visual editor; the header reads « Zigbee2MQTT · Channel 15 · 42 devices ».
- New messages when no Zigbee2MQTT answers under the base topic or the MQTT integration is missing, in every language.

## 1.1.1 - 2026-11-18

### Fixes
- Illustrated header: `auto` now follows the Home Assistant theme alone — a light theme keeps the day picture after sunset, a dark theme still shows the night one.

## 1.1.0 - 2026-11-17

### Features
- Illustrated header, 90 px on the full card and on the mini card: the title on the left over the amber gradient, on the right a house with the Zigbee coordinator in its middle and six devices around it (bulb, plug, thermometer, motion sensor, lock, blind), packets running along their links, and a 10 px amber mesh strip edge to edge at the bottom, dots running along it (day and night looks).
- The scene follows the network: all well, a weak link (amber, dashed) when a device needs attention, a device offline (the lock red, blinking, its link lost).
- The round `mdi:zigbee` icon takes the status colour on the full and the mini card, day and night: green when all is well, amber with an issue, red with a device offline or an error, grey while loading.
- Automatic night look when the sun is down (`sun.sun`) or with the dark theme of Home Assistant; `illustration_theme: day | night` still forces it. `prefers-reduced-motion` stops the packets, the ping and the strip.
- The mini card shows the same banner with « 42 devices » on its sky and its expand button (`mdi:arrow-expand` / `mdi:arrow-collapse`, 24 px, frosted) in the top right corner, then its chips or health bar; `illustration: false` keeps the one-line layout.
- Status pill right after the title on every header (full and mini card, illustrated or classic): Healthy, « 3 issues », Loading or Unavailable, in the colour of the icon, frosted on the banner day and night; placed by measurement in every language: right after the title only when the whole title and the whole label fit there, otherwise on its own line under the statistics (then kept to one line); when the label would still be cut or leave the banner above its strip, and at 200 px or less, its dot alone. Below 380 px the mesh picture is drawn smaller (about 70 %), so that the title stays whole and the pill keeps its label. New strings in every language.

## 1.0.0 - 2026-11-16

### Features
- **Zigbee Card** (`custom:zigbee-card`): the Zigbee network of the [ZHA integration](https://www.home-assistant.io/integrations/zha/), read from its websocket API (`zha/devices`, `zha/network/settings`), shared by every card of the page and read again every `refresh_interval` seconds.
- Animated banner: an amber gradient with the mesh flowing from the coordinator to its routers and end devices, its far node blinking amber or red when a device needs attention, and packets running along the bottom strip; night look with the dark theme or `illustration_theme: night`; `illustration: false` for a classic header. `prefers-reduced-motion` is honoured.
- **Devices** tab: status chips (online, offline, low battery, last update), filters `All`, `Routers`, `End devices`, `Attention` with their counts, and a two-column grid of 56 px tiles: the device's icon from its main entity, its name, a state line (« Router · LQI 230 », « LQI 156 · battery 82% », « Offline · 3 h », « Weak signal · LQI 61 », « Battery 12% »), four signal bars from the LQI and a status dot. Healthy tiles stay neutral, only issues are coloured. `max_devices` with a folding « Show all » row.
- **Map** tab: the coordinator in the centre, the routers on an inner ring, the end devices outside next to their parent, the links from the neighbor tables coloured by link quality (green, amber dashed when weak, red dashed when lost), a legend, the channel and PAN id, and a folding « Needs attention » list.
- Device popup at the top of the card, from a tile, a map node or a row: model, manufacturer, LQI, RSSI, battery, power source, last seen, parent and its link quality, area, IEEE and network addresses, a folding list of neighbors and a link to the device page; closed by a click elsewhere, Escape, or when the card leaves the page.
- Configurable thresholds: `weak_lqi` (80) and `low_battery` (20 %); `exclude` (YAML only) hides devices by IEEE address or name.
- **Zigbee Mini Card** (`custom:zigbee-mini-card`): a 40 px badge, the network's status and a zoom button that unfolds the full card (folded back by a click elsewhere), with chips (routers, offline, low battery, or online, routers and average LQI on a healthy network) or a health bar (`mini_layout: bar`).
- Visual editors for both cards, the mini card's with the full card's options; 22 languages, with only English in the bundle and each other language loaded on demand.
