// BETA VERSION: Overlapping audio spots now support Concatenated and Jamm listening modes.
import React, { useState, useEffect, useRef } from 'react';
import { MapContainer as LeafletMapContainer, TileLayer, Marker, Popup, useMap, Circle, ZoomControl, Polyline } from 'react-leaflet';
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
      position: relative;
    " onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'">
      <div style="
        width: 16px; 
        height: 16px; 
        background-color: ${color}; 
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

// --- Error Boundary for SoundWalk ---
class SoundWalkErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    // Optionally log error
    console.error('SoundWalk render error:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 32, color: '#EF4444', background: '#FFF7F7', borderRadius: 12, margin: 32, textAlign: 'center' }}>
          <h2>Ocurrió un error en Recorrido Sonoro</h2>
          <pre style={{ color: '#B91C1C', fontSize: 14 }}>{this.state.error?.message || 'Unknown error'}</pre>
          <button onClick={() => window.location.reload()} style={{ marginTop: 16, background: '#EF4444', color: 'white', border: 'none', borderRadius: 6, padding: '8px 16px', cursor: 'pointer' }}>Recargar</button>
        </div>
      );
    }
    return this.props.children;
  }
}

const SoundWalk = ({ onBackToLanding, locationPermission, userLocation, hasRequestedPermission, setLocationPermission, setUserLocation, setHasRequestedPermission }) => {
  // --- DEBUG MARKER ---
  console.log('DEBUG: SoundWalk component mounted');
  // Visible marker for UI confirmation
  const debugMarker = (
    <div style={{position:'fixed',top:0,left:0,zIndex:9999,background:'yellow',color:'black',padding:'4px 12px',fontWeight:'bold',fontSize:'16px'}}>SoundWalk MOUNTED</div>
  );
  const [audioSpots, setAudioSpots] = useState([]);
  const [audioSpotsError, setAudioSpotsError] = useState(null); // NEW: error state
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
  // --- Robust cleanup refs ---
  const playbackTimeoutRef = useRef(null); // Track playback timeout for nearby spots
  const [tracklog, setTracklog] = useState([]);
  const [showTracklog, setShowTracklog] = useState(false);

  // Add Android/Capacitor-optimized state and refs
  const [playbackMode, setPlaybackMode] = useState('nearby'); // 'nearby', 'concatenated', 'jamm', 'single'
  const [selectedSpot, setSelectedSpot] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const isPlayingRef = useRef(false); // Prevent race conditions
  
  // Add layer switching state
  const [currentLayer, setCurrentLayer] = useState('StadiaSatellite');
  
  // Add breadcrumb state
  const [showBreadcrumbs, setShowBreadcrumbs] = useState(false);
  const [breadcrumbVisualization, setBreadcrumbVisualization] = useState('line');
  const [currentBreadcrumbs, setCurrentBreadcrumbs] = useState([]);

  // --- Tracklog helpers ---
  const loadTracklog = () => {
    try {
      const data = localStorage.getItem('biomap_tracklog');
      setTracklog(data ? JSON.parse(data) : []);
    } catch (e) {
      setTracklog([]);
    }
  };

  // Load audio spots from localStorage
  const loadAudioSpots = async () => {
    try {
      console.log('SoundWalk: Loading audio spots...');
      const recordings = localStorageService.getAllRecordings();
      console.log('SoundWalk: Raw recordings:', recordings);
      const spots = recordings.map(recording => ({
        id: recording.uniqueId,
        location: recording.location,
        filename: recording.displayName || recording.filename,
        timestamp: recording.timestamp,
        duration: recording.duration,
        notes: recording.notes,
        speciesTags: recording.speciesTags || []
      })).filter(spot =>
        spot.location &&
        typeof spot.location.lat === 'number' && isFinite(spot.location.lat) &&
        typeof spot.location.lng === 'number' && isFinite(spot.location.lng)
      );
      console.log('SoundWalk: Parsed audio spots:', spots);
      setAudioSpots(spots);
      setAudioSpotsError(null);
      if (!Array.isArray(recordings) || recordings.length === 0) {
        setAudioSpotsError('No recordings found in storage.');
        localStorage.setItem('biomap_soundwalk_error', 'No recordings found in storage.');
      } else if (spots.length === 0) {
        setAudioSpotsError('No valid audio spots found. Data may be corrupted.');
        localStorage.setItem('biomap_soundwalk_error', 'No valid audio spots found. Data may be corrupted.');
      }
    } catch (error) {
      setAudioSpotsError('Error loading audio spots: ' + error.message);
      localStorage.setItem('biomap_soundwalk_error', 'Error loading audio spots: ' + error.message);
      console.error('SoundWalk: Error loading audio spots:', error);
    }
  };

  useEffect(() => {
    loadAudioSpots();
    loadTracklog();
  }, []);

  // --- Refresh audio spots and tracklog when window/tab becomes visible or focused ---
  useEffect(() => {
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        loadAudioSpots();
        loadTracklog();
      }
    };
    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    return () => {
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
    };
  }, []);

  // --- GPS/Location Logic (using global state) ---
  // Remove the useEffect that checks and requests location permission
  // The manual permission request buttons in SharedTopBar.jsx handle this.

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

  // Unified playAudio function
  const playAudio = async (spot, audioBlob, userPos = null) => {
    if (isPlayingRef.current) {
      await stopAllAudio();
    }
    try {
      setIsLoading(true);
      const audio = new Audio(URL.createObjectURL(audioBlob));
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
        console.error('Audio error:', e);
      };
      await audio.play();
    } catch (error) {
      console.error('Audio setup/play error:', error);
      isPlayingRef.current = false;
      setIsPlaying(false);
    } finally {
      setIsLoading(false);
    }
  };

  // Unified playNearbySpots
  const playNearbySpots = async (spots) => {
    if (spots.length === 0) return;
    try {
      setIsLoading(true);
      await stopAllAudio();
      const sortedSpots = spots.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      for (const spot of sortedSpots) {
        if (!isPlayingRef.current) break;
        try {
          const audioBlob = await localStorageService.getAudioBlobFlexible(spot.id);
          if (audioBlob) {
            await playAudio(spot, audioBlob, userLocation);
            await new Promise((resolve) => {
              // --- Robust timer cleanup ---
              if (playbackTimeoutRef.current) {
                clearTimeout(playbackTimeoutRef.current);
                playbackTimeoutRef.current = null;
              }
              const timeout = setTimeout(resolve, 30000);
              playbackTimeoutRef.current = timeout;
              if (audioRefs.current[0]) {
                audioRefs.current[0].onended = () => {
                  clearTimeout(timeout);
                  playbackTimeoutRef.current = null;
                  resolve();
                };
              } else {
                clearTimeout(timeout);
                playbackTimeoutRef.current = null;
                resolve();
              }
            });
            // --- End robust timer cleanup ---
            if (playbackTimeoutRef.current) {
              clearTimeout(playbackTimeoutRef.current);
              playbackTimeoutRef.current = null;
            }
          } else {
            // Try native path as last resort
            const playableUrl = await localStorageService.getPlayableUrl(spot.id);
            if (playableUrl) {
              const el = new Audio(playableUrl);
              try { await el.play(); } catch (_) {}
            }
          }
        } catch (error) {
          console.error('Error playing spot:', spot.id, error);
        }
      }
    } catch (error) {
      console.error('Nearby playback error:', error);
    } finally {
      setIsLoading(false);
      setIsPlaying(false);
      if (playbackTimeoutRef.current) {
        clearTimeout(playbackTimeoutRef.current);
        playbackTimeoutRef.current = null;
      }
    }
  };

  // Unified playConcatenated
  async function playConcatenated(group) {
    if (group.length === 0) return;
    try {
      setIsLoading(true);
      await stopAllAudio();
      setPlaybackMode('concatenated');
      const audioBlobs = [];
      for (const spot of group) {
        const blob = await localStorageService.getAudioBlobFlexible(spot.id);
        if (blob) audioBlobs.push(blob);
      }
      if (audioBlobs.length > 0) {
        const concatenatedBlob = new Blob(audioBlobs, { type: 'audio/webm' });
        await playAudio(group[0], concatenatedBlob, userLocation);
      }
    } catch (error) {
      console.error('Concatenated playback error:', error);
    } finally {
      setIsLoading(false);
    }
  }

  // Unified playJamm
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
          } catch (error) {
            console.error('Jamm audio play error:', error);
          }
        }
      }
    } catch (error) {
      console.error('Jamm playback error:', error);
    } finally {
      setIsLoading(false);
    }
  }

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

  function getProximityVolume(distance) {
    const maxDistance = 15000; // 15km in meters
    const minVolume = 0.1; // Minimum volume
    const maxVolume = 1.0; // Maximum volume

    if (distance > maxDistance) {
      return minVolume;
    }
    const volumeRange = maxVolume - minVolume;
    const normalizedDistance = Math.min(distance, maxDistance) / maxDistance;
    return minVolume + (normalizedDistance * volumeRange);
  }

  // --- Export with tracklog ---
  const handleExportAll = async () => {
    try {
      await RecordingExporter.exportAllRecordings();
      // Also export tracklog as JSON
      if (tracklog && tracklog.length > 1) {
        const blob = new Blob([JSON.stringify({ tracklog, exportDate: new Date().toISOString() }, null, 2)], { type: 'application/json' });
        const filename = `biomap_tracklog_${new Date().toISOString().split('T')[0]}.json`;
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
      alert('Todas las grabaciones y registro de ruta exportadas con éxito!');
    } catch (error) {
      console.error('Export error:', error);
      alert('Exportación fallida: ' + error.message);
    }
  };

  const handleExportMetadata = async () => {
    try {
      await RecordingExporter.exportMetadata();
      alert('Metadatos exportados con éxito!');
    } catch (error) {
      console.error('Metadata export error:', error);
      alert('Exportación de metadatos fallida: ' + error.message);
    }
  };

  const center = userLocation || { lat: config.centroMapa.lat, lng: config.centroMapa.lon };
  const zoom = config.defaultZoom || 14;

  console.log('SoundWalk render - userLocation:', userLocation, 'locationPermission:', locationPermission, 'audioSpots:', audioSpots.length);

  // Fallback UI for audioSpots error
  if (audioSpotsError) {
    return (
      <div style={{ padding: 32, color: '#B91C1C', background: '#FFF7F7', borderRadius: 12, margin: 32, textAlign: 'center' }}>
        <h2>Error en Recorrido Sonoro</h2>
        <pre style={{ color: '#B91C1C', fontSize: 14 }}>{audioSpotsError}</pre>
        <button onClick={() => window.location.reload()} style={{ marginTop: 16, background: '#EF4444', color: 'white', border: 'none', borderRadius: 6, padding: '8px 16px', cursor: 'pointer' }}>Recargar</button>
        <div style={{ marginTop: 16, color: '#666', fontSize: 12 }}>
          Si esto persiste, intenta borrar tus grabaciones o contacta soporte.<br/>
          <strong>Información de depuración:</strong> Ver consola del navegador y la clave localStorage <code>biomap_soundwalk_error</code>.
        </div>
      </div>
    );
  }

  // --- UI for overlapping spots ---
  function renderPopupContent(clickedSpot) {
    const overlappingSpots = findOverlappingSpots(clickedSpot);
    if (!overlappingSpots || overlappingSpots.length === 0) {
      return <div>No hay grabaciones disponibles</div>;
    }
    return (
      <div style={{ minWidth: '200px', maxWidth: '300px' }}>
        <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: '600', color: '#1F2937' }}>
          {overlappingSpots.length > 1 ? `🎧 ${overlappingSpots.length} grabaciones superpuestas` : `🔊 ${overlappingSpots[0].filename}`}
        </h3>
        {overlappingSpots.length > 1 && (
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontWeight: 500, marginRight: 8, fontSize: '14px' }}>Modo de escucha:</label>
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
              <option value={LISTEN_MODES.CONCAT}>Concatenado</option>
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
                alert('Error al reproducir audio: ' + error.message);
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
            {isPlaying ? 'Reproduciendo...' : 'Reproducir Audio'}
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
            title="Detener reproducción"
          >
            <Square size={14} />
          </button>
        </div>
        {/* In Range (Nearby) Playback Button */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
          <button
            disabled={isPlaying || !nearbySpots || nearbySpots.length === 0}
            onClick={async () => {
              try {
                setIsPlaying(true);
                await playNearbySpots(nearbySpots);
              } catch (error) {
                console.error('Error playing nearby spots:', error);
                alert('Error al reproducir cercanos: ' + error.message);
              } finally {
                setIsPlaying(false);
              }
            }}
            style={{
              flex: 1,
              padding: '8px 16px',
              background: isPlaying ? '#9CA3AF' : '#10B981',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              cursor: isPlaying || !nearbySpots || nearbySpots.length === 0 ? 'not-allowed' : 'pointer',
              fontWeight: 600,
              fontSize: '14px',
              transition: 'background-color 0.2s'
            }}
          >
            {isPlaying ? 'Reproduciendo Cercanos...' : 'Reproducir Cercanos'}
          </button>
        </div>
        <div style={{ marginTop: 12, fontSize: 12, color: '#6B7280' }}>
          <strong>Grabaciones:</strong>
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
      {debugMarker}
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
        title="Recargar GPS"
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
            
            {/* StadiaMaps Satellite (default) */}
            <TileLayer
              attribution='&copy; <a href="https://stadiamaps.com/">Stadia Maps</a>'
              url="https://tiles.stadiamaps.com/tiles/alidade_satellite/{z}/{x}/{y}.jpg"
              opacity={currentLayer === 'StadiaSatellite' ? 1 : 0}
              zIndex={currentLayer === 'StadiaSatellite' ? 1 : 0}
              maxZoom={19}
            />

            {/* OpenStreetMap Layer */}
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              opacity={currentLayer === 'OpenStreetMap' ? 1 : 0}
              zIndex={currentLayer === 'OpenStreetMap' ? 1 : 0}
              maxZoom={19}
            />

            {/* OpenTopoMap Layer */}
            <TileLayer
              attribution='Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)'
              url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
              opacity={currentLayer === 'OpenTopoMap' ? 1 : 0}
              zIndex={currentLayer === 'OpenTopoMap' ? 1 : 0}
              maxZoom={17}
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

            {/* User location marker */}
            {userLocation && (
              <Marker
                position={[userLocation.lat, userLocation.lng]}
                icon={userLocationIcon}
              >
                <Popup>
                  <div>
                    <h3>Tu Ubicación</h3>
                    <p><strong>Latitud:</strong> {userLocation.lat.toFixed(6)}</p>
                    <p><strong>Longitud:</strong> {userLocation.lng.toFixed(6)}</p>
                    {userLocation.accuracy && (
                      <p><strong>Precisión:</strong> ±{Math.round(userLocation.accuracy)}m</p>
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
                        Duración: {Math.round(spot.duration || 0)}s
                      </p>
                      <p style={{ margin: '4px 0', fontSize: '14px', color: '#6B7280' }}>
                        Fecha: {new Date(spot.timestamp).toLocaleDateString()}
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
                              alert('Archivo de audio no encontrado');
                            }
                          } catch (error) {
                            console.error('Error al reproducir audio:', error);
                            alert('Error al reproducir audio: ' + error.message);
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
                        ▶️ Reproducir Audio
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
                        title="Detener reproducción"
                      >
                        <Square size={16} />
                        Detener Todo el Audio
                      </button>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
            {/* Tracklog Polyline */}
            {showTracklog && tracklog.length > 1 && (
              <Polyline
                positions={tracklog.map(pt => [pt.lat, pt.lng])}
                pathOptions={{
                  color: '#10B981',
                  weight: 4,
                  opacity: 0.85, // 85% opacity
                  dashArray: '8 8' // Dotted line: 8px dash, 8px gap
                }}
              />
            )}
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
            🎧 Modo Recorrido Sonoro
          </h3>
          <p style={{ margin: '0px', fontSize: '14px', color: 'rgb(107, 114, 128)' }}>
            {nearbySpots.length > 0 
              ? `${nearbySpots.length} punto${nearbySpots.length > 1 ? 's' : ''} de audio cercanos`
              : 'No hay puntos de audio cercanos'
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
            {isPlaying ? 'Reproduciendo...' : 'Reproducir Cercanos'}
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
            title="Detener todo el audio"
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
            aria-label="Volumen"
          />
        </div>
      </div>

      {/* Floating Mic Button - just above Back to Menu */}
      <button
        onClick={toggleAudioRecorder} // or the appropriate handler for mic click
        style={{
          position: 'fixed',
          left: '50%',
          bottom: '130px', // 50px above Back to Menu (which is at 80px)
          transform: 'translateX(-50%)',
          background: '#ef4444',
          color: 'white',
          border: '4px solid white',
          borderRadius: '50%',
          padding: '16px',
          boxShadow: '0 8px 25px rgba(239, 68, 68, 0.5), 0 4px 15px rgba(0, 0, 0, 0.3)',
          transition: 'all 0.3s ease',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minWidth: '64px',
          minHeight: '64px',
          zIndex: 1100,
          animation: 'microphone-pulse 2s infinite'
        }}
        title="Grabar Audio"
      >
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
          <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
          <line x1="12" y1="19" x2="12" y2="23"/>
          <line x1="8" y1="23" x2="16" y2="23"/>
        </svg>
      </button>

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
        showLayerSelector={true}
        currentLayer={currentLayer}
        onLayerChange={(layerName) => {
          console.log('SoundWalk: Layer changed to:', layerName);
          setCurrentLayer(layerName);
        }}
        showBreadcrumbs={showBreadcrumbs}
        onToggleBreadcrumbs={() => setShowBreadcrumbs(!showBreadcrumbs)}
        breadcrumbVisualization={breadcrumbVisualization}
        onSetBreadcrumbVisualization={setBreadcrumbVisualization}
      />
    </div>
  );
};

// --- Wrap export ---
export default function SoundWalkWithBoundary(props) {
  return <SoundWalkErrorBoundary><SoundWalk {...props} /></SoundWalkErrorBoundary>;
} 