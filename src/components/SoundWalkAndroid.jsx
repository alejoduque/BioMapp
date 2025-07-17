// BETA VERSION: Overlapping audio spots now support Concatenated and Jamm listening modes.
import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import { Play, Pause, Square, Volume2, VolumeX, ArrowLeft, MapPin, Download } from 'lucide-react';
import localStorageService from '../services/localStorageService';
import RecordingExporter from '../utils/recordingExporter';
import locationService from '../services/locationService.js';

// Create circle icon based on duration
const createDurationCircleIcon = (duration) => {
  const size = Math.max(20, Math.min(60, duration * 10)); // 20-60px based on duration
  return {
    iconUrl: 'data:image/svg+xml;base64,' + btoa(`
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
        <circle cx="${size/2}" cy="${size/2}" r="${size/2 - 2}" fill="rgba(239, 68, 68, 0.8)" stroke="white" stroke-width="2"/>
        <text x="${size/2}" y="${size/2 + 4}" text-anchor="middle" fill="white" font-size="${Math.max(10, size/6)}" font-weight="bold">${Math.round(duration)}s</text>
      </svg>
    `),
    iconSize: [size, size],
    iconAnchor: [size/2, size/2],
    popupAnchor: [0, -size/2]
  };
};

// Map updater component for Android
function MapUpdater({ center, zoom }) {
  const map = useRef();
  
  useEffect(() => {
    if (map.current && center) {
      map.current.setView(center, zoom);
    }
  }, [center, zoom]);
  
  return null;
}

const SoundWalkAndroid = (props) => {
  // Emergency debug - log immediately
  console.log('🎧 SoundWalkAndroid render start - EMERGENCY DEBUG');
  console.log('Props received:', props);
  
  // Emergency fallback if props are completely missing
  if (!props) {
    console.error('❌ CRITICAL: props is null/undefined');
    return (
      <div style={{
        width: '100%', 
        height: '100vh', 
        background: 'red', 
        color: 'white', 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center',
        fontSize: '20px',
        textAlign: 'center'
      }}>
        <div>
          <h1>🚨 CRITICAL ERROR</h1>
          <p>Props are missing completely</p>
          <p>Props: {JSON.stringify(props)}</p>
        </div>
      </div>
    );
  }
  
  // Check for missing props
  const requiredProps = ['onBackToLanding', 'locationPermission', 'userLocation', 'hasRequestedPermission', 'setLocationPermission', 'setUserLocation', 'setHasRequestedPermission'];
  const missingProps = requiredProps.filter(prop => props[prop] === undefined);
  if (missingProps.length > 0) {
    console.error('❌ Missing required props:', missingProps);
  }
  
  // Validate location service
  try {
    if (typeof locationService === 'undefined') {
      console.error('❌ locationService is undefined');
    }
    if (typeof localStorageService === 'undefined') {
      console.error('❌ localStorageService is undefined');
    }
  } catch (error) {
    console.error('❌ Service import error:', error);
  }

  // State management - add error boundaries
  const [audioSpots, setAudioSpots] = useState([]);
  const [nearbySpots, setNearbySpots] = useState([]);
  const [currentAudio, setCurrentAudio] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.4);
  const [isMuted, setMuted] = useState(false);
  const [proximityVolumeEnabled, setProximityVolumeEnabled] = useState(false);
  const [showMap, setShowMap] = useState(true);
  const [activeGroup, setActiveGroup] = useState(null);
  const [playbackMode, setPlaybackMode] = useState('nearby');
  const [selectedSpot, setSelectedSpot] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [renderError, setRenderError] = useState(null);

  console.log('🎧 State initialized');

  // Refs for Android audio management
  const audioRefs = useRef([]);
  const audioContext = useRef(null);
  const isPlayingRef = useRef(false);
  const playbackTimeoutRef = useRef(null);

  // Enhanced load audio spots with better error handling and refresh on visibility
  useEffect(() => {
    console.log('🎧 Loading audio spots...');
    const loadAudioSpots = async () => {
      try {
        if (!localStorageService) {
          throw new Error('localStorageService is not available');
        }
        
        // Initialize localStorage service and cleanup corrupted data
        localStorageService.init();
        
        // Clear corrupted recordings that might cause crashes
        const corruptedCount = localStorageService.clearCorruptedRecordings();
        if (corruptedCount > 0) {
          console.warn(`🎧 Cleared ${corruptedCount} corrupted recordings`);
        }
        
        // Get storage stats to check for corrupted blobs
        const stats = localStorageService.getStorageStats();
        console.log('🎧 Storage stats:', stats);
        
        if (stats.corruptedAudioBlobs > 0) {
          console.warn(`🎧 Found ${stats.corruptedAudioBlobs} corrupted audio blobs, cleaning up...`);
          localStorageService.cleanupCorruptedAudioBlobs();
        }
        
        const recordings = await localStorageService.getAllRecordings();
        console.log('🎧 Raw recordings:', recordings);
        if (!Array.isArray(recordings)) {
          throw new Error('getAllRecordings did not return an array');
        }
        
        // Filter out corrupted recordings that might cause crashes
        const validRecordings = recordings.filter(recording => {
          try {
            // Check if recording has required fields
            if (!recording || typeof recording !== 'object') return false;
            if (!recording.uniqueId) return false;
            if (!recording.location || typeof recording.location !== 'object') return false;
            if (typeof recording.location.lat !== 'number' || isNaN(recording.location.lat)) return false;
            if (typeof recording.location.lng !== 'number' || isNaN(recording.location.lng)) return false;
            if (!recording.filename && !recording.displayName) return false;
            return true;
          } catch (error) {
            console.error('🎧 Corrupted recording found:', recording, error);
            return false;
          }
        });
        
        console.log('🎧 Valid recordings:', validRecordings.length, 'out of', recordings.length);
        
        const spots = validRecordings.map(recording => ({
          id: recording.uniqueId,
          location: recording.location,
          filename: recording.displayName || recording.filename,
          timestamp: recording.timestamp,
          duration: recording.duration,
          notes: recording.notes,
          speciesTags: recording.speciesTags || []
        })).filter(spot => spot.location && spot.location.lat && spot.location.lng);
        console.log('🎧 Processed spots:', spots.length);
        setAudioSpots(spots);
      } catch (error) {
        console.error('❌ Error loading audio spots:', error);
        setRenderError(`Failed to load audio spots: ${error.message}`);
        setAudioSpots([]); // Fallback to empty array
      }
    };
    
    // Load immediately
    loadAudioSpots();
    
    // Also reload when page becomes visible (user returns from Collector)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log('🎧 Page became visible, reloading audio spots...');
        loadAudioSpots();
      }
    };
    
    // Also reload when window gains focus
    const handleFocus = () => {
      console.log('🎧 Window gained focus, reloading audio spots...');
      loadAudioSpots();
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  // Enhanced location initialization with better error handling
  useEffect(() => {
    console.log('🎧 Initializing location...');
    let isMounted = true;
    let cancelled = false;
    const handleLocationGranted = (position) => {
      console.log('🎧 Location granted:', position);
      if (!isMounted || cancelled) return;
      props.setUserLocation(position);
      props.setLocationPermission('granted');
      props.setHasRequestedPermission(true);
      try {
        locationService.startLocationWatch(
          (newPosition) => {
            if (!isMounted || cancelled) return;
            props.setUserLocation(newPosition);
            props.setLocationPermission('granted');
            checkNearbySpots(newPosition);
          },
          (error) => {
            if (!isMounted || cancelled) return;
            console.error('❌ Location watch error:', error);
            props.setLocationPermission('denied');
          }
        );
      } catch (error) {
        console.error('❌ Location watch setup error:', error);
        props.setLocationPermission('denied');
      }
    };
    const handleLocationDenied = (errorMessage) => {
      console.log('🎧 Location denied:', errorMessage);
      if (!isMounted || cancelled) return;
      props.setLocationPermission('denied');
      props.setUserLocation(null);
      props.setHasRequestedPermission(true);
    };
    const checkCachedPermissionState = async () => {
      try {
        console.log('🎧 Checking cached permission state...');
        props.setLocationPermission('unknown');
        if (!locationService) {
          throw new Error('locationService is not available');
        }
        const permissionState = await locationService.checkLocationPermission();
        console.log('🎧 Permission state:', permissionState);
        if (permissionState === 'granted') {
          const position = await locationService.requestLocation();
          handleLocationGranted(position);
        } else if (permissionState === 'denied') {
          handleLocationDenied('Location permission denied');
        } else {
          try {
            const position = await locationService.requestLocation();
            handleLocationGranted(position);
          } catch (error) {
            handleLocationDenied(error.message);
          }
        }
      } catch (error) {
        console.error('❌ Permission check error:', error);
        handleLocationDenied(error.message);
      }
    };
    if (!props.hasRequestedPermission) {
      checkCachedPermissionState();
    }
    return () => {
      console.log('🎧 Location effect cleanup');
      isMounted = false;
      cancelled = true;
      try {
        locationService.stopLocationWatch();
      } catch (error) {
        console.error('❌ Location watch cleanup error:', error);
      }
    };
  }, [props.hasRequestedPermission, props.setLocationPermission, props.setUserLocation, props.setHasRequestedPermission]);

  // Manual location retry function (same as SoundWalk.jsx)
  const handleLocationRetry = async () => {
    props.setLocationPermission('unknown');
    try {
      locationService.stopLocationWatch();
      const position = await locationService.requestLocation();
      props.setUserLocation(position);
      props.setLocationPermission('granted');
      props.setHasRequestedPermission(true);
      locationService.startLocationWatch(
        (newPosition) => {
          props.setUserLocation(newPosition);
          props.setLocationPermission('granted');
          checkNearbySpots(newPosition);
        },
        (error) => {
          props.setLocationPermission('denied');
        }
      );
    } catch (error) {
      props.setLocationPermission('denied');
      props.setUserLocation(null);
      props.setHasRequestedPermission(true);
    }
  };

  // Check for nearby audio spots (5-10m range) - Android optimized
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
  };

  // Calculate distance between two points
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3; // Earth's radius in meters
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

  // Android-specific proximity volume calculation
  function getProximityVolume(distance) {
    if (distance <= 5) return 1.0;
    if (distance >= 10) return 0.1;
    return Math.exp(-(distance - 5) / 2);
  }

  // Android-optimized single audio playback
  const playAudio = async (spot, audioBlob, userPos = null) => {
    if (isPlayingRef.current) {
      await stopAllAudio();
    }
    
    try {
      setIsLoading(true);
    const audio = new Audio(URL.createObjectURL(audioBlob));
      
      // Android-specific audio setup
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
    
      // Android-specific event handlers
      audio.oncanplaythrough = () => {
        console.log('Audio ready to play on Android');
      };
      
    audio.onended = () => {
        console.log('Audio ended on Android');
        isPlayingRef.current = false;
        setIsPlaying(false);
        setCurrentAudio(null);
        setSelectedSpot(null);
      };
      
      audio.onerror = (e) => {
        console.error('Audio error on Android:', e);
        isPlayingRef.current = false;
        setIsPlaying(false);
        setCurrentAudio(null);
        setSelectedSpot(null);
    };
    
      // Android-specific play with retry
    try {
      await audio.play();
        console.log('Audio started successfully on Android');
      } catch (playError) {
        console.error('Play failed on Android:', playError);
        // Retry once for Android
        setTimeout(async () => {
          try {
            await audio.play();
          } catch (retryError) {
            console.error('Retry failed on Android:', retryError);
            isPlayingRef.current = false;
            setIsPlaying(false);
          }
        }, 100);
      }
      
    } catch (error) {
      console.error('Audio setup error on Android:', error);
      isPlayingRef.current = false;
      setIsPlaying(false);
    } finally {
      setIsLoading(false);
    }
  };

  // Android-optimized nearby spots playback
  const playNearbySpots = async (spots) => {
    if (spots.length === 0) return;
    
    try {
      setIsLoading(true);
      await stopAllAudio();
      
      // Sort by timestamp (oldest first)
      const sortedSpots = spots.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      
      for (const spot of sortedSpots) {
        if (!isPlayingRef.current) break; // Check if stopped
        
        try {
          const audioBlob = await localStorageService.getAudioBlob(spot.id);
          if (audioBlob) {
            await playAudio(spot, audioBlob, props.userLocation);
            
            // Wait for audio to finish with timeout
            await new Promise((resolve) => {
              // --- Robust timer cleanup ---
              if (playbackTimeoutRef.current) {
                clearTimeout(playbackTimeoutRef.current);
                playbackTimeoutRef.current = null;
              }
              const timeout = setTimeout(() => {
                console.log('Audio timeout on Android');
                resolve();
              }, 30000); // 30 second timeout
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
          }
        } catch (error) {
          console.error('Error playing spot on Android:', spot.id, error);
        }
      }
    } catch (error) {
      console.error('Nearby playback error on Android:', error);
    } finally {
      setIsLoading(false);
      if (playbackTimeoutRef.current) {
        clearTimeout(playbackTimeoutRef.current);
        playbackTimeoutRef.current = null;
      }
    }
  };

  // Android-optimized playback handlers
  const handlePlayNearby = () => {
    if (nearbySpots.length > 0) {
      setPlaybackMode('nearby');
      playNearbySpots(nearbySpots);
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

  // Export functions
  const handleExportAll = async () => {
    if (audioSpots.length === 0) return;
    try {
      await RecordingExporter.exportAllRecordings();
    } catch (error) {
      console.error('Export error:', error);
    }
  };

  const handleExportMetadata = async () => {
    if (audioSpots.length === 0) return;
    try {
      await RecordingExporter.exportMetadata();
    } catch (error) {
      console.error('Metadata export error:', error);
    }
  };

  const handleExportZip = async () => {
    if (audioSpots.length === 0) return;
    try {
      await RecordingExporter.exportAsZip(audioSpots);
    } catch (error) {
      console.error('ZIP export error:', error);
    }
  };

  // --- Robust stopAllAudio: also clear playback timeout ---
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
      } catch (error) {
        console.error('Error stopping audio on Android:', error);
      } 
    });
    audioRefs.current = [];
  }

  // Android-optimized single audio playback for popup
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
      console.error('Single audio error on Android:', error);
      isPlayingRef.current = false;
      setIsPlaying(false);
  }
  };

  // Android-optimized concatenated playback
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
    } catch (error) {
      console.error('Concatenated playback error on Android:', error);
    } finally {
      setIsLoading(false);
    }
  }

  // Android-optimized jamm playback
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
          audio.volume = (isMuted ? 0 : volume) / group.length; // Distribute volume
          audio.loop = true;
          audioRefs.current.push(audio);
          audioElements.push(audio);
        }
      }
      
      if (audioElements.length > 0) {
        isPlayingRef.current = true;
        setIsPlaying(true);
      
        // Start all audio elements
        for (const audio of audioElements) {
          try {
            await audio.play();
          } catch (error) {
            console.error('Jamm audio play error on Android:', error);
          }
        }
      }
    } catch (error) {
      console.error('Jamm playback error on Android:', error);
    } finally {
      setIsLoading(false);
    }
  }

  // Find overlapping spots
  function findOverlappingSpots(spot) {
    return audioSpots.filter(otherSpot => {
      if (otherSpot.id === spot.id) return false;
      const distance = calculateDistance(
        spot.location.lat, spot.location.lng,
        otherSpot.location.lat, otherSpot.location.lng
      );
      return distance <= 5; // 5 meters overlap
    });
  }

  // Android-optimized popup content
  function renderPopupContent(clickedSpot) {
    const overlappingSpots = findOverlappingSpots(clickedSpot);
    const allSpots = [clickedSpot, ...overlappingSpots];
    return (
      <div style={{ padding: '12px', minWidth: '250px' }}>
        <div style={{ marginBottom: '12px' }}>
          <h4 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: '600' }}>
            🔊 {clickedSpot.filename}
          </h4>
          <p style={{ margin: '0', fontSize: '12px', color: '#6B7280' }}>
            {new Date(clickedSpot.timestamp).toLocaleString()}
          </p>
          <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#6B7280' }}>
            Duration: {clickedSpot.duration}s
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
          <button
            onClick={() => playConcatenated(allSpots)}
            disabled={isLoading}
            style={{
              padding: '6px 12px',
              backgroundColor: '#10B981',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '12px',
              cursor: 'pointer',
              opacity: isLoading ? 0.6 : 1
            }}
          >
            {isLoading ? 'Loading...' : 'Concatenated'}
          </button>
          <button
            onClick={() => playJamm(allSpots)}
            disabled={isLoading}
            style={{
              padding: '6px 12px',
              backgroundColor: '#8B5CF6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '12px',
              cursor: 'pointer',
              opacity: isLoading ? 0.6 : 1
            }}
          >
            {isLoading ? 'Loading...' : 'Jamm'}
          </button>
          <button
            onClick={() => playNearbySpots(nearbySpots)}
            disabled={isLoading || !nearbySpots || nearbySpots.length === 0}
            style={{
              padding: '6px 12px',
              backgroundColor: '#3B82F6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '12px',
              cursor: isLoading || !nearbySpots || nearbySpots.length === 0 ? 'not-allowed' : 'pointer',
              opacity: isLoading ? 0.6 : 1
            }}
          >
            {isLoading ? 'Loading...' : 'In Range'}
          </button>
        </div>
        <button
          onClick={async () => {
            const blob = await localStorageService.getAudioBlob(clickedSpot.id);
            if (blob) {
              setSelectedSpot(clickedSpot);
              setPlaybackMode('single');
              await playSingleAudio(blob);
            }
          }}
          disabled={isLoading}
          style={{
            width: '100%',
            padding: '8px 12px',
            backgroundColor: '#3B82F6',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '14px',
            cursor: 'pointer',
            opacity: isLoading ? 0.6 : 1
          }}
        >
          {isLoading ? 'Loading...' : 'Play Single'}
        </button>
      </div>
    );
  }

  // --- Robust cleanup on unmount: stop audio, clear timers, stop location watcher ---
  useEffect(() => {
    return () => {
      stopAllAudio();
      if (playbackTimeoutRef.current) {
        clearTimeout(playbackTimeoutRef.current);
        playbackTimeoutRef.current = null;
      }
      locationService.stopLocationWatch();
    };
  }, []);

  // Enhanced map center calculation with validation
  const mapCenter = (() => {
    console.log('🎧 Calculating map center...');
    console.log('🎧 props.userLocation:', props.userLocation);
    if (props.userLocation && 
        typeof props.userLocation.lat === 'number' && 
        typeof props.userLocation.lng === 'number' &&
        !isNaN(props.userLocation.lat) && 
        !isNaN(props.userLocation.lng)) {
      console.log('🎧 Using user location for map center');
      return [props.userLocation.lat, props.userLocation.lng];
    }
    console.log('🎧 Using default map center');
    return [0, 0];
  })();

  // Add error boundary for render
  if (renderError) {
    return (
      <div style={{
        width: '100%',
        height: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        background: 'white',
        color: 'red',
        textAlign: 'center',
        padding: '20px'
      }}>
        <div>
          <h2>SoundWalk Error</h2>
          <p>{renderError}</p>
          <button onClick={() => window.location.reload()}>Reload</button>
        </div>
      </div>
    );
  }

  console.log('🎧 About to render main component');
  console.log('🎧 audioSpots.length:', audioSpots.length);
  console.log('🎧 showMap:', showMap);
  console.log('🎧 mapCenter:', mapCenter);

  // Emergency try-catch for rendering
  try {
    // EMERGENCY MODE: If we have any issues, show a minimal interface
    const emergencyMode = !props || !props.userLocation || audioSpots === null || audioSpots === undefined;
    
    if (emergencyMode) {
      return (
        <div style={{ width: '100%', height: '100vh', position: 'relative', background: '#f8fafc' }}>
          {/* Emergency debug info */}
          <div style={{
            position: 'fixed',
            top: '0px',
            left: '0px',
            right: '0px',
            zIndex: 99999,
            background: 'rgba(255,0,0,0.95)',
            color: 'white',
            padding: '8px 12px',
            fontSize: '12px',
            fontWeight: 'bold',
            textAlign: 'center',
            borderBottom: '2px solid white'
          }}>
            <div>🚨 EMERGENCY MODE - Props: {props ? 'OK' : 'NULL'} | Location: {props?.userLocation ? 'OK' : 'NULL'} | AudioSpots: {audioSpots ? 'OK' : 'NULL'}</div>
          </div>
          
          {/* Emergency interface */}
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center',
            padding: '20px',
            background: 'white',
            borderRadius: '12px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            maxWidth: '300px'
          }}>
            <div style={{ fontSize: '24px', marginBottom: '12px' }}>🚨</div>
            <h3 style={{ margin: '0 0 8px', color: '#374151' }}>Emergency Mode</h3>
            <p style={{ margin: '0 0 16px', color: '#6B7280', fontSize: '14px' }}>
              SoundWalk is in emergency mode due to missing data.
            </p>
            <button
              onClick={props?.onBackToLanding || (() => window.location.reload())}
              style={{
                backgroundColor: '#3B82F6',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                padding: '8px 16px',
                fontSize: '14px',
                cursor: 'pointer',
                marginRight: '8px'
              }}
            >
              Back to Menu
            </button>
            <button
              onClick={() => window.location.reload()}
              style={{
                backgroundColor: '#EF4444',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                padding: '8px 16px',
                fontSize: '14px',
                cursor: 'pointer',
                marginRight: '8px'
              }}
            >
              Reload App
            </button>
            <button
              onClick={() => {
                if (localStorageService) {
                  localStorageService.nuclearClear();
                  alert('All data cleared. The app will reload.');
                  window.location.reload();
                }
              }}
              style={{
                backgroundColor: '#DC2626',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                padding: '8px 16px',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              Clear All Data
            </button>
          </div>
        </div>
      );
    }
    
    // Fallback UI for no audio spots
    if (audioSpots.length === 0) {
    return (
      <div style={{ width: '100%', height: '100vh', position: 'relative', background: '#f8fafc' }}>
        {/* Debug overlay */}
        <div style={{
          position: 'fixed',
          top: '240px',
          left: 0,
          zIndex: 10000,
          background: 'rgba(0,0,0,0.8)',
          color: 'white',
          padding: '10px',
          fontSize: '12px',
          maxWidth: '300px',
          maxHeight: '200px',
          overflow: 'auto'
        }}>
          <div>🎧 SoundWalk Debug - NO SPOTS</div>
          <div>Audio Spots: {audioSpots.length}</div>
          <div>Location: {props.userLocation ? 'Available' : 'None'}</div>
          <div>Permission: {props.locationPermission}</div>
          <div>Show Map: {showMap ? 'Yes' : 'No'}</div>
          <div>Map Center: {mapCenter.join(', ')}</div>
        </div>
        
        {/* No spots message */}
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center',
          padding: '20px',
          background: 'white',
          borderRadius: '12px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          maxWidth: '300px'
        }}>
          <div style={{ fontSize: '24px', marginBottom: '12px' }}>🎧</div>
          <h3 style={{ margin: '0 0 8px', color: '#374151' }}>No Audio Spots Found</h3>
          <p style={{ margin: '0 0 16px', color: '#6B7280', fontSize: '14px' }}>
            Record some sounds in Collector mode to see them here.
          </p>
          <button
            onClick={props.onBackToLanding}
            style={{
              backgroundColor: '#3B82F6',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              padding: '8px 16px',
              fontSize: '14px',
              cursor: 'pointer'
            }}
          >
            Back to Menu
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '100vh', position: 'relative' }}>
      {/* Emergency debug info - always visible */}
      <div style={{
        position: 'fixed',
        top: '0px',
        left: '0px',
        right: '0px',
        zIndex: 99999,
        background: 'rgba(255,0,0,0.95)',
        color: 'white',
        padding: '8px 12px',
        fontSize: '12px',
        fontWeight: 'bold',
        textAlign: 'center',
        borderBottom: '2px solid white'
      }}>
        <div>🚨 SOUNDWALK ANDROID DEBUG - Props: {props ? 'OK' : 'NULL'} | AudioSpots: {audioSpots ? audioSpots.length : 'NULL'} | Location: {props?.userLocation ? 'OK' : 'NULL'} | Time: {new Date().toLocaleTimeString()}</div>
      </div>
      {/* Add debug overlay */}
      <div style={{
        position: 'fixed',
        top: '240px',
        left: 0,
        zIndex: 10000,
        background: 'rgba(0,0,0,0.8)',
        color: 'white',
        padding: '10px',
        fontSize: '12px',
        maxWidth: '300px',
        maxHeight: '200px',
        overflow: 'auto'
      }}>
        <div>🎧 SoundWalk Debug</div>
        <div>Audio Spots: {audioSpots.length}</div>
        <div>Location: {props.userLocation ? 'Available' : 'None'}</div>
        <div>Permission: {props.locationPermission}</div>
        <div>Show Map: {showMap ? 'Yes' : 'No'}</div>
        <div>Map Center: {mapCenter.join(', ')}</div>
      </div>
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
        <MapContainer 
          center={mapCenter}
          zoom={16}
          style={{ height: '100%', width: '100%' }}
          zoomControl={false}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          <MapUpdater center={mapCenter} zoom={16} />
          {/* User location marker */}
          {props.userLocation && (
            <Circle
              center={[props.userLocation.lat, props.userLocation.lng]}
              radius={10}
              pathOptions={{ color: '#3B82F6', fillColor: '#3B82F6', fillOpacity: 0.3 }}
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
                eventHandlers={{
                  click: () => {
                  console.log('Marker clicked on Android:', spot.filename, 'Duration:', spot.duration);
                    setActiveGroup(spot);
                  }
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
          })}
        </MapContainer>
      )}

      {/* Unified Android Modal */}
      <div style={{
        position: 'fixed',
        bottom: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(0, 0, 0, 0.7)', // Updated to match old simple player
        color: 'white', // Ensure text is white for contrast
        borderRadius: '16px',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)', // Stronger shadow for depth
        padding: '20px',
        minWidth: '300px',
        maxWidth: '400px',
        zIndex: 1000
      }}>
        <div style={{ textAlign: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: '0px 0px 8px', fontSize: '18px', fontWeight: '600', color: 'white' }}>
            🎧 SoundWalk Android
          </h3>
          <p style={{ margin: '0px', fontSize: '14px', color: 'rgba(255,255,255,0.8)' }}>
            {nearbySpots.length > 0 
              ? `${nearbySpots.length} audio spot${nearbySpots.length > 1 ? 's' : ''} nearby`
              : 'No audio spots nearby'
            }
          </p>
        </div>
        {/* Mode Selection */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: 'white' }}>
            Playback Mode:
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              onClick={() => setPlaybackMode('nearby')}
              style={{
                padding: '6px 12px',
                backgroundColor: playbackMode === 'nearby' ? '#10B981' : 'rgba(255,255,255,0.15)',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '12px',
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              Nearby
            </button>
            <button
              onClick={() => setPlaybackMode('concatenated')}
              style={{
                padding: '6px 12px',
                backgroundColor: playbackMode === 'concatenated' ? '#10B981' : 'rgba(255,255,255,0.15)',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '12px',
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              Concatenated
            </button>
            <button
              onClick={() => setPlaybackMode('jamm')}
              style={{
                padding: '6px 12px',
                backgroundColor: playbackMode === 'jamm' ? '#10B981' : 'rgba(255,255,255,0.15)',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '12px',
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              Jamm
            </button>
          </div>
        </div>
        {/* Current Audio Info */}
        {currentAudio && (
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '4px', color: 'white' }}>
              🔊 {currentAudio.filename}
            </div>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.8)' }}>
              {new Date(currentAudio.timestamp).toLocaleDateString()}
            </div>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.8)' }}>
              Mode: {playbackMode}
            </div>
          </div>
        )}
        {/* Unified Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <button
            onClick={() => {
              if (playbackMode === 'nearby') {
                handlePlayNearby();
              } else if (playbackMode === 'concatenated' && selectedSpot) {
                const overlapping = findOverlappingSpots(selectedSpot);
                playConcatenated([selectedSpot, ...overlapping]);
              } else if (playbackMode === 'jamm' && selectedSpot) {
                const overlapping = findOverlappingSpots(selectedSpot);
                playJamm([selectedSpot, ...overlapping]);
              }
            }}
            disabled={nearbySpots.length === 0 && !selectedSpot}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: (nearbySpots.length > 0 || selectedSpot) ? '#10B981' : 'rgba(255,255,255,0.15)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              padding: '8px 16px',
              fontSize: '14px',
              cursor: (nearbySpots.length > 0 || selectedSpot) ? 'pointer' : 'not-allowed',
              fontWeight: 600,
              transition: 'background-color 0.2s'
            }}
          >
            {isLoading ? <div style={{ width: '16px', height: '16px', border: '2px solid white', borderTop: '2px solid transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} /> : (isPlaying ? <Pause size={16} /> : <Play size={16} />)}
            {isLoading ? 'Loading...' : (isPlaying ? 'Playing...' : 'Play')}
          </button>
          <button
            onClick={handleStopAudio}
            style={{
              backgroundColor: '#EF4444',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              padding: '8px 12px',
              cursor: 'pointer',
              fontWeight: 600,
              transition: 'background-color 0.2s'
            }}
            title="Stop all audio"
          >
            <Square size={16} />
          </button>
          <button
            onClick={toggleMute}
            style={{
              backgroundColor: isMuted ? '#EF4444' : 'rgba(255,255,255,0.15)',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              padding: '8px',
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
        </div>
        {/* Proximity Volume Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: 'white' }}>
          <input
            type="checkbox"
            id="proximity-volume-toggle"
            checked={proximityVolumeEnabled}
            onChange={e => setProximityVolumeEnabled(e.target.checked)}
          />
          <label htmlFor="proximity-volume-toggle" style={{ fontSize: '14px', color: 'white', cursor: 'pointer' }}>
            Proximity volume (fade with distance)
          </label>
        </div>
        {/* Volume Slider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Volume2 size={14} color="#fff" />
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
          onClick={props.onBackToLanding}
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
          backgroundColor: props.locationPermission === 'granted' ? '#10B981' : props.locationPermission === 'denied' ? '#EF4444' : '#F59E0B',
          borderRadius: '8px',
          padding: '8px 16px',
          fontSize: '14px',
          color: 'white',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          cursor: props.locationPermission === 'denied' ? 'pointer' : 'default'
        }}
        onClick={props.locationPermission === 'denied' ? handleLocationRetry : undefined}
        title={props.locationPermission === 'denied' ? 'Click to retry location' : ''}
        >
          <MapPin size={16} />
          {props.locationPermission === 'granted' ? 'GPS Active' : 
           props.locationPermission === 'denied' ? 'GPS Denied' : 'GPS Loading...'}
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
          Export
        </button>
      </div>

      {/* Loading Overlay */}
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
            <p style={{ margin: 0, fontSize: '14px', color: '#374151' }}>Loading audio...</p>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
  } catch (error) {
    console.error('❌ CRITICAL RENDERING ERROR:', error);
    return (
      <div style={{
        width: '100%', 
        height: '100vh', 
        background: 'red', 
        color: 'white', 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center',
        fontSize: '20px',
        textAlign: 'center',
        padding: '20px'
      }}>
        <div>
          <h1>🚨 CRITICAL RENDERING ERROR</h1>
          <p>SoundWalkAndroid crashed during rendering</p>
          <p>Error: {error.message}</p>
          <p>Stack: {error.stack}</p>
          <button 
            onClick={() => window.location.reload()} 
            style={{
              background: 'white',
              color: 'red',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '8px',
              fontSize: '16px',
              cursor: 'pointer',
              marginTop: '20px'
            }}
          >
            Reload App
          </button>
        </div>
      </div>
    );
  }
};

export default SoundWalkAndroid; 