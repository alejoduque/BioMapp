// BETA VERSION: Overlapping audio spots now support Concatenated and Jamm listening modes.
import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import { Play, Pause, Square, Volume2, VolumeX, ArrowLeft, MapPin, Download } from 'lucide-react';
import localStorageService from '../services/localStorageService';
import RecordingExporter from '../utils/recordingExporter';
import locationService from '../services/locationService.js';
import L from 'leaflet';

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
      return <div style={{color: 'red', fontSize: 24, padding: 20}}>SoundWalk crashed: {String(this.state.error)}</div>;
    }
    return this.props.children;
  }
}

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

const SoundWalkAndroid = ({ onBackToLanding, locationPermission, userLocation, hasRequestedPermission, setLocationPermission, setUserLocation, setHasRequestedPermission }) => {
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
  const audioRefs = useRef([]);
  const audioContext = useRef(null);
  const isPlayingRef = useRef(false);
  const playbackTimeoutRef = useRef(null);

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
          speciesTags: recording.speciesTags || []
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
        setLocationPermission('unknown');
        const permissionState = await locationService.checkLocationPermission();
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

  const handleExportAll = async () => {
    if (audioSpots.length === 0) return;
    try {
      await RecordingExporter.exportAllRecordings();
    } catch (error) {}
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

  function renderPopupContent(clickedSpot) {
    const overlappingSpots = findOverlappingSpots(clickedSpot);
    const allSpots = [clickedSpot, ...overlappingSpots];
    return (
      <div style={{ padding: '12px', minWidth: '250px' }}>
        <div style={{ marginBottom: '12px' }}>
          <h4 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: '600' }}>
            🎚️ {clickedSpot.filename}
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

  useEffect(() => {
    return () => {
      stopAllAudio();
    };
  }, []);

  return (
    <div style={{ width: '100%', height: '100vh', position: 'relative' }}>
      <div style={{background: 'yellow', color: 'black', fontSize: 20, zIndex: 9999, position: 'fixed', top: 0, left: 0, width: '100%', textAlign: 'center', padding: '8px 0'}}>
        SoundWalkAndroid mounted
      </div>
      {/* Map */}
      {showMap && (
        <MapContainer 
          center={userLocation || [0, 0]}
          zoom={16}
          style={{ height: '100%', width: '100%' }}
          zoomControl={false}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          <MapUpdater center={userLocation} zoom={16} />
          {userLocation && (
            <Circle
              center={[userLocation.lat, userLocation.lng]}
              radius={10}
              pathOptions={{ color: '#3B82F6', fillColor: '#3B82F6', fillOpacity: 0.3 }}
            />
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
                  // Use default Leaflet icon
                  return (
                    <Marker
                      key={spot.id}
                      position={[spot.location.lat, spot.location.lng]}
                      // No custom icon prop, use default
                      eventHandlers={{
                        click: () => {
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
                });
            } catch (err) {
              console.error('Error rendering markers:', err);
              return (
                <div style={{ color: 'red', fontWeight: 'bold' }}>
                  Marker rendering error: {String(err)}
                </div>
              );
            }
          })()}
        </MapContainer>
      )}
      {/* Unified Android Modal */}
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
            🎧 SoundWalk Android
          </h3>
          <p style={{ margin: '0px', fontSize: '14px', color: 'rgb(107, 114, 128)' }}>
            {nearbySpots.length > 0 
              ? `${nearbySpots.length} audio spot${nearbySpots.length > 1 ? 's' : ''} nearby`
              : 'No audio spots nearby'
            }
          </p>
        </div>
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>
            Playback Mode:
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              onClick={() => setPlaybackMode('nearby')}
              style={{
                padding: '6px 12px',
                backgroundColor: playbackMode === 'nearby' ? '#10B981' : '#E5E7EB',
                color: playbackMode === 'nearby' ? 'white' : '#374151',
                border: 'none',
                borderRadius: '6px',
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              Nearby
            </button>
            <button
              onClick={() => setPlaybackMode('concatenated')}
              style={{
                padding: '6px 12px',
                backgroundColor: playbackMode === 'concatenated' ? '#10B981' : '#E5E7EB',
                color: playbackMode === 'concatenated' ? 'white' : '#374151',
                border: 'none',
                borderRadius: '6px',
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              Concatenated
            </button>
            <button
              onClick={() => setPlaybackMode('jamm')}
              style={{
                padding: '6px 12px',
                backgroundColor: playbackMode === 'jamm' ? '#10B981' : '#E5E7EB',
                color: playbackMode === 'jamm' ? 'white' : '#374151',
                border: 'none',
                borderRadius: '6px',
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              Jamm
            </button>
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
              Mode: {playbackMode}
            </div>
          </div>
        )}
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
              backgroundColor: (nearbySpots.length > 0 || selectedSpot) ? '#10B981' : '#9CA3AF',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              padding: '8px 16px',
              fontSize: '14px',
              cursor: (nearbySpots.length > 0 || selectedSpot) ? 'pointer' : 'not-allowed',
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
              backgroundColor: isMuted ? '#EF4444' : '#6B7280',
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <input
            type="checkbox"
            id="proximity-volume-toggle"
            checked={proximityVolumeEnabled}
            onChange={e => setProximityVolumeEnabled(e.target.checked)}
          />
          <label htmlFor="proximity-volume-toggle" style={{ fontSize: '14px', color: '#374151', cursor: 'pointer' }}>
            Proximity volume (fade with distance)
          </label>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Volume2 size={14} color="#374151" />
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
          Export
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
            <p style={{ margin: 0, fontSize: '14px', color: '#374151' }}>Loading audio...</p>
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