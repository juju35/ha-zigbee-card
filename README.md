# ha-zigbee-card

[![Marketplace](https://img.shields.io/badge/Marketplace-Custom-41BDF5.svg)](https://www.home-assistant.io/integrations/marketplace/)
[![Marketplace Validation](https://github.com/juju35/ha-zigbee-card/actions/workflows/hacs.yml/badge.svg)](https://github.com/juju35/ha-zigbee-card/actions/workflows/hacs.yml)
[![Validate](https://github.com/juju35/ha-zigbee-card/actions/workflows/validate.yml/badge.svg)](https://github.com/juju35/ha-zigbee-card/actions/workflows/validate.yml)
[![Lint](https://github.com/juju35/ha-zigbee-card/actions/workflows/lint.yml/badge.svg)](https://github.com/juju35/ha-zigbee-card/actions/workflows/lint.yml)
[![Release](https://img.shields.io/github/v/release/juju35/ha-zigbee-card)](https://github.com/juju35/ha-zigbee-card/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/juju35/ha-zigbee-card/blob/main/LICENSE)
[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-FFDD00?logo=buymeacoffee&logoColor=black)](https://buymeacoffee.com/julienstep9)

<p align="center"><img src="https://raw.githubusercontent.com/juju35/ha-zigbee-card/main/images/icon.svg" alt="Zigbee Card" width="120"></p>

<p align="center">
  <a href="https://www.home-assistant.io/integrations/zha/"><img src="https://raw.githubusercontent.com/juju35/ha-zigbee-card/main/images/zha.png" alt="ZHA" width="64"></a>&nbsp;&nbsp;
  <a href="https://www.zigbee2mqtt.io/"><img src="https://raw.githubusercontent.com/juju35/ha-zigbee-card/main/images/zigbee2mqtt.png" alt="Zigbee2MQTT" width="64"></a>
</p>

A card for the **Zigbee network** of Home Assistant's [ZHA integration](https://www.home-assistant.io/integrations/zha/) or of [Zigbee2MQTT](https://www.zigbee2mqtt.io/): every device with its link quality, battery and availability, and a **map of the mesh**, under an animated banner where the mesh flows from the coordinator.

The cards read the network straight from ZHA (the same data as its network visualization) or from the MQTT topics of Zigbee2MQTT: add the card, and the coordinator, the routers and the end devices show up by themselves, with the devices that need attention first.

[![Open your Home Assistant instance and open a repository inside the Marketplace.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/marketplace_repository/?owner=juju35&repository=ha-zigbee-card&category=plugin)

| Devices | Map |
|---|---|
| <picture><source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/juju35/ha-zigbee-card/main/screenshots/card-dark.png"><img src="https://raw.githubusercontent.com/juju35/ha-zigbee-card/main/screenshots/card.png" alt="devices tab" width="400"></picture> | <picture><source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/juju35/ha-zigbee-card/main/screenshots/card-map-dark.png"><img src="https://raw.githubusercontent.com/juju35/ha-zigbee-card/main/screenshots/card-map.png" alt="map tab" width="400"></picture> |
| <picture><source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/juju35/ha-zigbee-card/main/screenshots/mini-card-dark.png"><img src="https://raw.githubusercontent.com/juju35/ha-zigbee-card/main/screenshots/mini-card.png" alt="mini card" width="380"></picture> | <picture><source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/juju35/ha-zigbee-card/main/screenshots/mini-card-bar-dark.png"><img src="https://raw.githubusercontent.com/juju35/ha-zigbee-card/main/screenshots/mini-card-bar.png" alt="mini card with its health bar" width="380"></picture> |

## Features

- Two cards: a full **Zigbee Card** and a compact **Zigbee Mini Card**, of type `custom:zigbee-card` and `custom:zigbee-mini-card`
- An illustrated, animated banner as header (90 px, on the full and the mini card): an amber gradient, a house with the Zigbee coordinator in its middle and its devices around it (bulb, plug, thermometer, motion sensor, lock, blind), packets running along their links and dots along the mesh strip at the bottom. It follows the network: all well, a **weak link** (amber, dashed) when a device needs attention, a **device offline** (red, blinking, its link lost). The round Zigbee icon takes the status colour: green, amber or red. A night look with the dark theme of Home Assistant (day with a light one); motion stops with *reduce motion*
- **ZHA or Zigbee2MQTT**, picked by itself (ZHA when it is loaded, else Zigbee2MQTT when MQTT is) or set with `integration`; several Zigbee2MQTT instances through their `base_topic`
- The header shows the network's name with « ZHA · Channel 15 · 42 devices » (or « Zigbee2MQTT · Channel 15 · 42 devices ») (Devices tab) or « 42 devices · 14 routers » (Map tab)
- **Devices** and **Map** text tabs right under the banner
- **Devices** tab: status chips (« 41 / 42 online », « 1 offline », « 1 low battery », and when the network was read), the filters **All**, **Routers**, **End devices** and **Attention** with their counts, and a two-column grid of tiles, one per device: its icon (from its main entity), its name, a state line such as « Router · LQI 230 », « LQI 156 · battery 82% », « Offline · 3 h », « Weak signal · LQI 61 » or « Battery 12% », four signal bars from the LQI and a status dot
- Healthy tiles stay neutral (grey icon, grey state line); only an issue brings colour: amber for a weak signal or a low battery, red for a device offline
- **Map** tab: the coordinator in the centre, the routers on an inner ring, the end devices outside next to their parent; the links come from the neighbor tables and are coloured by link quality: green, **amber dashed** when weak, **red dashed** when lost. A legend, the channel and the PAN id, and a folding **Needs attention** list with each device's last contact and parent (folded at first, folded back by a click elsewhere)
- Click a tile, a node of the map or a row for the device's popup, at the top of the card: model, manufacturer, LQI, RSSI, battery, power source, last seen, the router it is connected through, area, IEEE and network addresses, a folding list of its neighbors and a link to its device page; it closes with its button, a click anywhere else, Escape, or when the card leaves the page
- Configurable thresholds for a weak signal (LQI) and a low battery (%)
- Status pill next to the title on every header: « Healthy », « 3 issues », « Loading » or « Unavailable », in the colour of the Zigbee icon
- Mini card: the same illustrated banner with « 42 devices » and the status pill on its sky (with `illustration: false`, the 40 px Zigbee badge tinted by the network's health and its status pill in one line), then chips (routers, offline, low battery; or online, routers and the average LQI) or a health bar, and a zoom button that unfolds the full card; a click anywhere outside the card folds it back
- Visual editor for both cards; options left at their default are kept out of the YAML
- Light and dark themes, `prefers-reduced-motion` honoured
- English, French, German, Spanish, Serbian (Cyrillic and Latin), Italian, Dutch, European Portuguese, Polish, Romanian, Danish, Swedish, Bulgarian, Russian, Ukrainian, Hungarian, Slovak, Czech, Slovenian, Latvian and Greek

## Supported integrations

| Integration | What the cards show |
|---|---|
| [ZHA](https://www.home-assistant.io/integrations/zha/) (Zigbee Home Automation, built into Home Assistant) | The devices of `zha/devices` (type, LQI, RSSI, availability, last seen, power source, neighbor tables) and the channel and PAN id of `zha/network/settings`; the battery of each device from its battery sensor. Tested with a Home Assistant Connect ZBT-2 coordinator |
| [Zigbee2MQTT](https://www.zigbee2mqtt.io/) (through the [MQTT integration](https://www.home-assistant.io/integrations/mqtt/)) | The devices of `<base_topic>/bridge/devices` (type, power source, model, network address), the channel and PAN id of `bridge/info`, the availability of `<device>/availability`, the link quality and last seen of the devices' states (or their `linkquality` sensor), and the neighbor tables of a raw network map (`bridge/request/networkmap`, every `networkmap_interval`); the battery, area and device page from the Home Assistant device |

## Prerequisites

- Home Assistant 2024.8 or later
- The [ZHA integration](https://www.home-assistant.io/integrations/zha/) with its coordinator, or [Zigbee2MQTT](https://www.zigbee2mqtt.io/) with the [MQTT integration](https://www.home-assistant.io/integrations/mqtt/) (its Home Assistant discovery on)
- An **administrator** account: ZHA only gives its network to administrators, and Home Assistant only lets administrators listen to MQTT topics; for other users the card says so

## Installation

### Via the Marketplace (recommended)

Click the button below to add the repository directly:

[![Add to the Marketplace](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/marketplace_repository/?owner=juju35&repository=ha-zigbee-card&category=plugin)

Then click **Install**, and reload your browser when the Marketplace asks you to.

Or manually:

1. Open **Settings → Marketplace → Add from link** (top right; this needs a GitHub account connected)
2. Add `https://github.com/juju35/ha-zigbee-card` — Category: **Dashboard** (Lovelace)
3. Open **Zigbee Card** and click **Install**
4. Clear your browser cache and refresh

The Marketplace registers the dashboard resource for you (`/local/community/ha-zigbee-card/zigbee-card.js`); the single file provides both cards.

### Manual

1. Download `zigbee-card.js` and the `zigbee-card.i18n.*.js` translation files from the [latest release](https://github.com/juju35/ha-zigbee-card/releases/latest)
2. Copy them all to `/config/www/` (without the translation files, the cards show in English)
3. Go to **Settings → Dashboards → ⋮ → Resources** → Add resource:
   - URL: `/local/zigbee-card.js`
   - Type: **JavaScript Module**
4. Clear your browser cache and refresh

## Configuration

### Visual editor

Edit a dashboard, click **Add card** and search for **Zigbee Card** or **Zigbee Mini Card**. Set the title, the integration (and for Zigbee2MQTT its base topic and network map scan), the default tab and filter, the thresholds, the number of tiles, the refresh interval, the illustration and the language. The preview updates live, and options left at their default are kept out of the generated YAML. The mini card's editor also has the full card's options, used by its unfolded view.

### Minimal

```yaml
type: custom:zigbee-card
```

```yaml
type: custom:zigbee-mini-card
```

### Full options

```yaml
type: custom:zigbee-card
title: Zigbee network
integration: auto
default_tab: devices
default_filter: all
weak_lqi: 80
low_battery: 20
max_devices: 12
refresh_interval: 60
show_status: true
illustration: true
illustration_theme: auto
exclude:
  - Garden plug
  - 00:12:4b:00:2a:10:65:7e
language: en
```

Zigbee2MQTT, with a base topic other than `zigbee2mqtt`:

```yaml
type: custom:zigbee-card
integration: zigbee2mqtt
base_topic: zigbee2mqtt-garage
networkmap_interval: 7200
```

```yaml
type: custom:zigbee-mini-card
mini_layout: bar
default_tab: map
zoom: true
```

### Options reference

| Option | Card | Default | Description |
|---|---|---|---|
| `title` | both | `Zigbee network` (mini: `Zigbee`) | Card title |
| `integration` | both | `auto` | `zha`, `zigbee2mqtt`, or `auto`: ZHA when it is loaded, else Zigbee2MQTT when MQTT is |
| `base_topic` | both | `zigbee2mqtt` | Zigbee2MQTT only: the base topic of its MQTT messages |
| `networkmap_interval` | both | `3600` | Zigbee2MQTT only: seconds between two raw network map scans (300 at least), the first when the card loads, shared by every browser of the home; `0` never asks one (a scan asked elsewhere, by the Zigbee2MQTT frontend, is still used). Without a map, every device hangs from the coordinator |
| `default_tab` | both | `devices` | Tab shown first: `devices` or `map`; on the mini card, in its unfolded view |
| `default_filter` | both | `all` | Filter of the Devices tab shown first: `all`, `routers`, `end_devices` or `attention` |
| `weak_lqi` | both | `80` | A device whose LQI is below this has a weak signal |
| `low_battery` | both | `20` | A device whose battery is at or below this percentage has a low battery |
| `max_devices` | both | `12` | Tiles shown before the « Show all » row; `0` shows every device |
| `refresh_interval` | both | `60` | ZHA only: seconds between two reads of the network (10 at least); Zigbee2MQTT updates live |
| `show_status` | both | `true` | The status chips under the tabs |
| `illustration` | both | `true` | The animated banner as header (full and mini card); `false` for a classic header with a round icon |
| `illustration_theme` | both | `auto` | `auto` (follows the Home Assistant theme: night with a dark theme, day with a light theme), `day` or `night` |
| `exclude` | both | None | **YAML only.** A list of devices to leave out, by IEEE address or name |
| `mini_layout` | mini | `chips` | The mini card's second line: `chips` or `bar` (a health bar with a summary) |
| `zoom` | mini | `true` | Zoom button: unfolds the full card and back (`false` removes it). The full card's options above apply to the unfolded view and are also set in the mini card's visual editor |
| `language` | both | Auto | Force language: `en`, `fr`, `de`, `es`, `sr`, `sr-Latn`, `it`, `nl`, `pt`, `pl`, `ro`, `da`, `sv`, `bg`, `ru`, `uk`, `hu`, `sk`, `cs`, `sl`, `lv` or `el` (auto-detects from HA settings) |

Every option but `exclude` is in the visual editor.

## Screenshots

### Animations

The mesh flows from the coordinator, the node of a device that needs attention blinks, and packets run along the bottom strip of the banner; on the map, the links to the routers flow and the nodes with an issue blink. With `prefers-reduced-motion`, everything stays still.

Banner, all well:

| Light | Dark |
|---|---|
| <img src="https://raw.githubusercontent.com/juju35/ha-zigbee-card/main/screenshots/banner-ok.gif" alt="banner animation, all well" width="400"> | <img src="https://raw.githubusercontent.com/juju35/ha-zigbee-card/main/screenshots/banner-ok-dark.gif" alt="banner animation, all well, dark theme" width="400"> |

Banner, a weak link:

| Light | Dark |
|---|---|
| <img src="https://raw.githubusercontent.com/juju35/ha-zigbee-card/main/screenshots/banner-weak.gif" alt="banner animation, weak link" width="400"> | <img src="https://raw.githubusercontent.com/juju35/ha-zigbee-card/main/screenshots/banner-weak-dark.gif" alt="banner animation, weak link, dark theme" width="400"> |

Banner, a device offline:

| Light | Dark |
|---|---|
| <img src="https://raw.githubusercontent.com/juju35/ha-zigbee-card/main/screenshots/banner.gif" alt="banner animation, device offline" width="400"> | <img src="https://raw.githubusercontent.com/juju35/ha-zigbee-card/main/screenshots/banner-dark.gif" alt="banner animation, device offline, dark theme" width="400"> |

Night banner:

| Light | Dark |
|---|---|
| <img src="https://raw.githubusercontent.com/juju35/ha-zigbee-card/main/screenshots/night.gif" alt="night banner animation" width="400"> | <img src="https://raw.githubusercontent.com/juju35/ha-zigbee-card/main/screenshots/night-dark.gif" alt="night banner animation, dark theme" width="400"> |

Map:

| Light | Dark |
|---|---|
| <img src="https://raw.githubusercontent.com/juju35/ha-zigbee-card/main/screenshots/map.gif" alt="map animation" width="400"> | <img src="https://raw.githubusercontent.com/juju35/ha-zigbee-card/main/screenshots/map-dark.gif" alt="map animation, dark theme" width="400"> |

### Zigbee Card

| Light | Dark |
|---|---|
| <img src="https://raw.githubusercontent.com/juju35/ha-zigbee-card/main/screenshots/card.png" alt="devices tab" width="400"> | <img src="https://raw.githubusercontent.com/juju35/ha-zigbee-card/main/screenshots/card-dark.png" alt="devices tab, dark theme" width="400"> |
| <img src="https://raw.githubusercontent.com/juju35/ha-zigbee-card/main/screenshots/card-map.png" alt="map tab" width="400"> | <img src="https://raw.githubusercontent.com/juju35/ha-zigbee-card/main/screenshots/card-map-dark.png" alt="map tab, dark theme" width="400"> |

The **Attention** filter:

| Light | Dark |
|---|---|
| <img src="https://raw.githubusercontent.com/juju35/ha-zigbee-card/main/screenshots/card-attention.png" alt="attention filter" width="400"> | <img src="https://raw.githubusercontent.com/juju35/ha-zigbee-card/main/screenshots/card-attention-dark.png" alt="attention filter, dark theme" width="400"> |

The popup of a device, at the top of the card:

| Light | Dark |
|---|---|
| <img src="https://raw.githubusercontent.com/juju35/ha-zigbee-card/main/screenshots/card-detail.png" alt="device popup" width="400"> | <img src="https://raw.githubusercontent.com/juju35/ha-zigbee-card/main/screenshots/card-detail-dark.png" alt="device popup, dark theme" width="400"> |

On **Zigbee2MQTT** (`integration: zigbee2mqtt`, or automatic without ZHA), here with `max_devices: 8`:

| Light | Dark |
|---|---|
| <img src="https://raw.githubusercontent.com/juju35/ha-zigbee-card/main/screenshots/card-z2m.png" alt="Zigbee2MQTT, devices tab" width="400"> | <img src="https://raw.githubusercontent.com/juju35/ha-zigbee-card/main/screenshots/card-z2m-dark.png" alt="Zigbee2MQTT, devices tab, dark theme" width="400"> |
| <img src="https://raw.githubusercontent.com/juju35/ha-zigbee-card/main/screenshots/card-z2m-map.png" alt="Zigbee2MQTT, map tab" width="400"> | <img src="https://raw.githubusercontent.com/juju35/ha-zigbee-card/main/screenshots/card-z2m-map-dark.png" alt="Zigbee2MQTT, map tab, dark theme" width="400"> |

Night banner (`illustration_theme: night`, or automatic with a dark theme):

| Light | Dark |
|---|---|
| <img src="https://raw.githubusercontent.com/juju35/ha-zigbee-card/main/screenshots/card-night.png" alt="night banner" width="400"> | <img src="https://raw.githubusercontent.com/juju35/ha-zigbee-card/main/screenshots/card-night-dark.png" alt="night banner, dark theme" width="400"> |

Classic header (`illustration: false`, here with `max_devices: 6`):

| Light | Dark |
|---|---|
| <img src="https://raw.githubusercontent.com/juju35/ha-zigbee-card/main/screenshots/card-classic.png" alt="classic header" width="400"> | <img src="https://raw.githubusercontent.com/juju35/ha-zigbee-card/main/screenshots/card-classic-dark.png" alt="classic header, dark theme" width="400"> |

### Zigbee Mini Card

| Light | Dark |
|---|---|
| <img src="https://raw.githubusercontent.com/juju35/ha-zigbee-card/main/screenshots/mini-card.png" alt="mini card" width="380"> | <img src="https://raw.githubusercontent.com/juju35/ha-zigbee-card/main/screenshots/mini-card-dark.png" alt="mini card, dark theme" width="380"> |
| <img src="https://raw.githubusercontent.com/juju35/ha-zigbee-card/main/screenshots/mini-card-healthy.png" alt="mini card, healthy network" width="380"> | <img src="https://raw.githubusercontent.com/juju35/ha-zigbee-card/main/screenshots/mini-card-healthy-dark.png" alt="mini card, healthy network, dark theme" width="380"> |
| <img src="https://raw.githubusercontent.com/juju35/ha-zigbee-card/main/screenshots/mini-card-bar.png" alt="mini card with its health bar" width="380"> | <img src="https://raw.githubusercontent.com/juju35/ha-zigbee-card/main/screenshots/mini-card-bar-dark.png" alt="mini card with its health bar, dark theme" width="380"> |
| <img src="https://raw.githubusercontent.com/juju35/ha-zigbee-card/main/screenshots/mini-card-classic.png" alt="mini card without the illustration" width="380"> | <img src="https://raw.githubusercontent.com/juju35/ha-zigbee-card/main/screenshots/mini-card-classic-dark.png" alt="mini card without the illustration, dark theme" width="380"> |

Unfolded with its zoom button (click it again or anywhere outside the card to go back):

| Light | Dark |
|---|---|
| <img src="https://raw.githubusercontent.com/juju35/ha-zigbee-card/main/screenshots/mini-card-zoom.png" alt="mini card unfolded" width="400"> | <img src="https://raw.githubusercontent.com/juju35/ha-zigbee-card/main/screenshots/mini-card-zoom-dark.png" alt="mini card unfolded, dark theme" width="400"> |

## How it works

### Data

The cards call the ZHA websocket API: `zha/devices` for the devices (`device_type` Coordinator, Router or EndDevice, `lqi`, `rssi`, `available`, `last_seen`, `power_source`, `ieee`, `nwk`, `neighbors`, `entities`, `user_given_name`, `area_id`, `device_reg_id`) and `zha/network/settings` for the channel and the PAN id. One read serves every card of the page; it is made again every `refresh_interval` seconds. The battery of a device comes from its battery sensor (a percentage, or a low-battery binary sensor), its icon from its main entity (a light, a plug, a motion or door sensor…).

With Zigbee2MQTT, the cards listen through Home Assistant's `mqtt/subscribe` to the topics they read, not the whole `<base_topic>/#` (the bridge's logs, events, groups and definitions and the devices' `set` / `get` requests stay out): `bridge/devices`, `bridge/info`, `bridge/request/networkmap`, `bridge/response/networkmap`, `<base_topic>/+` and `<base_topic>/+/availability`, plus the exact topics of the devices whose name holds a slash (one set of subscriptions for every card of the page, closed a minute after the last card leaves): the retained `bridge/devices` (`type`, `ieee_address`, `friendly_name`, `network_address`, `power_source`, `definition`), `bridge/info` (channel, PAN id, coordinator), `<device>/availability`, and the devices' states for their `linkquality` and `last_seen` (or the `linkquality` sensor). The neighbor tables come from a raw network map, asked by publishing `{"type":"raw","routes":false}` to `bridge/request/networkmap` when the card loads and then every `networkmap_interval`, and read from `bridge/response/networkmap`. A scan is asked after a random delay of 1 to 15 seconds, and not at all when another client asked one meanwhile (the cards see the requests and answers on the bridge's topics): the browsers and wall tablets of a home share one scan instead of each asking theirs. Each device is matched to its Home Assistant device by its `zigbee2mqtt_<ieee>` identifier, read from the device registry (`config/device_registry/list`, again at most once a minute when the devices change), for its battery, icon, area and device page. A device is offline only when Zigbee2MQTT says so on `<device>/availability`: turn on its [availability](https://www.zigbee2mqtt.io/guide/configuration/device-availability.html) option (off by default) to see offline devices; its `last_seen` option fills the « last seen » of the popup. The cards update live, at most once a second.

### Status

| Status | When | Colour |
|---|---|---|
| Offline | ZHA marks the device unavailable; the tile shows for how long it has not been seen | Red |
| Low battery | Its battery is at or below `low_battery` (or its low-battery sensor is on) | Amber |
| Weak signal | Its LQI is below `weak_lqi` | Amber |
| Healthy | Anything else | Neutral tile, green dot |

The signal bars follow the LQI: four from 180, three from 130, two from `weak_lqi`, one below. The devices that need attention come first, then by name.

### Map

Each device hangs from its parent: for an end device, the router that lists it as its child (or that it lists as its parent); for a router, the coordinator when it hears it well, else the neighbor it hears best. The link quality is the best LQI the two report about each other. A device seen in no neighbor table hangs from the coordinator. Beyond 8 routers or 24 end devices, the rings stretch sideways to use the card's width.

### Narrow cards

The full card fits down to 8 columns of a sections view (about 208 px on a phone), the mini card down to 6 columns (about 156 px). The tiles go to one column, the filters scroll sideways, the banner keeps its gradient without its scene. In a container sized by its content, the cards take a width of 400 px instead of collapsing.

## Development

```bash
npm install
npm run build        # bundles src/ into dist/zigbee-card.js and stamps the version of package.json
npm run check        # builds and checks the bundle (run in CI)
npm test             # unit tests, and the browser layout tests (Chromium through Playwright)
npm run screenshots  # renders the cards with mock data (scripts/screenshots/mock.mjs) into screenshots/, and the animation GIFs (needs ffmpeg)
```

`dist/` is not committed: `npm run build` creates it locally, CI builds it on every push, and the release workflow attaches the built file to the release, which is where the Marketplace installs it from. The **Screenshots** workflow renders the captures again on every pull request that changes the sources and commits them to its branch.

### Releasing

1. Bump `version` in `package.json` (and `package-lock.json`)
2. Add a `## <version>` section at the top of [CHANGELOG.md](https://github.com/juju35/ha-zigbee-card/blob/main/CHANGELOG.md)
3. Merge to `main`: the **Release** workflow builds the card, creates the tag and the GitHub release with the changelog section as notes, and attaches `zigbee-card.js` and its translation files

## Translations

The cards auto-detect the language from your Home Assistant settings. Currently supported:

| Language | Code |
|---|---|
| English | `en` |
| Français | `fr` |
| Deutsch | `de` |
| Español | `es` |
| Српски (Serbian, Cyrillic) | `sr` |
| Srpski (Serbian, Latin) | `sr-Latn` |
| Italiano | `it` |
| Nederlands | `nl` |
| Português (Portugal) | `pt` |
| Polski | `pl` |
| Română | `ro` |
| Dansk | `da` |
| Svenska | `sv` |
| Български | `bg` |
| Русский | `ru` |
| Українська | `uk` |
| Magyar | `hu` |
| Slovenčina | `sk` |
| Čeština | `cs` |
| Slovenščina | `sl` |
| Latviešu | `lv` |
| Ελληνικά | `el` |

Contributions for additional languages are welcome!

## Contributing

Issues and pull requests are welcome: bug reports with your card configuration and a browser console extract, ideas, and translation fixes. Before opening a pull request, run `npm test` and `npm run check`; the screenshots are rendered by the CI on the pull request.

## Credits

Zigbee data from the [ZHA integration](https://www.home-assistant.io/integrations/zha/) of Home Assistant. Zigbee is a trademark of the Connectivity Standards Alliance; this project is not affiliated with it. The devices, names and addresses of the screenshots are fictional.

## License

[MIT](https://github.com/juju35/ha-zigbee-card/blob/main/LICENSE)

## Support

If you find this project useful, you can support its development:

<a href="https://buymeacoffee.com/julienstep9"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me a Coffee" height="50"></a>
