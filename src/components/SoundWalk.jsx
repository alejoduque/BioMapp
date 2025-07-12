// BETA VERSION: Overlapping audio spots now support Concatenated and Jamm listening modes.
import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Circle, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
import { Play, Pause, Volume2, VolumeX, ArrowLeft, MapPin, Clock, Download, Square } from 'lucide-react';
import config from '../config.json';
import localStorageService from '../services/localStorageService.js';
import locationService from '../services/locationService.js';
import RecordingExporter from '../utils/recordingExporter.js';

// Sound icon for audio spots - larger and more clickable
const soundSpotIcon = L.icon({
  iconUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8Y2lyY2xlIGN4PSIxNiIgY3k9IjE2IiByPSIxNCIgZmlsbD0iIzEwQjk4MSIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLXdpZHRoPSIyIi8+CiAgPHBhdGggZD0iTTEyIDEwdjEyYzAgMS4xIC45IDIgMiAyaDRjMS4xIDAgMi0uOSAyLTIgVjEwYzAtMS4xLS45LTItMi0yaC00Yy0xLjEgMC0yIC45LTIgMnoiIGZpbGw9IndoaXRlIi8+CiAgPHBhdGggZD0iTTggMTR2NGMwIDEuMSAuOSAyIDIgMmgydi04SDEwYy0xLjEgMC0yIC45LTIgMnoiIGZpbGw9IndoaXRlIi8+CiAgPHBhdGggZD0iTTIyIDE0djRjMCAxLjEtLjkgMi0yIDJoLTJ2LThoMmMxLjEgMCAyIC45IDIgMnoiIGZpbGw9IndoaXRlIi8+CiAgPGNpcmNsZSBjeD0iMTYiIGN5PSIxNiIgcj0iMyIgZmlsbD0iIzEwQjk4MSIvPgo8L3N2Zz4K',
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  popupAnchor: [0, -16]
});

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
  
  useEffect(() => {
    if (center && center.lat && center.lng) {
      map.setView([center.lat, center.lng], zoom);
    }
  }, [center, zoom, map]);
  
  return null;
}

const LISTEN_MODES = {
  CONCAT: 'Concatenated',
  JAMM: 'Jamm',
};

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
  const [listenMode, setListenMode] = useState(LISTEN_MODES.CONCAT);
  const [activeGroup, setActiveGroup] = useState(null); // For overlapping spots
  const audioRefs = useRef([]); // For managing multiple audio elements
  const audioContextRef = useRef(null); // For Jamm mode
  const [proximityVolumeEnabled, setProximityVolumeEnabled] = useState(false); // NEW
  
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
        console.log('SoundWalk: Requesting location permission...');
        const position = await locationService.requestLocation();
        console.log('SoundWalk: Location obtained:', position);
        setUserLocation(position);
        setLocationPermission('granted');
        
        // Start watching location updates
        locationWatchRef.current = locationService.startLocationWatch(
          (newPosition) => {
            console.log('SoundWalk: Location update:', newPosition);
            setUserLocation(newPosition);
            checkNearbySpots(newPosition);
          },
          (error) => {
            console.error('SoundWalk: Location watch error:', error);
            setLocationPermission('denied');
          }
        );
      } catch (error) {
        console.error('SoundWalk: Location error:', error);
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

  // Manual location retry function
  const handleLocationRetry = async () => {
    console.log('SoundWalk: Manual location retry requested');
    setLocationPermission('unknown');
    
    try {
      // Stop any existing watch
      if (locationWatchRef.current) {
        locationService.stopLocationWatch();
      }
      
      const position = await locationService.requestLocation();
      console.log('SoundWalk: Manual retry successful:', position);
      setUserLocation(position);
      setLocationPermission('granted');
      
      // Restart location watching
      locationWatchRef.current = locationService.startLocationWatch(
        (newPosition) => {
          setUserLocation(newPosition);
          checkNearbySpots(newPosition);
        },
        (error) => {
          console.error('SoundWalk: Location watch error after retry:', error);
          setLocationPermission('denied');
        }
      );
    } catch (error) {
      console.error('SoundWalk: Manual retry failed:', error);
      setLocationPermission('denied');
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
    
    // REMOVED: Auto-play nearby spots - this was causing the looping issue
    // Users should manually trigger playback with the "Play Nearby" button
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

  // --- Helper: Exponential proximity volume (radius 10m, fade to 0) ---
  function getProximityVolume(distance) {
    // Exponential fade: volume = globalVolume * exp(-distance / 4), clamp to [0, globalVolume]
    const v = volume * Math.exp(-distance / 4);
    return Math.max(0, Math.min(volume, v));
  }

  // --- Play single audio with proximity volume ---
  const playAudio = async (spot, audioBlob, userPos = null) => {
    const audio = new Audio(URL.createObjectURL(audioBlob));
    let dist = 0;
    if (proximityVolumeEnabled && userPos && spot.location) {
      dist = calculateDistance(userPos.lat, userPos.lng, spot.location.lat, spot.location.lng);
      audio.volume = getProximityVolume(dist);
    } else {
      audio.volume = isMuted ? 0 : volume;
    }
    
    // Add to audio refs
    audioRefs.current.push(audio);
    setCurrentAudio(spot);
    
    // Set up event handlers
    audio.onended = () => {
      console.log('Audio ended:', spot.filename);
    };
    audio.onerror = (error) => {
      console.error('Audio error:', spot.filename, error);
    };
    
    try {
      await audio.play();
      console.log('Audio started playing:', spot.filename);
    } catch (error) {
      console.error('Error playing audio:', spot.filename, error);
      // Remove from refs if play failed
      const index = audioRefs.current.indexOf(audio);
      if (index > -1) {
        audioRefs.current.splice(index, 1);
      }
      throw error;
    }
  };

  // --- Play all nearby spots with proximity volume ---
  const playNearbySpots = async (spots) => {
    if (spots.length === 0) return;
    stopAllAudio();
    setIsPlaying(true);
    
    try {
    // Sort by timestamp (oldest first)
      const sortedSpots = spots.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      
    for (const spot of sortedSpots) {
      try {
        const audioBlob = await localStorageService.getAudioBlob(spot.id);
        if (audioBlob) {
            await playAudio(spot, audioBlob, userLocation); // Pass userLocation for proximity volume
            
          // Wait for audio to finish before playing next
            await new Promise((resolve, reject) => {
              const audio = audioRefs.current[audioRefs.current.length - 1];
              if (audio) {
                audio.onended = resolve;
                audio.onerror = reject;
                // Add timeout to prevent infinite waiting
                setTimeout(resolve, 30000); // 30 second timeout
            } else {
              resolve();
            }
          });
        }
      } catch (error) {
        console.error('Error playing spot:', spot.id, error);
      }
    }
    } catch (error) {
      console.error('Error in playNearbySpots:', error);
    } finally {
    setIsPlaying(false);
    }
  };

  // --- Update volume on user movement if proximityVolumeEnabled ---
  useEffect(() => {
    if (!proximityVolumeEnabled || !isPlaying || !nearbySpots.length || !userLocation) return;
    // Update volume for all currently playing audio
    audioRefs.current.forEach((audio, idx) => {
      const spot = nearbySpots[idx];
      if (audio && spot && spot.location) {
        const dist = calculateDistance(userLocation.lat, userLocation.lng, spot.location.lat, spot.location.lng);
        audio.volume = getProximityVolume(dist);
      }
    });
  }, [userLocation, proximityVolumeEnabled, isPlaying, nearbySpots, volume]);

  // Manual play button
  const handlePlayNearby = () => {
    if (nearbySpots.length > 0) {
      playNearbySpots(nearbySpots);
    }
  };

  // Stop all audio
  const handleStopAudio = () => {
    stopAllAudio();
  };

  // Toggle mute
  const toggleMute = () => {
    setIsMuted(!isMuted);
    // Apply to all audio elements
    audioRefs.current.forEach(audio => {
      if (audio && audio.volume !== undefined) {
        // HTML Audio element
        audio.volume = !isMuted ? volume : 0;
      } else if (audio && audio.type === 'webAudio' && audio.gainNode) {
        // Web Audio API gain node
        audio.gainNode.gain.value = !isMuted ? volume : 0;
      }
    });
  };

  // Volume change
  const handleVolumeChange = (newVolume) => {
    setVolume(newVolume);
    // Apply to all audio elements if not muted
    if (!isMuted) {
      audioRefs.current.forEach(audio => {
        if (audio && audio.volume !== undefined) {
          // HTML Audio element
          audio.volume = newVolume;
        } else if (audio && audio.type === 'webAudio' && audio.gainNode) {
          // Web Audio API gain node
          audio.gainNode.gain.value = newVolume;
        }
      });
    }
  };

  // Export functions
  const handleExportAll = async () => {
    try {
      await RecordingExporter.exportAllRecordings();
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed: ' + error.message);
    }
  };

  const handleExportMetadata = () => {
    try {
      RecordingExporter.exportMetadata();
    } catch (error) {
      console.error('Metadata export failed:', error);
      alert('Metadata export failed: ' + error.message);
    }
  };

  const handleExportZip = async () => {
    try {
      await RecordingExporter.exportAsZip();
    } catch (error) {
      console.error('Zip export failed:', error);
      alert('Zip export failed: ' + error.message);
    }
  };

  // --- Audio cleanup ---
  function stopAllAudio() {
    // Stop all audio elements
    audioRefs.current.forEach(audio => { 
      if (audio) { 
        if (audio.volume !== undefined) {
          // HTML Audio element
          audio.pause?.(); 
          audio.currentTime = 0; 
          audio.stop?.(); 
        } else if (audio.type === 'webAudio' && audio.source) {
          // Web Audio API source
          audio.source.stop?.();
        }
      } 
    });
    audioRefs.current = [];
    // Stop Web Audio API context if exists
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setCurrentAudio(null);
    setIsPlaying(false);
  }

  // --- Centralized play routine ---
  const playSingleAudio = async (audioBlob) => {
    stopAllAudio();
    const audio = new Audio(URL.createObjectURL(audioBlob));
    // Apply current volume and mute settings
    audio.volume = isMuted ? 0 : volume;
    audioRefs.current.push(audio);
    audio.play();
    setIsPlaying(true);
    audio.onended = () => setIsPlaying(false);
  }

  // --- Concatenated mode ---
  async function playConcatenated(group) {
    stopAllAudio();
    setIsPlaying(true);
    // Sort by timestamp (oldest first)
    const sorted = [...group].sort((a, b) => a.timestamp - b.timestamp);
    for (let i = 0; i < sorted.length; i++) {
      const spot = sorted[i];
      const audioBlob = await localStorageService.getAudioBlob(spot.id);
      if (!audioBlob) continue;
      await playSingleAudio(audioBlob);
      // Wait for audio to finish
      await new Promise((resolve) => {
        audioRefs.current[0].onended = resolve;
      });
    }
    setIsPlaying(false);
  }

  // --- Jamm mode ---
  async function playJamm(group) {
    stopAllAudio();
    setIsPlaying(true);
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    audioContextRef.current = ctx;
    const sorted = [...group].sort((a, b) => a.timestamp - b.timestamp);
    const panStep = 2 / (sorted.length + 1);
    await Promise.all(sorted.map(async (spot, i) => {
      const audioBlob = await localStorageService.getAudioBlob(spot.id);
      if (!audioBlob) return;
      const arrayBuffer = await audioBlob.arrayBuffer();
      const buffer = await ctx.decodeAudioData(arrayBuffer);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      
      // Create gain node for volume control
      const gainNode = ctx.createGain();
      gainNode.gain.value = isMuted ? 0 : volume;
      
      const pan = ctx.createStereoPanner();
      pan.pan.value = -1 + panStep * (i + 1); // Spread left to right
      
      // Connect: source -> gain -> pan -> destination
      source.connect(gainNode);
      gainNode.connect(pan);
      pan.connect(ctx.destination);
      
      source.start();
      
      // Store both source and gain node for volume control
      const audioObject = { source, gainNode, type: 'webAudio' };
      audioRefs.current.push(audioObject);
    }));
    // Wait for all sources to finish (optional: add onended listeners)
    setIsPlaying(false);
  }

  // --- Helper function to find overlapping spots ---
  function findOverlappingSpots(spot) {
    if (!spot.location) return [spot];
    
    // Find all spots within a small radius (5 meters) of this spot
    const overlapping = audioSpots.filter(otherSpot => {
      if (otherSpot.id === spot.id) return true; // Include the clicked spot
      
      if (!otherSpot.location) return false;
      
      const distance = calculateDistance(
        spot.location.lat, spot.location.lng,
        otherSpot.location.lat, otherSpot.location.lng
      );
      return distance <= 5; // 5 meters radius for overlapping detection
    });
    
    return overlapping;
  }

  // --- UI for overlapping spots ---
  function renderPopupContent(clickedSpot) {
    // Find all overlapping spots at this location
    const overlappingSpots = findOverlappingSpots(clickedSpot);
    
    if (!overlappingSpots || overlappingSpots.length === 0) {
      return <div>No recordings available</div>;
    }

    return (
      <div style={{ 
        minWidth: '280px', 
        maxWidth: '350px',
        padding: '8px'
      }}>
        <h3 style={{ 
          margin: '0 0 12px 0', 
          fontSize: '18px', 
          fontWeight: '600', 
          color: '#1F2937',
          textAlign: 'center'
        }}>
          {overlappingSpots.length > 1 ? `🎧 ${overlappingSpots.length} overlapping recordings` : `🔊 ${overlappingSpots[0].filename}`}
        </h3>
        
        {overlappingSpots.length > 1 && (
          <div style={{ 
            marginBottom: 16,
            padding: '12px',
            backgroundColor: '#F3F4F6',
            borderRadius: '8px',
            border: '1px solid #E5E7EB'
          }}>
            <label style={{ 
              fontWeight: 600, 
              marginBottom: 8, 
              fontSize: '14px',
              display: 'block',
              color: '#374151'
            }}>
              🎵 Listening mode:
            </label>
            <select 
              value={listenMode} 
              onChange={e => setListenMode(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '6px',
                border: '2px solid #D1D5DB',
                fontSize: '16px',
                backgroundColor: 'white',
                cursor: 'pointer'
              }}
            >
              <option value={LISTEN_MODES.CONCAT}>🎵 Concatenated (one after another)</option>
              <option value={LISTEN_MODES.JAMM}>🎼 Jamm (all together)</option>
            </select>
          </div>
        )}
        
        <div style={{ 
          display: 'flex', 
          gap: '12px', 
          marginBottom: '12px',
          flexDirection: 'column'
        }}>
        <button
          disabled={isPlaying}
          onClick={async () => {
              try {
            setIsPlaying(true);
                if (overlappingSpots.length > 1) {
                  if (listenMode === LISTEN_MODES.CONCAT) await playConcatenated(overlappingSpots);
                  else await playJamm(overlappingSpots);
            } else {
              // Single audio
                  const audioBlob = await localStorageService.getAudioBlob(overlappingSpots[0].id);
              if (audioBlob) await playSingleAudio(audioBlob);
            }
              } catch (error) {
                console.error('Error playing audio:', error);
                alert('Error playing audio: ' + error.message);
              } finally {
            setIsPlaying(false);
              }
          }}
          style={{
              width: '100%',
              padding: '12px 16px',
            background: isPlaying ? '#9CA3AF' : '#3B82F6',
            color: 'white',
            border: 'none',
              borderRadius: 8,
            cursor: isPlaying ? 'not-allowed' : 'pointer',
              fontWeight: 600,
              fontSize: '16px',
              transition: 'all 0.2s ease',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}
        >
            {isPlaying ? '⏸️ Playing...' : '▶️ Play Audio'}
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
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}
            title="Stop playback"
          >
            <Square size={16} />
            Stop All Audio
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
                      console.log('Marker clicked:', spot.filename, 'Duration:', spot.duration);
                      // Force popup to open by setting active group
                      setActiveGroup(spot);
                    }
                  }}
                >
              <Popup
                    onOpen={() => {
                      console.log('Popup opened for:', spot.filename);
                      setActiveGroup(spot);
                    }}
                    onClose={() => {
                      console.log('Popup closed for:', spot.filename);
                      setActiveGroup(null);
                    }}
                    autoPan={true}
                    closeButton={true}
                    className="audio-spot-popup"
                  >
                    {renderPopupContent(spot)}
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
        backgroundColor: '#ffffffbf',
        borderRadius: '16px',
        boxShadow: 'rgb(157 58 58 / 30%) 0px 10px 30px',
        padding: '20px',
        minWidth: '300px',
        maxWidth: '400px',
        zIndex: 1000
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
        {/* Proximity Volume Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <input
            type="checkbox"
            id="proximity-volume-toggle"
            checked={proximityVolumeEnabled}
            onChange={e => setProximityVolumeEnabled(e.target.checked)}
          />
          <label htmlFor="proximity-volume-toggle" style={{ fontSize: '14px', color: 'rgb(55, 65, 81)', cursor: 'pointer' }}>
            Proximity volume (fade with distance)
          </label>
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
          backgroundColor: locationPermission === 'granted' ? '#10B981' : locationPermission === 'denied' ? '#EF4444' : '#F59E0B',
          borderRadius: '8px',
          padding: '8px 16px',
          fontSize: '14px',
          color: 'white',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          cursor: locationPermission === 'denied' ? 'pointer' : 'default'
        }}
        onClick={locationPermission === 'denied' ? handleLocationRetry : undefined}
        title={locationPermission === 'denied' ? 'Click to retry location' : ''}
        >
          <MapPin size={16} />
          {locationPermission === 'granted' ? 'GPS Active' : 
           locationPermission === 'denied' ? 'GPS Denied' : 'GPS Loading...'}
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
          Export All ({audioSpots.length})
        </button>

        <button
          onClick={handleExportZip}
          disabled={audioSpots.length === 0}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: audioSpots.length > 0 ? '#8B5CF6' : '#9CA3AF',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            padding: '8px 16px',
            fontSize: '14px',
            cursor: audioSpots.length > 0 ? 'pointer' : 'not-allowed',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
          }}
        >
          📦 Export ZIP
        </button>

        <button
          onClick={handleExportMetadata}
          disabled={audioSpots.length === 0}
          style={{
            backgroundColor: audioSpots.length > 0 ? '#3B82F6' : '#9CA3AF',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            padding: '8px 16px',
            fontSize: '14px',
            cursor: audioSpots.length > 0 ? 'pointer' : 'not-allowed',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
          }}
        >
          Export Metadata
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
          maxWidth: '350px'
        }}>
          <h3 style={{ margin: '0 0 12px 0', color: '#92400E' }}>
            Location Permission Required
          </h3>
          <p style={{ margin: '0 0 16px 0', color: '#92400E', fontSize: '14px' }}>
            SoundWalk mode requires GPS access to detect nearby audio spots and provide an immersive experience.
          </p>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
          <button
              onClick={handleLocationRetry}
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
              Retry Location
            </button>
            <button
              onClick={() => window.location.reload()}
              style={{
                backgroundColor: '#6B7280',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                padding: '8px 16px',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              Reload Page
          </button>
          </div>
          <p style={{ margin: '12px 0 0 0', color: '#92400E', fontSize: '12px' }}>
            If the issue persists, check your browser's location permissions in the address bar.
          </p>
        </div>
      )}
    </div>
  );
};

export default SoundWalk; 