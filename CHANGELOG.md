# Changelog

All notable changes to BioMapp are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased] — 2026-03-01

### Added
- **DeriveController service** — all automatic walk session lifecycle logic (auto-start, auto-stop, drift guard) consolidated in `src/services/deriveController.js`; `UnifiedMap` is now a thin consumer that calls `feedPosition()` on each GPS tick
- **GPS drift protection for auto-start** — derive no longer starts on a single drifting GPS fix; requires 2 consecutive ticks that each exceed the movement threshold (`max(5m, accuracy × 1.5)`) before a session opens; any non-moving tick resets the counter
- **Derive pill hint** — "toca para finalizar" label below the floating stats pill makes it obvious the pill is tappable; existing Pause/Resume + Guardar Deriva flow is unchanged
- **Soundwalk trail export in audio ZIP** — `exportAllRecordings()` now embeds GPS breadcrumb trails in `sessions/<id>.json` inside the ZIP; each session file contains title, author alias, timestamps, compressed breadcrumb array, and path summary; `export_summary.json` includes `sessionCount` and `totalBreadcrumbs` fields
- **Soundwalk trail import from audio ZIP** — `importAudioExportZip` reads `sessions/*.json` (new format) or reconstructs trails from breadcrumbs embedded in `metadata/*.json` (old format); creates walk sessions in `soundwalk_sessions` with correct IDs so recordings are immediately visible and GPS polylines render on the map
- **Old-format ZIP breadcrumb reconstruction** — ZIPs exported before session-trail support now correctly reconstruct session paths from per-recording embedded breadcrumbs; multiple recordings sharing the same `walkSessionId` have their trails merged into one chronological path; fixes a visibility bug where recordings imported from old ZIPs were filtered off the map because their `walkSessionId` referenced non-existent sessions
- **Validation UI shows trail count** — import modal validation panel now shows breadcrumb count and derive count for both new format (sessions/*.json) and old format (embedded in metadata); e.g. "303 migas de pan (6 derivas)" for the Manakai 2026-02-22 archive

### Fixed
- **ZIP import: recordings deleted on next app launch** — imported recordings were silently removed by `cleanupOrphanedRecordings()` because the metadata still contained the original device's `audioPath` (e.g. `BioMapp/recording-xxx.mp4`); `Filesystem.stat()` on that path fails on any other device, marking the recording as orphaned; fix: `importAudioFiles` now strips `audioPath` from imported metadata before calling `saveRecording`, so the blob is saved to the local filesystem/localStorage and a fresh valid path is written
- **ZIP import: only first recording appears on map** — same root cause as above; the 8 recordings deleted by orphan cleanup were no longer in `allRecordings` so `audioSpots` only contained the one that survived; after the fix all 9 recordings persist and map correctly
- **ZIP import: imported recordings don't play back** — playback tried `getPlayableUrl()` which used the stale `audioPath` from the exporter's device; with the path stripped on import, playback correctly falls through to the locally-saved blob

### Changed
- **Audio file upload** — Plus (+) icon in recorder window allows uploading MP4/M4A/WebM/OGG/WAV files up to 6MB with current GPS location assigned; uploaded files become sound blobs on map with extracted duration metadata
- **Delete recordings** — Trash icon in sound blob popup with confirmation dialog; deletes native audio file, localStorage blob, and metadata while preserving associated breadcrumb/derive data
- **Dynamic spatial audio for Cercanos mode** — Volume and stereo panning update every 200ms based on real-time distance and bearing as user walks; creates immersive directional soundscape that responds instantly to movement
- **Proximity-based volume curve (50m range)** — Exponential decay optimized for Cercanos 50m radius: full volume at ≤5m, drops to ~37% at 25m, ~10% at 50m edge; makes distance clearly audible even with multiple concurrent sounds
- **Performance limits for concurrent audio** — Max 6 simultaneous audio streams in Cercanos mode, prioritizing closest sounds; prevents audio overload on medium-range Android devices
- **Animated playing markers in Cercanos** — Sound blobs currently playing nearby pulse with green glow and scale animation (1.0 → 1.15); provides visual feedback for active spatial audio sources
- **Timeline markers during recording** — Tap the pin button while recording to bookmark important moments (bird call, interesting sound). Each marker saves the offset timestamp + GPS position. Markers appear as point labels in Audacity exports and as selection rows in Raven Pro tables, enabling precise navigation to field moments
- **GPS drift mitigation for auto-derive** — Ignores GPS positions with accuracy >30m, uses dynamic threshold max(5m, accuracy × 1.5) for movement detection, only advances anchor position on real movement (prevents false triggers from GPS drift)
- **Bioacoustic standard format exports** — Raven Pro selection tables (.txt), Audacity labels (.txt), GPX waypoints for QGIS/ArcGIS; enables interoperability with established analysis tools
- **Animated breadcrumbs as default** — live trail draws itself progressively; mode no longer resets to heatmap on derive start
- **GPS-tracklog style for past derives** — completed session tracks rendered as audio-level-colored lines (green=moving, red=high audio, gray=stationary) instead of a dashed single-color polyline
- **Zoom-scaled sound blob markers** — duration circles shrink logarithmically as you zoom out (`Math.pow(2, zoom-19)`), minimum 25% size, preventing overlap at low zoom levels
- **Pulsing user location icon** — ultrared.png human figure with CSS `user-loc-pulse` ring animation replaces default Leaflet marker+circle
- **Smart default session visibility** — on load, picks the most relevant derive (most recordings, then most recent as tiebreaker) instead of showing all or none
- **Audio ZIP import (`export_summary.json` format)** — importer now detects and handles audio-only exports (no tracklog required); pre-scans all `metadata/*.json` files to build filename→metadata lookup map
- **Session layer auto-enable after import** — after importing an audio ZIP, `walkSessionIds` referenced by the imported recordings are added to `visibleSessionIds` automatically
- **`audio/mp4` recording preference** — MediaRecorder now prefers `audio/mp4` first for cross-platform compatibility (Safari/iOS ZIP playback without transcoding)

### Fixed
- **Spatial audio stale closure bug** — Dynamic updates now use `userLocationRef` and `isMutedRef` to avoid capturing stale state; volume/panning recalculated with current GPS position every 200ms (was broken: used initial position only)
- **Cercanos loading modal blocking UI** — "Cargando audio..." modal now hides immediately after setup instead of waiting for all 6 audio files to download; audio loads in background, sounds start playing instantly
- **Storage quota exceeded on recordings >5MB** — Native platforms now always use Capacitor Filesystem (no localStorage quota). On web, removed artificial limits and raised sanity check to 50MB. Large recordings (5-min at standard quality) now save successfully.
- **Derive pill "Fin" button confusion** — Removed non-functional red Square icon and "Fin" text from derive counter pill; only the counter itself remains (tapping opens "Finalizar Deriva Sonora" modal)
- **Breadcrumb stale trail on relaunch** — added mount-time cleanup that clears breadcrumbs if no active session; prevents straight line from last session end to current GPS position
- **Tile layer blank at zoom 19** — added `maxNativeZoom` per provider (OSM=19, Stadia/Esri=18, OpenTopoMap=17) and `maxZoom={20}` on MapContainer; prevents requesting non-existent tile zoom levels
- **Export "NO AUDIO DATA" for some recordings** — atomic save order: blob is saved first, metadata only persisted on success; `saveRecording` now awaited in walk recording handler
- **ZIP import: "Missing required file tracklog/tracklog.json"** — format detection now checks for `export_summary.json` before falling to legacy tracklog validation
- **ZIP import: 0 markers after "7 recordings imported"** — fixed undefined `recordingId` variable (renamed to `filenameNoExt`); metadata lookup now matches by `meta.filename` → `meta.uniqueId` → filename-no-ext chain
- **Import: recordings with no GPS location no longer counted** — skipped with warning instead of failing silently inside `saveRecording`; recordings with `duration=0` get 1s minimum to pass validation
- **Derive tracking GPS watch conflict** — `breadcrumbService` is now a passive consumer via `feedPosition()`; only UnifiedMap owns the GPS watch (eliminates double-watch singleton bug)
- **`isTracking` used as function** — corrected to `isTrackingActive()` method call; removed spurious `startTracking()` calls on every GPS tick
- **`showBreadcrumbs` toggle destroying breadcrumb data** — tracking lifecycle decoupled from visibility toggle; `stopTracking()` no longer called on visibility change

### Changed
- **Cercanos mode range reduced to 50m** — was 100m; tighter radius makes spatial audio more coherent and focused
- **Cercanos shows all sounds in range** — removed `visibleSessionIds` filter; sounds appear if within 50m regardless of derive layer toggle state
- **Vertical stratum field reinterpreted** — changed from "microphone position" to "sound source origin"; labels now include context (e.g., "Suelo (<2m) — anfibios, insectos"); default value "No identificado" instead of required selection
- **Past session tracklines simplified** — Ramer-Douglas-Peucker decimation reduces breadcrumb count by 60-80% while preserving track shape and high-audio points; improves rendering performance
- **UI color scheme refinement** — top bar changed to cool gray rgba(240,242,245,0.68); breadcrumb mode buttons now monochrome grays (#5a5a6a, #6a6a7a, #7a7a8a); FABs increased transparency (0.82→0.65) with stronger blur (8px→12px)
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

---

## Roadmap — Planned Features

### Near-term (1-2 months)
- **Acoustic indices (ACI, ADI, H')** — automated on-device calculation of Acoustic Complexity Index, Acoustic Diversity Index, and Shannon Entropy for quantitative biodiversity assessment
  - Web Audio API FFT analysis for spectral processing
  - Per-recording index scores stored in metadata
  - Enables comparative analysis without manual listening
  - ~1-2 weeks development + scientific validation with biologists

### Medium-term (3-6 months)
- **Community species labeling system** — offline collaborative tagging interface to build training dataset for future ML models
  - User-contributed species identifications with confidence levels
  - Export to standard ML training formats (CSV + audio segments)
  - Builds foundation for regional acoustic models

### Long-term (6+ months)
- **On-device species detection** — lightweight ML inference for Neotropical dry forest taxa
  - Requires: curated dataset of 1000+ validated recordings per species
  - Collaboration with bioacoustic researchers needed
  - Note: BirdNET/Perch models are biased toward Northern Hemisphere species

- **Multi-device sync for spatial arrays** — coordinated simultaneous recording from multiple smartphones
  - GPS time sync + BLE/WiFi Direct discovery
  - Use case: measure sound propagation, spatial correlation analysis
  - Lower priority: limited field use cases vs. complexity

### Deferred / Not Planned
- ❌ **Real-time species alerts** — battery drain prohibitive for field use
- ❌ **Cloud ML processing** — conflicts with offline-first, community-owned data philosophy
