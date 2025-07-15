// BETA VERSION: Overlapping audio spots now support Concatenated and Jamm listening modes.
import React, { useState, useEffect, useRef } from 'react';
import { MapContainer as LeafletMapContainer, TileLayer, Marker, Popup, useMap, Circle, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
import { Play, Pause, Volume2, VolumeX, ArrowLeft, MapPin, Clock, Download, Square } from 'lucide-react';
import config from '../config.json';
import localStorageService from '../services/localStorageService.js';
import locationService from '../services/locationService.js';
import SharedTopBar from './SharedTopBar.jsx';
import RecordingExporter from '../utils/recordingExporter.js';

const LISTEN_MODES = {
  CONCAT: 'concatenated',
  JAMM: 'jamm',
  IN_RANGE: 'inrange',
};

// Create circle icon based on duration - radius corresponds to duration
const createDurationCircleIcon = (duration) => {
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
};

// User location icon - make it larger and more visible
const userLocationIcon = L.divIcon({
  className: 'user-location-marker',
  html: '<div style="background-color: #3B82F6; width: 24px; height: 24px; border-radius: 50%; border: 4px solid white; box-shadow: 0 0 0 3px #3B82F6, 0 4px 8px rgba(0,0,0,0.3); position: relative;"><div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 8px; height: 8px; background-color: white; border-radius: 50%;"></div></div>',
  iconSize: [24, 24],
  iconAnchor: [12, 12]
});

// Component to handle map updates
function MapUpdater({ center, zoom }) {
  const map = useMap();
  
  useEffect(() => {
    if (center && center.lat && center.lng) {
      map.setView([center.lat, center.lng], zoom);
    }
  }, [center, zoom, map]);
  
  return null;
}

const SoundWalk = ({ onBackToLanding, locationPermission, userLocation, hasRequestedPermission, setLocationPermission, setUserLocation, setHasRequestedPermission }) => {
  const [audioSpots, setAudioSpots] = useState([]);
  const [currentAudio, setCurrentAudio] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.7);
  const [isMuted, setIsMuted] = useState(false);
  const [nearbySpots, setNearbySpots] = useState([]);
  const [showMap, setShowMap] = useState(true);
  const [proximityVolumeEnabled, setProximityVolumeEnabled] = useState(false);
  const [listenMode, setListenMode] = useState(LISTEN_MODES.CONCAT);
  const [activeGroup, setActiveGroup] = useState(null); // For overlapping spots
  const audioRefs = useRef([]);
  const audioContextRef = useRef(null);
  const locationWatchRef = useRef(null);

  // Load audio spots from localStorage
  useEffect(() => {
    const loadAudioSpots = async () => {
      try {
        console.log('SoundWalk: Loading audio spots...');
        const recordings = localStorageService.getAllRecordings();
        console.log('SoundWalk: Found recordings:', recordings.length);
        
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
        console.log('SoundWalk: Loaded audio spots:', spots.length);
      } catch (error) {
        console.error('SoundWalk: Error loading audio spots:', error);
      }
    };
    
    loadAudioSpots();
  }, []);

  // --- GPS/Location Logic (using global state) ---
  useEffect(() => {
    let isMounted = true;
    const handleLocationGranted = (position) => {
      if (!isMounted) return;
      setUserLocation(position);
      setLocationPermission('granted');
      setHasRequestedPermission(true);
      locationService.startLocationWatch(
        (newPosition) => {
          if (!isMounted) return;
          setUserLocation(newPosition);
          setLocationPermission('granted');
          checkNearbySpots(newPosition);
        },
        (error) => {
          if (!isMounted) return;
          setLocationPermission('denied');
        }
      );
    };
    const handleLocationDenied = (errorMessage) => {
      if (!isMounted) return;
      setLocationPermission('denied');
      setUserLocation(null);
      setHasRequestedPermission(true);
    };
    const checkCachedPermissionState = async () => {
      try {
        // Only check if we haven't requested permission globally yet
        if (hasRequestedPermission) {
          console.log('SoundWalk: Permission already requested globally, skipping check');
          return;
        }

        console.log('SoundWalk: Checking cached permission state...');
        const permissionState = await locationService.checkLocationPermission();
        
        if (permissionState === 'granted') {
          // Permission already granted, request location
          console.log('SoundWalk: Permission already granted, requesting location...');
          const position = await locationService.requestLocation();
          handleLocationGranted(position);
        } else if (permissionState === 'denied') {
          // Permission denied, don't request again
          console.log('SoundWalk: Permission denied, not requesting again');
          handleLocationDenied('Location permission denied');
        } else {
          // Permission unknown or prompt, try to request
          console.log('SoundWalk: Permission unknown, requesting location...');
          try {
            const position = await locationService.requestLocation();
            handleLocationGranted(position);
          } catch (error) {
            handleLocationDenied(error.message);
          }
        }
      } catch (error) {
        console.error('SoundWalk: Error checking cached permission:', error);
        handleLocationDenied(error.message);
      }
    };
    if (!hasRequestedPermission) {
      checkCachedPermissionState();
    }
    return () => {
      isMounted = false;
      locationService.stopLocationWatch();
    };
  }, [hasRequestedPermission, setLocationPermission, setUserLocation, setHasRequestedPermission]);

  // Manual location retry function (same as Collector)
  const handleLocationRetry = async () => {
    setLocationPermission('unknown');
    try {
      locationService.stopLocationWatch();
      const position = await locationService.requestLocation();
      setUserLocation(position);
      setLocationPermission('granted');
      setHasRequestedPermission(true);
      locationService.startLocationWatch(
        (newPosition) => {
          setUserLocation(newPosition);
          setLocationPermission('granted');
          checkNearbySpots(newPosition);
        },
        (error) => {
          setLocationPermission('denied');
        }
      );
    } catch (error) {
      setLocationPermission('denied');
      setUserLocation(null);
      setHasRequestedPermission(true);
    }
  };

  // Check for nearby audio spots (15m range)
  const checkNearbySpots = (position) => {
    if (!position || !audioSpots.length) return;
    
    const nearby = audioSpots.filter(spot => {
      const distance = calculateDistance(
        position.lat, position.lng,
        spot.location.lat, spot.location.lng
      );
      return distance <= 15; // 15 meters range
    });
    
    setNearbySpots(nearby);
    console.log('SoundWalk: Found nearby spots:', nearby.length);
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

  // Play single audio
  const playAudio = async (spot, audioBlob, userPosition) => {
    const audio = new Audio(URL.createObjectURL(audioBlob));
    audio.volume = isMuted ? 0 : volume;
    
    audioRefs.current.push(audio);
    setCurrentAudio(spot);
    
    audio.onended = () => {
      console.log('Audio ended:', spot.filename);
    };
    
    try {
      await audio.play();
      console.log('Audio started playing:', spot.filename);
    } catch (error) {
      console.error('Error playing audio:', spot.filename, error);
      const index = audioRefs.current.indexOf(audio);
      if (index > -1) {
        audioRefs.current.splice(index, 1);
      }
      throw error;
    }
  };

  // Play all nearby spots
  const playNearbySpots = async (spots) => {
    if (spots.length === 0) return;
    stopAllAudio();
    setIsPlaying(true);
    
    try {
      const sortedSpots = spots.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      
      for (const spot of sortedSpots) {
        try {
          const audioBlob = await localStorageService.getAudioBlob(spot.id);
          if (audioBlob) {
            await playAudio(spot, audioBlob, userLocation);
            
            // Wait for audio to finish before playing next
            await new Promise((resolve, reject) => {
              const audio = audioRefs.current[audioRefs.current.length - 1];
              audio.onended = resolve;
              audio.onerror = reject;
            });
          }
        } catch (error) {
          console.error('Error playing spot:', spot.filename, error);
        }
      }
    } catch (error) {
      console.error('Error playing nearby spots:', error);
    } finally {
      setIsPlaying(false);
    }
  };

  // Helper: Find overlapping spots within 5 meters
  function findOverlappingSpots(spot) {
    if (!spot.location) return [spot];
    return audioSpots.filter(otherSpot => {
      if (otherSpot.id === spot.id) return true;
      if (!otherSpot.location) return false;
      const distance = calculateDistance(
        spot.location.lat, spot.location.lng,
        otherSpot.location.lat, otherSpot.location.lng
      );
      return distance <= 5;
    });
  }

  // Concatenated playback
  const playConcatenated = async (spots) => {
    stopAllAudio();
    setIsPlaying(true);
    const sortedSpots = spots.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    for (const spot of sortedSpots) {
      try {
        const audioBlob = await localStorageService.getAudioBlob(spot.id);
        if (audioBlob) {
          await playAudio(spot, audioBlob, userLocation);
          await new Promise((resolve, reject) => {
            const audio = audioRefs.current[audioRefs.current.length - 1];
            audio.onended = resolve;
            audio.onerror = reject;
          });
        }
      } catch (error) {
        console.error('Error playing spot:', spot.filename, error);
      }
    }
    setIsPlaying(false);
  };

  // Jamm playback (all at once, panned L-R)
  const playJamm = async (spots) => {
    stopAllAudio();
    setIsPlaying(true);
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    audioContextRef.current = ctx;
    const panStep = 2 / (spots.length + 1);
    await Promise.all(spots.map(async (spot, i) => {
      const audioBlob = await localStorageService.getAudioBlob(spot.id);
      if (!audioBlob) return;
      const arrayBuffer = await audioBlob.arrayBuffer();
      const buffer = await ctx.decodeAudioData(arrayBuffer);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const gainNode = ctx.createGain();
      gainNode.gain.value = isMuted ? 0 : volume;
      const pan = ctx.createStereoPanner();
      pan.pan.value = -1 + panStep * (i + 1);
      source.connect(gainNode);
      gainNode.connect(pan);
      pan.connect(ctx.destination);
      source.start();
      audioRefs.current.push({ source, gainNode, type: 'webAudio' });
    }));
    setIsPlaying(false);
  };

  const handlePlayNearby = () => {
    if (nearbySpots.length > 0) {
      playNearbySpots(nearbySpots);
    }
  };

  const handleStopAudio = () => {
    stopAllAudio();
    setIsPlaying(false);
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
    audioRefs.current.forEach(audio => {
      audio.volume = !isMuted ? 0 : volume;
    });
  };

  const handleVolumeChange = (newVolume) => {
    setVolume(newVolume);
    if (!isMuted) {
      audioRefs.current.forEach(audio => {
        audio.volume = newVolume;
      });
    }
  };

  function stopAllAudio() {
    audioRefs.current.forEach(audio => {
      audio.pause();
      audio.currentTime = 0;
    });
    audioRefs.current = [];
    setCurrentAudio(null);
  }

  const handleExportAll = async () => {
    try {
      const exporter = new RecordingExporter();
      await exporter.exportAllRecordings();
      alert('All recordings exported successfully!');
    } catch (error) {
      console.error('Export error:', error);
      alert('Export failed: ' + error.message);
    }
  };

  const handleExportMetadata = async () => {
    try {
      const exporter = new RecordingExporter();
      exporter.exportMetadata();
      alert('Metadata exported successfully!');
    } catch (error) {
      console.error('Metadata export error:', error);
      alert('Metadata export failed: ' + error.message);
    }
  };

  const center = userLocation || { lat: config.centroMapa.lat, lng: config.centroMapa.lon };
  const zoom = config.defaultZoom || 14;

  console.log('SoundWalk render - userLocation:', userLocation, 'locationPermission:', locationPermission, 'audioSpots:', audioSpots.length);

  // --- UI for overlapping spots ---
  function renderPopupContent(clickedSpot) {
    const overlappingSpots = findOverlappingSpots(clickedSpot);
    if (!overlappingSpots || overlappingSpots.length === 0) {
      return <div>No recordings available</div>;
    }
    return (
      <div style={{ minWidth: '200px', maxWidth: '300px' }}>
        <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: '600', color: '#1F2937' }}>
          {overlappingSpots.length > 1 ? `🎧 ${overlappingSpots.length} overlapping recordings` : `🔊 ${overlappingSpots[0].filename}`}
        </h3>
        {overlappingSpots.length > 1 && (
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontWeight: 500, marginRight: 8, fontSize: '14px' }}>Listening mode:</label>
            <select 
              value={listenMode} 
              onChange={e => setListenMode(e.target.value)}
              style={{
                padding: '4px 8px',
                borderRadius: '4px',
                border: '1px solid #D1D5DB',
                fontSize: '14px'
              }}
            >
              <option value={LISTEN_MODES.CONCAT}>Concatenated</option>
              <option value={LISTEN_MODES.JAMM}>Jamm</option>
            </select>
          </div>
        )}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
          <button
            disabled={isPlaying}
            onClick={async () => {
              try {
                setIsPlaying(true);
                if (overlappingSpots.length > 1) {
                  if (listenMode === LISTEN_MODES.CONCAT) await playConcatenated(overlappingSpots);
                  else await playJamm(overlappingSpots);
                } else {
                  const audioBlob = await localStorageService.getAudioBlob(overlappingSpots[0].id);
                  if (audioBlob) await playAudio(overlappingSpots[0], audioBlob, userLocation);
                }
              } catch (error) {
                console.error('Error playing audio:', error);
                alert('Error playing audio: ' + error.message);
              } finally {
                setIsPlaying(false);
              }
            }}
            style={{
              flex: 1,
              padding: '8px 16px',
              background: isPlaying ? '#9CA3AF' : '#3B82F6',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              cursor: isPlaying ? 'not-allowed' : 'pointer',
              fontWeight: 600,
              fontSize: '14px',
              transition: 'background-color 0.2s'
            }}
          >
            {isPlaying ? 'Playing...' : 'Play Audio'}
          </button>
          <button
            onClick={stopAllAudio}
            style={{
              padding: '8px 12px',
              background: '#EF4444',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '14px'
            }}
            title="Stop playback"
          >
            <Square size={14} />
          </button>
        </div>
        <div style={{ marginTop: 12, fontSize: 12, color: '#6B7280' }}>
          <strong>Recordings:</strong>
          <ul style={{ margin: '4px 0', paddingLeft: '16px' }}>
            {overlappingSpots.map(spot => (
              <li key={spot.id} style={{ marginBottom: '2px' }}>
                {spot.filename} ({spot.duration || 0}s, {new Date(spot.timestamp).toLocaleDateString()})
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  // Place all player controls in a compact flex layout
  return (
    <div style={{ width: '100%', height: '100vh', position: 'relative' }}>
      {/* Reload GPS Button */}
      <button
        onClick={handleLocationRetry}
        style={{
          position: 'fixed',
          top: 'env(safe-area-inset-top, 24px)',
          right: 16,
          zIndex: 1002,
          background: 'white',
          border: '2px solid #3B82F6',
          borderRadius: '50%',
          padding: 10,
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        title="Reload GPS"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0114.13-3.36L23 10M1 14l5.36 5.36A9 9 0 0020.49 15"></path></svg>
      </button>

      {/* Map */}
      {showMap && (
        <div style={{ width: '100%', height: '100%' }}>
          <LeafletMapContainer 
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

            {/* Audio spots - each file gets its own marker with duration-based circle size */}
            {audioSpots.map((spot, idx) => {
              if (!spot.location || !spot.duration) return null;
              
              // Create circle icon based on duration
              const icon = createDurationCircleIcon(spot.duration);
              
              return (
                <Marker
                  key={spot.id}
                  position={[spot.location.lat, spot.location.lng]}
                  icon={icon}
                >
                  <Popup
                    autoPan={true}
                    closeButton={true}
                    className="audio-spot-popup"
                  >
                    <div style={{ textAlign: 'center', minWidth: '200px' }}>
                      <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: '600' }}>
                        🔊 {spot.filename}
                      </h3>
                      <p style={{ margin: '4px 0', fontSize: '14px', color: '#6B7280' }}>
                        Duration: {Math.round(spot.duration || 0)}s
                      </p>
                      <p style={{ margin: '4px 0', fontSize: '14px', color: '#6B7280' }}>
                        Date: {new Date(spot.timestamp).toLocaleDateString()}
                      </p>
                      {spot.notes && (
                        <p style={{ margin: '8px 0', fontSize: '14px', color: '#374151' }}>
                          {spot.notes}
                        </p>
                      )}
                      <button
                        onClick={async () => {
                          try {
                            const audioBlob = await localStorageService.getAudioBlob(spot.id);
                            if (audioBlob) {
                              await playAudio(spot, audioBlob, userLocation);
                            } else {
                              alert('Audio file not found');
                            }
                          } catch (error) {
                            console.error('Error playing audio:', error);
                            alert('Error playing audio: ' + error.message);
                          }
                        }}
                        style={{
                          width: '100%',
                          padding: '12px 16px',
                          background: '#3B82F6',
                          color: 'white',
                          border: 'none',
                          borderRadius: 8,
                          cursor: 'pointer',
                          fontWeight: 600,
                          fontSize: '16px',
                          transition: 'all 0.2s ease',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                        }}
                      >
                        ▶️ Play Audio
                      </button>
                      
                      <button
                        onClick={handleStopAudio}
                        style={{
                          width: '100%',
                          padding: '10px 16px',
                          background: '#EF4444',
                          color: 'white',
                          border: 'none',
                          borderRadius: 8,
                          cursor: 'pointer',
                          fontWeight: 600,
                          fontSize: '14px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px',
                          transition: 'all 0.2s ease',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                          marginTop: '8px'
                        }}
                        title="Stop playback"
                      >
                        <Square size={16} />
                        Stop All Audio
                      </button>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
            <MapUpdater center={center} zoom={zoom} />
          </LeafletMapContainer>
        </div>
      )}

      {/* Audio Player Overlay */}
      <div style={{
        position: 'fixed',
        bottom: '80px',
        left: '50%',
        transform: 'translateX(-50%)',
        backgroundColor: '#ffffffbf',
        borderRadius: '16px',
        boxShadow: 'rgb(157 58 58 / 30%) 0px 10px 30px',
        padding: '20px',
        minWidth: '300px',
        maxWidth: 'calc(100vw - 40px)',
        zIndex: 1000,
        margin: '0 20px'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: '0px 0px 8px', fontSize: '18px', fontWeight: '600' }}>
            🎧 SoundWalk Mode
          </h3>
          <p style={{ margin: '0px', fontSize: '14px', color: 'rgb(107, 114, 128)' }}>
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
            <div style={{ fontSize: '12px', color: 'rgb(107, 114, 128)' }}>
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
              backgroundColor: nearbySpots.length > 0 ? 'rgb(16, 185, 129)' : '#9CA3AF',
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
            onClick={handleStopAudio}
            style={{
              backgroundColor: 'rgb(239, 68, 68)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              padding: '8px 12px',
              cursor: 'pointer',
              transition: 'background-color 0.2s'
            }}
            title="Stop all audio"
          >
            <Square size={16} />
          </button>

          <button
            onClick={toggleMute}
            style={{
              backgroundColor: isMuted ? 'rgb(239, 68, 68)' : 'rgb(107, 114, 128)',
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
            style={{ flex: '1 1 0%' }}
          />
        </div>
      </div>

      {/* Top Bar - Using SharedTopBar */}
      <SharedTopBar
        onBackToLanding={onBackToLanding}
        onLocationRefresh={handleLocationRetry}
        locationPermission={locationPermission}
        microphonePermission="unknown"
        userLocation={userLocation}
        showMap={showMap}
        onToggleMap={() => setShowMap(!showMap)}
        onExportAll={handleExportAll}
        onExportMetadata={handleExportMetadata}
        audioSpotsCount={audioSpots.length}
      />
    </div>
  );
};

export default SoundWalk; 