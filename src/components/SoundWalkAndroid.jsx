// BETA VERSION: Overlapping audio spots now support Concatenated and Jamm listening modes.
import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import { Play, Pause, Square, Volume2, VolumeX, ArrowLeft, MapPin, Download } from 'lucide-react';
import localStorageService from '../services/localStorageService';
import RecordingExporter from '../utils/recordingExporter';
import locationService from '../services/locationService.js';
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
      return <div style={{color: 'red', fontSize: 24, padding: 20}}>SoundWalk crashed: {String(this.state.error)}</div>;
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
  const [mapRef, setMapRef] = useState(null);
  const [modalPosition, setModalPosition] = useState(null); // { x, y }

  useEffect(() => {
    // If userLocation and permission is granted, set GPS state to 'granted' on mount/return
    if (userLocation && (propLocationPermission === 'granted' || gpsState === 'granted')) {
      setGpsState('granted');
      // Auto-center if GPS position changes by more than 5 meters
      if (mapRef) {
        const prev = lastCenteredRef.current;
        const curr = userLocation;
        if (!prev) {
          mapRef.setView([curr.lat, curr.lng], 16);
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
          if (distance > 5) {
            mapRef.setView([curr.lat, curr.lng], 16);
            lastCenteredRef.current = { lat: curr.lat, lng: curr.lng };
          }
        }
      }
    } else {
      setGpsState('idle');
    }
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
    const props = clickedSpot;
    return (
      <div style={{ minWidth: '220px', maxWidth: '320px', padding: '10px' }}>
        <h3 style={{ margin: '0 0 8px 0', color: '#333', fontWeight: 'bold', fontSize: '16px' }}>{props.filename || 'Recording'}</h3>
        {props.notes && <p style={{ margin: '4px 0', color: '#666' }}><strong>Notes:</strong> {props.notes}</p>}
        {props.speciesTags && props.speciesTags.length > 0 && <p style={{ margin: '4px 0', color: '#666' }}><strong>Species:</strong> {props.speciesTags.join(', ')}</p>}
        {props.weather && <p style={{ margin: '4px 0', color: '#666' }}><strong>Weather:</strong> {props.weather}</p>}
        {props.temperature && <p style={{ margin: '4px 0', color: '#666' }}><strong>Temperature:</strong> {props.temperature}°C</p>}
        {props.duration && <p style={{ margin: '4px 0', color: '#666' }}><strong>Duration:</strong> {props.duration}s</p>}
        {props.timestamp && <p style={{ margin: '4px 0', color: '#666' }}><strong>Recorded:</strong> {new Date(props.timestamp).toLocaleString()}</p>}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', margin: '10px 0' }}>
          <button
            onClick={() => playConcatenated(allSpots)}
            disabled={isLoading}
            style={{
              padding: '6px 12px',
              background: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '12px',
              cursor: 'pointer',
              opacity: isLoading ? 0.6 : 1
            }}
          >{isLoading ? 'Loading...' : 'Concatenated'}</button>
          <button
            onClick={() => playJamm(allSpots)}
            disabled={isLoading}
            style={{
              padding: '6px 12px',
              background: '#8B5CF6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '12px',
              cursor: 'pointer',
              opacity: isLoading ? 0.6 : 1
            }}
          >{isLoading ? 'Loading...' : 'Jamm'}</button>
          <button
            onClick={() => playNearbySpots(nearbySpots)}
            disabled={isLoading || !nearbySpots || nearbySpots.length === 0}
            style={{
              padding: '6px 12px',
              background: '#3B82F6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '12px',
              cursor: isLoading || !nearbySpots || nearbySpots.length === 0 ? 'not-allowed' : 'pointer',
              opacity: isLoading ? 0.6 : 1
            }}
          >{isLoading ? 'Loading...' : 'In Range'}</button>
        </div>
        <button
          onClick={async () => {
            await stopAllAudio();
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
            background: '#3B82F6',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '14px',
            cursor: 'pointer',
            opacity: isLoading ? 0.6 : 1
          }}
        >{isLoading ? 'Loading...' : 'Play Single'}</button>
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
    if (onBackToLanding) onBackToLanding();
  };

  return (
    <div style={{ width: '100%', height: '100vh', position: 'relative' }}>
      {/* Map */}
      <MapContainer 
        center={userLocation ? [userLocation.lat, userLocation.lng] : [6.2529, -75.5646]}
        zoom={16}
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
        whenCreated={setMapRef}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        <MapUpdater center={userLocation ? [userLocation.lat, userLocation.lng] : [6.2529, -75.5646]} zoom={16} />
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
                      click: (e) => {
                        setActiveGroup(spot);
                        if (e && e.originalEvent) {
                          setModalPosition({ x: e.originalEvent.clientX, y: e.originalEvent.clientY });
                        } else {
                          setModalPosition(null);
                        }
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
            // console.error('Error rendering markers:', err);
            return (
              <div style={{ color: 'red', fontWeight: 'bold' }}>
                Marker rendering error: {String(err)}
              </div>
            );
          }
        })()}
      </MapContainer>
      {/* Manual recenter button */}
      <button
        onClick={() => {
          if (mapRef && userLocation) {
            mapRef.setView([userLocation.lat, userLocation.lng], 16);
          }
        }}
        style={{
          position: 'absolute',
          bottom: 100,
          right: 20,
          zIndex: 1200,
          background: 'white',
          border: '1px solid #ccc',
          borderRadius: '50%',
          width: 40,
          height: 40,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
          cursor: 'pointer',
        }}
        title="Recenter map to your location"
      >
        <img src={markerIconUrl} alt="Recenter" style={{ width: 24, height: 36, display: 'block' }} />
      </button>
      {/* Unified Android Modal */}
      <div style={{
        position: 'fixed',
        left: modalPosition ? Math.max(0, Math.min(window.innerWidth - 350, modalPosition.x - 150)) : '50%',
        top: modalPosition ? Math.max(0, Math.min(window.innerHeight - 300, modalPosition.y - 100)) : '50%',
        transform: modalPosition ? 'none' : 'translate(-50%, -50%)',
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
            onClick={async () => {
              await stopAllAudio();
              if (playbackMode === 'nearby') {
                handlePlayNearby();
              } else if ((playbackMode === 'concatenated' || playbackMode === 'jamm')) {
                let group = [];
                if (selectedSpot) {
                  const overlapping = findOverlappingSpots(selectedSpot);
                  group = [selectedSpot, ...overlapping];
                } else {
                  group = audioSpots;
                }
                if (playbackMode === 'concatenated') {
                  playConcatenated(group);
                } else if (playbackMode === 'jamm') {
                  playJamm(group);
                }
              }
            }}
            disabled={
              (playbackMode === 'nearby' && nearbySpots.length === 0) ||
              ((playbackMode === 'concatenated' || playbackMode === 'jamm') && audioSpots.length === 0)
            }
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: isPlaying ? '#EF4444' : '#F59E42',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              padding: '8px 16px',
              fontSize: '14px',
              cursor: ((playbackMode === 'nearby' && nearbySpots.length > 0) || ((playbackMode === 'concatenated' || playbackMode === 'jamm') && audioSpots.length > 0)) ? 'pointer' : 'not-allowed',
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
          onClick={handleBackToMenu}
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
        <div
          style={{
            backgroundColor:
              gpsState === 'idle' ? 'white' :
              gpsState === 'loading' ? '#F59E0B' :
              gpsState === 'granted' ? '#10B981' :
              gpsState === 'denied' ? '#EF4444' : 'white',
            borderRadius: '8px',
            padding: '8px 16px',
            fontSize: '14px',
            color: gpsState === 'idle' ? '#374151' : 'white',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: gpsState !== 'granted' ? 'pointer' : 'default',
            border: gpsState === 'idle' ? '1px solid #E5E7EB' : 'none'
          }}
          onClick={gpsState !== 'granted' ? handleLocationRetry : undefined}
          title={gpsState !== 'granted' ? 'Click to request GPS' : ''}
        >
          <MapPin size={16} />
          {gpsState === 'idle' ? 'Request GPS' :
           gpsState === 'loading' ? 'GPS Loading...' :
           gpsState === 'granted' ? 'GPS Active' :
           gpsState === 'denied' ? 'GPS Denied' : ''}
        </div>
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