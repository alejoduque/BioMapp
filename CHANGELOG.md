# Changelog

All notable changes to BioMapp are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased] — 2026-02-18

### Added
- **Animated breadcrumbs as default** — live trail draws itself progressively; mode no longer resets to heatmap on derive start
- **GPS-tracklog style for past derives** — completed session tracks rendered as audio-level-colored lines (green=moving, red=high audio, gray=stationary) instead of a dashed single-color polyline
- **Zoom-scaled sound blob markers** — duration circles shrink logarithmically as you zoom out (`Math.pow(2, zoom-19)`), minimum 25% size, preventing overlap at low zoom levels
- **Pulsing user location icon** — ultrared.png human figure with CSS `user-loc-pulse` ring animation replaces default Leaflet marker+circle
- **Smart default session visibility** — on load, picks the most relevant derive (most recordings, then most recent as tiebreaker) instead of showing all or none
- **Audio ZIP import (`export_summary.json` format)** — importer now detects and handles audio-only exports (no tracklog required); pre-scans all `metadata/*.json` files to build filename→metadata lookup map
- **Session layer auto-enable after import** — after importing an audio ZIP, `walkSessionIds` referenced by the imported recordings are added to `visibleSessionIds` automatically
- **`audio/mp4` recording preference** — MediaRecorder now prefers `audio/mp4` first for cross-platform compatibility (Safari/iOS ZIP playback without transcoding)

### Fixed
- **Tile layer blank at zoom 19** — added `maxNativeZoom` per provider (OSM=19, Stadia/Esri=18, OpenTopoMap=17) and `maxZoom={20}` on MapContainer; prevents requesting non-existent tile zoom levels
- **Export "NO AUDIO DATA" for some recordings** — atomic save order: blob is saved first, metadata only persisted on success; `saveRecording` now awaited in walk recording handler
- **ZIP import: "Missing required file tracklog/tracklog.json"** — format detection now checks for `export_summary.json` before falling to legacy tracklog validation
- **ZIP import: 0 markers after "7 recordings imported"** — fixed undefined `recordingId` variable (renamed to `filenameNoExt`); metadata lookup now matches by `meta.filename` → `meta.uniqueId` → filename-no-ext chain
- **Import: recordings with no GPS location no longer counted** — skipped with warning instead of failing silently inside `saveRecording`; recordings with `duration=0` get 1s minimum to pass validation
- **Derive tracking GPS watch conflict** — `breadcrumbService` is now a passive consumer via `feedPosition()`; only UnifiedMap owns the GPS watch (eliminates double-watch singleton bug)
- **`isTracking` used as function** — corrected to `isTrackingActive()` method call; removed spurious `startTracking()` calls on every GPS tick
- **`showBreadcrumbs` toggle destroying breadcrumb data** — tracking lifecycle decoupled from visibility toggle; `stopTracking()` no longer called on visibility change

### Changed
- **Heatmap circle radius reduced** — `max(2, 8 * intensity)` metres (was `max(5, 20 * intensity)`)
- **iPhone 7 Plus / Safari UI compacted** — `bottomButtonStyle` padding 12→8px, font 14→12px, gap 12→8px; top bar height 40→36px; mic button padding 7→5px, icon 20→18px
- **Export MIME type** — extension derived from mimeType: `.mp4` default (was `.webm`)
- **Pre-export orphan cleanup** — `cleanupOrphanedRecordings()` runs before generating ZIP to avoid exporting metadata-only entries

---

## [2.1.0] — 2026-02-14

### Added
- **Derive Sonora v2.1 interop protocol** — structured ZIP packages with `manifest.json`, `session/`, `audio/`, `metadata/` layout; versioned schema for cross-device sharing
- **Import/Export modal** — unified UI for importing derive ZIPs (GeoJSON, GPX, legacy ZIP) and exporting per-session Deriva Sonora packages
- **Android file picker fix** — native file picker for ZIP import on Android via Capacitor Filesystem
- **Web geolocation fallback** — `navigator.geolocation` used when Capacitor GPS unavailable (Safari/browser)
- **Web audio recording** — MediaRecorder fallback path for browser environments

### Fixed
- **Safari/browser derive ZIP import** — format detection and path handling corrected for web context
- **Compact modals for iPhone 7 Plus** — modal height, font sizes, and button layout adjusted for 375px viewport
- **Web save fallback** — localStorage blob storage path for web builds

---

## [2.0.0] — 2026-02-10

### Added
- **Auto-derive** — walk session auto-starts when user moves >5m from initial position, auto-stops after 10 min inactivity
- **Always-on breadcrumb trail** — visible in all modes including animated
- **8 playback modes** — Nearby, Aleatorio, Concatenado, Jamm, Alba, Crepúsculo, Drone, Silencio
- **Per-derive colored polylines** — each session gets a unique color via golden-angle hue spacing
- **Auto-zoom** — map zoom adjusts logarithmically as you walk (z19 start, zooms out with distance); manual pinch overrides until GPS recenter
- **Solar bridge (Alba / Crepúsculo)** — independent dawn/dusk playback modes using sunrise/sunset times
- **Bioacoustic metadata schema** — species tags, habitat, behavior, distance, weather fields on recordings
- **5-minute recording timer** — auto-stops recording after 5 min
- **Mode-aware player count** — nearby species density indicator

### Fixed
- **Alba/Crepúsculo split** — previously shared state, now fully independent modes
- **5-min recording timer reset** — timer correctly resets on new recording start

---

## [1.x] — Pre-2026

Initial field-testing builds. GPS recording, basic map display, single playback mode.
