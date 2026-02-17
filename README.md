
<p align="center">
  <img src="public/biomapp.png" alt="BioMapp" width="480">
</p>

<p align="center"><strong>DerivaSonora / SoundWalk Recorder</strong></p>

**ES** — App de mapeo sonoro comunitario. Graba audio geoetiquetado, camina derivas sonoras con tracklog GPS y exporta paquetes ZIP compartibles. Construida con React 18 + Vite, funciona en Android (Capacitor) y navegadores web. Ideal para ciencia ciudadana, investigacion de campo y amantes de la naturaleza.

**EN** — Community sound mapping app. Record geo-tagged audio, walk sonic derives with GPS tracklogs, and export shareable ZIP packages. Built with React 18 + Vite, runs on Android (Capacitor) and web browsers. Ideal for citizen science, field research, and nature enthusiasts.

## Features / Funcionalidades

- **Deriva Sonora** — GPS-tracked walks that start automatically when you move >5m or tap the record button. Timer, distance and recording counter. Breadcrumb trail always visible in heatmap mode. Auto-exports ZIP on finish.
- **Audio recording** — Geo-tagged recordings with rich bioacoustic metadata. Offline-first via localStorage.
- **Playback modes** — Nine modes spanning bioacoustic science and sound art (see below).
- **Breadcrumb visualization** — Line, heatmap, animated. Tracking starts on GPS grant and breadcrumbs are always rendered on map. Per-derive colored polylines with visibility toggle per layer.
- **Import/Export** — Import derive ZIPs, per-user colored tracklogs on map. Export includes GeoJSON, GPX, CSV, audio and timeline.
- **Proximity volume** — Exponential volume fade based on distance (full at ≤10m, decay to 100m). Stereo panning by bearing from GPS heading. Toggle in player.

## Playback Modes / Modos de Reproducción

BioMapp approaches sound from two fronts simultaneously: **bioacoustic field research** and **sound art / SoundWalk practice**. Each playback mode serves one or both.

### Bioacustica

| Mode | ES Name | Description |
|------|---------|-------------|
| **Nearby** | Cercanos | Spatial audio from all recordings within 100 m. Volume and stereo pan follow your GPS position in real time. Species density indicator logs unique species count nearby. The composition changes as you walk. |
| **Reloj** | Reloj | Plays recordings made within a configurable time window (±15, ±30, or ±60 min) of the *current time of day*, across all visible layers. At 6:15 AM you hear what the reserve sounded like at 6:15 on every previous session day. Useful for tracking dawn chorus shifts over time. |
| **Alba** | Alba | Solar bridge: listen to dawn recordings from any location during *your* local dawn. Uses solar declination to compute dawn windows for both listener (gate) and recording origin (filter). If you recorded birds at dawn in the Amazon and someone plays Alba in Madrid, they hear the Amazonian dawn chorus — but only when it's dawn in Madrid. |
| **Crepúsculo** | Crepúsculo | Solar bridge: listen to dusk recordings from any location during *your* local dusk. Same solar declination logic as Alba but for evening hours. Connects distant soundscapes through synchronized solar cycles. |
| **Estratos** | Estratos | Builds the soundscape layer by layer, staggered every 4 s: insects → birds → amphibians → mammals → water → ambient/other. Expanded keyword matching (~60 species/sound terms). Tags added during recording drive the classification. Useful for teaching ecological composition. |

### Arte Sonoro

| Mode | ES Name | Description |
|------|---------|-------------|
| **Chronological** | Cronológico | Recordings in capture order with true 500 ms crossfade overlap between tracks. Scientifically faithful replay of the session as it happened. |
| **Jamm** | Jamm | All tracks simultaneously with automated L↔R panning. Random start offset per track for varied texture on each play. The longest file leads; shorter ones loop. Dense, immersive soundscape. |
| **Migratoria** | Migratoria | Plays imported derives in geographic/timestamp order with 500 ms crossfade. A bioacoustic journey across locations — ideal for touring soundscapes collected by different users or at different sites. |
| **Espectro** | Espectro | Sorts recordings by frequency band heuristic (sub-bass → low → mid → high) and plays them as a spectral sweep with 600 ms crossfade. An educational mode for exploring how different species occupy the frequency spectrum. |
- **Multi-layer map** — OSM, Topo, Carto, Humanitarian, Satellite (Leaflet).

## Recording Metadata / Metadatos de Grabación

Each recording captures a rich set of fields designed for AI-ready bioacoustic analysis:

| Field | Source | Description |
|-------|--------|-------------|
| GPS (lat, lng) | Auto | Recording coordinates |
| Altitude | Auto | Elevation in meters (from GPS) |
| GPS Accuracy | Auto | Position confidence in meters |
| Device Model | Auto | Microphone/phone identifier for spectral calibration |
| Timestamp | Auto | ISO datetime of capture |
| Duration | Auto | Recording length in seconds |
| Movement Pattern | Auto | Walking pattern from breadcrumb tracking |
| Habitat | User | Bosque, Humedal, Pastizal, Ribera, Urbano, Cultivo, Páramo, Manglar, Cueva |
| Vertical Stratum | User | Suelo, Sotobosque, Dosel, Aéreo, Subacuático |
| Distance Estimate | User | <5m, 5–20m, 20–50m, >50m |
| Activity Type | User | Canto, Alarma, Forrajeo, Desplazamiento, Coro, Desconocido |
| Species Tags | User | Multi-select: Ave, Mamífero, Anfibio, Reptil, Insecto, Agua, Viento, Humano |
| Anthropophony | User | Human noise level: Ninguna, Baja, Media, Alta |
| Weather | User | Soleado, Nublado, Lluvioso, Tormentoso, Niebla, Ventoso, Nevado |
| Temperature | User | Range brackets from <0°C to >30°C |
| Quality | User | Baja, Media, Alta |
| Notes | User | Free-text field |

## Quick Start

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # dist/
```

### Android APK

```bash
npm run build
npx cap sync android
cd android && ./gradlew assembleRelease
# or use: bash build-apk.sh
```

## Stack

React 18, Vite, Leaflet, Capacitor, JSZip, Web Audio API

## Archive

The `_archive/` folder contains legacy files preserved for reference: old components, server deployment scripts (now Vercel-only), presentations, and duplicate assets. These are not used by the active codebase.

## Links

- **Web**: https://biomapp.vercel.app
- **Contact**: ping@radiolibre.xyz
- **Project**: https://etc.radiolibre.xyz
---

## Licensing

**BioMapp Project developed for Reserva MANAKAI**

Copyright (c) 2026 Alejandro Duque Jaramillo. All rights reserved.

This work is licensed under the **Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0) License**.

You are free to:
*   **Share** — copy and redistribute the material in any medium or format.
*   **Adapt** — remix, transform, and build upon the material.

Under the following terms:
*   **Attribution** — You must give appropriate credit, provide a link to the license, and indicate if changes were made. You may do so in any reasonable manner, but not in any way that suggests the licensor endorses you or your use.
*   **NonCommercial** — You may not use the material for commercial purposes. This includes, but is not limited to, any use of the code (including for training artificial intelligence models) that is primarily intended for or directed towards commercial advantage or monetary compensation.
*   **ShareAlike** — If you remix, transform, and build upon the material, you must distribute your contributions under the same license as the original.

For the full license text, please visit: [https://creativecommons.org/licenses/by-nc-sa/4.0/legalcode](https://creativecommons.org/licenses/by-nc-sa/4.0/legalcode)

This license applies to all forms of use, including by automated systems or artificial intelligence models, to prevent unauthorized commercial exploitation and ensure proper attribution.
