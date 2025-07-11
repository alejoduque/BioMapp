import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Circle, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
import { Play, Pause, Volume2, VolumeX, ArrowLeft, MapPin, Clock } from 'lucide-react';
import config from '../config.json';
import localStorageService from '../services/localStorageService.js';
import locationService from '../services/locationService.js';

// Sound icon for audio spots
const soundSpotIcon = L.icon({
  iconUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8Y2lyY2xlIGN4PSIxMiIgY3k9IjEyIiByPSIxMCIgZmlsbD0iIzEwQjk4MSIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLXdpZHRoPSIyIi8+CiAgPHBhdGggZD0iTTkgMTJ2NmMwIDEuMS45IDIgMiAyaDJjMS4xIDAgMi0uOSAyLTIgdi02YzAtMS4xLS45LTItMi0ySDExYy0xLjEgMC0yIC45LTIgMnoiIGZpbGw9IndoaXRlIi8+CiAgPHBhdGggZD0iTTYgMTJ2NGMwIDEuMS45IDIgMiAyaDF2LThIN2MtMS4xIDAtMiAuOS0yIDJ6IiBmaWxsPSJ3aGl0ZSIvPgogIDxwYXRoIGQ9Ik0xOCAxMnY0YzAgMS4xLS45IDItMiAyaC0xdi04aDFjMS4xIDAgMiAuOSAyIDJ6IiBmaWxsPSJ3aGl0ZSIvPgo8L3N2Zz4K',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
  popupAnchor: [0, -12]
});

// User location icon
const userLocationIcon = L.divIcon({
  className: 'user-location-marker',
  html: '<div style="background-color: #3B82F6; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 0 2px #3B82F6;"></div>',
  iconSize: [16, 16],
  iconAnchor: [8, 8]
});

// Component to handle map updates
function MapUpdater({ center, zoom }) {
  const map = useMap();
  
  React.useEffect(() => {
    if (center && center.lat && center.lng) {
      map.setView([center.lat, center.lng], zoom);
    }
  }, [center, zoom, map]);
  
  return null;
}

const SoundWalk = ({ onBackToLanding }) => {
  const [userLocation, setUserLocation] = useState(null);
  const [locationPermission, setLocationPermission] = useState('unknown');
  const [audioSpots, setAudioSpots] = useState([]);
  const [currentAudio, setCurrentAudio] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.7);
  const [isMuted, setIsMuted] = useState(false);
  const [nearbySpots, setNearbySpots] = useState([]);
  const [showMap, setShowMap] = useState(true);
  
  const audioRef = useRef(null);
  const locationWatchRef = useRef(null);

  // Load audio spots from localStorage
  useEffect(() => {
    const loadAudioSpots = async () => {
      try {
        const recordings = localStorageService.getAllRecordings();
        const spots = recordings.map(recording => ({
          id: recording.uniqueId,
          location: recording.location,
          filename: recording.displayName || recording.filename,
          timestamp: recording.timestamp,
          duration: recording.duration,
          notes: recording.notes,
          speciesTags: recording.speciesTags || []
        })).filter(spot => spot.location && spot.location.lat && spot.location.lng);
        
        setAudioSpots(spots);
        console.log('Loaded audio spots:', spots.length);
      } catch (error) {
        console.error('Error loading audio spots:', error);
      }
    };
    
    loadAudioSpots();
  }, []);

  // Request location permission and start watching
  useEffect(() => {
    const initializeLocation = async () => {
      try {
        const position = await locationService.requestLocation();
        setUserLocation(position);
        setLocationPermission('granted');
        
        // Start watching location updates
        locationWatchRef.current = locationService.startLocationWatch(
          (newPosition) => {
            setUserLocation(newPosition);
            checkNearbySpots(newPosition);
          },
          (error) => {
            console.error('Location watch error:', error);
          }
        );
      } catch (error) {
        console.error('Location error:', error);
        setLocationPermission('denied');
      }
    };
    
    initializeLocation();
    
    return () => {
      if (locationWatchRef.current) {
        locationService.stopLocationWatch();
      }
    };
  }, [audioSpots]);

  // Check for nearby audio spots (5-10m range)
  const checkNearbySpots = (position) => {
    if (!position || !audioSpots.length) return;
    
    const nearby = audioSpots.filter(spot => {
      const distance = calculateDistance(
        position.lat, position.lng,
        spot.location.lat, spot.location.lng
      );
      return distance <= 10; // 10 meters range
    });
    
    setNearbySpots(nearby);
    
    // Auto-play nearby spots if not currently playing
    if (nearby.length > 0 && !isPlaying) {
      playNearbySpots(nearby);
    }
  };

  // Calculate distance between two points in meters
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371000; // Earth's radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // Play nearby spots in chronological order
  const playNearbySpots = async (spots) => {
    if (spots.length === 0) return;
    
    // Sort by timestamp (oldest first)
    const sortedSpots = spots.sort((a, b) => 
      new Date(a.timestamp) - new Date(b.timestamp)
    );
    
    for (const spot of sortedSpots) {
      try {
        const audioBlob = await localStorageService.getAudioBlob(spot.id);
        if (audioBlob) {
          await playAudio(spot, audioBlob);
          // Wait for audio to finish before playing next
          await new Promise(resolve => {
            if (audioRef.current) {
              audioRef.current.onended = resolve;
            } else {
              resolve();
            }
          });
        }
      } catch (error) {
        console.error('Error playing spot:', spot.id, error);
      }
    }
  };

  // Play single audio
  const playAudio = async (spot, audioBlob) => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    
    const audio = new Audio(URL.createObjectURL(audioBlob));
    audio.volume = isMuted ? 0 : volume;
    audioRef.current = audio;
    
    setCurrentAudio(spot);
    setIsPlaying(true);
    
    audio.onended = () => {
      setIsPlaying(false);
      setCurrentAudio(null);
    };
    
    audio.onerror = () => {
      setIsPlaying(false);
      setCurrentAudio(null);
    };
    
    await audio.play();
  };

  // Manual play button
  const handlePlayNearby = () => {
    if (nearbySpots.length > 0) {
      playNearbySpots(nearbySpots);
    }
  };

  // Toggle mute
  const toggleMute = () => {
    setIsMuted(!isMuted);
    if (audioRef.current) {
      audioRef.current.volume = !isMuted ? 0 : volume;
    }
  };

  // Volume change
  const handleVolumeChange = (newVolume) => {
    setVolume(newVolume);
    if (audioRef.current && !isMuted) {
      audioRef.current.volume = newVolume;
    }
  };

  const center = userLocation || { lat: config.centroMapa.lat, lng: config.centroMapa.lon };
  const zoom = config.defaultZoom || 14;

  return (
    <div style={{ width: '100%', height: '100vh', position: 'relative' }}>
      {/* Map */}
      {showMap && (
        <div style={{ width: '100%', height: '100%' }}>
          <MapContainer 
            center={[center.lat, center.lng]} 
            zoom={zoom} 
            style={{ height: '100%', width: '100%' }}
            zoomControl={false}
            attributionControl={true}
          >
            <ZoomControl position="bottomright" />
            {/* OpenStreetMap base layer */}
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              maxZoom={19}
            />
            
            {/* Topography overlay layer */}
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
              opacity={0.3}
              maxZoom={17}
            />

            {/* User location marker */}
            {userLocation && (
              <Marker
                position={[userLocation.lat, userLocation.lng]}
                icon={userLocationIcon}
              >
                <Popup>
                  <div>
                    <h3>Your Location</h3>
                    <p><strong>Latitude:</strong> {userLocation.lat.toFixed(6)}</p>
                    <p><strong>Longitude:</strong> {userLocation.lng.toFixed(6)}</p>
                    {userLocation.accuracy && (
                      <p><strong>Accuracy:</strong> ±{Math.round(userLocation.accuracy)}m</p>
                    )}
                  </div>
                </Popup>
              </Marker>
            )}

            {/* Accuracy circle for user location */}
            {userLocation && userLocation.accuracy && (
              <Circle
                center={[userLocation.lat, userLocation.lng]}
                radius={userLocation.accuracy}
                pathOptions={{
                  color: '#3B82F6',
                  fillColor: '#3B82F6',
                  fillOpacity: 0.1,
                  weight: 1
                }}
              />
            )}

            {/* Audio spots */}
            {audioSpots.map((spot) => {
              const isNearby = nearbySpots.some(nearby => nearby.id === spot.id);
              return (
                <Marker
                  key={spot.id}
                  position={[spot.location.lat, spot.location.lng]}
                  icon={soundSpotIcon}
                >
                  <Popup>
                    <div style={{ minWidth: '200px' }}>
                      <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: '600' }}>
                        🔊 {spot.filename}
                      </h3>
                      {spot.notes && (
                        <p style={{ margin: '4px 0', fontSize: '14px' }}>
                          <strong>Description:</strong> {spot.notes}
                        </p>
                      )}
                      {spot.duration && (
                        <p style={{ margin: '4px 0', fontSize: '12px', color: '#6B7280' }}>
                          <strong>Duration:</strong> {spot.duration}s
                        </p>
                      )}
                      {spot.speciesTags && spot.speciesTags.length > 0 && (
                        <p style={{ margin: '4px 0', fontSize: '12px', color: '#6B7280' }}>
                          <strong>Species:</strong> {spot.speciesTags.join(', ')}
                        </p>
                      )}
                      <p style={{ margin: '4px 0', fontSize: '10px', color: '#9CA3AF' }}>
                        {new Date(spot.timestamp).toLocaleString()}
                      </p>
                      {isNearby && (
                        <div style={{
                          marginTop: '8px',
                          padding: '4px 8px',
                          backgroundColor: '#10B981',
                          color: 'white',
                          borderRadius: '4px',
                          fontSize: '12px',
                          textAlign: 'center'
                        }}>
                          🎧 Nearby - Will auto-play
                        </div>
                      )}
                    </div>
                  </Popup>
                </Marker>
              );
            })}

            <MapUpdater center={center} zoom={zoom} />
          </MapContainer>
        </div>
      )}

      {/* Audio Player Overlay */}
      <div style={{
        position: 'fixed',
        bottom: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        backgroundColor: 'white',
        borderRadius: '16px',
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)',
        padding: '20px',
        minWidth: '300px',
        maxWidth: '400px',
        zIndex: 1000
      }}>
        <div style={{ textAlign: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: '600' }}>
            🎧 SoundWalk Mode
          </h3>
          <p style={{ margin: '0', fontSize: '14px', color: '#6B7280' }}>
            {nearbySpots.length > 0 
              ? `${nearbySpots.length} audio spot${nearbySpots.length > 1 ? 's' : ''} nearby`
              : 'No audio spots nearby'
            }
          </p>
        </div>

        {currentAudio && (
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '4px' }}>
              🔊 {currentAudio.filename}
            </div>
            <div style={{ fontSize: '12px', color: '#6B7280' }}>
              {new Date(currentAudio.timestamp).toLocaleDateString()}
            </div>
          </div>
        )}

        {/* Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <button
            onClick={handlePlayNearby}
            disabled={nearbySpots.length === 0}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: nearbySpots.length > 0 ? '#10B981' : '#9CA3AF',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              padding: '8px 16px',
              fontSize: '14px',
              cursor: nearbySpots.length > 0 ? 'pointer' : 'not-allowed',
              transition: 'background-color 0.2s'
            }}
          >
            {isPlaying ? <Pause size={16} /> : <Play size={16} />}
            {isPlaying ? 'Playing...' : 'Play Nearby'}
          </button>

          <button
            onClick={toggleMute}
            style={{
              backgroundColor: isMuted ? '#EF4444' : '#6B7280',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              padding: '8px',
              cursor: 'pointer'
            }}
          >
            {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
        </div>

        {/* Volume Slider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Volume2 size={14} color="#6B7280" />
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={volume}
            onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
            style={{ flex: 1 }}
          />
        </div>
      </div>

      {/* Top Bar - Centered */}
      <div style={{
        position: 'fixed',
        top: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1000,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '12px'
      }}>
        <button
          onClick={onBackToLanding}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: 'white',
            color: '#374151',
            border: 'none',
            borderRadius: '8px',
            padding: '8px 16px',
            fontSize: '14px',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
          }}
        >
          <ArrowLeft size={16} />
          Back to Menu
        </button>

        <div style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          padding: '8px 16px',
          fontSize: '14px',
          color: '#374151',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <MapPin size={16} />
          {locationPermission === 'granted' ? 'GPS Active' : 'GPS Required'}
        </div>

        <button
          onClick={() => setShowMap(!showMap)}
          style={{
            backgroundColor: 'white',
            color: '#374151',
            border: 'none',
            borderRadius: '8px',
            padding: '8px 16px',
            fontSize: '14px',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
          }}
        >
          {showMap ? 'Hide Map' : 'Show Map'}
        </button>
      </div>

      {/* Location Permission Warning */}
      {locationPermission === 'denied' && (
        <div style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          backgroundColor: '#FEF3C7',
          border: '1px solid #F59E0B',
          borderRadius: '12px',
          padding: '20px',
          textAlign: 'center',
          zIndex: 1001,
          maxWidth: '300px'
        }}>
          <h3 style={{ margin: '0 0 12px 0', color: '#92400E' }}>
            Location Permission Required
          </h3>
          <p style={{ margin: '0 0 16px 0', color: '#92400E', fontSize: '14px' }}>
            SoundWalk mode requires GPS access to detect nearby audio spots and provide an immersive experience.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              backgroundColor: '#F59E0B',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              padding: '8px 16px',
              fontSize: '14px',
              cursor: 'pointer'
            }}
          >
            Enable Location & Reload
          </button>
        </div>
      )}
    </div>
  );
};

export default SoundWalk; 