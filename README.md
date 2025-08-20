```
               BioMapp - a Soundscape | S | A | F | A | R | I | 
         ~~~   ~~~   ~~~   ~~~   ~~~   ~~~   ~~~   ~~~   ~~~   ~~~   ~~~
        🌳      🦁         🌴      🐘         🐦      🌾      🐆         🌳
         ~~~   ~~~   ~~~   ~~~   ~~~   ~~~   ~~~   ~~~   ~~~   ~~~   ~~~

           Biodiversity | Soundscapes | Community | SoundWalk Adventure

# BioMap - Beta Unstable v2

**English:**
BioMap is a web application for recording, mapping, and sharing biodiversity audio observations. Users can record sounds (such as birds, insects, or environmental noises) directly from their device, geolocate them on an interactive map, and visualize all collected audio data with rich map layers. Ideal for citizen science, field research, and nature enthusiasts.

**Español:**
BioMap es una aplicación web para grabar, mapear y compartir observaciones de audio de biodiversidad. Los usuarios pueden grabar sonidos (como aves, insectos o sonidos ambientales) directamente desde su dispositivo, geolocalizarlos en un mapa interactivo y visualizar todos los datos de audio recolectados con capas de mapa avanzadas. Ideal para ciencia ciudadana, investigación de campo y amantes de la naturaleza.

## Version: Beta Unstable v2

This is a beta release with experimental features including:
- ✅ **Android APK Build**: Successfully builds and deploys APK via GitHub Actions
- ✅ **iOS Compatibility**: Fixed audio recording MIME type issues for iOS Safari
- ✅ **Cross-Platform Support**: Works on Android, iOS, and desktop browsers
- ✅ **Offline-first audio recording and storage**
- ✅ **Advanced audio playback modes** (Concatenated and Jamm)
- ✅ **Overlapping audio spot detection and management**
- ✅ **Enhanced mobile UI/UX**
- ✅ **Multiple export options** (Individual files, ZIP, Metadata)
- ✅ **Sample data and example recordings** for demonstration

## 🚀 Installation Options

### Web App (Recommended)
- **URL**: [BioMap Web App](https://biomap.vercel.app)
- **Compatibility**: All modern browsers (Chrome, Safari, Firefox, Edge)
- **Features**: Full functionality with automatic updates

### Android APK
- **Download**: Available from GitHub Actions → Latest workflow run → Artifacts
- **Installation**: Enable "Install from unknown sources" in Android settings
- **Features**: Native Android app with full functionality

### PWA Installation
- **iOS**: Open in Safari → Share → Add to Home Screen
- **Android**: Open in Chrome → Menu → Add to Home Screen
- **Features**: App-like experience with offline capabilities

## 🎯 Recent Updates (v002+apk)

### ✅ Android APK Build System
- Automated GitHub Actions workflow for APK generation
- Java 17 compatibility fixes
- Proper Android SDK configuration
- Debug APK available for testing

### ✅ iOS Safari Compatibility
- Fixed "mimeType is not supported" error
- Dynamic audio format detection (WebM → MP4 fallback)
- Proper file extension handling for iOS
- Enhanced cross-platform audio recording

### ✅ Enhanced Audio Recording
- Automatic MIME type detection and fallback
- Support for multiple audio formats (WebM, MP4, OGG, WAV)
- Improved error handling and debugging
- Better file naming with correct extensions

### ✅ Mobile Optimizations
- Android-specific SoundWalk component
- Improved touch interactions
- Better modal handling on mobile devices
- Enhanced location permission handling

## Features

- **GPS Location Tracking**: Real-time GPS location with user permission prompts
- **Audio Recording**: Capture audio recordings with metadata (species tags, weather, notes)
- **Geographic Mapping**: Map audio recordings to specific locations within the natural reserve
- **Search & Discovery**: Full-text search across recording metadata and locations
- **Field Research**: Optimized for field work with offline capabilities
- **Interactive Map**: Leaflet-based map with OpenStreetMap and topography layers
- **Advanced Audio Playback**: Multiple listening modes for overlapping recordings (Concatenated and Jamm)
- **Export & Backup**: Multiple export options including ZIP files with organized structure
- **Offline-First**: All recordings stored locally with pending upload functionality
- **Mobile Optimized**: Responsive design optimized for field use on mobile devices
- **Cross-Platform**: Works on Android, iOS, and desktop browsers

## Technology Stack

- **Frontend**: React 18 with Vite
- **Mapping**: Leaflet with react-leaflet for interactive mapping
- **Maps**: OpenStreetMap and OpenTopoMap for map tiles
- **Styling**: Tailwind CSS
- **Search**: Lunr.js for full-text search with Spanish language support
- **Audio**: Web Audio API for recording functionality
- **Location**: Geolocation API for GPS tracking
- **Export**: JSZip for archive creation and export functionality
- **Mobile**: Capacitor for Android APK generation
- **CI/CD**: GitHub Actions for automated builds

## Available Scripts

In the project directory, you can run:

### `npm run dev`
Runs the app in the development mode.<br>
Open [http://localhost:5173](http://localhost:5173) to view it in the browser.

### `npm run build`
Builds the app for production to the `dist` folder.

### `npm run preview`
Preview the production build locally.

### `npm run deploy`
Deploy the application to Vercel.

### Android APK Build
```bash
# Install Capacitor
npm install -g @capacitor/cli

# Add Android platform
npx cap add android

# Build web app
npm run build

# Sync with Android
npx cap sync

# Open in Android Studio
npx cap open android

# Or build APK directly
cd android && ./gradlew assembleDebug
```

#### Generating Android Launcher Icons
To generate all required launcher icon sizes from your source PNG (e.g., ultrared.png), run:
```bash
./generate-android-icons.sh
```
This will create the correct icon sizes in all mipmap-*dpi folders for best compatibility on Android launchers.

## Configuration

The application is configured for the MANAKAI Natural Reserve in Colombia. Key configuration can be found in `src/config.json`:

- Map center coordinates
- Audio recording settings
- Storage configuration
- Location accuracy settings

## Usage

1. **Location Permission**: When you first open the app, you'll be prompted to allow location access for GPS tracking
2. **Microphone Permission**: Audio recording requires microphone access permission
3. **GPS Tracking**: Your current location will be displayed on the map with a blue marker and accuracy circle
4. **Recording Audio**: Click the microphone button to start recording audio observations
5. **Adding Metadata**: Include species tags, weather conditions, and notes with each recording
6. **Mapping**: Recordings are automatically mapped to your current GPS location
7. **Searching**: Use the search bar to find recordings by species, notes, or location
8. **Browsing**: Navigate through recordings using the arrow controls
9. **Map Navigation**: Use the map controls to zoom and pan around the natural reserve

## Export & Backup

The application provides multiple export options for your recordings:

### Export Options in SoundWalk Mode:
- **🟢 Export All**: Downloads individual audio files for each recording
- **🟣 Export ZIP**: Downloads a single ZIP file containing:
  - `audio/` folder with all recordings
  - `metadata/` folder with JSON files for each recording
  - `export_summary.json` with export details
- **🔵 Export Metadata**: Downloads a JSON file with all recording metadata

### Export File Structure:
```
biomap_recordings_2025-07-11.zip
├── audio/
│   ├── recording1.webm
│   ├── recording2.mp4
│   └── ...
├── metadata/
│   ├── recording1_metadata.json
│   ├── recording2_metadata.json
│   └── ...
└── export_summary.json
```

## Example Files

The repository includes example files for testing and demonstration:

### Sample Data (`public/sample-data/`)
- `example-recordings.json`: Sample recording metadata structure
- `README.md`: Documentation for the sample data format

### Sample Audio (`public/sample-audio/`)
- Example audio recordings for testing the application
- Demonstrates various audio types and durations
- Shows the expected file format and naming conventions

## Development

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app) and migrated to Vite for better performance.

## Troubleshooting

### iOS Issues
- **"mimeType is not supported"**: Fixed in v002+apk - app now automatically detects supported formats
- **Audio recording not working**: Ensure microphone permission is granted in Safari settings

### Android Issues
- **APK installation**: Enable "Install from unknown sources" in Android settings
- **Permissions not requested**: Check app permissions in Android settings
- **Location not working**: Ensure GPS is enabled and location permission is granted

### General Issues
- **Audio not playing**: Check browser console for errors
- **Location not updating**: Refresh page and grant location permission
- **Recording not saving**: Check available storage space

## Learn More

To learn React, check out the [React documentation](https://reactjs.org/).

## Version History

- **v002+apk**: First successful APK build, iOS compatibility fixes, enhanced mobile support
- **v001**: Initial beta release with core functionality
