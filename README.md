# BioMap

**English:**
BioMap is a web application for recording, mapping, and sharing biodiversity audio observations. Users can record sounds (such as birds, insects, or environmental noises) directly from their device, geolocate them on an interactive map, and visualize all collected audio data with rich map layers. Ideal for citizen science, field research, and nature enthusiasts.

**Español:**
BioMap es una aplicación web para grabar, mapear y compartir observaciones de audio de biodiversidad. Los usuarios pueden grabar sonidos (como aves, insectos o sonidos ambientales) directamente desde su dispositivo, geolocalizarlos en un mapa interactivo y visualizar todos los datos de audio recolectados con capas de mapa avanzadas. Ideal para ciencia ciudadana, investigación de campo y amantes de la naturaleza.

# MANAKAI Audio Recorder

Audio recording and mapping application for MANAKAI Natural Reserve, Colombia.

## Features

- **GPS Location Tracking**: Real-time GPS location with user permission prompts
- **Audio Recording**: Capture audio recordings with metadata (species tags, weather, notes)
- **Geographic Mapping**: Map audio recordings to specific locations within the natural reserve
- **Search & Discovery**: Full-text search across recording metadata and locations
- **Field Research**: Optimized for field work with offline capabilities
- **Interactive Map**: Leaflet-based map with OpenStreetMap and topography layers

## Technology Stack

- React 18 with Vite
- Leaflet with react-leaflet for interactive mapping
- OpenStreetMap and OpenTopoMap for map tiles
- Tailwind CSS for styling
- Lunr.js for full-text search with Spanish language support
- Web Audio API for recording functionality
- Geolocation API for GPS tracking
- Material-UI components

## Available Scripts

In the project directory, you can run:

### `npm run dev`

Runs the app in the development mode.<br>
Open [http://localhost:5173](http://localhost:5173) to view it in the browser.

The page will reload if you make edits.<br>
You will also see any lint errors in the console.

### `npm run build`

Builds the app for production to the `dist` folder.<br>
It correctly bundles React in production mode and optimizes the build for the best performance.

### `npm run preview`

Preview the production build locally.

### `npm run deploy`

Deploy the application to GitHub Pages.

## Configuration

The application is configured for the MANAKAI Natural Reserve in Colombia. Key configuration can be found in `src/config.json`:

- Map center coordinates
- Audio recording settings
- Storage configuration
- Location accuracy settings

## Usage

1. **Location Permission**: When you first open the app, you'll be prompted to allow location access for GPS tracking
2. **GPS Tracking**: Your current location will be displayed on the map with a blue marker and accuracy circle
3. **Recording Audio**: Click the microphone button to start recording audio observations
4. **Adding Metadata**: Include species tags, weather conditions, and notes with each recording
5. **Mapping**: Recordings are automatically mapped to your current GPS location
6. **Searching**: Use the search bar to find recordings by species, notes, or location
7. **Browsing**: Navigate through recordings using the arrow controls
8. **Map Navigation**: Use the map controls to zoom and pan around the natural reserve

## Development

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app) and migrated to Vite for better performance.

## Learn More

To learn React, check out the [React documentation](https://reactjs.org/).
