import React, { Component, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, ZoomControl, LayersControl, useMap } from 'react-leaflet';
import L from 'leaflet';
import config from '../config.json';
import pinSelected from "./../assets/pin-selected.png";
import pinResults from "./../assets/pin-results.png";
const soundIconDataUrl = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8Y2lyY2xlIGN4PSIxNiIgY3k9IjE2IiByPSIxNCIgZmlsbD0iIzEwQjk4MSIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLXdpZHRoPSIyIi8+CiAgPHBhdGggZD0iTTEyIDEwdjEyYzAgMS4xIC45IDIgMiAyaDRjMS4xIDAgMi0uOSAyLTIgVjEwYzAtMS4xLS45LTItMi0yaC00Yy0xLjEgMC0yIC45LTIgMnoiIGZpbGw9IndoaXRlIi8+CiAgPHBhdGggZD0iTTggMTR2NGMwIDEuMSAuOSAyIDIgMmgydi04SDEwYy0xLjEgMC0yIC45LTIgMnoiIGZpbGw9IndoaXRlIi8+CiAgPHBhdGggZD0iTTIyIDE0djRjMCAxLjEtLjkgMi0yIDJoLTJ2LThoMmMxLjEgMCAyIC45IDIgMnoiIGZpbGw9IndoaXRlIi8+CiAgPGNpcmNsZSBjeD0iMTYiIGN5PSIxNiIgcj0iMyIgZmlsbD0iIzEwQjk4MSIvPgo8L3N2Zz4K";

const createCustomIcon = (iconUrl) => {
  return L.icon({
    iconUrl,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });
};

// Component to handle map center updates
function MapUpdater({ center, zoom }) {
  const map = useMap();
  
  useEffect(() => {
    if (center && center.lat && center.lng) {
      console.log('Updating map center to:', center);
      map.setView([center.lat, center.lng], zoom);
    }
  }, [center, zoom, map]);
  
  return null;
}

class BaseMap extends Component {
    // Create circle icon based on duration - similar to SoundWalk
  createDurationCircleIcon(duration) {
    // Map duration to radius: 5s = 20px, 120s = 80px
    const minDuration = 5, maxDuration = 120;
    const minRadius = 20, maxRadius = 80;
    const normalizedDuration = Math.max(minDuration, Math.min(maxDuration, duration || 10));
    const radius = minRadius + ((normalizedDuration - minDuration) / (maxDuration - minDuration)) * (maxRadius - minRadius);
    
    return L.divIcon({
      className: 'duration-circle-marker',
      html: `<div style="
        width: ${radius * 2}px; 
        height: ${radius * 2}px; 
        background-color: rgba(59, 130, 246, 0.3); 
        border: 3px solid #3B82F6; 
        border-radius: 50%; 
        display: flex; 
        align-items: center; 
        justify-content: center;
        cursor: pointer;
        transition: all 0.2s ease;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        position: relative;
      " onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'">
        <div style="
          width: 16px; 
          height: 16px; 
          background-color: #3B82F6; 
          border-radius: 50%; 
          border: 2px solid white;
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
        "></div>
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
          white-space: nowrap;
        ">${Math.round(duration || 0)}s</div>
      </div>`,
      iconSize: [radius * 2, radius * 2 + 20], // Extra height for duration label
      iconAnchor: [radius, radius],
      popupAnchor: [0, -radius - 10]
    });
  }

  // Convert geoJson features to soundMarkers format
  getSoundMarkers() {
    if (!this.props.geoJson || !this.props.geoJson.features) {
      return [];
    }
    
    return this.props.geoJson.features.map((feature, idx) => {
      const coords = feature.geometry.coordinates;
      const props = feature.properties;
      
      return {
        lat: coords[1],
        lng: coords[0],
        duration: props.duration || 10,
        popupContent: `
          <div style="min-width: 200px;">
            <h3 style="margin: 0 0 8px 0; color: #333; font-weight: bold;">${props.filename || 'Recording'}</h3>
            ${props.notes ? `<p style="margin: 4px 0; color: #666;"><strong>Notes:</strong> ${props.notes}</p>` : ''}
            ${props.speciesTags && props.speciesTags.length > 0 ? `<p style="margin: 4px 0; color: #666;"><strong>Species:</strong> ${props.speciesTags.join(', ')}</p>` : ''}
            ${props.weather ? `<p style="margin: 4px 0; color: #666;"><strong>Weather:</strong> ${props.weather}</p>` : ''}
            ${props.temperature ? `<p style="margin: 4px 0; color: #666;"><strong>Temperature:</strong> ${props.temperature}°C</p>` : ''}
            ${props.duration ? `<p style="margin: 4px 0; color: #666;"><strong>Duration:</strong> ${props.duration}s</p>` : ''}
            ${props.timestamp ? `<p style="margin: 4px 0; color: #666;"><strong>Recorded:</strong> ${new Date(props.timestamp).toLocaleString()}</p>` : ''}
            <button onclick="window.playAudio('${props.uniqueId}')" style="margin-top: 8px; padding: 4px 8px; background: #10b981; color: white; border: none; border-radius: 4px; cursor: pointer;">Play Audio</button>
          </div>
        `
      };
    });
  }

  render() {
    const center = [this.props.center.lat, this.props.center.lng];
    const zoom = config.defaultZoom || 14;
    const { BaseLayer } = LayersControl;
    const soundMarkers = this.getSoundMarkers();

    return (
      <div id='map' style={{width: '100%', height: '100vh', position: 'fixed', top: '0px', bottom: '0px', left: '0px'}}>
        <MapContainer 
          center={center} 
          zoom={zoom} 
          style={{ height: '100%', width: '100%' }}
          ref={(map) => { this.mapRef = map; }}
          zoomControl={false}
        >
          <MapUpdater center={this.props.center} zoom={zoom} />
          <ZoomControl position="bottomright" />
          <LayersControl position="bottomleft" style={{ backgroundColor: 'white', padding: '8px', borderRadius: '4px', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>
            <BaseLayer checked name="OpenStreetMap">
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
            </BaseLayer>
            <BaseLayer name="OpenTopoMap (Contours/Hillshade)">
              <TileLayer
                attribution='Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)'
                url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
              />
            </BaseLayer>
            <BaseLayer name="CartoDB Positron">
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
              />
            </BaseLayer>
          </LayersControl>

          {/* User location marker */}
          {this.props.userLocation && (
            <Marker
              position={[this.props.userLocation.lat, this.props.userLocation.lng]}
              icon={createCustomIcon(pinSelected)}
            >
              <Popup>You are here</Popup>
            </Marker>
          )}

          {/* Sound markers from recordings - using circular markers like SoundWalk */}
          {soundMarkers.map((marker, idx) => (
            <Marker
              key={idx}
              position={[marker.lat, marker.lng]}
              icon={this.createDurationCircleIcon(marker.duration)}
            >
              <Popup>
                <div dangerouslySetInnerHTML={{ __html: marker.popupContent }} />
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    );
  }
}

export default BaseMap;
