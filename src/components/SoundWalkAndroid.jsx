// BETA VERSION: Overlapping audio spots now support Concatenated and Jamm listening modes.
import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import { Play, Pause, Square, Volume2, VolumeX, ArrowLeft, MapPin, Download } from 'lucide-react';
import localStorageService from '../services/localStorageService';
import RecordingExporter from '../utils/recordingExporter';
import TracklogExporter from '../utils/tracklogExporter.js';
import locationService from '../services/locationService.js';
import breadcrumbService from '../services/breadcrumbService.js';
import SharedTopBar from './SharedTopBar.jsx';
import BreadcrumbVisualization from './BreadcrumbVisualization.jsx';
import L from 'leaflet';
import { createDurationCircleIcon } from './SharedMarkerUtils';
import markerIconUrl from 'leaflet/dist/images/marker-icon.png';
import markerShadowUrl from 'leaflet/dist/images/marker-shadow.png';

// Add ErrorBoundary and wrapper export at the top

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return <div style={{color: 'red', fontSize: 24, padding: 20}}>Recorrido Sonoro falló: {String(this.state.error)}</div>;
    }
    return this.props.children;
  }
}

// Map updater component for Android
function MapUpdater({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center && map) {
      map.setView(center, zoom);
    }
  }, [center, zoom, map]);
  return null;
}

const SoundWalkAndroid = ({ onBackToLanding, locationPermission: propLocationPermission, userLocation, hasRequestedPermission, setLocationPermission, setUserLocation, setHasRequestedPermission }) => {
  // Add local state for GPS button state
  const [gpsState, setGpsState] = useState('idle'); // idle, loading, granted, denied
  const locationPermission = gpsState === 'idle' ? 'idle' : propLocationPermission;
  const [audioSpots, setAudioSpots] = useState([]);
  const [nearbySpots, setNearbySpots] = useState([]);
  const [currentAudio, setCurrentAudio] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.4);
  const [isMuted, setMuted] = useState(false);
  const [proximityVolumeEnabled, setProximityVolumeEnabled] = useState(false);
  // Always show map
  const showMap = true;
  const [activeGroup, setActiveGroup] = useState(null);
  const [playbackMode, setPlaybackMode] = useState('nearby');
  const [selectedSpot, setSelectedSpot] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const audioRefs = useRef([]);
  const audioContext = useRef(null);
  const isPlayingRef = useRef(false);
  const playbackTimeoutRef = useRef(null);
  const lastCenteredRef = useRef(null);
  const [mapInstance, setMapInstance] = useState(null);
  // Remove modalPosition, use Leaflet Popup only
  // Add state for auto-centering
  const [hasAutoCentered, setHasAutoCentered] = useState(false);
  
  // Breadcrumb state
  const [showBreadcrumbs, setShowBreadcrumbs] = useState(true); // Enable by default
  const [breadcrumbVisualization, setBreadcrumbVisualization] = useState('line');
  const [currentBreadcrumbs, setCurrentBreadcrumbs] = useState([]);
  const [isBreadcrumbTracking, setIsBreadcrumbTracking] = useState(false);
  
  // Add layer switching state
  const [currentLayer, setCurrentLayer] = useState('OpenStreetMap');

  // 1. Move recentering logic to a useEffect that depends on userLocation, and use 10 meters
  useEffect(() => {
    if (userLocation && (propLocationPermission === 'granted' || gpsState === 'granted')) {
      setGpsState('granted');
      if (mapInstance) {
        const prev = lastCenteredRef.current;
        const curr = userLocation;
        if (!prev) {
          mapInstance.setView([curr.lat, curr.lng], 16);
          lastCenteredRef.current = { lat: curr.lat, lng: curr.lng };
        } else {
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
            mapInstance.setView([curr.lat, curr.lng], 16);
            lastCenteredRef.current = { lat: curr.lat, lng: curr.lng };
          }
        }
      }
    } else {
      setGpsState('idle');
    }
  }, [userLocation, propLocationPermission, gpsState, mapInstance]);

  useEffect(() => {
    const loadAudioSpots = async () => {
      try {
        const recordings = await localStorageService.getAllRecordings();
        const spots = recordings.map(recording => ({
          id: recording.uniqueId,
          location: recording.location,
          filename: recording.displayName || recording.filename,
          timestamp: recording.timestamp,
          duration: recording.duration,
          notes: recording.notes,
          speciesTags: recording.speciesTags || [],
          audioBlob: recording.audioBlob // Add audioBlob to the spot object
        })).filter(spot =>
          spot &&
          spot.location &&
          typeof spot.location.lat === 'number' && isFinite(spot.location.lat) &&
          typeof spot.location.lng === 'number' && isFinite(spot.location.lng) &&
          typeof spot.duration === 'number' && isFinite(spot.duration) && spot.duration > 0
        );
        setAudioSpots(spots);
      } catch (error) {
        setAudioSpots([]);
      }
    };
    loadAudioSpots();
  }, []);

  useEffect(() => {
    let isMounted = true;
    const handleLocationGranted = (position) => {
      if (!isMounted) return;
      setUserLocation(position);
      setLocationPermission('granted');
      setHasRequestedPermission(true);
      setGpsState('granted');
      locationService.startLocationWatch(
        (newPosition) => {
          if (!isMounted) return;
          setUserLocation(newPosition);
          setLocationPermission('granted');
          setGpsState('granted');
          checkNearbySpots(newPosition);
        },
        (error) => {
          if (!isMounted) return;
          setLocationPermission('denied');
          setGpsState('denied');
        }
      );
    };
    const handleLocationDenied = (errorMessage) => {
      if (!isMounted) return;
      setLocationPermission('denied');
      setUserLocation(null);
      setHasRequestedPermission(true);
      setGpsState('denied');
    };
    const checkCachedPermissionState = async () => {
      setGpsState('loading');
      try {
        setLocationPermission('unknown');
        const permissionState = await locationService.checkLocationPermission();
        if (permissionState === 'granted') {
          const position = await locationService.requestLocation();
          handleLocationGranted(position);
        } else if (permissionState === 'denied') {
          handleLocationDenied('Permiso de ubicación denegado');
        } else {
          try {
            const position = await locationService.requestLocation();
            handleLocationGranted(position);
          } catch (error) {
            handleLocationDenied(error.message);
          }
        }
      } catch (error) {
        handleLocationDenied(error.message);
      }
    };
    if (!hasRequestedPermission) {
      setGpsState('idle');
    }
    return () => {
      isMounted = false;
      locationService.stopLocationWatch();
    };
  }, [hasRequestedPermission, setLocationPermission, setUserLocation, setHasRequestedPermission]);

  const handleLocationRetry = async () => {
    setGpsState('loading');
    setLocationPermission('unknown');
    try {
      locationService.stopLocationWatch();
      const position = await locationService.requestLocation();
      setUserLocation(position);
      setLocationPermission('granted');
      setHasRequestedPermission(true);
      setGpsState('granted');
      locationService.startLocationWatch(
        (newPosition) => {
          setUserLocation(newPosition);
          setLocationPermission('granted');
          setGpsState('granted');
          checkNearbySpots(newPosition);
        },
        (error) => {
          setLocationPermission('denied');
          setGpsState('denied');
        }
      );
    } catch (error) {
      setLocationPermission('denied');
      setUserLocation(null);
      setHasRequestedPermission(true);
      setGpsState('denied');
    }
  };

  const checkNearbySpots = (position) => {
    if (!position || !audioSpots.length) return;
    const nearby = audioSpots.filter(spot => {
      const distance = calculateDistance(
        position.lat, position.lng,
        spot.location.lat, spot.location.lng
      );
      return distance <= 10;
    });
    setNearbySpots(nearby);
  };

  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3;
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  function getProximityVolume(distance) {
    if (distance <= 5) return 1.0;
    if (distance >= 10) return 0.1;
    return Math.exp(-(distance - 5) / 2);
  }

  const playAudio = async (spot, audioBlob, userPos = null) => {
    if (isPlayingRef.current) {
      await stopAllAudio();
    }
    try {
      setIsLoading(true);
      const audio = new Audio(URL.createObjectURL(audioBlob));
      audio.preload = 'auto';
      audio.crossOrigin = 'anonymous';
      let dist = 0;
      if (proximityVolumeEnabled && userPos && spot.location) {
        dist = calculateDistance(userPos.lat, userPos.lng, spot.location.lat, spot.location.lng);
        audio.volume = getProximityVolume(dist);
      } else {
        audio.volume = isMuted ? 0 : volume;
      }
      audioRefs.current.push(audio);
      setCurrentAudio(spot);
      setSelectedSpot(spot);
      isPlayingRef.current = true;
      setIsPlaying(true);
      audio.oncanplaythrough = () => {};
      audio.onended = () => {
        isPlayingRef.current = false;
        setIsPlaying(false);
        setCurrentAudio(null);
        setSelectedSpot(null);
      };
      audio.onerror = (e) => {
        isPlayingRef.current = false;
        setIsPlaying(false);
        setCurrentAudio(null);
        setSelectedSpot(null);
      };
      try {
        await audio.play();
      } catch (playError) {
        setTimeout(async () => {
          try {
            await audio.play();
          } catch (retryError) {
            isPlayingRef.current = false;
            setIsPlaying(false);
          }
        }, 100);
      }
    } catch (error) {
      isPlayingRef.current = false;
      setIsPlaying(false);
    } finally {
      setIsLoading(false);
    }
  };

  const playNearbySpots = async (spots) => {
    if (spots.length === 0) return;
    try {
      setIsLoading(true);
      await stopAllAudio();
      const sortedSpots = spots.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      for (const spot of sortedSpots) {
        if (!isPlayingRef.current) break;
        try {
          const audioBlob = await localStorageService.getAudioBlob(spot.id);
          if (audioBlob) {
            await playAudio(spot, audioBlob, userLocation);
            await new Promise((resolve) => {
              const timeout = setTimeout(() => {
                resolve();
              }, 30000);
              if (audioRefs.current[0]) {
                audioRefs.current[0].onended = () => {
                  clearTimeout(timeout);
                  resolve();
                };
              } else {
                clearTimeout(timeout);
                resolve();
              }
            });
          }
        } catch (error) {}
      }
    } catch (error) {} finally {
      setIsLoading(false);
    }
  };

  const handlePlayNearby = () => {
    // Check for nearby spots with current location
    if (userLocation) {
      checkNearbySpots(userLocation);
    }
    
    if (nearbySpots.length > 0) {
      setPlaybackMode('nearby');
      playNearbySpots(nearbySpots);
    } else {
      alert('No hay puntos de audio cercanos. Acércate a las grabaciones de audio o intenta un modo de reproducción diferente.');
    }
  };

  const handleStopAudio = () => {
    stopAllAudio();
  };

  const toggleMute = () => {
    setMuted(!isMuted);
    if (audioRefs.current.length > 0) {
      audioRefs.current.forEach(audio => {
        audio.volume = !isMuted ? 0 : volume;
      });
    }
  };

  const handleVolumeChange = (newVolume) => {
    setVolume(newVolume);
    if (!isMuted && audioRefs.current.length > 0) {
      audioRefs.current.forEach(audio => {
        audio.volume = newVolume;
      });
    }
  };

  const handleExportAll = async () => {
    if (audioSpots.length === 0) return;
    try {
      await RecordingExporter.exportAllRecordings();
    } catch (error) {
      console.error('Export error:', error);
      // Only show error if it's not a handled fallback
      if (!error.message.includes('aborted') && !error.message.includes('showDirectoryPicker')) {
        alert('Exportación fallida: ' + error.message);
      }
    }
  };

  const handleExportMetadata = async () => {
    if (audioSpots.length === 0) return;
    try {
      await RecordingExporter.exportMetadata();
    } catch (error) {}
  };

  const handleExportZip = async () => {
    if (audioSpots.length === 0) return;
    try {
      await RecordingExporter.exportAsZip(audioSpots);
    } catch (error) {}
  };

  // Tracklog export functions
  const handleExportTracklog = async () => {
    try {
      const currentSession = breadcrumbService.getCurrentSession();
      if (!currentSession) {
        alert('No hay una sesión activa para exportar. Inicia el rastreo de migas de pan primero.');
        return;
      }

      // Stop tracking to get complete session data
      const sessionData = breadcrumbService.stopTracking();
      if (!sessionData) {
        alert('Error al obtener datos de la sesión.');
        return;
      }

      // Get associated recordings
      const associatedRecordings = TracklogExporter.getAssociatedRecordings(sessionData);
      
      await TracklogExporter.exportTracklog(sessionData, associatedRecordings, 'zip');
      
      // Restart tracking
      breadcrumbService.startTracking();
      setIsBreadcrumbTracking(true);
      
    } catch (error) {
      console.error('Error exporting tracklog:', error);
      alert('Error al exportar tracklog: ' + error.message);
    }
  };

  const handleExportCurrentSession = async () => {
    try {
      await TracklogExporter.exportCurrentSession('zip');
    } catch (error) {
      console.error('Error exporting current session:', error);
      alert('Error al exportar sesión actual: ' + error.message);
    }
  };

  function stopAllAudio() {
    isPlayingRef.current = false;
    setIsPlaying(false);
    setCurrentAudio(null);
    setSelectedSpot(null);
    if (playbackTimeoutRef.current) {
      clearTimeout(playbackTimeoutRef.current);
      playbackTimeoutRef.current = null;
    }
    audioRefs.current.forEach(audio => {
      try {
        audio.pause();
        audio.currentTime = 0;
        audio.src = '';
      } catch (error) {}
    });
    audioRefs.current = [];
  }

  const playSingleAudio = async (audioBlob) => {
    if (isPlayingRef.current) {
      await stopAllAudio();
    }
    try {
      const audio = new Audio(URL.createObjectURL(audioBlob));
      audio.volume = isMuted ? 0 : volume;
      audioRefs.current.push(audio);
      isPlayingRef.current = true;
      setIsPlaying(true);
      audio.onended = () => {
        isPlayingRef.current = false;
        setIsPlaying(false);
      };
      await audio.play();
    } catch (error) {
      isPlayingRef.current = false;
      setIsPlaying(false);
    }
  };

  async function playConcatenated(group) {
    if (group.length === 0) return;
    try {
      setIsLoading(true);
      await stopAllAudio();
      setPlaybackMode('concatenated');
      const audioBlobs = [];
      for (const spot of group) {
        const blob = await localStorageService.getAudioBlob(spot.id);
        if (blob) audioBlobs.push(blob);
      }
      if (audioBlobs.length > 0) {
        const concatenatedBlob = new Blob(audioBlobs, { type: 'audio/webm' });
        await playSingleAudio(concatenatedBlob);
      }
    } catch (error) {} finally {
      setIsLoading(false);
    }
  }

  async function playJamm(group) {
    if (group.length === 0) return;
    try {
      setIsLoading(true);
      await stopAllAudio();
      setPlaybackMode('jamm');
      const audioElements = [];
      for (const spot of group) {
        const blob = await localStorageService.getAudioBlob(spot.id);
        if (blob) {
          const audio = new Audio(URL.createObjectURL(blob));
          audio.volume = (isMuted ? 0 : volume) / group.length;
          audio.loop = true;
          audioRefs.current.push(audio);
          audioElements.push(audio);
        }
      }
      if (audioElements.length > 0) {
        isPlayingRef.current = true;
        setIsPlaying(true);
        for (const audio of audioElements) {
          try {
            await audio.play();
          } catch (error) {}
        }
      }
    } catch (error) {} finally {
      setIsLoading(false);
    }
  }

  function findOverlappingSpots(spot) {
    return audioSpots.filter(otherSpot => {
      if (otherSpot.id === spot.id) return false;
      const distance = calculateDistance(
        spot.location.lat, spot.location.lng,
        otherSpot.location.lat, otherSpot.location.lng
      );
      return distance <= 5;
    });
  }

  // 2. Show all metadata in the Leaflet Popup for each marker
  function renderPopupContent(clickedSpot) {
    return (
      <div style={{ minWidth: 220 }}>
        <div style={{ fontWeight: 'bold', fontSize: 16 }}>{clickedSpot.filename}</div>
        <div>Duración: {clickedSpot.duration ? clickedSpot.duration.toFixed(1) : '?'}s</div>
        <div>Fecha y hora: {clickedSpot.timestamp ? new Date(clickedSpot.timestamp).toLocaleString() : '?'}</div>
        {clickedSpot.notes && <div>Notas: {clickedSpot.notes}</div>}
        {clickedSpot.speciesTags && clickedSpot.speciesTags.length > 0 && (
          <div>Especies: {clickedSpot.speciesTags.join(', ')}</div>
        )}
        {clickedSpot.location && (
          <div>Ubicación: {clickedSpot.location.lat.toFixed(5)}, {clickedSpot.location.lng.toFixed(5)}</div>
        )}
        {/* Add any other metadata fields here if needed */}
        <button
          style={{ marginTop: 8, background: '#F59E42', color: 'white', border: 'none', borderRadius: 4, padding: '4px 12px', cursor: 'pointer' }}
          onClick={async () => {
            await stopAllAudio();
            // Always fetch the audioBlob for this spot
            const blob = await localStorageService.getAudioBlob(clickedSpot.id);
            if (blob) {
              setSelectedSpot(clickedSpot);
              setPlaybackMode('single');
              await playSingleAudio(blob);
            }
          }}
        >
          <Play size={16} style={{ marginRight: 4 }} /> Reproducir Individual
        </button>
      </div>
    );
  }

  useEffect(() => {
    return () => {
      stopAllAudio();
    };
  }, []);

  // Helper to handle back to menu and stop audio
  const handleBackToMenu = () => {
    stopAllAudio();
    // Stop breadcrumb tracking when leaving
    if (isBreadcrumbTracking) {
      breadcrumbService.stopTracking();
      setIsBreadcrumbTracking(false);
    }
    if (onBackToLanding) onBackToLanding();
  };

  // Breadcrumb functions
  const toggleBreadcrumbs = () => {
    const newShowBreadcrumbs = !showBreadcrumbs;
    setShowBreadcrumbs(newShowBreadcrumbs);
    
    if (newShowBreadcrumbs) {
      // Start tracking if not already tracking
      if (!isBreadcrumbTracking) {
        breadcrumbService.startTracking();
        setIsBreadcrumbTracking(true);
      }
      // Load current breadcrumbs
      const breadcrumbs = breadcrumbService.getCurrentBreadcrumbs();
      setCurrentBreadcrumbs(breadcrumbs);
    }
  };

  const handleSetBreadcrumbVisualization = (mode) => {
    setBreadcrumbVisualization(mode);
  };

  // Start breadcrumb tracking when component mounts
  useEffect(() => {
    breadcrumbService.startTracking();
    setIsBreadcrumbTracking(true);
    
    // Update breadcrumbs periodically
    const interval = setInterval(() => {
      if (showBreadcrumbs) {
        const breadcrumbs = breadcrumbService.getCurrentBreadcrumbs();
        setCurrentBreadcrumbs(breadcrumbs);
      }
    }, 1000);
    
    return () => {
      clearInterval(interval);
      breadcrumbService.stopTracking();
    };
  }, [showBreadcrumbs]);

  // Start breadcrumb tracking immediately when component mounts
  useEffect(() => {
    if (showBreadcrumbs && !isBreadcrumbTracking) {
      breadcrumbService.startTracking();
      setIsBreadcrumbTracking(true);
    }
  }, []);

  // Handle map creation using ref
  const mapRef = useRef(null);
  
  // Set map instance when ref is available
  useEffect(() => {
    if (mapRef.current) {
      setMapInstance(mapRef.current);
    }
  }, [mapRef.current]);

  return (
    <div style={{ width: '100%', height: '100vh', position: 'relative' }}>
      {/* Map */}
      <MapContainer 
        center={userLocation ? [userLocation.lat, userLocation.lng] : [6.2529, -75.5646]}
        zoom={16}
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
        ref={mapRef}
      >
        {/* OpenStreetMap Layer */}
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          opacity={currentLayer === 'OpenStreetMap' ? 1 : 0}
          zIndex={currentLayer === 'OpenStreetMap' ? 1 : 0}
        />

        {/* OpenTopoMap Layer */}
        <TileLayer
          attribution='Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)'
          url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
          opacity={currentLayer === 'OpenTopoMap' ? 1 : 0}
          zIndex={currentLayer === 'OpenTopoMap' ? 1 : 0}
        />

        {/* CartoDB Layer */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          opacity={currentLayer === 'CartoDB' ? 1 : 0}
          zIndex={currentLayer === 'CartoDB' ? 1 : 0}
        />

        {/* OSM Humanitarian Layer */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="https://www.hotosm.org/">Humanitarian OpenStreetMap Team</a>'
          url="https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png"
          opacity={currentLayer === 'OSMHumanitarian' ? 1 : 0}
          zIndex={currentLayer === 'OSMHumanitarian' ? 1 : 0}
        />
        {userLocation && (
          <>
            <Marker position={[userLocation.lat, userLocation.lng]} />
            <Circle
              center={[userLocation.lat, userLocation.lng]}
              radius={10}
              pathOptions={{ color: '#3B82F6', fillColor: '#3B82F6', fillOpacity: 0.3 }}
            />
          </>
        )}
        {(() => {
          try {
            return audioSpots
              .filter(spot =>
                spot &&
                spot.location &&
                typeof spot.location.lat === 'number' && isFinite(spot.location.lat) &&
                typeof spot.location.lng === 'number' && isFinite(spot.location.lng) &&
                typeof spot.duration === 'number' && isFinite(spot.duration) && spot.duration > 0
              )
              .map((spot, idx) => {
                return (
                  <Marker
                    key={spot.id}
                    position={[spot.location.lat, spot.location.lng]}
                    icon={createDurationCircleIcon(spot.duration)}
                    eventHandlers={{
                      click: () => setActiveGroup(spot)
                    }}
                  >
                    <Popup
                      onOpen={() => setActiveGroup(spot)}
                      onClose={() => setActiveGroup(null)}
                      className="audio-spot-popup"
                    >
                      {renderPopupContent(spot)}
                    </Popup>
                  </Marker>
                );
              });
          } catch (err) {
            // console.error('Error rendering markers:', err);
            return (
              <div style={{ color: 'red', fontWeight: 'bold' }}>
                Error al renderizar marcadores: {String(err)}
              </div>
            );
          }
        })()}
        
        {/* Breadcrumb Visualization */}
        {showBreadcrumbs && currentBreadcrumbs.length > 0 && (
          <BreadcrumbVisualization
            breadcrumbs={currentBreadcrumbs}
            visualizationMode={breadcrumbVisualization}
            mapInstance={mapInstance}
          />
        )}
      </MapContainer>
      
      {/* Shared TopBar */}
      <SharedTopBar
        userLocation={userLocation}
        onBackToLanding={handleBackToMenu}
        onLocationRefresh={() => {
          if (mapInstance && userLocation) {
            mapInstance.setView([userLocation.lat, userLocation.lng], 16);
            lastCenteredRef.current = { lat: userLocation.lat, lng: userLocation.lng };
          }
        }}
        onRequestGPSAccess={handleLocationRetry}
        mapInstance={mapInstance}
        showBreadcrumbs={showBreadcrumbs}
        onToggleBreadcrumbs={toggleBreadcrumbs}
        breadcrumbVisualization={breadcrumbVisualization}
        onSetBreadcrumbVisualization={handleSetBreadcrumbVisualization}
        showMicButton={false}
        showSearch={false}
        showZoomControls={true}
        showLayerSelector={true}
        currentLayer={currentLayer}
        onLayerChange={(layerName) => {
          console.log('SoundWalkAndroid: Layer changed to:', layerName);
          setCurrentLayer(layerName);
        }}
        showImportButton={true}
      />

      {/* Simple player modal at bottom of screen, only when playing audio */}
      {/* 3. Make the player modal always visible at the bottom, with mode controls always present */}
      <div style={{
        position: 'fixed',
        bottom: '190px', // Moved higher to avoid TopBar interference
        left: '50%',
        transform: 'translateX(-50%)',
        backgroundColor: '#ffffffbf', // translucent white
        borderRadius: '16px',
        boxShadow: 'rgb(157 58 58 / 30%) 0px 10px 30px',
        padding: '20px',
        minWidth: '300px',
        maxWidth: '400px',
        zIndex: 1000
      }}>
        <div style={{ textAlign: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: '0px 0px 8px', fontSize: '18px', fontWeight: '600' }}>
            🎧 Recorrido Sonoro Android
          </h3>
          <p style={{ margin: '0px', fontSize: '14px', color: 'rgb(107, 114, 128)' }}>
            {nearbySpots.length > 0 
              ? `${nearbySpots.length} punto${nearbySpots.length > 1 ? 's' : ''} de audio cercanos`
              : 'No hay puntos de audio cercanos'
            }
          </p>
        </div>
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>
            Modo de Reproducción:
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button onClick={() => setPlaybackMode('nearby')} style={{ padding: '6px 12px', backgroundColor: playbackMode === 'nearby' ? '#10B981' : '#E5E7EB', color: playbackMode === 'nearby' ? 'white' : '#374151', border: 'none', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>Cercanos</button>
            <button onClick={() => setPlaybackMode('concatenated')} style={{ padding: '6px 12px', backgroundColor: playbackMode === 'concatenated' ? '#10B981' : '#E5E7EB', color: playbackMode === 'concatenated' ? 'white' : '#374151', border: 'none', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>Concatenado</button>
            <button onClick={() => setPlaybackMode('jamm')} style={{ padding: '6px 12px', backgroundColor: playbackMode === 'jamm' ? '#10B981' : '#E5E7EB', color: playbackMode === 'jamm' ? 'white' : '#374151', border: 'none', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>Jamm</button>
          </div>
        </div>
        {currentAudio && (
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '4px' }}>
              🎚️ {currentAudio.filename}
            </div>
            <div style={{ fontSize: '12px', color: 'rgb(107, 114, 128)' }}>
              {new Date(currentAudio.timestamp).toLocaleDateString()}
            </div>
            <div style={{ fontSize: '12px', color: 'rgb(107, 114, 128)' }}>
              Modo: {playbackMode}
            </div>
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <button
            onClick={() => {
              if (playbackMode === 'nearby') handlePlayNearby();
              else if (playbackMode === 'concatenated') playConcatenated(audioSpots);
              else if (playbackMode === 'jamm') playJamm(audioSpots);
            }}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              backgroundColor: (nearbySpots.length > 0 || selectedSpot) ? '#10B981' : '#9CA3AF',
              color: 'white', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '14px', cursor: (nearbySpots.length > 0 || selectedSpot) ? 'pointer' : 'not-allowed', transition: 'background-color 0.2s'
            }}
          >
            <Play size={16} /> Reproducir
          </button>
          <button onClick={handleStopAudio} style={{ backgroundColor: '#EF4444', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '14px', cursor: 'pointer' }}>
            <Square size={16} /> Detener
          </button>
          <button onClick={toggleMute} style={{ backgroundColor: isMuted ? '#EF4444' : '#6B7280', color: 'white', border: 'none', borderRadius: '6px', padding: '8px 12px', fontSize: '14px', cursor: 'pointer' }}>
            {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <input type="checkbox" id="proximity-volume-toggle" checked={proximityVolumeEnabled} onChange={e => setProximityVolumeEnabled(e.target.checked)} />
          <label htmlFor="proximity-volume-toggle" style={{ fontSize: '14px', color: '#374151', cursor: 'pointer' }}>
            Volumen por proximidad (se desvanece con la distancia)
          </label>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Volume2 size={14} color="#374151" />
          <input type="range" min="0" max="1" step="0.01" value={volume} onChange={e => handleVolumeChange(Number(e.target.value))} />
        </div>
      </div>

      
      {/* Export Buttons */}
      <div style={{
        position: 'fixed',
        top: '180px',
        left: '20px',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
      }}>
        <button
          onClick={handleExportAll}
          disabled={audioSpots.length === 0}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: audioSpots.length > 0 ? '#10B981' : '#9CA3AF',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            padding: '8px 16px',
            fontSize: '14px',
            cursor: audioSpots.length > 0 ? 'pointer' : 'not-allowed',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
          }}
        >
          <Download size={16} />
          Exportar Audio
        </button>
        
        <button
          onClick={handleExportTracklog}
          disabled={!isBreadcrumbTracking}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: isBreadcrumbTracking ? '#8B5CF6' : '#9CA3AF',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            padding: '8px 16px',
            fontSize: '14px',
            cursor: isBreadcrumbTracking ? 'pointer' : 'not-allowed',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
          }}
        >
          📍 Exportar Tracklog
        </button>
      </div>
      {isLoading && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 2000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '12px',
            textAlign: 'center'
          }}>
            <div style={{ width: '32px', height: '32px', border: '3px solid #e5e7eb', borderTop: '3px solid #10B981', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
            <p style={{ margin: 0, fontSize: '14px', color: '#374151' }}>Cargando audio...</p>
          </div>
        </div>
      )}
      <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

// Wrap export in ErrorBoundary
const WrappedSoundWalkAndroid = (props) => (
  <ErrorBoundary>
    <SoundWalkAndroid {...props} />
  </ErrorBoundary>
);

export default WrappedSoundWalkAndroid; 