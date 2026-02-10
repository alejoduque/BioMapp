// BETA VERSION: Overlapping audio spots now support Concatenated and Jamm listening modes.
import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap, Polyline, Tooltip } from 'react-leaflet';
import { Play, Pause, Square, Volume2, VolumeX, ArrowLeft, MapPin, Mic } from 'lucide-react';
import localStorageService from '../services/localStorageService';
import locationService from '../services/locationService.js';
import breadcrumbService from '../services/breadcrumbService.js';
import walkSessionService from '../services/walkSessionService.js';
import userAliasService from '../services/userAliasService.js';
import SharedTopBar from './SharedTopBar.jsx';
import BreadcrumbVisualization from './BreadcrumbVisualization.jsx';
import AudioRecorder from '../services/AudioRecorder.tsx';
// WalkSessionPanel removed — derive controls now integrated into SharedTopBar
import AliasPrompt from './AliasPrompt.jsx';
import SessionHistoryPanel from './SessionHistoryPanel.jsx';
import DetailView from './DetailView.jsx';
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

// Custom alert function for Android without localhost text
const showAlert = (message) => {
  if (window.Capacitor?.isNativePlatform()) {
    // For native platforms, create a simple modal overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.7); z-index: 10000;
      display: flex; align-items: center; justify-content: center;
    `;
    
    const modal = document.createElement('div');
    modal.style.cssText = `
      background: white; border-radius: 8px; padding: 20px;
      max-width: 300px; margin: 20px; text-align: center;
      box-shadow: 0 10px 30px rgba(0,0,0,0.3);
    `;
    
    modal.innerHTML = `
      <p style="margin: 0 0 15px 0; font-size: 14px; color: #374151;">${message}</p>
      <button style="
        background: #3B82F6; color: white; border: none; border-radius: 6px;
        padding: 8px 16px; cursor: pointer; font-size: 14px;
      ">OK</button>
    `;
    
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    
    // Close on button click or overlay click
    const closeModal = () => document.body.removeChild(overlay);
    modal.querySelector('button').onclick = closeModal;
    overlay.onclick = (e) => e.target === overlay && closeModal();
  } else {
    // For web, use regular alert
    alert(message);
  }
};

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
  const [currentLayer, setCurrentLayer] = useState('StadiaSatellite');
  
  // Debug state
  const [showDebugInfo, setShowDebugInfo] = useState(false);

  // Walk session & recording state
  const [showAliasPrompt, setShowAliasPrompt] = useState(false);
  const [isAudioRecorderVisible, setIsAudioRecorderVisible] = useState(false);
  const [activeWalkSession, setActiveWalkSession] = useState(() => {
    // If a stale active session exists from a previous app run, auto-save it
    const stale = walkSessionService.autoSaveStaleSession();
    if (stale) return null; // was saved, start fresh
    return walkSessionService.getActiveSession();
  });
  const [showSessionHistory, setShowSessionHistory] = useState(false);
  const [sessionTracklines, setSessionTracklines] = useState([]);
  const [visibleSessionIds, setVisibleSessionIds] = useState(new Set());
  const [sessionPlayback, setSessionPlayback] = useState(null); // { sessionId, mode, title, alias }
  const [playerExpanded, setPlayerExpanded] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedPoint, setSelectedPoint] = useState(null);

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
      // Auto-check cached permission on mount — if already granted, center map
      checkCachedPermissionState();
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
    if (distance >= 15) return 0.1; // Extended range for spatial mixing
    return Math.exp(-(distance - 5) / 3);
  }

  // Calculate bearing (direction) from user to audio spot in degrees (0-360)
  function calculateBearing(lat1, lng1, lat2, lng2) {
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const lat1Rad = lat1 * Math.PI / 180;
    const lat2Rad = lat2 * Math.PI / 180;
    
    const y = Math.sin(dLng) * Math.cos(lat2Rad);
    const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - 
              Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng);
    
    let bearing = Math.atan2(y, x) * 180 / Math.PI;
    return (bearing + 360) % 360; // Normalize to 0-360
  }

  // Convert bearing to stereo pan (-1 = full left, +1 = full right)
  function calculateSterePan(bearing) {
    // 0° = North = center (0)
    // 90° = East = full right (+1)
    // 180° = South = center (0)  
    // 270° = West = full left (-1)
    
    // Convert bearing to radians for smoother calculation
    const bearingRad = bearing * Math.PI / 180;
    
    // Use sine function to map bearing to pan (-1 to +1)
    // 90° (East) = sin(90°) = 1 (right)
    // 270° (West) = sin(270°) = -1 (left)
    const pan = Math.sin(bearingRad);
    
    // Clamp to valid range
    return Math.max(-1, Math.min(1, pan));
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
        const proximityVolume = getProximityVolume(dist);
        audio.volume = proximityVolume;
        console.log(`🔊 Proximity volume: distance=${dist.toFixed(1)}m, volume=${proximityVolume.toFixed(2)}`);
      } else {
        audio.volume = isMuted ? 0 : volume;
        console.log(`🔊 Standard volume: ${audio.volume.toFixed(2)} (muted=${isMuted})`);
      }
      audioRefs.current.push(audio);
      setCurrentAudio(spot);
      setSelectedSpot(spot);
      isPlayingRef.current = true;
      setIsPlaying(true);
      setPlayerExpanded(true);
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
    console.log(`🎧 Spatial audio playback with ${spots.length} nearby spots`);
    if (spots.length === 0) return;
    
    try {
      setIsLoading(true);
      await stopAllAudio();
      
      // Set playing state
      isPlayingRef.current = true;
      setIsPlaying(true);
      setPlayerExpanded(true);

      // Calculate bearing and distance for each spot
      const spatialSpots = spots.map(spot => {
        const distance = calculateDistance(
          userLocation.lat, userLocation.lng,
          spot.location.lat, spot.location.lng
        );
        const bearing = calculateBearing(
          userLocation.lat, userLocation.lng,
          spot.location.lat, spot.location.lng
        );
        return { ...spot, distance, bearing };
      });
      
      console.log('🗺️ Spatial positions:', spatialSpots.map(s => 
        `${s.filename}: ${s.distance.toFixed(1)}m, ${s.bearing.toFixed(0)}°`
      ));
      
      // Start all nearby sounds simultaneously with spatial audio
      const audioPromises = spatialSpots.map(async (spot) => {
        try {
          console.log(`🎵 Loading spatial audio: ${spot.filename}`);
          const audioSource = await getPlayableAudioForSpot(spot.id);

          if (audioSource) {
            const audioUrl = audioSource.type === 'blob'
              ? URL.createObjectURL(audioSource.blob)
              : audioSource.url;
            const audio = new Audio(audioUrl);
            audio.preload = 'auto';
            audio.loop = true; // Loop for ambient mixing
            
            // Calculate spatial audio properties
            const volume = getProximityVolume(spot.distance);
            const pan = calculateSterePan(spot.bearing);
            
            console.log(`🔊 ${spot.filename}: vol=${volume.toFixed(2)}, pan=${pan.toFixed(2)}, dist=${spot.distance.toFixed(1)}m`);
            
            // Apply volume (use global volume state)
            audio.volume = isMuted ? 0 : volume;
            
            // Apply stereo panning using Web Audio API
            if (window.AudioContext || window.webkitAudioContext) {
              try {
                const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                const audioSource = audioContext.createMediaElementSource(audio);
                const panNode = audioContext.createStereoPanner();
                
                panNode.pan.value = pan;
                audioSource.connect(panNode);
                panNode.connect(audioContext.destination);
                
                // Store audio context references for cleanup
                audio._audioContext = audioContext;
                audio._panNode = panNode;
                audio._audioSource = audioSource;
                
                console.log(`🎧 Spatial audio setup for ${spot.filename}: pan=${pan.toFixed(2)}`);
              } catch (spatialError) {
                console.warn('⚠️ Spatial audio not supported, using standard audio');
              }
            }
            
            // Track audio reference
            audioRefs.current.push(audio);
            
            // Set up event handlers
            audio.onended = () => {
              console.log(`🔚 ${spot.filename} ended`);
            };
            
            audio.onerror = (error) => {
              console.error(`❌ Audio error for ${spot.filename}:`, error);
            };
            
            // Start playback
            await audio.play();
            console.log(`▶️ Started spatial playback: ${spot.filename}`);
            
            return audio;
          } else {
            console.warn(`⚠️ No audio source for ${spot.filename}`);
            return null;
          }
        } catch (error) {
          console.error(`❌ Error setting up spatial audio for ${spot.filename}:`, error);
          return null;
        }
      });
      
      // Wait for all audio to start
      const activeAudios = (await Promise.all(audioPromises)).filter(audio => audio !== null);
      console.log(`🎼 Started ${activeAudios.length} simultaneous spatial audio streams`);
      
      // Update current audio info (show the closest one)
      const closestSpot = spatialSpots.reduce((closest, current) => 
        current.distance < closest.distance ? current : closest
      );
      setCurrentAudio(closestSpot);
      setSelectedSpot(closestSpot);
      
    } catch (error) {
      console.error('❌ Error in spatial audio playback:', error);
      isPlayingRef.current = false;
      setIsPlaying(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlayNearby = () => {
    console.log('🎯 handlePlayNearby called');
    
    // If already playing, stop playback
    if (isPlaying) {
      console.log('⏹️ Already playing, stopping audio');
      stopAllAudio();
      return;
    }
    
    if (!userLocation) {
      console.log('❌ No user location available');
      showAlert('Se requiere ubicación GPS para reproducir sonidos cercanos.');
      return;
    }
    
    // Calculate nearby spots directly instead of relying on state
    console.log('📍 User location available, calculating nearby spots directly');
    const directNearbyCheck = audioSpots.filter(spot => {
      if (!spot || !spot.location) return false;
      const distance = calculateDistance(
        userLocation.lat, userLocation.lng,
        spot.location.lat, spot.location.lng
      );
      console.log(`📏 Distance to ${spot.filename}: ${distance.toFixed(1)}m`);
      return distance <= 15; // Extended range for spatial mixing
    });
    
    console.log(`🔍 Found ${directNearbyCheck.length} nearby spots directly`);
    
    if (directNearbyCheck.length > 0) {
      console.log('✅ Playing nearby spots:', directNearbyCheck.map(s => s.filename));
      setPlaybackMode('nearby');
      playNearbySpots(directNearbyCheck);
    } else {
      console.log('❌ No nearby spots found');
      showAlert('No hay puntos de audio cercanos (dentro de 15 metros). Acércate más a las grabaciones para experimentar el audio espacial.');
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

  function stopAllAudio() {
    console.log('🛑 Stopping all audio and cleaning up spatial audio');
    isPlayingRef.current = false;
    setIsPlaying(false);
    setCurrentAudio(null);
    setSelectedSpot(null);
    setSessionPlayback(null);
    
    if (playbackTimeoutRef.current) {
      clearTimeout(playbackTimeoutRef.current);
      playbackTimeoutRef.current = null;
    }
    
    audioRefs.current.forEach(audio => {
      try {
        // Stop playback
        audio.pause();
        audio.currentTime = 0;
        
        // Clean up Web Audio API contexts
        if (audio._audioContext) {
          try {
            if (audio._audioSource) {
              audio._audioSource.disconnect();
            }
            if (audio._panNode) {
              audio._panNode.disconnect();
            }
            if (audio._audioContext.state !== 'closed') {
              audio._audioContext.close();
            }
            console.log('🧹 Cleaned up spatial audio context');
          } catch (contextError) {
            console.warn('⚠️ Error cleaning up audio context:', contextError);
          }
          
          // Clear references
          delete audio._audioContext;
          delete audio._audioSource;
          delete audio._panNode;
        }
        
        // Revoke blob URLs to prevent memory leaks
        if (audio.src && audio.src.startsWith('blob:')) {
          URL.revokeObjectURL(audio.src);
        }
        audio.src = '';
        
      } catch (error) {
        console.warn('⚠️ Error stopping audio:', error);
      }
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
      setPlayerExpanded(true);
      audio.onended = () => {
        isPlayingRef.current = false;
        setIsPlaying(false);
      };
      audio.onerror = (e) => {
        console.error('Audio playback error (blob):', e);
        isPlayingRef.current = false;
        setIsPlaying(false);
      };
      await audio.play();
    } catch (error) {
      console.error('Failed to play audio blob:', error);
      isPlayingRef.current = false;
      setIsPlaying(false);
    }
  };

  const playSingleAudioFromUrl = async (url) => {
    if (isPlayingRef.current) {
      await stopAllAudio();
    }
    try {
      const audio = new Audio(url);
      audio.volume = isMuted ? 0 : volume;
      audioRefs.current.push(audio);
      isPlayingRef.current = true;
      setIsPlaying(true);
      setPlayerExpanded(true);
      audio.onended = () => {
        isPlayingRef.current = false;
        setIsPlaying(false);
      };
      audio.onerror = (e) => {
        console.error('Audio playback error (url):', e);
        isPlayingRef.current = false;
        setIsPlaying(false);
      };
      await audio.play();
    } catch (error) {
      console.error('Failed to play audio URL:', error);
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
      
      console.log(`🔗 Starting Concatenated mode with ${group.length} files`);
      
      // Sort spots chronologically by timestamp
      const sortedSpots = [...group].sort((a, b) => {
        const timeA = new Date(a.timestamp || 0).getTime();
        const timeB = new Date(b.timestamp || 0).getTime();
        return timeA - timeB;
      });
      
      console.log(`📅 Sorted ${sortedSpots.length} spots chronologically`);
      
      // Simple sequential playback with basic crossfades
      let currentIndex = 0;
      
      const playNext = async () => {
        if (currentIndex >= sortedSpots.length || !isPlayingRef.current) {
          console.log('🏁 Concatenated playback completed');
          setIsPlaying(false);
          isPlayingRef.current = false;
          return;
        }
        
        const spot = sortedSpots[currentIndex];
        console.log(`🎵 Playing track ${currentIndex + 1}/${sortedSpots.length}: ${spot.filename}`);
        
        try {
          const audioSource = await getPlayableAudioForSpot(spot.id);

          if (!audioSource) {
            console.warn(`⚠️ No audio for ${spot.filename}, skipping`);
            currentIndex++;
            await playNext();
            return;
          }

          // Create audio element
          const audioUrl = audioSource.type === 'blob'
            ? URL.createObjectURL(audioSource.blob)
            : audioSource.url;
          const audio = new Audio(audioUrl);
          audio.volume = isMuted ? 0 : volume;
          audioRefs.current.push(audio);
          
          // Update UI with current track info
          setCurrentAudio(spot);
          setSelectedSpot(spot);
          
          // Set up event handlers
          audio.onended = () => {
            console.log(`🔚 Track ${currentIndex + 1} ended`);
            currentIndex++;
            // Small delay before next track for basic crossfade effect
            setTimeout(() => {
              if (isPlayingRef.current) {
                playNext();
              }
            }, 200);
          };
          
          audio.onerror = (error) => {
            console.error(`❌ Error playing track ${currentIndex + 1}:`, error);
            currentIndex++;
            setTimeout(() => {
              if (isPlayingRef.current) {
                playNext();
              }
            }, 100);
          };
          
          // Start playback
          await audio.play();
          console.log(`▶️ Successfully started track ${currentIndex + 1}`);
          
        } catch (error) {
          console.error(`❌ Error with track ${currentIndex + 1}:`, error);
          currentIndex++;
          // Continue to next track even if current one fails
          setTimeout(() => {
            if (isPlayingRef.current) {
              playNext();
            }
          }, 100);
        }
      };
      
      // Start playback
      isPlayingRef.current = true;
      setIsPlaying(true);
      setPlayerExpanded(true);
      await playNext();
      
      console.log('✅ Concatenated mode started successfully');
      
    } catch (error) {
      console.error('❌ Error in Concatenated mode:', error);
      setIsPlaying(false);
      isPlayingRef.current = false;
    } finally {
      setIsLoading(false);
    }
  }

  async function playJamm(group) {
    if (group.length === 0) return;
    try {
      setIsLoading(true);
      await stopAllAudio();
      setPlaybackMode('jamm');
      
      console.log(`🎼 Starting Jamm mode with ${group.length} files`);
      
      // Create Web Audio API context for advanced panning
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const audioElements = [];
      const audioSources = [];
      const panNodes = [];
      
      for (let i = 0; i < group.length; i++) {
        const spot = group[i];
        const src = await getPlayableAudioForSpot(spot.id);

        if (src) {
          // Create audio element
          const audioUrl = src.type === 'blob' ? URL.createObjectURL(src.blob) : src.url;
          const audio = new Audio(audioUrl);
          audio.volume = isMuted ? 0 : volume;
          audio.loop = false; // NO LOOPING as requested
          audioRefs.current.push(audio);
          audioElements.push(audio);
          
          // Create Web Audio API nodes for advanced panning
          const audioSource = audioContext.createMediaElementSource(audio);
          const panNode = audioContext.createStereoPanner();
          
          // Connect audio graph
          audioSource.connect(panNode);
          panNode.connect(audioContext.destination);
          
          audioSources.push(audioSource);
          panNodes.push(panNode);
          
          // Get audio duration to calculate panning speed
          audio.addEventListener('loadedmetadata', () => {
            const duration = audio.duration;
            startPanningAnimation(panNode, duration, i);
          });
          
          console.log(`🎵 Prepared audio ${i + 1}: ${spot.filename}`);
        }
      }
      
      if (audioElements.length > 0) {
        isPlayingRef.current = true;
        setIsPlaying(true);
        setPlayerExpanded(true);

        // Start all audio simultaneously
        console.log(`▶️ Starting ${audioElements.length} simultaneous audio streams`);
        const playPromises = audioElements.map(audio => {
          try {
            return audio.play();
          } catch (error) {
            console.warn('Audio play failed:', error);
            return Promise.resolve();
          }
        });
        
        await Promise.all(playPromises);
        
        // Set up global end handler (when any audio ends, stop all)
        audioElements.forEach(audio => {
          audio.addEventListener('ended', () => {
            console.log('🏁 Audio ended in Jamm mode, stopping all');
            stopAllAudio();
          });
        });
        
        console.log('✅ Jamm mode playback started successfully');
      }
    } catch (error) {
      console.error('❌ Error in Jamm mode:', error);
    } finally {
      setIsLoading(false);
    }
  }

  // Panning animation function for Jamm mode
  function startPanningAnimation(panNode, duration, index) {
    if (!panNode || !duration || duration <= 0) return;
    
    const startTime = Date.now();
    const updateInterval = 50; // Update every 50ms for smooth panning
    
    // Each audio gets a different panning pattern
    const panDirection = index % 2 === 0 ? 1 : -1; // Alternate L→R and R→L
    
    const panAnimation = () => {
      const elapsed = (Date.now() - startTime) / 1000; // seconds
      const progress = elapsed / duration; // 0 to 1
      
      if (progress >= 1 || !isPlayingRef.current) {
        panNode.pan.value = 0; // Center at end
        return;
      }
      
      // Calculate pan value: complete L→R→L cycle during file duration
      const cycleProgress = (progress * 2) % 2; // 0 to 2
      let panValue;
      
      if (cycleProgress <= 1) {
        // First half: L to R (or R to L)
        panValue = (cycleProgress - 0.5) * 2 * panDirection; // -1 to 1
      } else {
        // Second half: R to L (or L to R)  
        panValue = (1.5 - cycleProgress) * 2 * panDirection; // 1 to -1
      }
      
      // Clamp to valid range [-1, 1]
      panNode.pan.value = Math.max(-1, Math.min(1, panValue));
      
      // Continue animation
      setTimeout(panAnimation, updateInterval);
    };
    
    // Start panning animation
    panAnimation();
    console.log(`🎛️ Started panning animation for audio ${index + 1}, direction: ${panDirection > 0 ? 'L→R' : 'R→L'}`);
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
            // Close the popup to avoid overlapping UI
            if (mapInstance) mapInstance.closePopup();
            const audioSource = await getPlayableAudioForSpot(clickedSpot.id);
            if (audioSource) {
              setSelectedSpot(clickedSpot);
              setPlaybackMode('single');
              if (audioSource.type === 'blob') {
                await playSingleAudio(audioSource.blob);
              } else {
                await playSingleAudioFromUrl(audioSource.url);
              }
            } else {
              showAlert('No se encontró audio para esta grabación.');
            }
          }}
        >
          <Play size={16} style={{ marginRight: 4 }} /> Reproducir
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

  // Check alias on mount
  useEffect(() => {
    if (!userAliasService.hasAlias()) {
      setShowAliasPrompt(true);
    }
  }, []);

  // Load saved session tracklines for map visualization
  useEffect(() => {
    const sessions = walkSessionService.getCompletedSessions();
    const lines = sessions
      .filter(s => s.breadcrumbs && s.breadcrumbs.length >= 2)
      .map(s => ({
        sessionId: s.sessionId,
        positions: s.breadcrumbs.map(b => [b.lat, b.lng]),
        color: userAliasService.aliasToHexColor(s.userAlias),
        alias: s.userAlias,
        title: s.title || 'Deriva sin título',
        recordingCount: s.recordingIds?.length || 0
      }));
    setSessionTracklines(lines);
    // Initialize all sessions as visible
    setVisibleSessionIds(new Set(sessions.map(s => s.sessionId)));
  }, [activeWalkSession]); // Refresh when session changes

  // Helper: get a playable audio source for a spot (blob or native URL)
  const getPlayableAudioForSpot = async (spotId) => {
    // Try blob first (localStorage or native file via Filesystem)
    const blob = await localStorageService.getAudioBlobFlexible(spotId);
    if (blob && blob.size > 0) return { type: 'blob', blob };
    // Fallback: try native playable URL
    const url = await localStorageService.getPlayableUrl(spotId);
    if (url) return { type: 'url', url };
    return null;
  };

  // Walk session recording handler
  const handleWalkRecordingSave = (recordingData) => {
    try {
      const { metadata, audioBlob, audioPath } = recordingData;
      // Store native audioPath in metadata so playback can find the file
      if (audioPath) {
        metadata.audioPath = audioPath;
      }
      const sessionId = activeWalkSession?.sessionId || null;
      if (sessionId) {
        metadata.walkSessionId = sessionId;
      }
      localStorageService.saveRecording(metadata, audioBlob);
      if (sessionId) {
        walkSessionService.addRecordingToSession(sessionId, metadata.uniqueId);
        setActiveWalkSession({ ...walkSessionService.getActiveSession() });
      }
      // Reload audio spots
      const recordings = localStorageService.getAllRecordings();
      const spots = recordings
        .filter(r => r.location && r.location.lat && r.location.lng)
        .map(r => ({
          id: r.uniqueId,
          location: r.location,
          filename: r.displayName || r.filename,
          timestamp: r.timestamp,
          duration: r.duration,
          notes: r.notes,
          speciesTags: r.speciesTags || [],
        }))
        .filter(s => s.id && s.duration > 0);
      setAudioSpots(spots);
      setIsAudioRecorderVisible(false);
    } catch (error) {
      console.error('Error saving walk recording:', error);
    }
  };

  const handleStartMicForWalk = () => {
    setIsAudioRecorderVisible(true);
  };

  const updateQuery = (q) => setQuery(q);

  const searchMapData = (q) => {
    if (!q || !q.trim()) return;
    const lowerQ = q.toLowerCase();
    const matching = audioSpots.filter(spot =>
      (spot.filename && spot.filename.toLowerCase().includes(lowerQ)) ||
      (spot.notes && spot.notes.toLowerCase().includes(lowerQ)) ||
      (spot.speciesTags && spot.speciesTags.some(tag => tag.toLowerCase().includes(lowerQ)))
    );
    if (matching.length > 0 && mapInstance) {
      const first = matching[0];
      mapInstance.setView([first.location.lat, first.location.lng], 17);
    }
  };

  const handleMarkerClick = (spot) => {
    setActiveGroup(spot);
    // Wrap spot into GeoJSON-like shape for DetailView
    setSelectedPoint({
      properties: spot,
      geometry: { coordinates: [spot.location.lng, spot.location.lat] }
    });
  };

  const getNextRecording = (point) => {
    const validSpots = audioSpots.filter(s => s && s.location);
    const idx = validSpots.findIndex(s => s.id === point.properties.id);
    const nextIdx = (idx + 1) % validSpots.length;
    const next = validSpots[nextIdx];
    setSelectedPoint({
      properties: next,
      geometry: { coordinates: [next.location.lng, next.location.lat] }
    });
  };

  const getPreviousRecording = (point) => {
    const validSpots = audioSpots.filter(s => s && s.location);
    const idx = validSpots.findIndex(s => s.id === point.properties.id);
    const prevIdx = idx <= 0 ? validSpots.length - 1 : idx - 1;
    const prev = validSpots[prevIdx];
    setSelectedPoint({
      properties: prev,
      geometry: { coordinates: [prev.location.lng, prev.location.lat] }
    });
  };

  const handleStartDerive = async () => {
    try {
      const session = walkSessionService.startSession();
      if (userLocation) {
        await walkSessionService.startTracking(userLocation);
      }
      setActiveWalkSession(session);
    } catch (error) {
      console.error('Error starting walk session:', error);
    }
  };

  const handleEndDerive = async (title) => {
    try {
      const sessionId = activeWalkSession.sessionId;
      if (title) {
        walkSessionService.updateSession(sessionId, { title });
      }
      walkSessionService.endSession(sessionId);
      setActiveWalkSession(null);
      // Refresh tracklines
      const sessions = walkSessionService.getCompletedSessions();
      const lines = sessions
        .filter(s => s.breadcrumbs && s.breadcrumbs.length >= 2)
        .map(s => ({
          sessionId: s.sessionId,
          positions: s.breadcrumbs.map(b => [b.lat, b.lng]),
          color: userAliasService.aliasToHexColor(s.userAlias),
          alias: s.userAlias,
          title: s.title || 'Deriva sin título',
          recordingCount: s.recordingIds?.length || 0
        }));
      setSessionTracklines(lines);

      // Auto-export ZIP
      try {
        const { default: DeriveSonoraExporter } = await import('../utils/deriveSonoraExporter.js');
        await DeriveSonoraExporter.exportDerive(sessionId);
      } catch (exportError) {
        console.warn('Auto-export failed:', exportError);
      }
    } catch (error) {
      console.error('Error ending walk session:', error);
    }
  };

  // --- Session layer visibility toggle ---
  const handleToggleVisibility = (sessionId) => {
    setVisibleSessionIds(prev => {
      const next = new Set(prev);
      if (next.has(sessionId)) {
        next.delete(sessionId);
      } else {
        next.add(sessionId);
        // Center map on first breadcrumb when toggling ON
        const session = walkSessionService.getSession(sessionId);
        if (session?.breadcrumbs?.length > 0 && mapInstance) {
          const first = session.breadcrumbs[0];
          mapInstance.setView([first.lat, first.lng], 16);
        }
      }
      return next;
    });
  };

  // --- Per-session playback ---
  const playSessionAudio = async (sessionId, mode) => {
    const session = walkSessionService.getSession(sessionId);
    if (!session) return;
    const sessionSpots = audioSpots.filter(s => session.recordingIds.includes(s.id));
    if (sessionSpots.length === 0) {
      showAlert('No hay grabaciones con ubicación en esta deriva.');
      return;
    }
    setSessionPlayback({
      sessionId,
      mode,
      title: session.title || 'Deriva sin título',
      alias: session.userAlias
    });
    setPlayerExpanded(true);

    switch (mode) {
      case 'nearby': playNearbySpots(sessionSpots); break;
      case 'chronological': playConcatenated(sessionSpots); break;
      case 'jamm': playJamm(sessionSpots); break;
    }
  };

  return (
    <div style={{ width: '100%', height: '100vh', position: 'relative' }}>
      {/* Android status bar dark overlay — makes battery/time icons visible */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: 'max(env(safe-area-inset-top, 0px), 36px)',
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.35), rgba(0,0,0,0))',
        zIndex: 1000,
        pointerEvents: 'none'
      }} />
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

        {/* StadiaMaps Satellite Layer */}
        <TileLayer
          attribution='&copy; <a href="https://stadiamaps.com/">Stadia Maps</a>'
          url="https://tiles.stadiamaps.com/tiles/alidade_satellite/{z}/{x}/{y}.jpg"
          opacity={currentLayer === 'StadiaSatellite' ? 1 : 0}
          zIndex={currentLayer === 'StadiaSatellite' ? 1 : 0}
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
                      click: () => handleMarkerClick(spot)
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

        {/* Saved session tracklines (per-user colored, filtered by visibility) */}
        {sessionTracklines.filter(track => visibleSessionIds.has(track.sessionId)).map(track => (
          <Polyline
            key={track.sessionId}
            positions={track.positions}
            pathOptions={{
              color: track.color,
              weight: 3,
              opacity: 0.6,
              dashArray: '8, 6'
            }}
          >
            <Tooltip sticky>
              <strong>{track.alias}</strong> — {track.title}
              <br />
              {track.recordingCount} grabacion(es)
            </Tooltip>
          </Polyline>
        ))}
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
        showSearch={true}
        query={query}
        searchMapData={searchMapData}
        updateQuery={updateQuery}
        showZoomControls={true}
        showLayerSelector={true}
        currentLayer={currentLayer}
        onLayerChange={(layerName) => {
          console.log('SoundWalkAndroid: Layer changed to:', layerName);
          setCurrentLayer(layerName);
        }}
        showImportButton={true}
        walkSession={activeWalkSession}
        onStartDerive={handleStartDerive}
        onEndDerive={handleEndDerive}
        onRecordPress={handleStartMicForWalk}
        onShowHistory={() => setShowSessionHistory(true)}
      />

      {/* Record (red) and Play (green) FABs — symmetrical bottom corners */}
      {/* Record FAB — bottom-left */}
      <button
        onClick={() => setIsAudioRecorderVisible(!isAudioRecorderVisible)}
        style={{
          position: 'fixed',
          bottom: '200px',
          left: '16px',
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          backgroundColor: '#EF4444',
          color: 'white',
          border: 'none',
          boxShadow: '0 4px 12px rgba(239,68,68,0.4)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          transition: 'transform 0.2s'
        }}
        title="Grabar audio"
      >
        <Mic size={24} />
      </button>

      {/* Play FAB — bottom-right */}
      {!playerExpanded && (
        <button
          onClick={() => {
            setPlayerExpanded(true);
            if (mapInstance) mapInstance.closePopup();
          }}
          style={{
            position: 'fixed',
            bottom: '200px',
            right: '16px',
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            backgroundColor: '#10B981',
            color: 'white',
            border: 'none',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            transition: 'transform 0.2s'
          }}
          title="Abrir reproductor"
        >
          <Play size={24} />
        </button>
      )}

      {/* Expanded player panel */}
      {playerExpanded && (
      <div style={{
        position: 'fixed',
        bottom: '190px',
        left: '50%',
        transform: 'translateX(-50%)',
        backgroundColor: '#ffffffbf',
        borderRadius: '16px',
        boxShadow: 'rgb(157 58 58 / 30%) 0px 10px 30px',
        padding: '20px',
        minWidth: '300px',
        maxWidth: '400px',
        zIndex: 1000
      }}>
        {/* Close button */}
        <button
          onClick={() => setPlayerExpanded(false)}
          style={{
            position: 'absolute',
            top: '8px',
            right: '8px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: '#6B7280',
            fontSize: '18px',
            padding: '4px',
            lineHeight: 1
          }}
          title="Cerrar reproductor"
        >
          ✕
        </button>
        <div style={{ textAlign: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: '0px 0px 8px', fontSize: '18px', fontWeight: '600' }}>
            {sessionPlayback ? sessionPlayback.title : 'Reproductor'}
          </h3>
          <p style={{ margin: '0px', fontSize: '14px', color: 'rgb(107, 114, 128)' }}>
            {sessionPlayback
              ? `${sessionPlayback.alias} — ${
                  sessionPlayback.mode === 'nearby' ? 'Cercanos' :
                  sessionPlayback.mode === 'chronological' ? 'Cronológico' : 'Concatenado'
                }`
              : nearbySpots.length > 0
                ? `${nearbySpots.length} punto${nearbySpots.length > 1 ? 's' : ''} de audio cercanos`
                : `${audioSpots.length} grabaciones en el mapa`
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
              {currentAudio.filename}
            </div>
            <div style={{ fontSize: '12px', color: 'rgb(107, 114, 128)' }}>
              {new Date(currentAudio.timestamp).toLocaleDateString()} — {playbackMode}
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
              backgroundColor: (nearbySpots.length > 0 || selectedSpot) ? '#3B82F6' : '#6B7280',
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Volume2 size={14} color="#374151" />
          <input type="range" min="0" max="1" step="0.01" value={volume} onChange={e => handleVolumeChange(Number(e.target.value))} />
        </div>
      </div>
      )}

      {/* Export buttons removed — export is now available via Session History panel */}
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

      {/* DetailView for selected marker */}
      <DetailView
        point={selectedPoint}
        getNextRecording={getNextRecording}
        getPreviousRecording={getPreviousRecording}
        searchMapData={searchMapData}
      />

      {/* Audio Recorder */}
      <AudioRecorder
        userLocation={userLocation}
        locationAccuracy={userLocation?.accuracy}
        onSaveRecording={handleWalkRecordingSave}
        onCancel={() => setIsAudioRecorderVisible(false)}
        isVisible={isAudioRecorderVisible}
        walkSessionId={activeWalkSession?.sessionId || null}
      />

      {/* Alias prompt on first use */}
      {showAliasPrompt && (
        <AliasPrompt
          onSubmit={(alias) => {
            userAliasService.setAlias(alias);
            setShowAliasPrompt(false);
          }}
          onCancel={() => setShowAliasPrompt(false)}
        />
      )}

      {/* Session history panel */}
      {showSessionHistory && (
        <SessionHistoryPanel
          onClose={() => setShowSessionHistory(false)}
          onViewSession={(session) => {
            setShowSessionHistory(false);
            // Center map on session start if breadcrumbs exist
            if (session.breadcrumbs?.length > 0 && mapInstance) {
              const first = session.breadcrumbs[0];
              mapInstance.setView([first.lat, first.lng], 16);
            }
          }}
          visibleSessionIds={visibleSessionIds}
          onToggleVisibility={handleToggleVisibility}
          onPlaySession={(sessionId, mode) => {
            setShowSessionHistory(false);
            playSessionAudio(sessionId, mode);
          }}
        />
      )}
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