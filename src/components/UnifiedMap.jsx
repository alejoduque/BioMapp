// BETA VERSION: Overlapping audio spots now support Concatenated and Jamm listening modes.
/**
 * @fileoverview This file is part of the BioMapp project, developed for Reserva MANAKAI.
 *
 * Copyright (c) 2026 Alejandro Duque Jaramillo. All rights reserved.
 *
 * This code is licensed under the Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0) License.
 * For the full license text, please visit: https://creativecommons.org/licenses/by-nc-sa/4.0/legalcode
 *
 * You are free to:
 * - Share — copy and redistribute the material in any medium or format.
 * - Adapt — remix, transform, and build upon the material.
 *
 * Under the following terms:
 * - Attribution — You must give appropriate credit, provide a link to the license, and indicate if changes were made. You may do so in any reasonable manner, but not in any way that suggests the licensor endorses you or your use.
 * - NonCommercial — You may not use the material for commercial purposes. This includes, but is not limited to, any use of the code (including for training artificial intelligence models) that is primarily intended for or directed towards commercial advantage or monetary compensation.
 * - ShareAlike — If you remix, transform, or build upon the material, you must distribute your contributions under the same license as the original.
 *
 * This license applies to all forms of use, including by automated systems or artificial intelligence models,
 * to prevent unauthorized commercial exploitation and ensure proper attribution.
 */
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap, useMapEvents, Polyline, Tooltip } from 'react-leaflet';
import { Play, Pause, Square, Volume2, VolumeX, ArrowLeft, MapPin, Mic, Trash2 } from 'lucide-react';

// Services
import locationService from '../services/locationService.js';
import walkSessionService from '../services/walkSessionService.js';
import breadcrumbService from '../services/breadcrumbService.js';
import localStorageService from '../services/localStorageService.js';
import userAliasService from '../services/userAliasService.js';

// Components
import BreadcrumbVisualization from './BreadcrumbVisualization.jsx';
import SharedTopBar from './SharedTopBar.jsx';
import DetailView from './DetailView.jsx';
import AudioRecorder from '../services/AudioRecorder.tsx';
import AliasPrompt from './AliasPrompt.jsx';
import SessionHistoryPanel from './SessionHistoryPanel.jsx';
import ErrorBoundary from './ErrorBoundary.jsx';
import TracklistItem from './TracklistItem.jsx';

// Hooks
import useDraggable from '../hooks/useDraggable.js';

// Utils
import { createDurationCircleIcon, createPlayingNearbyIcon, createUserLocationIcon } from './SharedMarkerUtils.js';

// Custom alert function for Android without localhost text
const showAlert = (message) => {
  if (window.Capacitor?.isNativePlatform()) {
    // For native platforms, create a simple modal overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: rgb(20 50 20 / 65%); z-index: 10000;
      display: flex; align-items: center; justify-content: center;
    `;

    const modal = document.createElement('div');
    modal.style.cssText = `
      background: rgba(220,225,235,0.92); border-radius: 8px; padding: 20px;
      max-width: 300px; margin: 20px; text-align: center;
      box-shadow: 0 10px 30px rgba(0,0,0,0.3);
    `;

    modal.innerHTML = `
      <p style="margin: 0 0 15px 0; font-size: 14px; color: rgb(1 9 2 / 84%);">${message}</p>
      <button style="
        background: #4e4e86; color: white; border: none; border-radius: 6px;
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

// Detects user-initiated zoom and tracks current zoom level
const MapZoomHandler = ({ onUserZoom, onZoomChange }) => {
  const map = useMapEvents({
    zoomstart() {
      if (!map._flyDest) onUserZoom();
    },
    zoomend() {
      onZoomChange(map.getZoom());
    }
  });
  return null;
};

// Simplify breadcrumb array by decimating points while preserving track shape
// Uses Ramer-Douglas-Peucker-like approach: keep points with significant direction change
const simplifyBreadcrumbs = (breadcrumbs, tolerance = 0.0001) => {
  if (breadcrumbs.length <= 2) return breadcrumbs;

  const simplified = [breadcrumbs[0]]; // Always keep first point

  for (let i = 1; i < breadcrumbs.length - 1; i++) {
    const prev = breadcrumbs[i - 1];
    const curr = breadcrumbs[i];
    const next = breadcrumbs[i + 1];

    // Calculate distance from current point to line between prev and next
    const dx = next.lat - prev.lat;
    const dy = next.lng - prev.lng;
    const norm = Math.sqrt(dx * dx + dy * dy);

    if (norm === 0) continue; // Skip if prev and next are same point

    const perpDist = Math.abs((dy * curr.lat - dx * curr.lng + next.lng * prev.lat - next.lat * prev.lng) / norm);

    // Keep point if it deviates significantly OR has high audio level (important feature)
    if (perpDist > tolerance || (curr.audioLevel && curr.audioLevel > 0.7)) {
      simplified.push(curr);
    }
  }

  simplified.push(breadcrumbs[breadcrumbs.length - 1]); // Always keep last point

  return simplified;
};

const SoundWalkAndroid = ({ onBackToLanding, locationPermission: propLocationPermission, userLocation, hasRequestedPermission, setLocationPermission, setUserLocation, setHasRequestedPermission, allSessions, allRecordings, onDataRefresh }) => {
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
  const [relojWindow, setRelojWindow] = useState(30); // ±15, ±30, or ±60 minutes
  const [selectedSpot, setSelectedSpot] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const audioRefs = useRef([]);
  const audioContext = useRef(null);
  const isPlayingRef = useRef(false);
  const playbackTimeoutRef = useRef(null);
  const lastCenteredRef = useRef(null);
  const lastWalkPositionRef = useRef(null); // tracks last position for 5m auto-derive
  const lastMovementTimeRef = useRef(Date.now()); // tracks last >5m movement for 10-min auto-stop
  const cumulativeDistanceRef = useRef(0); // running total distance for auto-zoom
  const userHasZoomedRef = useRef(false); // true when user manually zooms — disables auto-zoom
  const lastAutoZoomRef = useRef(19); // last zoom level set by auto-zoom
  const activeWalkSessionRef = useRef(null); // always-current ref for use in callbacks
  const onNewPositionRef = useRef(null); // always-current ref so location-watch closures stay fresh
  const activeTracksRef = useRef([]); // array of { audio, spot, id } for progress tracking
  const progressAnimFrameRef = useRef(null); // rAF handle for progress polling
  const spatialAudioIntervalRef = useRef(null); // interval for updating spatial audio parameters
  const zoomThrottleRef = useRef(null); // timeout for debouncing zoom updates
  const [mapInstance, setMapInstance] = useState(null);
  const [currentZoom, setCurrentZoom] = useState(19);
  // Add state for auto-centering
  const [hasAutoCentered, setHasAutoCentered] = useState(false);

  // Breadcrumb state
  const [showBreadcrumbs, setShowBreadcrumbs] = useState(true); // Enable by default
  const [breadcrumbVisualization, setBreadcrumbVisualization] = useState('animated');
  const [currentBreadcrumbs, setCurrentBreadcrumbs] = useState([]);
  const [isBreadcrumbTracking, setIsBreadcrumbTracking] = useState(false);

  // Add layer switching state
  const [currentLayer, setCurrentLayer] = useState('EsriWorldImagery');

  // Debug state
  const [showDebugInfo, setShowDebugInfo] = useState(false);

  // Draggable reproductor
  const { position: playerDragPos, handlePointerDown: onPlayerDragStart } = useDraggable();

  // Walk session & recording state
  const [showAliasPrompt, setShowAliasPrompt] = useState(false);
  const [isAudioRecorderVisible, setIsAudioRecorderVisible] = useState(false);
  const [activeWalkSession, setActiveWalkSession] = useState(() => {
    // If a stale active session exists from a previous app run, auto-save it
    const stale = walkSessionService.autoSaveStaleSession();
    if (stale) return null; // was saved, start fresh
    return walkSessionService.getActiveSession();
  });
  // Keep refs in sync so stale location-watch closures always call latest handlers
  useEffect(() => { activeWalkSessionRef.current = activeWalkSession; }, [activeWalkSession]);

  const [showSessionHistory, setShowSessionHistory] = useState(false);
  const [sessionTracklines, setSessionTracklines] = useState([]);
  const [visibleSessionIds, setVisibleSessionIds] = useState(new Set());
  const [sessionPlayback, setSessionPlayback] = useState(null); // { sessionId, mode, title, alias }
  const [playerExpanded, setPlayerExpanded] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedPoint, setSelectedPoint] = useState(null);
  const [trackProgress, setTrackProgress] = useState({});
  const [playingNearbySpotIds, setPlayingNearbySpotIds] = useState(new Set()); // Track which spots are playing in nearby mode

  // Auto-zoom: zoom = clamp(19 - log2(distance / 25), 14, 19)
  const computeAutoZoom = (distanceMeters) => {
    if (distanceMeters <= 25) return 19;
    const z = 19 - Math.log2(distanceMeters / 25);
    return Math.max(14, Math.min(19, z));
  };

  // Apply auto-zoom if user hasn't manually overridden
  const applyAutoZoom = (position, distanceMeters) => {
    if (!mapInstance || userHasZoomedRef.current) return;
    const targetZoom = computeAutoZoom(distanceMeters);
    // Only zoom out, never zoom back in automatically (avoid jarring snaps)
    if (targetZoom >= lastAutoZoomRef.current) return;
    // Smooth transition — only adjust if zoom changed by at least 0.3 levels
    if (lastAutoZoomRef.current - targetZoom < 0.3) return;
    lastAutoZoomRef.current = targetZoom;
    mapInstance.flyTo([position.lat, position.lng], Math.round(targetZoom), { duration: 0.8 });
  };

  // Compute mode-specific playable recording count
  // Markers are shown for all spots regardless of session visibility, so count all spots.
  // Only migratoria restricts to visible-session spots (walk-order makes no sense cross-session).
  const modePlayableCount = useMemo(() => {
    // Use same session filter as the play button so count matches what actually plays
    const visible = audioSpots.filter(s => !s.walkSessionId || visibleSessionIds.has(s.walkSessionId));
    const visibleInSession = visible;
    const nowHour = new Date().getHours();
    const nowMin = new Date().getMinutes();
    const nowTotalMin = nowHour * 60 + nowMin;

    switch (playbackMode) {
      case 'nearby':
        return nearbySpots.length;
      case 'reloj': {
        const windowMin = relojWindow;
        return visible.filter(s => {
          if (!s.timestamp) return false;
          const d = new Date(s.timestamp);
          const recMin = d.getHours() * 60 + d.getMinutes();
          const diff = Math.abs(recMin - nowTotalMin);
          return Math.min(diff, 1440 - diff) <= windowMin;
        }).length;
      }
      case 'alba': {
        return visible.filter(s => {
          if (!s.timestamp) return false;
          const recHour = new Date(s.timestamp).getHours();
          const recLat = s.lat || s.latitude;
          const sun = recLat ? estimateSunHours(recLat) : { dawnStart: 5, dawnEnd: 8 };
          return recHour >= sun.dawnStart && recHour < sun.dawnEnd;
        }).length;
      }
      case 'crepusculo': {
        return visible.filter(s => {
          if (!s.timestamp) return false;
          const recHour = new Date(s.timestamp).getHours();
          const recLat = s.lat || s.latitude;
          const sun = recLat ? estimateSunHours(recLat) : { duskStart: 17, duskEnd: 20 };
          return recHour >= sun.duskStart && recHour < sun.duskEnd;
        }).length;
      }
      case 'estratos':
      case 'chronological':
      case 'jamm':
      case 'espectro':
        return visible.length;
      case 'migratoria':
        return visibleInSession.filter(s => s.walkSessionId).length;
      default:
        return visible.length;
    }
  }, [playbackMode, audioSpots, visibleSessionIds, nearbySpots, relojWindow]);

  // 1. Move recentering logic to a useEffect that depends on userLocation, and use 10 meters
  useEffect(() => {
    if (userLocation && (propLocationPermission === 'granted' || gpsState === 'granted')) {
      setGpsState('granted');
      if (mapInstance) {
        const prev = lastCenteredRef.current;
        const curr = userLocation;
        if (!prev) {
          mapInstance.setView([curr.lat, curr.lng], 19);
          lastCenteredRef.current = { lat: curr.lat, lng: curr.lng };
        } else if (!userHasZoomedRef.current) {
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
          if (distance > 10) { // 10 meters threshold — recenter, keep current zoom
            mapInstance.setView([curr.lat, curr.lng], mapInstance.getZoom());
            lastCenteredRef.current = { lat: curr.lat, lng: curr.lng };
          }
        }
      }
    } else {
      setGpsState('idle');
    }
  }, [userLocation, propLocationPermission, gpsState, mapInstance]);

  useEffect(() => {
    const spots = allRecordings.map(recording => ({
      id: recording.uniqueId,
      location: recording.location,
      filename: recording.displayName || recording.filename,
      timestamp: recording.timestamp,
      duration: recording.duration,
      notes: recording.notes,
      speciesTags: recording.speciesTags || [],
      audioBlob: recording.audioBlob,
      walkSessionId: recording.walkSessionId || null, // Track which deriva this belongs to
    })).filter(spot =>
      spot &&
      spot.location &&
      typeof spot.location.lat === 'number' && isFinite(spot.location.lat) &&
      typeof spot.location.lng === 'number' && isFinite(spot.location.lng) &&
      typeof spot.duration === 'number' && isFinite(spot.duration) && spot.duration > 0
    );
    setAudioSpots(spots);
  }, [allRecordings]);

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
          onNewPositionRef.current?.(newPosition);
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
          onNewPositionRef.current?.(newPosition);
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

  // Called on every GPS position update — handles auto-derive start, breadcrumb feeding, and inactivity auto-stop
  const onNewPosition = (position) => {
    checkNearbySpots(position);
    // Feed position to breadcrumb service (passive consumer — no GPS watch of its own)
    breadcrumbService.feedPosition(position);

    // Ignore positions with poor accuracy (>30m) — GPS drift guard
    const accuracy = position.accuracy || 999;
    if (accuracy > 30) return;

    // Auto-start deriva if user has moved >5m and no session is active
    const prev = lastWalkPositionRef.current;
    if (prev) {
      const R = 6371e3;
      const φ1 = prev.lat * Math.PI / 180, φ2 = position.lat * Math.PI / 180;
      const Δφ = (position.lat - prev.lat) * Math.PI / 180;
      const Δλ = (position.lng - prev.lng) * Math.PI / 180;
      const a = Math.sin(Δφ/2)**2 + Math.cos(φ1)*Math.cos(φ2)*Math.sin(Δλ/2)**2;
      const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

      // Only count movement that exceeds the GPS accuracy radius — prevents drift triggers
      if (dist >= Math.max(5, accuracy * 1.5)) {
        // User is genuinely moving — update anchor position and accumulate distance
        lastMovementTimeRef.current = Date.now();
        cumulativeDistanceRef.current += dist;
        lastWalkPositionRef.current = position; // advance anchor only on real movement
        // Auto-zoom out as user covers more ground
        applyAutoZoom(position, cumulativeDistanceRef.current);
        if (!activeWalkSessionRef.current) {
          // Start deriva silently — user is walking
          const session = walkSessionService.startSession();
          breadcrumbService.startTracking(session.sessionId, position);
          setIsBreadcrumbTracking(true);
          // Reset auto-zoom for the new derive
          cumulativeDistanceRef.current = 0;
          userHasZoomedRef.current = false;
          lastAutoZoomRef.current = 19;
          setActiveWalkSession(session);
        }
      }
      // Auto-stop after 10 min of inactivity
      if (activeWalkSessionRef.current && lastMovementTimeRef.current &&
          Date.now() - lastMovementTimeRef.current > 600000) {
        console.log('Auto-stopping derive: 10 min inactivity');
        const sid = activeWalkSessionRef.current.sessionId;
        walkSessionService.endSession(sid);
        setActiveWalkSession(null);
        lastMovementTimeRef.current = Date.now();
      }
    } else {
      lastWalkPositionRef.current = position; // first fix — set anchor
    }
  };
  // Keep ref current so location-watch closures (created once) always call the latest version
  onNewPositionRef.current = onNewPosition;

  const checkNearbySpots = (position) => {
    if (!position || !audioSpots.length) return;
    const nearby = audioSpots.filter(spot => {
      // Cercanos mode shows ALL sounds within 50m regardless of derive visibility
      const distance = calculateDistance(
        position.lat, position.lng,
        spot.location.lat, spot.location.lng
      );
      return distance <= 50; // 50m range for nearby mode
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
    // Cercanos mode: 50m range with noticeable volume dropoff
    if (distance <= 5) return 1.0;            // Full volume within 5m
    if (distance >= 50) return 0.1;           // Very quiet at 50m edge
    // Steeper exponential decay for 50m range: volume drops to ~0.37 at 25m, ~0.14 at 50m
    return Math.exp(-(distance - 5) / 15);
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
      registerActiveTrack(audio, spot);
      setCurrentAudio(spot);
      setSelectedSpot(spot);
      isPlayingRef.current = true;
      setIsPlaying(true);
      setPlayerExpanded(true);
      startProgressPolling();
      audio.oncanplaythrough = () => { };
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

      // Limit concurrent audio streams to 6 closest sounds for performance
      const MAX_CONCURRENT_SOUNDS = 6;
      const closestSpots = spatialSpots
        .sort((a, b) => a.distance - b.distance)
        .slice(0, MAX_CONCURRENT_SOUNDS);

      console.log(`🗺️ Playing ${closestSpots.length} closest sounds (out of ${spatialSpots.length} nearby)`);
      console.log('🗺️ Spatial positions:', closestSpots.map(s =>
        `${s.filename}: ${s.distance.toFixed(1)}m, ${s.bearing.toFixed(0)}°`
      ));

      // Start closest sounds simultaneously with spatial audio
      const audioPromises = closestSpots.map(async (spot) => {
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

            // Track audio reference with spot metadata for dynamic updates
            audio._spotLocation = spot.location; // Store spot location for dynamic spatial updates
            audio._spotId = spot.id;
            audioRefs.current.push(audio);
            registerActiveTrack(audio, spot);

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
      startProgressPolling();

      // Track which spots are playing for visual feedback
      setPlayingNearbySpotIds(new Set(closestSpots.map(s => s.id)));

      // Start spatial audio update loop (updates volume/panning as user moves)
      startSpatialAudioUpdates();

      // Update current audio info (show the closest one)
      const closestSpot = closestSpots[0]; // Already sorted by distance
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

    // Calculate nearby spots directly — ALL spots within 50m regardless of derive visibility
    console.log('📍 User location available, calculating nearby spots directly');
    const directNearbyCheck = audioSpots.filter(spot => {
      if (!spot || !spot.location) return false;
      const distance = calculateDistance(
        userLocation.lat, userLocation.lng,
        spot.location.lat, spot.location.lng
      );
      console.log(`📏 Distance to ${spot.filename}: ${distance.toFixed(1)}m`);
      return distance <= 50; // Cercanos range: 50m
    });

    console.log(`🔍 Found ${directNearbyCheck.length} nearby spots directly`);

    if (directNearbyCheck.length > 0) {
      // Species density: count unique tagged species
      const speciesSet = new Set();
      directNearbyCheck.forEach(s => (s.speciesTags || []).forEach(t => speciesSet.add(t.toLowerCase())));
      if (speciesSet.size > 0) {
        console.log(`🧬 Biodiversity: ${speciesSet.size} species in 50m — ${[...speciesSet].join(', ')}`);
      }
      console.log('✅ Playing nearby spots:', directNearbyCheck.map(s => s.filename));
      setPlaybackMode('nearby');
      playNearbySpots(directNearbyCheck);
    } else {
      console.log('❌ No nearby spots found');
      showAlert('No hay puntos de audio dentro de 50 metros. Acércate a las grabaciones.');
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

  function registerActiveTrack(audio, spot) {
    const trackId = `${spot.id}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
    activeTracksRef.current.push({ audio, spot, id: trackId });
    return trackId;
  }

  function startProgressPolling() {
    if (progressAnimFrameRef.current) return;
    let lastUpdate = 0;
    const poll = (timestamp) => {
      if (timestamp - lastUpdate >= 200) { // throttle to ~5Hz
        lastUpdate = timestamp;
        const progress = {};
        activeTracksRef.current = activeTracksRef.current.filter(t => t.audio && t.audio.src);
        activeTracksRef.current.forEach(({ audio, spot, id }) => {
          progress[id] = {
            currentTime: audio.currentTime || 0,
            duration: audio.duration || 0,
            filename: spot.filename,
            spotId: spot.id,
            isPlaying: !audio.paused && !audio.ended,
          };
        });
        setTrackProgress(progress);
      }
      if (isPlayingRef.current) {
        progressAnimFrameRef.current = requestAnimationFrame(poll);
      } else {
        progressAnimFrameRef.current = null;
        setTrackProgress({});
      }
    };
    progressAnimFrameRef.current = requestAnimationFrame(poll);
  }

  function stopProgressPolling() {
    if (progressAnimFrameRef.current) {
      cancelAnimationFrame(progressAnimFrameRef.current);
      progressAnimFrameRef.current = null;
    }
    setTrackProgress({});
  }

  // Dynamic spatial audio updates — recalculates volume/panning as user moves
  function startSpatialAudioUpdates() {
    if (spatialAudioIntervalRef.current) return; // Already running

    spatialAudioIntervalRef.current = setInterval(() => {
      if (!userLocation || !isPlayingRef.current) {
        stopSpatialAudioUpdates();
        return;
      }

      // Update volume and panning for each playing audio based on current user position
      audioRefs.current.forEach(audio => {
        if (audio._spotLocation && audio._panNode) {
          // Recalculate distance and bearing
          const distance = calculateDistance(
            userLocation.lat, userLocation.lng,
            audio._spotLocation.lat, audio._spotLocation.lng
          );
          const bearing = calculateBearing(
            userLocation.lat, userLocation.lng,
            audio._spotLocation.lat, audio._spotLocation.lng
          );

          // Update volume based on proximity
          const newVolume = getProximityVolume(distance);
          audio.volume = isMuted ? 0 : newVolume;

          // Update stereo panning based on direction
          const newPan = calculateSterePan(bearing);
          audio._panNode.pan.value = newPan;

          // Log updates occasionally (every 10 ticks to avoid spam)
          if (Math.random() < 0.1) {
            console.log(`🔄 Updated ${audio._spotId}: dist=${distance.toFixed(1)}m, vol=${newVolume.toFixed(2)}, pan=${newPan.toFixed(2)}`);
          }
        }
      });
    }, 500); // Update every 500ms for smooth spatial transitions
  }

  function stopSpatialAudioUpdates() {
    if (spatialAudioIntervalRef.current) {
      clearInterval(spatialAudioIntervalRef.current);
      spatialAudioIntervalRef.current = null;
    }
  }

  function stopAllAudio() {
    console.log('🛑 Stopping all audio and cleaning up spatial audio');
    isPlayingRef.current = false;
    setIsPlaying(false);
    setCurrentAudio(null);
    setSelectedSpot(null);
    setSessionPlayback(null);
    setPlayingNearbySpotIds(new Set()); // Clear nearby playing markers
    activeTracksRef.current = [];
    stopProgressPolling();
    stopSpatialAudioUpdates(); // Stop dynamic spatial updates

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

  const playSingleAudio = async (audioBlob, spot) => {
    if (isPlayingRef.current) {
      await stopAllAudio();
    }
    try {
      const audio = new Audio(URL.createObjectURL(audioBlob));
      audio.volume = isMuted ? 0 : volume;
      audioRefs.current.push(audio);
      if (spot) registerActiveTrack(audio, spot);
      isPlayingRef.current = true;
      setIsPlaying(true);
      setPlayerExpanded(true);
      startProgressPolling();
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

  const playSingleAudioFromUrl = async (url, spot) => {
    if (isPlayingRef.current) {
      await stopAllAudio();
    }
    try {
      const audio = new Audio(url);
      audio.volume = isMuted ? 0 : volume;
      audioRefs.current.push(audio);
      if (spot) registerActiveTrack(audio, spot);
      isPlayingRef.current = true;
      setIsPlaying(true);
      setPlayerExpanded(true);
      startProgressPolling();
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
          activeTracksRef.current = activeTracksRef.current.filter(t => !t.audio.paused || !t.audio.ended);
          registerActiveTrack(audio, spot);

          // Update UI with current track info
          setCurrentAudio(spot);
          setSelectedSpot(spot);

          // True crossfade: start next track 500ms before current ends
          const CROSSFADE_MS = 500;
          const fadeOutNext = () => {
            currentIndex++;
            if (isPlayingRef.current) playNext();
          };
          audio.ontimeupdate = () => {
            if (audio.duration && audio.currentTime > 0) {
              const remaining = (audio.duration - audio.currentTime) * 1000;
              if (remaining <= CROSSFADE_MS && remaining > CROSSFADE_MS - 100 && currentIndex + 1 < sortedSpots.length) {
                // Fade out current, start next
                audio.ontimeupdate = null;
                const fadeSteps = 10;
                const fadeInterval = CROSSFADE_MS / fadeSteps;
                let step = 0;
                const origVol = audio.volume;
                const fadeTimer = setInterval(() => {
                  step++;
                  audio.volume = Math.max(0, origVol * (1 - step / fadeSteps));
                  if (step >= fadeSteps) clearInterval(fadeTimer);
                }, fadeInterval);
                fadeOutNext();
              }
            }
          };
          audio.onended = () => {
            audio.ontimeupdate = null;
            if (currentIndex < sortedSpots.length - 1) return; // already advanced by crossfade
            currentIndex++;
            if (isPlayingRef.current) playNext();
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
      startProgressPolling();

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
          audioRefs.current.push(audio);
          registerActiveTrack(audio, spot);
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
        startProgressPolling();

        // Wait for all durations, then loop shorter files; longest is the leader
        const durationsReady = audioElements.map(audio =>
          new Promise(resolve => {
            if (audio.duration && isFinite(audio.duration)) resolve(audio.duration);
            else audio.addEventListener('loadedmetadata', () => resolve(audio.duration), { once: true });
          })
        );
        const durations = await Promise.all(durationsReady);
        const maxDuration = Math.max(...durations);
        const leaderIndex = durations.indexOf(maxDuration);

        audioElements.forEach((audio, i) => {
          if (i === leaderIndex) {
            audio.loop = false;
            audio.addEventListener('ended', () => {
              console.log('🏁 Longest audio ended in Jamm mode, stopping all');
              stopAllAudio();
            });
          } else {
            audio.loop = true;
            // Random start offset so loops don't always align from beat 0
            if (durations[i] > 0) {
              audio.currentTime = Math.random() * durations[i];
            }
          }
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

  // --- RELOJ: plays sounds recorded at the same time-of-day window as right now ---
  // Matches recordings within ±30 minutes of the current clock time, across all visible sessions.
  async function playReloj(group) {
    if (group.length === 0) return;
    try {
      setIsLoading(true);
      await stopAllAudio();
      setPlaybackMode('reloj');

      const now = new Date();
      const nowMinutes = now.getHours() * 60 + now.getMinutes();
      const WINDOW = relojWindow; // configurable ±15/30/60 min

      const matchingSpots = group.filter(spot => {
        if (!spot.timestamp) return false;
        const t = new Date(spot.timestamp);
        const tMin = t.getHours() * 60 + t.getMinutes();
        let diff = Math.abs(tMin - nowMinutes);
        if (diff > 720) diff = 1440 - diff; // wrap midnight
        return diff <= WINDOW;
      }).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

      if (matchingSpots.length === 0) {
        const nowStr = now.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
        showAlert(`No hay grabaciones en la ventana de ±${WINDOW} min alrededor de las ${nowStr}. Prueba otro modo o amplía la ventana.`);
        setIsLoading(false);
        return;
      }

      console.log(`🕐 Reloj: ${matchingSpots.length} grabaciones en ventana horaria actual`);

      // Spatial playback — all matching spots simultaneously with proximity volume
      isPlayingRef.current = true;
      setIsPlaying(true);
      setPlayerExpanded(true);

      const audioPromises = matchingSpots.map(async (spot) => {
        try {
          const audioSource = await getPlayableAudioForSpot(spot.id);
          if (!audioSource) return null;
          const audioUrl = audioSource.type === 'blob'
            ? URL.createObjectURL(audioSource.blob)
            : audioSource.url;
          const audio = new Audio(audioUrl);
          audio.loop = true;

          const dist = userLocation
            ? calculateDistance(userLocation.lat, userLocation.lng, spot.location.lat, spot.location.lng)
            : 0;
          const vol = getProximityVolume(dist);
          audio.volume = isMuted ? 0 : vol;

          if (userLocation && (window.AudioContext || window.webkitAudioContext)) {
            try {
              const actx = new (window.AudioContext || window.webkitAudioContext)();
              const src = actx.createMediaElementSource(audio);
              const pan = actx.createStereoPanner();
              pan.pan.value = calculateSterePan(
                calculateBearing(userLocation.lat, userLocation.lng, spot.location.lat, spot.location.lng)
              );
              src.connect(pan);
              pan.connect(actx.destination);
              audio._audioContext = actx;
              audio._audioSource = src;
              audio._panNode = pan;
            } catch (_) { /* spatial audio unsupported */ }
          }

          audioRefs.current.push(audio);
          registerActiveTrack(audio, spot);
          await audio.play();
          return audio;
        } catch (e) {
          console.warn('Reloj: error playing spot', e);
          return null;
        }
      });

      const active = (await Promise.all(audioPromises)).filter(Boolean);
      startProgressPolling();
      console.log(`🕐 Reloj: ${active.length} sonidos activos`);

      if (active.length > 0) {
        const closest = matchingSpots.reduce((c, s) => {
          if (!userLocation) return c;
          const d = calculateDistance(userLocation.lat, userLocation.lng, s.location.lat, s.location.lng);
          const dc = calculateDistance(userLocation.lat, userLocation.lng, c.location.lat, c.location.lng);
          return d < dc ? s : c;
        });
        setCurrentAudio(closest);
        setSelectedSpot(closest);
      }
    } catch (error) {
      console.error('❌ Error in Reloj mode:', error);
      isPlayingRef.current = false;
      setIsPlaying(false);
    } finally {
      setIsLoading(false);
    }
  }

  // Solar hour estimation based on latitude and day-of-year
  // Returns dawn/dusk windows for any location on Earth
  function estimateSunHours(lat) {
    const now = new Date();
    const doy = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 86400000);
    const decl = 23.45 * Math.sin((2 * Math.PI / 365) * (doy - 81));
    const latRad = lat * Math.PI / 180;
    const declRad = decl * Math.PI / 180;
    const cosH = -Math.tan(latRad) * Math.tan(declRad);
    const clampedCos = Math.max(-1, Math.min(1, cosH));
    const haDeg = Math.acos(clampedCos) * 180 / Math.PI;
    const sunrise = 12 - haDeg / 15;
    const sunset = 12 + haDeg / 15;
    return {
      dawnStart: Math.floor(sunrise - 1),
      dawnEnd: Math.ceil(sunrise + 2),
      duskStart: Math.floor(sunset - 2),
      duskEnd: Math.ceil(sunset + 1),
    };
  }

  // --- ALBA: solar-gated dawn mode ---
  // Gate: only plays when the LISTENER is in their local dawn window
  // Filter: plays recordings captured during dawn at their ORIGIN location
  async function playAlba(group) {
    const listenerSun = userLocation
      ? estimateSunHours(userLocation.lat)
      : { dawnStart: 5, dawnEnd: 8 };
    const nowHour = new Date().getHours();
    if (nowHour < listenerSun.dawnStart || nowHour >= listenerSun.dawnEnd) {
      showAlert(`🌅 Alba solo está disponible durante tu amanecer local (${listenerSun.dawnStart}:00–${listenerSun.dawnEnd}:00h). Ahora son las ${nowHour}:00. Vuelve al alba para escuchar el coro matutino.`);
      return;
    }
    await playSolarWindow(group, 'alba', 'dawn');
  }

  // --- CREPÚSCULO: solar-gated dusk mode ---
  // Gate: only plays when the LISTENER is in their local dusk window
  // Filter: plays recordings captured during dusk at their ORIGIN location
  async function playCrepusculo(group) {
    const listenerSun = userLocation
      ? estimateSunHours(userLocation.lat)
      : { duskStart: 17, duskEnd: 20 };
    const nowHour = new Date().getHours();
    if (nowHour < listenerSun.duskStart || nowHour >= listenerSun.duskEnd) {
      showAlert(`🌇 Crepúsculo solo está disponible durante tu atardecer local (${listenerSun.duskStart}:00–${listenerSun.duskEnd}:00h). Ahora son las ${nowHour}:00. Vuelve al crepúsculo para escuchar el coro vespertino.`);
      return;
    }
    await playSolarWindow(group, 'crepusculo', 'dusk');
  }

  // Shared helper: filter recordings by their origin solar window, then play
  async function playSolarWindow(group, mode, window) {
    if (group.length === 0) return;
    try {
      setIsLoading(true);
      await stopAllAudio();
      setPlaybackMode(mode);

      // Filter recordings that were captured during dawn/dusk at their ORIGIN location
      const filtered = group.filter(spot => {
        if (!spot.timestamp) return false;
        const recHour = new Date(spot.timestamp).getHours();
        // Use recording's GPS coordinates to compute its local solar window
        const recLat = spot.lat || spot.latitude;
        const originSun = recLat ? estimateSunHours(recLat) : { dawnStart: 5, dawnEnd: 8, duskStart: 17, duskEnd: 20 };
        if (window === 'dawn') {
          return recHour >= originSun.dawnStart && recHour < originSun.dawnEnd;
        } else {
          return recHour >= originSun.duskStart && recHour < originSun.duskEnd;
        }
      }).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

      if (filtered.length === 0) {
        const label = window === 'dawn' ? 'alba' : 'crepúsculo';
        showAlert(`No hay grabaciones del ${label} en esta capa. Graba durante las horas de mayor actividad bioacústica.`);
        setIsLoading(false);
        return;
      }

      console.log(`🌅 ${mode}: ${filtered.length} grabaciones del ${window} (filtradas por horario solar de origen)`);

      // Play chronologically
      isPlayingRef.current = true;
      setIsPlaying(true);
      setPlayerExpanded(true);
      startProgressPolling();

      let idx = 0;
      const playNext = async () => {
        if (idx >= filtered.length || !isPlayingRef.current) {
          setIsPlaying(false);
          isPlayingRef.current = false;
          return;
        }
        const spot = filtered[idx];
        const audioSource = await getPlayableAudioForSpot(spot.id);
        if (!audioSource) { idx++; await playNext(); return; }

        const audioUrl = audioSource.type === 'blob'
          ? URL.createObjectURL(audioSource.blob)
          : audioSource.url;
        const audio = new Audio(audioUrl);
        audio.volume = isMuted ? 0 : volume;
        audioRefs.current.push(audio);
        activeTracksRef.current = activeTracksRef.current.filter(t => !t.audio.paused || !t.audio.ended);
        registerActiveTrack(audio, spot);
        setCurrentAudio(spot);
        setSelectedSpot(spot);

        audio.onended = () => { idx++; setTimeout(() => { if (isPlayingRef.current) playNext(); }, 300); };
        audio.onerror = () => { idx++; setTimeout(() => { if (isPlayingRef.current) playNext(); }, 100); };
        await audio.play();
      };
      await playNext();

    } catch (error) {
      console.error(`❌ Error in ${mode} mode:`, error);
      isPlayingRef.current = false;
      setIsPlaying(false);
    } finally {
      setIsLoading(false);
    }
  }

  // --- ESTRATOS: build up ecological strata — insects → birds → amphibians → mammals → others ---
  async function playEstratos(group) {
    if (group.length === 0) return;
    try {
      setIsLoading(true);
      await stopAllAudio();
      setPlaybackMode('estratos');

      // Strata order — keywords matched against speciesTags or filename
      const strata = [
        { label: 'Insectos',   keywords: ['insect', 'insecto', 'grillo', 'cricket', 'cicada', 'cigarra', 'abeja', 'bee', 'mosca', 'fly', 'wasp', 'avispa', 'hormiga', 'ant', 'escarabajo', 'beetle', 'mariposa', 'butterfly', 'moth', 'polilla', 'libélula', 'dragonfly', 'mantis', 'cucaracha', 'cockroach', 'luciérnaga', 'firefly', 'zancudo', 'mosquito'] },
        { label: 'Aves',       keywords: ['ave', 'bird', 'pajaro', 'pájaro', 'song', 'canto', 'colibrí', 'hummingbird', 'tucán', 'toucan', 'loro', 'parrot', 'guacamaya', 'macaw', 'búho', 'owl', 'lechuza', 'águila', 'eagle', 'halcón', 'hawk', 'garza', 'heron', 'carpintero', 'woodpecker', 'golondrina', 'swallow', 'mirlo', 'thrush', 'quetzal', 'gallina', 'tanager', 'tángara', 'barranquero', 'motmot'] },
        { label: 'Anfibios',   keywords: ['frog', 'rana', 'sapo', 'toad', 'anfibio', 'amphibian', 'salamandra', 'salamander', 'tritón', 'newt', 'cecilia', 'caecilian', 'dendrobates', 'tree frog'] },
        { label: 'Mamíferos',  keywords: ['mammal', 'mamifero', 'mamífero', 'mono', 'monkey', 'bat', 'murciélago', 'aullador', 'howler', 'ardilla', 'squirrel', 'venado', 'deer', 'jaguar', 'puma', 'ocelote', 'perezoso', 'sloth', 'armadillo', 'danta', 'tapir', 'nutria', 'otter', 'delfín', 'dolphin', 'ballena', 'whale'] },
        { label: 'Agua',       keywords: ['agua', 'water', 'río', 'river', 'stream', 'quebrada', 'cascada', 'waterfall', 'lluvia', 'rain', 'mar', 'sea', 'ocean', 'ola', 'wave', 'goteo', 'drip'] },
        { label: 'Ambiente',   keywords: [] }, // catches everything else
      ];

      const matchStrata = (spot) => {
        const tags = (spot.speciesTags || []).map(t => t.toLowerCase());
        const name = (spot.filename || '').toLowerCase();
        for (let i = 0; i < strata.length - 1; i++) {
          if (strata[i].keywords.some(k => tags.some(t => t.includes(k)) || name.includes(k))) return i;
        }
        return strata.length - 1; // ambient / other
      };

      // Build strata buckets
      const buckets = strata.map(() => []);
      group.forEach(spot => buckets[matchStrata(spot)].push(spot));
      const activeBuckets = buckets.filter(b => b.length > 0);

      if (activeBuckets.length === 0) {
        showAlert('No hay grabaciones con etiquetas de especie. Añade etiquetas al grabar para usar el modo Estratos.');
        setIsLoading(false);
        return;
      }

      console.log(`🌿 Estratos: ${activeBuckets.length} capas activas`);

      // Layer entry interval — add a new stratum every STAGGER_MS ms
      const STAGGER_MS = 4000;

      isPlayingRef.current = true;
      setIsPlaying(true);
      setPlayerExpanded(true);
      startProgressPolling();

      const loadAndPlay = async (spot) => {
        const audioSource = await getPlayableAudioForSpot(spot.id);
        if (!audioSource) return;
        const audioUrl = audioSource.type === 'blob'
          ? URL.createObjectURL(audioSource.blob)
          : audioSource.url;
        const audio = new Audio(audioUrl);
        audio.loop = true;
        audio.volume = isMuted ? 0 : volume * 0.75; // slightly reduced so mix doesn't clip
        audioRefs.current.push(audio);
        registerActiveTrack(audio, spot);
        try { await audio.play(); } catch (_) {}
      };

      // Stagger each stratum bucket entry
      let layerIdx = 0;
      for (const bucket of activeBuckets) {
        if (!isPlayingRef.current) break;
        console.log(`🔊 Estratos: entrando capa ${strata[layerIdx]?.label || 'ambiente'} (${bucket.length} sonidos)`);
        await Promise.all(bucket.map(loadAndPlay));
        if (layerIdx === 0) {
          setCurrentAudio(bucket[0]);
          setSelectedSpot(bucket[0]);
        }
        layerIdx++;
        if (layerIdx < activeBuckets.length) {
          await new Promise(resolve => setTimeout(resolve, STAGGER_MS));
        }
      }

    } catch (error) {
      console.error('❌ Error in Estratos mode:', error);
      isPlayingRef.current = false;
      setIsPlaying(false);
    } finally {
      setIsLoading(false);
    }
  }

  // --- MIGRATORIA: play imported derives in their original geographic order ---
  // Sorts spots by geographic position (walking path order) and plays sequentially,
  // regardless of current user location. Bioacoustic tourism: walk a Colombian rainforest in Berlin.
  async function playMigratoria(group) {
    if (group.length === 0) return;
    try {
      setIsLoading(true);
      await stopAllAudio();
      setPlaybackMode('migratoria');

      // Sort by timestamp (walking order) — the original derive path
      const sorted = [...group].sort((a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0));

      console.log(`🦋 Migratoria: ${sorted.length} grabaciones en orden de caminata`);

      isPlayingRef.current = true;
      setIsPlaying(true);
      setPlayerExpanded(true);
      startProgressPolling();

      let idx = 0;
      const playNext = async () => {
        if (idx >= sorted.length || !isPlayingRef.current) {
          setIsPlaying(false);
          isPlayingRef.current = false;
          return;
        }
        const spot = sorted[idx];
        const audioSource = await getPlayableAudioForSpot(spot.id);
        if (!audioSource) { idx++; await playNext(); return; }

        const audioUrl = audioSource.type === 'blob'
          ? URL.createObjectURL(audioSource.blob)
          : audioSource.url;
        const audio = new Audio(audioUrl);
        audio.volume = isMuted ? 0 : volume;
        audioRefs.current.push(audio);
        activeTracksRef.current = activeTracksRef.current.filter(t => !t.audio.paused || !t.audio.ended);
        registerActiveTrack(audio, spot);
        setCurrentAudio(spot);
        setSelectedSpot(spot);

        // Crossfade 500ms before end
        const CROSSFADE_MS = 500;
        audio.ontimeupdate = () => {
          if (audio.duration && audio.currentTime > 0) {
            const remaining = (audio.duration - audio.currentTime) * 1000;
            if (remaining <= CROSSFADE_MS && remaining > CROSSFADE_MS - 100 && idx + 1 < sorted.length) {
              audio.ontimeupdate = null;
              const origVol = audio.volume;
              let step = 0;
              const fadeTimer = setInterval(() => {
                step++;
                audio.volume = Math.max(0, origVol * (1 - step / 10));
                if (step >= 10) clearInterval(fadeTimer);
              }, CROSSFADE_MS / 10);
              idx++;
              if (isPlayingRef.current) playNext();
            }
          }
        };
        audio.onended = () => {
          audio.ontimeupdate = null;
          idx++;
          if (isPlayingRef.current) playNext();
        };
        audio.onerror = () => { idx++; setTimeout(() => { if (isPlayingRef.current) playNext(); }, 100); };
        await audio.play();
      };
      await playNext();
    } catch (error) {
      console.error('❌ Error in Migratoria mode:', error);
      isPlayingRef.current = false;
      setIsPlaying(false);
    } finally {
      setIsLoading(false);
    }
  }

  // --- ESPECTRO: sort by frequency content (species tags heuristic) and crossfade low→high ---
  // Creates a spectral sweep from low-frequency sounds (mammals, water) to high (insects, birds).
  async function playEspectro(group) {
    if (group.length === 0) return;
    try {
      setIsLoading(true);
      await stopAllAudio();
      setPlaybackMode('espectro');

      // Frequency band heuristic: lower index = lower frequency
      const freqBands = [
        { range: 'Sub-bass',  keywords: ['whale', 'ballena', 'earthquake', 'trueno', 'thunder', 'water', 'agua', 'río', 'river', 'lluvia', 'rain', 'cascada', 'waterfall'] },
        { range: 'Bass',      keywords: ['mammal', 'mamífero', 'mamifero', 'mono', 'monkey', 'howler', 'aullador', 'jaguar', 'puma', 'tapir', 'danta'] },
        { range: 'Low-mid',   keywords: ['frog', 'rana', 'sapo', 'toad', 'anfibio', 'amphibian', 'dendrobates'] },
        { range: 'Mid',       keywords: ['ave', 'bird', 'owl', 'búho', 'lechuza', 'woodpecker', 'carpintero', 'tucán', 'toucan', 'barranquero', 'motmot'] },
        { range: 'High-mid',  keywords: ['pajaro', 'pájaro', 'song', 'canto', 'colibrí', 'hummingbird', 'tanager', 'tángara', 'golondrina', 'swallow', 'quetzal'] },
        { range: 'High',      keywords: ['insect', 'insecto', 'grillo', 'cricket', 'cicada', 'cigarra', 'bat', 'murciélago', 'mosquito', 'zancudo'] },
      ];

      const getFreqScore = (spot) => {
        const tags = (spot.speciesTags || []).map(t => t.toLowerCase());
        const name = (spot.filename || '').toLowerCase();
        for (let i = 0; i < freqBands.length; i++) {
          if (freqBands[i].keywords.some(k => tags.some(t => t.includes(k)) || name.includes(k))) return i;
        }
        return 3; // default to mid
      };

      const sorted = [...group].sort((a, b) => getFreqScore(a) - getFreqScore(b));
      console.log(`🌈 Espectro: ${sorted.length} grabaciones ordenadas por frecuencia estimada`);

      isPlayingRef.current = true;
      setIsPlaying(true);
      setPlayerExpanded(true);
      startProgressPolling();

      let idx = 0;
      const playNext = async () => {
        if (idx >= sorted.length || !isPlayingRef.current) {
          setIsPlaying(false);
          isPlayingRef.current = false;
          return;
        }
        const spot = sorted[idx];
        const audioSource = await getPlayableAudioForSpot(spot.id);
        if (!audioSource) { idx++; await playNext(); return; }

        const audioUrl = audioSource.type === 'blob'
          ? URL.createObjectURL(audioSource.blob)
          : audioSource.url;
        const audio = new Audio(audioUrl);
        audio.volume = isMuted ? 0 : volume;
        audioRefs.current.push(audio);
        activeTracksRef.current = activeTracksRef.current.filter(t => !t.audio.paused || !t.audio.ended);
        registerActiveTrack(audio, spot);
        setCurrentAudio(spot);
        setSelectedSpot(spot);

        // Crossfade 600ms — slightly longer for spectral transitions
        const CROSSFADE_MS = 600;
        audio.ontimeupdate = () => {
          if (audio.duration && audio.currentTime > 0) {
            const remaining = (audio.duration - audio.currentTime) * 1000;
            if (remaining <= CROSSFADE_MS && remaining > CROSSFADE_MS - 100 && idx + 1 < sorted.length) {
              audio.ontimeupdate = null;
              const origVol = audio.volume;
              let step = 0;
              const fadeTimer = setInterval(() => {
                step++;
                audio.volume = Math.max(0, origVol * (1 - step / 10));
                if (step >= 10) clearInterval(fadeTimer);
              }, CROSSFADE_MS / 10);
              idx++;
              if (isPlayingRef.current) playNext();
            }
          }
        };
        audio.onended = () => {
          audio.ontimeupdate = null;
          idx++;
          if (isPlayingRef.current) playNext();
        };
        audio.onerror = () => { idx++; setTimeout(() => { if (isPlayingRef.current) playNext(); }, 100); };
        await audio.play();
      };
      await playNext();
    } catch (error) {
      console.error('❌ Error in Espectro mode:', error);
      isPlayingRef.current = false;
      setIsPlaying(false);
    } finally {
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
        <div style={{ display: 'flex', gap: '8px', marginTop: 8 }}>
          <button
            style={{ flex: 1, background: '#F59E42', color: 'white', border: 'none', borderRadius: 4, padding: '4px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
            onClick={async () => {
              await stopAllAudio();
              // Close the popup to avoid overlapping UI
              if (mapInstance) mapInstance.closePopup();
              const audioSource = await getPlayableAudioForSpot(clickedSpot.id);
              if (audioSource) {
                setSelectedSpot(clickedSpot);
                setCurrentAudio(clickedSpot);
                setPlaybackMode('single');
                if (audioSource.type === 'blob') {
                  await playSingleAudio(audioSource.blob, clickedSpot);
                } else {
                  await playSingleAudioFromUrl(audioSource.url, clickedSpot);
                }
              } else {
                showAlert('No se encontró audio para esta grabación.');
              }
            }}
          >
            <Play size={16} /> Reproducir
          </button>
          <button
            style={{ background: '#c24a6e', color: 'white', border: 'none', borderRadius: 4, padding: '4px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={() => handleDeleteRecording(clickedSpot.id)}
            title="Eliminar grabación"
          >
            <Trash2 size={16} />
          </button>
        </div>
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
    setShowBreadcrumbs(prev => !prev);
  };

  const handleSetBreadcrumbVisualization = (mode) => {
    setBreadcrumbVisualization(mode);
  };

  // Clear stale breadcrumbs on mount if no active session
  useEffect(() => {
    const activeSession = walkSessionService.getActiveSession();
    if (!activeSession) {
      breadcrumbService.clearBreadcrumbs();
      setCurrentBreadcrumbs([]);
    }
  }, []);

  // Poll breadcrumbs every 1s — tracking lifecycle is managed by derive start/end, not this effect
  useEffect(() => {
    const interval = setInterval(() => {
      const breadcrumbs = breadcrumbService.getCurrentBreadcrumbs();
      setCurrentBreadcrumbs(breadcrumbs);
    }, 1000);
    return () => clearInterval(interval);
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
    const lines = allSessions
      .filter(s => s.breadcrumbs && s.breadcrumbs.length >= 2)
      .map((s, index) => {
        // Space hues evenly by position index so successive derivas differ clearly
        const hue = (index * 137.5) % 360; // golden-angle step avoids clustering
        const color = userAliasService._hslToHex(hue, 85, 52);
        return {
          sessionId: s.sessionId,
          positions: s.breadcrumbs.map(b => [b.lat, b.lng]),
          color,
          alias: s.userAlias,
          title: s.title || 'Deriva sin título',
          recordingCount: s.recordingIds?.length || 0
        };
      });
    setSessionTracklines(lines);

    // Load visible sessions from localStorage, or default to all sessions
    const savedVisible = localStorageService.loadVisibleSessions();
    const baseSet = savedVisible ? new Set(savedVisible) : new Set(allSessions.map(s => s.sessionId));
    // Always include the active walk session so current recordings are playable
    if (activeWalkSession?.sessionId) {
      baseSet.add(activeWalkSession.sessionId);
    }
    setVisibleSessionIds(baseSet);
  }, [allSessions, activeWalkSession]); // Refresh when session changes

  // Helper: get a playable audio source for a spot (blob or native URL)
  const getPlayableAudioForSpot = async (spotId) => {
    // Prefer native file URL (no memory overhead) over loading full blob
    const url = await localStorageService.getPlayableUrl(spotId);
    if (url) return { type: 'url', url };
    // Fallback: try blob (localStorage data URL or native file read)
    const blob = await localStorageService.getAudioBlobFlexible(spotId);
    if (blob && blob.size > 0) return { type: 'blob', blob };
    return null;
  };

  // Walk session recording handler
  const handleWalkRecordingSave = async (recordingData) => {
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
      await localStorageService.saveRecording(metadata, audioBlob);
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
          walkSessionId: r.walkSessionId || null,
        }))
        .filter(s => s.id && s.duration > 0);
      setAudioSpots(spots);
      setIsAudioRecorderVisible(false);
      showAlert('Grabación guardada correctamente.');
    } catch (error) {
      console.error('Error saving walk recording:', error);
      showAlert(`Error al guardar grabación: ${error.message}. Intenta de nuevo.`);
      // Keep modal open so user can retry
    }
  };

  const handleStartMicForWalk = () => {
    setIsAudioRecorderVisible(true);
  };

  const handleDeleteRecording = async (recordingId) => {
    try {
      // Confirm deletion
      const confirmed = window.confirm('¿Estás seguro de que quieres eliminar esta grabación? Esta acción no se puede deshacer.');
      if (!confirmed) return;

      // Delete from storage (removes audio file and metadata, but preserves derive/breadcrumbs)
      const success = await localStorageService.deleteRecording(recordingId);

      if (success) {
        // Reload recordings to update UI
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
            walkSessionId: r.walkSessionId || null,
          }))
          .filter(s => s.id && s.duration > 0);
        setAudioSpots(spots);

        // Close popup
        if (mapInstance) mapInstance.closePopup();

        // Stop audio if this recording was playing
        if (currentAudio && currentAudio.id === recordingId) {
          stopAllAudio();
        }

        showAlert('Grabación eliminada correctamente.');
      } else {
        showAlert('Error al eliminar la grabación. Intenta de nuevo.');
      }
    } catch (error) {
      console.error('Error deleting recording:', error);
      showAlert('Error al eliminar: ' + (error?.message || error));
    }
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
    if (mapInstance) {
      mapInstance.setView([spot.location.lat, spot.location.lng], 19);
    }
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
        setIsBreadcrumbTracking(true);
      }
      lastMovementTimeRef.current = Date.now();
      // Reset auto-zoom for the new derive
      cumulativeDistanceRef.current = 0;
      userHasZoomedRef.current = false;
      lastAutoZoomRef.current = 19;
      setActiveWalkSession(session);
    } catch (error) {
      console.error('Error starting walk session:', error);
    }
  };

  const handleRecordingStart = async () => {
    if (!activeWalkSession) {
      await handleStartDerive();
    }
    // Zoom in when recording starts — temporarily override auto-zoom
    if (mapInstance) {
      mapInstance.flyTo([userLocation?.lat || mapInstance.getCenter().lat, userLocation?.lng || mapInstance.getCenter().lng], 19, { duration: 0.5 });
    }
    // Ensure breadcrumbs are visible
    if (!showBreadcrumbs) {
      setShowBreadcrumbs(true);
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
      // Refresh tracklines (use same golden-angle coloring as the main loader)
      const sessions = walkSessionService.getCompletedSessions();
      const lines = sessions
        .filter(s => s.breadcrumbs && s.breadcrumbs.length >= 2)
        .map((s, index) => {
          const hue = (index * 137.5) % 360;
          const color = userAliasService._hslToHex(hue, 85, 52);
          return {
            sessionId: s.sessionId,
            positions: s.breadcrumbs.map(b => [b.lat, b.lng]),
            color,
            alias: s.userAlias,
            title: s.title || 'Deriva sin título',
            recordingCount: s.recordingIds?.length || 0
          };
        });
      setSessionTracklines(lines);
      // Add new session to visible set
      setVisibleSessionIds(prev => {
        const next = new Set(prev);
        next.add(sessionId);
        localStorageService.saveVisibleSessions(next);
        return next;
      });

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
      localStorageService.saveVisibleSessions(next);
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
      case 'reloj': playReloj(sessionSpots); break;
      case 'alba': playAlba(sessionSpots); break;
      case 'crepusculo': playCrepusculo(sessionSpots); break;
      case 'estratos': playEstratos(sessionSpots); break;
    }
  };

  // Throttled zoom change handler to reduce marker re-renders during zoom animation
  const handleThrottledZoomChange = (newZoom) => {
    if (zoomThrottleRef.current) clearTimeout(zoomThrottleRef.current);
    zoomThrottleRef.current = setTimeout(() => {
      setCurrentZoom(newZoom);
    }, 200); // Wait 200ms after last zoom event before updating
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
        zoom={19}
        maxZoom={20}
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
        attributionControl={false}
        ref={mapRef}
      >
        {/* Detect user manual zoom to disable auto-zoom */}
        <MapZoomHandler onUserZoom={() => { userHasZoomedRef.current = true; }} onZoomChange={handleThrottledZoomChange} />
        {/* OpenStreetMap Layer */}
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          maxNativeZoom={19}
          maxZoom={20}
          opacity={currentLayer === 'OpenStreetMap' ? 1 : 0}
          zIndex={currentLayer === 'OpenStreetMap' ? 1 : 0}
        />

        {/* OpenTopoMap Layer — native max is 17 */}
        <TileLayer
          attribution='Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)'
          url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
          maxNativeZoom={17}
          maxZoom={20}
          opacity={currentLayer === 'OpenTopoMap' ? 1 : 0}
          zIndex={currentLayer === 'OpenTopoMap' ? 1 : 0}
        />

        {/* CartoDB Layer */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          maxNativeZoom={20}
          maxZoom={20}
          opacity={currentLayer === 'CartoDB' ? 1 : 0}
          zIndex={currentLayer === 'CartoDB' ? 1 : 0}
        />

        {/* OSM Humanitarian Layer */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="https://www.hotosm.org/">Humanitarian OpenStreetMap Team</a>'
          url="https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png"
          maxNativeZoom={19}
          maxZoom={20}
          opacity={currentLayer === 'OSMHumanitarian' ? 1 : 0}
          zIndex={currentLayer === 'OSMHumanitarian' ? 1 : 0}
        />

        {/* StadiaMaps Satellite Layer */}
        <TileLayer
          attribution='&copy; <a href="https://stadiamaps.com/">Stadia Maps</a>'
          url="https://tiles.stadiamaps.com/tiles/alidade_satellite/{z}/{x}/{y}.jpg"
          maxNativeZoom={18}
          maxZoom={20}
          opacity={currentLayer === 'StadiaSatellite' ? 1 : 0}
          zIndex={currentLayer === 'StadiaSatellite' ? 1 : 0}
        />
        <TileLayer
          attribution='Tiles &copy; Esri'
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          maxNativeZoom={18}
          maxZoom={20}
          opacity={currentLayer === 'EsriWorldImagery' ? 1 : 0}
          zIndex={currentLayer === 'EsriWorldImagery' ? 1 : 0}
        />
        <TileLayer
          attribution='<a href="https://github.com/cyclosm/cyclosm-cartocss-style/releases">CyclOSM</a> | &copy; OpenStreetMap'
          url="https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png"
          maxNativeZoom={18}
          maxZoom={20}
          opacity={currentLayer === 'CyclOSM' ? 1 : 0}
          zIndex={currentLayer === 'CyclOSM' ? 1 : 0}
        />
        {userLocation && (
          <Marker position={[userLocation.lat, userLocation.lng]} icon={createUserLocationIcon()} />
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
                // Use animated playing icon if this spot is playing in nearby mode
                const isPlayingNearby = playingNearbySpotIds.has(spot.id);
                const markerIcon = isPlayingNearby
                  ? createPlayingNearbyIcon(spot.duration, currentZoom)
                  : createDurationCircleIcon(spot.duration, currentZoom);

                return (
                  <Marker
                    key={spot.id}
                    position={[spot.location.lat, spot.location.lng]}
                    icon={markerIcon}
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

        {/* Breadcrumb Visualization — always visible when breadcrumbs exist */}
        {currentBreadcrumbs.length > 0 && (
          <BreadcrumbVisualization
            breadcrumbs={currentBreadcrumbs}
            visualizationMode={breadcrumbVisualization}
            mapInstance={mapInstance}
          />
        )}

        {/* Saved session tracklines — rendered as GPS-tracklog colored lines */}
        {allSessions
          .filter(s => visibleSessionIds.has(s.sessionId) && s.breadcrumbs?.length >= 2)
          .map(s => (
            <BreadcrumbVisualization
              key={s.sessionId}
              breadcrumbs={simplifyBreadcrumbs(s.breadcrumbs)}
              visualizationMode="line"
              lineColor="auto"
              lineWidth={4}
              opacity={0.85}
              showMarkers={false}
            />
          ))}
      </MapContainer>

      {/* Shared TopBar */}
      <SharedTopBar
        userLocation={userLocation}
        onBackToLanding={handleBackToMenu}
        onLocationRefresh={() => {
          if (mapInstance && userLocation) {
            userHasZoomedRef.current = false;
            const zoom = Math.round(computeAutoZoom(cumulativeDistanceRef.current));
            mapInstance.flyTo([userLocation.lat, userLocation.lng], zoom, { duration: 0.5 });
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
        onImportComplete={(result) => {
          if (onDataRefresh) onDataRefresh();
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
              walkSessionId: r.walkSessionId || null,
            }))
            .filter(s => s.id && s.duration > 0);
          setAudioSpots(spots);
          // Make the imported session(s) visible on the map
          const idsToAdd = [
            result?.sessionId,
            ...(result?.walkSessionIds || []),
          ].filter(Boolean);
          if (idsToAdd.length > 0) {
            setVisibleSessionIds(prev => {
              const next = new Set(prev);
              idsToAdd.forEach(id => next.add(id));
              localStorageService.saveVisibleSessions(next);
              return next;
            });
          }
        }}
        walkSession={activeWalkSession}
        onStartDerive={handleStartDerive}
        onEndDerive={handleEndDerive}
        onRecordPress={handleStartMicForWalk}
        onShowHistory={() => setShowSessionHistory(true)}
        allSessions={allSessions}
      />

      {/* Record (red) and Play (green) FABs — symmetrical bottom corners */}
      {/* Record FAB — bottom-left (hidden when recorder modal is open) */}
      {!isAudioRecorderVisible && (
        <button
          onClick={async () => { await handleRecordingStart(); setIsAudioRecorderVisible(true); }}
          style={{
            position: 'fixed',
            bottom: '130px',
            left: 'calc(50% - 166px)',
            width: '52px',
            height: '52px',
            borderRadius: '50%',
            backgroundColor: 'rgba(194,74,110,0.65)',
            color: 'white',
            border: '1px solid rgba(255,255,255,0.35)',
            boxShadow: '0 4px 16px rgba(194,74,110,0.35), 0 2px 6px rgba(0,0,0,0.15)',
            backdropFilter: 'blur(12px)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            transition: 'transform 0.2s'
          }}
          title="Grabar audio"
        >
          <Mic size={22} />
        </button>
      )}

      {/* Play FAB — bottom-right */}
      {!playerExpanded && (
        <button
          onClick={() => {
            setPlayerExpanded(true);
            if (mapInstance) mapInstance.closePopup();
          }}
          style={{
            position: 'fixed',
            bottom: '130px',
            left: 'calc(50% + 114px)',
            width: '52px',
            height: '52px',
            borderRadius: '50%',
            backgroundColor: 'rgba(157,192,76,0.65)',
            color: 'white',
            border: '1px solid rgba(255,255,255,0.35)',
            boxShadow: '0 4px 16px rgba(157,192,76,0.35), 0 2px 6px rgba(0,0,0,0.15)',
            backdropFilter: 'blur(12px)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            transition: 'transform 0.2s'
          }}
          title="Abrir reproductor"
        >
          <Play size={22} />
        </button>
      )}

      {/* Expanded player panel */}
      {playerExpanded && (
        <div style={{
          position: 'fixed',
          bottom: '120px',
          left: '50%',
          transform: `translate(calc(-50% + ${playerDragPos.x}px), ${playerDragPos.y}px)`,
          backgroundColor: 'rgba(220,225,235,0.78)',
          borderRadius: '16px',
          boxShadow: 'rgba(78,78,134,0.25) 0px 10px 30px',
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
              lineHeight: 1,
              zIndex: 1
            }}
            title="Cerrar reproductor"
          >
            ✕
          </button>
          <div
            onPointerDown={onPlayerDragStart}
            style={{ textAlign: 'center', marginBottom: '16px', cursor: 'grab', touchAction: 'none' }}
          >
            <h3 style={{ margin: '0px 0px 8px', fontSize: '18px', fontWeight: '600' }}>
              {sessionPlayback ? sessionPlayback.title : 'Reproductor'}
            </h3>
            <p style={{ margin: '0px', fontSize: '14px', color: 'rgb(107, 114, 128)' }}>
              {sessionPlayback
                ? `${sessionPlayback.alias} — ${{
                    nearby: '📍 Cercanos', chronological: '📅 Cronológico',
                    jamm: '🎛️ Jamm', reloj: '🕐 Reloj',
                    alba: '🌅 Alba', crepusculo: '🌇 Crepúsculo', estratos: '🌿 Estratos'
                  }[sessionPlayback.mode] || sessionPlayback.mode}`
                : `${modePlayableCount} grabación${modePlayableCount !== 1 ? 'es' : ''} reproducible${modePlayableCount !== 1 ? 's' : ''}`
              }
            </p>
          </div>
          <div style={{ marginBottom: '12px' }}>
            <div style={{ fontSize: '12px', fontWeight: '600', marginBottom: '6px', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Modo de Reproducción
            </div>
            {/* Bioacústica group */}
            <div style={{ fontSize: '10px', color: '#9CA3AF', marginBottom: '4px' }}>Bioacústica</div>
            <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginBottom: '6px' }}>
              {[
                { id: 'nearby',    label: 'Cercanos',  icon: '📍' },
                { id: 'reloj',     label: 'Reloj',     icon: '🕐' },
                { id: 'alba',        label: 'Alba',        icon: '🌅' },
                { id: 'crepusculo', label: 'Crepúsculo', icon: '🌇' },
                { id: 'estratos',   label: 'Estratos',   icon: '🌿' },
              ].map(({ id, label, icon }) => (
                <button
                  key={id}
                  onClick={() => setPlaybackMode(id)}
                  style={{
                    padding: '5px 9px',
                    backgroundColor: playbackMode === id ? '#4e4e86' : 'rgba(78,78,134,0.12)',
                    color: playbackMode === id ? 'white' : 'rgb(1 9 2 / 84%)',
                    border: playbackMode === id ? 'none' : '1px solid rgba(78,78,134,0.2)',
                    borderRadius: '6px', fontSize: '11px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '3px',
                    fontWeight: playbackMode === id ? '600' : '400',
                    boxShadow: playbackMode === id ? '0 2px 8px rgba(78,78,134,0.35)' : 'none',
                    transform: playbackMode === id ? 'scale(1.05)' : 'scale(1)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {icon} {label}
                </button>
              ))}
            </div>
            {/* Arte sonoro group */}
            <div style={{ fontSize: '10px', color: '#9CA3AF', marginBottom: '4px' }}>Arte sonoro</div>
            <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
              {[
                { id: 'chronological', label: 'Cronológico', icon: '📅' },
                { id: 'jamm',          label: 'Jamm',        icon: '🎛️' },
                { id: 'migratoria',    label: 'Migratoria',  icon: '🦋' },
                { id: 'espectro',      label: 'Espectro',    icon: '🌈' },
              ].map(({ id, label, icon }) => (
                <button
                  key={id}
                  onClick={() => setPlaybackMode(id)}
                  style={{
                    padding: '5px 9px',
                    backgroundColor: playbackMode === id ? '#4e4e86' : 'rgba(78,78,134,0.12)',
                    color: playbackMode === id ? 'white' : 'rgb(1 9 2 / 84%)',
                    border: playbackMode === id ? 'none' : '1px solid rgba(78,78,134,0.2)',
                    borderRadius: '6px', fontSize: '11px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '3px',
                    fontWeight: playbackMode === id ? '600' : '400',
                    boxShadow: playbackMode === id ? '0 2px 8px rgba(78,78,134,0.35)' : 'none',
                    transform: playbackMode === id ? 'scale(1.05)' : 'scale(1)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {icon} {label}
                </button>
              ))}
            </div>
            {/* Mode description */}
            <p style={{ margin: '6px 0 0 0', fontSize: '11px', color: '#6B7280', fontStyle: 'italic', lineHeight: '1.3' }}>
              {{
                nearby: 'Sonidos dentro de 100m con volumen espacial según distancia y dirección. Muestra densidad de especies.',
                chronological: 'Grabaciones una tras otra en orden cronológico con crossfade de 500ms.',
                jamm: 'Todas las pistas simultáneas con paneo estéreo L↔R y desfase aleatorio.',
                reloj: `Grabaciones hechas a la misma hora del día (±${relojWindow} min).`,
                alba: 'Puente solar: escucha el amanecer de otro lugar durante TU amanecer local. Solo disponible en horas del alba.',
                crepusculo: 'Puente solar: escucha el atardecer de otro lugar durante TU atardecer local. Solo disponible en horas del crepúsculo.',
                estratos: 'Capas ecológicas: insectos → aves → anfibios → mamíferos → agua, en secuencia.',
                migratoria: 'Recorre una deriva importada en orden geográfico original. Turismo bioacústico.',
                espectro: 'Barrido espectral: sonidos ordenados de graves a agudos con crossfade.',
              }[playbackMode] || ''}
            </p>
            {/* Reloj window selector */}
            {playbackMode === 'reloj' && (
              <div style={{ display: 'flex', gap: '4px', marginTop: '6px' }}>
                {[15, 30, 60].map(w => (
                  <button
                    key={w}
                    onClick={() => setRelojWindow(w)}
                    style={{
                      padding: '3px 8px',
                      fontSize: '10px',
                      border: relojWindow === w ? 'none' : '1px solid rgba(78,78,134,0.2)',
                      borderRadius: '4px',
                      backgroundColor: relojWindow === w ? '#4e4e86' : 'transparent',
                      color: relojWindow === w ? 'white' : '#6B7280',
                      cursor: 'pointer',
                    }}
                  >
                    ±{w} min
                  </button>
                ))}
              </div>
            )}
          </div>
          {/* Active tracks tracklist */}
          {Object.keys(trackProgress).length > 0 && (
            <div style={{
              marginBottom: '12px',
              maxHeight: '140px',
              overflowY: 'auto',
              borderTop: '1px solid rgba(78,78,134,0.12)',
              borderBottom: '1px solid rgba(78,78,134,0.12)',
              paddingTop: '8px',
              paddingBottom: '4px',
            }}>
              <div style={{
                fontSize: '10px', fontWeight: '600', color: '#9CA3AF',
                textTransform: 'uppercase', letterSpacing: '0.05em',
                marginBottom: '4px', paddingLeft: '8px',
              }}>
                Pistas activas ({Object.keys(trackProgress).length})
              </div>
              {Object.entries(trackProgress).map(([trackId, progress]) => (
                <TracklistItem
                  key={trackId}
                  track={{ filename: progress.filename }}
                  progress={progress}
                  isPlaying={progress.isPlaying}
                />
              ))}
            </div>
          )}
          {currentAudio && Object.keys(trackProgress).length === 0 && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '4px' }}>
                {currentAudio.filename}
              </div>
              <div style={{ fontSize: '12px', color: 'rgb(107, 114, 128)' }}>
                {new Date(currentAudio.timestamp).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} — {{ nearby: '📍 Cercanos', chronological: '📅 Cronológico', jamm: '🎛️ Jamm', reloj: '🕐 Reloj', alba: '🌅 Alba', crepusculo: '🌇 Crepúsculo', estratos: '🌿 Estratos', migratoria: '🦋 Migratoria', espectro: '🌈 Espectro' }[playbackMode] || playbackMode}
              </div>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <button
              onClick={() => {
                const visibleSpots = audioSpots.filter(s =>
                  !s.walkSessionId || visibleSessionIds.has(s.walkSessionId)
                );
                if (playbackMode === 'nearby') handlePlayNearby();
                else if (playbackMode === 'chronological') playConcatenated(visibleSpots);
                else if (playbackMode === 'concatenated') playConcatenated(visibleSpots);
                else if (playbackMode === 'jamm') playJamm(visibleSpots);
                else if (playbackMode === 'reloj') playReloj(visibleSpots);
                else if (playbackMode === 'alba') playAlba(visibleSpots);
                else if (playbackMode === 'crepusculo') playCrepusculo(visibleSpots);
                else if (playbackMode === 'estratos') playEstratos(visibleSpots);
                else if (playbackMode === 'migratoria') playMigratoria(visibleSpots);
                else if (playbackMode === 'espectro') playEspectro(visibleSpots);
              }}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                backgroundColor: (nearbySpots.length > 0 || selectedSpot) ? '#4e4e86' : '#6B7280',
                color: 'white', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '14px', cursor: (nearbySpots.length > 0 || selectedSpot) ? 'pointer' : 'not-allowed', transition: 'background-color 0.2s'
              }}
            >
              <Play size={16} /> Reproducir
            </button>
            <button onClick={handleStopAudio} style={{ backgroundColor: '#c24a6e', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '14px', cursor: 'pointer' }}>
              <Square size={16} /> Detener
            </button>
            <button onClick={toggleMute} style={{ backgroundColor: isMuted ? '#c24a6e' : '#6B7280', color: 'white', border: 'none', borderRadius: '6px', padding: '8px 12px', fontSize: '14px', cursor: 'pointer' }}>
              {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Volume2 size={14} color="rgb(1 9 2 / 84%)" />
            <input type="range" min="0" max="1" step="0.01" value={volume} onChange={e => handleVolumeChange(Number(e.target.value))} />
            <button
              onClick={() => setProximityVolumeEnabled(!proximityVolumeEnabled)}
              style={{
                backgroundColor: proximityVolumeEnabled ? '#9dc04cd4' : 'rgba(78,78,134,0.15)',
                color: proximityVolumeEnabled ? 'white' : 'rgb(1 9 2 / 84%)',
                border: 'none', borderRadius: '6px',
                padding: '6px 10px', fontSize: '11px', cursor: 'pointer'
              }}
              title="Volumen por proximidad"
            >
              📍🔊
            </button>
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
            backgroundColor: '#f0f1ec',
            padding: '20px',
            borderRadius: '12px',
            textAlign: 'center'
          }}>
            <div style={{ width: '32px', height: '32px', border: '3px solid rgba(78,78,134,0.15)', borderTop: '3px solid #9dc04cd4', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
            <p style={{ margin: 0, fontSize: '14px', color: 'rgb(1 9 2 / 84%)' }}>Cargando audio...</p>
          </div>
        </div>
      )}
      <style>{`
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        @keyframes nearby-pulse {
          0%, 100% {
            transform: scale(1);
            box-shadow: 0 2px 12px rgba(157, 192, 76, 0.6);
          }
          50% {
            transform: scale(1.15);
            box-shadow: 0 4px 20px rgba(157, 192, 76, 0.9);
          }
        }
      `}</style>

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
        onRecordingStart={handleRecordingStart}
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
          sessionColors={Object.fromEntries(sessionTracklines.map(t => [t.sessionId, t.color]))}
        />
      )}
    </div>
  );
};

// ... (WrappedSoundWalkAndroid and export remain the same)


// Wrap export in ErrorBoundary
const WrappedSoundWalkAndroid = (props) => (
  <ErrorBoundary>
    <SoundWalkAndroid {...props} />
  </ErrorBoundary>
);

export default WrappedSoundWalkAndroid; 