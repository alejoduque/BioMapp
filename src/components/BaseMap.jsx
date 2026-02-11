import React, { Component, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, ZoomControl, LayersControl, useMap } from 'react-leaflet';
import L from 'leaflet';
import config from '../config.json';
import pinSelected from "./../assets/pin-selected.png";
import pinResults from "./../assets/pin-results.png";
import markerIconUrl from 'leaflet/dist/images/marker-icon.png';
import BreadcrumbVisualization from './BreadcrumbVisualization.jsx';
const soundIconDataUrl = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8Y2lyY2xlIGN4PSIxNiIgY3k9IjE2IiByPSIxNCIgZmlsbD0iIzEwQjk4MSIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLXdpZHRoPSIyIi8+CiAgPHBhdGggZD0iTTEyIDEwdjEyYzAgMS4xIC45IDIgMiAyaDRjMS4xIDAgMi0uOSAyLTIgVjEwYzAtMS4xLS45LTItMi0yaC00Yy0xLjEgMC0yIC45LTIgMnoiIGZpbGw9IndoaXRlIi8+CiAgPHBhdGggZD0iTTggMTR2NGMwIDEuMSAuOSAyIDIgMmgydi04SDEwYy0xLjEgMC0yIC45LTIgMnoiIGZpbGw9IndoaXRlIi8+CiAgPHBhdGggZD0iTTIyIDE0djRjMCAxLjEtLjkgMi0yIDJoLTJ2LThoMmMxLjEgMCAyIC45IDIgMnoiIGZpbGw9IndoaXRlIi8+CiAgPGNpcmNsZSBjeD0iMTYiIGN5PSIxNiIgcj0iMyIgZmlsbD0iIzEwQjk4MSIvPgo8L3N2Zz4K";

const createCustomIcon = (iconUrl) => {
  return L.icon({
    iconUrl,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });
};

// Component to handle map center updates and pass map instance to parent
function MapUpdater({ center, zoom, onMapCreated, onMapReady }) {
  const map = useMap();
  
  useEffect(() => {
    if (center && center.lat && center.lng) {
      console.log('Updating map center to:', center);
      map.setView([center.lat, center.lng], zoom);
    }
  }, [center, zoom, map]);
  
  useEffect(() => {
    if (map) {
      console.log('Map instance created, passing to parent');
      if (onMapCreated) {
        onMapCreated(map);
      }
      if (onMapReady) {
        onMapReady(map);
      }
    }
  }, [map, onMapCreated, onMapReady]);
  
  return null;
}

class BaseMap extends Component {
  mapInstance = null;
  lastCentered = null;
  currentLayer = 'OpenStreetMap'; // Track current layer
  tileLayers = {}; // Store tile layer references
  layerRefs = {}; // Store layer component references
  // Create circle icon based on duration - similar to SoundWalk
  createDurationCircleIcon(duration) {
    // Map duration to radius: 5s = 20px, 120s = 80px
    const minDuration = 5, maxDuration = 120;
    const minRadius = 20, maxRadius = 80;
    const normalizedDuration = Math.max(minDuration, Math.min(maxDuration, duration || 10));
    const radius = minRadius + ((normalizedDuration - minDuration) / (maxDuration - minDuration)) * (maxRadius - minRadius);
    // Color gradient: short = blue, medium = green, long = red
    let color = '#3B82F6'; // blue (default)
    if (normalizedDuration < 30) color = '#3B82F6'; // blue
    else if (normalizedDuration < 60) color = '#10B981'; // green
    else color = '#EF4444'; // red
    return L.divIcon({
      className: 'duration-circle-marker',
      html: `<div style="
      width: ${radius * 2}px;
      height: ${radius * 2}px;
      background-color: ${color}33;
      border: 3px solid ${color};
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.2s ease;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      position: relative;">
        <img src='/ultrared.png' style='width: 60%; height: 60%; object-fit: contain; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: none;' alt='mic' />
        <div style="
          position: absolute;
          bottom: -20px;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(0,0,0,0.8);
          color: white;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 10px;
          white-space: nowrap;">
          ${Math.round(duration || 0)}s
        </div>
      </div>`,
      iconSize: [radius * 2, radius * 2 + 20],
      iconAnchor: [radius, radius],
      popupAnchor: [0, -radius - 10]
    });
  }

  // Convert geoJson features to soundMarkers format
  getSoundMarkers() {
    console.log('=== BaseMap getSoundMarkers ===');
    console.log('Props geoJson:', this.props.geoJson);
    console.log('Props geoJson features:', this.props.geoJson?.features);
    
    if (!this.props.geoJson || !this.props.geoJson.features) {
      console.log('No GeoJSON features found, returning empty array');
      return [];
    }
    
    const markers = this.props.geoJson.features.map((feature, idx) => {
      const coords = feature.geometry.coordinates;
      const props = feature.properties;
      
      console.log(`Processing feature ${idx}:`, feature);
      console.log(`Coordinates:`, coords);
      console.log(`Properties:`, props);
      
      return {
        lat: coords[1],
        lng: coords[0],
        duration: props.duration || 10,
        popupContent: `
          <div style="min-width: 200px;">
            <h3 style="margin: 0 0 8px 0; color: #333; font-weight: bold;">${props.filename || 'Grabación'}</h3>
            ${props.notes ? `<p style="margin: 4px 0; color: #666;"><strong>Notas:</strong> ${props.notes}</p>` : ''}
            ${props.speciesTags && props.speciesTags.length > 0 ? `<p style="margin: 4px 0; color: #666;"><strong>Especies:</strong> ${props.speciesTags.join(', ')}</p>` : ''}
            ${props.weather ? `<p style="margin: 4px 0; color: #666;"><strong>Clima:</strong> ${props.weather}</p>` : ''}
            ${props.temperature ? `<p style="margin: 4px 0; color: #666;"><strong>Temperatura:</strong> ${props.temperature}\u00b0C</p>` : ''}
            ${props.duration ? `<p style="margin: 4px 0; color: #666;"><strong>Duración:</strong> ${props.duration}s</p>` : ''}
            ${props.timestamp ? `<p style="margin: 4px 0; color: #666;"><strong>Grabado:</strong> ${new Date(props.timestamp).toLocaleString()}</p>` : ''}
            <button onclick="window.playAudio('${props.uniqueId}')" style="margin-top: 8px; padding: 4px 8px; background: #10b981; color: white; border: none; border-radius: 4px; cursor: pointer;">Reproducir Audio</button>
          </div>
        `
      };
    });
    
    console.log('Generated markers:', markers);
    return markers;
  }

  componentDidMount() {
    // Initialize with default layer - now defaults to Stadia.AlidadeSatellite
    this.currentLayer = this.props.currentLayer || 'Stadia.AlidadeSatellite';
  }

  componentDidUpdate(prevProps) {
    // Handle layer changes
    if (this.props.currentLayer && this.props.currentLayer !== prevProps.currentLayer) {
      console.log('Layer changed to:', this.props.currentLayer);
      this.currentLayer = this.props.currentLayer;
      
      // Force re-render to update layer visibility
      this.forceUpdate();
      
      // Also log the current layer state for debugging
      console.log('Current layer state updated:', this.currentLayer);
      console.log('Props currentLayer:', this.props.currentLayer);
      
      // Additional debugging for layer switching
      console.log('Available layer refs:', Object.keys(this.layerRefs));
    }

    // Auto-center if userLocation changes by more than 10 meters
    if (
      this.props.userLocation &&
      (!prevProps.userLocation ||
        this.props.userLocation.lat !== prevProps.userLocation.lat ||
        this.props.userLocation.lng !== prevProps.userLocation.lng)
    ) {
      if (this.mapInstance) {
        const prev = this.lastCentered || prevProps.userLocation;
        const curr = this.props.userLocation;
        // Only recenter if map is not already within 7 meters of new position
        const mapCenter = this.mapInstance.getCenter();
        const distanceToNew = this.calculateDistance(
          mapCenter.lat, mapCenter.lng, curr.lat, curr.lng
        );
        if (distanceToNew > 7) {
          if (prev) {
            const R = 6371e3;
            const φ1 = prev.lat * Math.PI / 180;
            const φ2 = curr.lat * Math.PI / 180;
            const Δφ = (curr.lat - prev.lat) * Math.PI / 180;
            const Δλ = (curr.lng - prev.lng) * Math.PI / 180;
            const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
                      Math.cos(φ1) * Math.cos(φ2) *
                      Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            const distance = R * c;
            if (distance > 10) { // 10 meters threshold
              this.mapInstance.setView([curr.lat, curr.lng], this.mapInstance.getZoom());
              this.lastCentered = { lat: curr.lat, lng: curr.lng };
            }
          } else {
            this.mapInstance.setView([curr.lat, curr.lng], this.mapInstance.getZoom());
            this.lastCentered = { lat: curr.lat, lng: curr.lng };
          }
        }
      }
    }
  }

  // Helper to calculate distance between two lat/lng points in meters
  calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371e3;
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  render() {
    const center = [this.props.center.lat, this.props.center.lng];
    const zoom = config.defaultZoom || 14;
    const soundMarkers = this.getSoundMarkers();
    const currentLayer = this.props.currentLayer || 'Stadia.AlidadeSatellite';
    
    console.log('=== BaseMap render ===');
    console.log('Center:', center);
    console.log('Zoom:', zoom);
    console.log('Sound markers count:', soundMarkers.length);
    console.log('User location:', this.props.userLocation);
    console.log('Current layer:', currentLayer);

    return (
      <div id='map' style={{width: '100%', height: '100vh', position: 'fixed', top: '0px', bottom: '0px', left: '0px'}}>
        <MapContainer 
          center={center} 
          zoom={zoom} 
          style={{ height: '100%', width: '100%' }}
          zoomControl={false}
        >
          <MapUpdater 
            center={this.props.center} 
            zoom={zoom} 
            onMapCreated={this.props.onMapCreated}
            onMapReady={(map) => {
              this.mapInstance = map;
              this.lastCentered = center;
            }}
          />
          
          {/* OpenStreetMap Layer */}
          <TileLayer
            ref={(ref) => { this.layerRefs['OpenStreetMap'] = ref; }}
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            opacity={currentLayer === 'OpenStreetMap' ? 1 : 0}
            zIndex={currentLayer === 'OpenStreetMap' ? 1 : 0}
          />

          {/* OpenTopoMap Layer */}
          <TileLayer
            ref={(ref) => { this.layerRefs['OpenTopoMap'] = ref; }}
            attribution='Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)'
            url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
            opacity={currentLayer === 'OpenTopoMap' ? 1 : 0}
            zIndex={currentLayer === 'OpenTopoMap' ? 1 : 0}
          />

          {/* CartoDB Layer */}
          <TileLayer
            ref={(ref) => { this.layerRefs['CartoDB'] = ref; }}
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
            opacity={currentLayer === 'CartoDB' ? 1 : 0}
            zIndex={currentLayer === 'CartoDB' ? 1 : 0}
          />

          {/* OSM Humanitarian Layer */}
          <TileLayer
            ref={(ref) => { this.layerRefs['OSMHumanitarian'] = ref; }}
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="https://www.hotosm.org/">Humanitarian OpenStreetMap Team</a>'
            url="https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png"
            opacity={currentLayer === 'OSMHumanitarian' ? 1 : 0}
            zIndex={currentLayer === 'OSMHumanitarian' ? 1 : 0}
          />

          {/* Stadia Alidade Satellite Layer */}
          <TileLayer
            ref={(ref) => { this.layerRefs['Stadia.AlidadeSatellite'] = ref; }}
            attribution='&copy; <a href="https://stadiamaps.com/">Stadia Maps</a>, &copy; <a href="https://openmaptiles.org/">OpenMapTiles</a> &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors'
            url="https://tiles.stadiamaps.com/tiles/alidade_satellite/{z}/{x}/{y}{r}.jpg"
            opacity={currentLayer === 'Stadia.AlidadeSatellite' ? 1 : 0}
            zIndex={currentLayer === 'Stadia.AlidadeSatellite' ? 1 : 0}
          />

          {/* User location marker */}
          {this.props.userLocation && (
            <Marker
              position={[this.props.userLocation.lat, this.props.userLocation.lng]}
              icon={createCustomIcon(pinSelected)}
            >
              <Popup>Aquí estás</Popup>
            </Marker>
          )}

          {/* Sound markers from recordings - using circular markers like SoundWalk */}
          {soundMarkers.map((marker, idx) => {
            console.log(`Rendering marker ${idx}:`, marker);
            return (
              <Marker
                key={idx}
                position={[marker.lat, marker.lng]}
                icon={this.createDurationCircleIcon(marker.duration)}
              >
                <Popup>
                  <div dangerouslySetInnerHTML={{ __html: marker.popupContent }} />
                </Popup>
              </Marker>
            );
          })}

          {/* Breadcrumb Visualization */}
          {this.props.showBreadcrumbs && this.props.currentBreadcrumbs && this.props.currentBreadcrumbs.length > 0 && (
            <BreadcrumbVisualization
              breadcrumbs={this.props.currentBreadcrumbs}
              visualizationMode={this.props.breadcrumbVisualization}
              showMarkers={true}
              showDirectionArrows={false}
              lineColor="auto"
              lineWidth={3}
              opacity={0.8}
              onMarkerClick={(crumb, index) => {
                console.log('Breadcrumb clicked:', crumb, index);
              }}
            />
          )}
        </MapContainer>
      </div>
    );
  }
}

export default BaseMap;
