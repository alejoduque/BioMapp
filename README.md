<p align="center">
  <img src="logoSoundWalk.jpg" alt="DerivaSonora / SoundWalk" width="320">
</p>

<p align="center">
  <img src="public/biomapp.png" alt="BioMapp" width="200">
</p>

<p align="center"><strong>DerivaSonora / SoundWalk Recorder</strong></p>

**ES** — App de mapeo sonoro comunitario. Graba audio geoetiquetado, camina derivas sonoras con tracklog GPS y exporta paquetes ZIP compartibles. Construida con React 18 + Vite, funciona en Android (Capacitor) y navegadores web. Ideal para ciencia ciudadana, investigacion de campo y amantes de la naturaleza.

**EN** — Community sound mapping app. Record geo-tagged audio, walk sonic derives with GPS tracklogs, and export shareable ZIP packages. Built with React 18 + Vite, runs on Android (Capacitor) and web browsers. Ideal for citizen science, field research, and nature enthusiasts.

## Features / Funcionalidades

- **Deriva Sonora** — GPS-tracked walks with auto-pause/resume on movement (>5m), timer, distance and recording counter. Auto-exports ZIP on finish.
- **Audio recording** — Geo-tagged recordings with metadata (species, weather, notes). Offline-first via localStorage.
- **Playback modes** — Nearby, chronological, concatenated (Jamm).
- **Breadcrumb visualization** — Line, heatmap, animated. Always-visible mode icons.
- **Import/Export** — Import derive ZIPs, per-user colored tracklogs on map. Export includes GeoJSON, GPX, CSV, audio and timeline.
- **Proximity volume** — Exponential volume fade based on distance (full at ≤5m, fade to 15m). Stereo panning by bearing. Toggle in player.
- **Multi-layer map** — OSM, Topo, Carto, Humanitarian, Satellite (Leaflet).

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
