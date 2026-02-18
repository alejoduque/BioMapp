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
import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Play, Pause, Save, X } from 'lucide-react';
import audioService from './audioService.js';
import { VoiceRecorder } from 'capacitor-voice-recorder';
import breadcrumbService from './breadcrumbService.js';
import useDraggable from '../hooks/useDraggable.js';

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

// Logging utility for debugging microphone issues
class AudioLogger {
  static logs: string[] = [];

  static log(message: string, data?: any) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}`;
    console.log(logEntry, data);
    this.logs.push(logEntry + (data ? ` | Data: ${JSON.stringify(data)}` : ''));
  }

  static error(message: string, error?: any) {
    const timestamp = new Date().toISOString();
    const errorDetails = error ? {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: (error as any).code,
      constraint: (error as any).constraint
    } : null;

    const logEntry = `[${timestamp}] ERROR: ${message}`;
    console.error(logEntry, error);
    this.logs.push(logEntry + (errorDetails ? ` | Error: ${JSON.stringify(errorDetails)}` : ''));
  }

  static getDeviceInfo() {
    return {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      cookieEnabled: navigator.cookieEnabled,
      onLine: navigator.onLine,
      hardwareConcurrency: navigator.hardwareConcurrency,
      deviceMemory: (navigator as any).deviceMemory,
      maxTouchPoints: navigator.maxTouchPoints,
      timestamp: new Date().toISOString()
    };
  }

  static async saveLogs() {
    try {
      const deviceInfo = this.getDeviceInfo();
      const fullLog = {
        deviceInfo,
        logs: this.logs,
        summary: {
          totalLogs: this.logs.length,
          errorCount: this.logs.filter(log => log.includes('ERROR:')).length,
          timestamp: new Date().toISOString()
        }
      };
      // Use a visible, user-friendly filename (no leading dot), and .txt extension
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').replace('Z', '');
      const filename = `biomap-audio-logs-${timestamp}.txt`;
      // Save as plain text for Android compatibility
      const logText = JSON.stringify(fullLog, null, 2);
      const blob = new Blob([logText], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      this.log('Logs saved successfully');
      return true;
    } catch (error) {
      console.error('Failed to save logs:', error);
      return false;
    }
  }

  static clearLogs() {
    this.logs = [];
  }
}

const AudioRecorder = ({
  userLocation,
  locationAccuracy,
  onSaveRecording,
  onCancel,
  isVisible = false,
  walkSessionId = null,
  onRecordingStart = null
}) => {
  // Remove all refs and state related to MediaRecorder, audioBlob, and web audio
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showMetadata, setShowMetadata] = useState(false);
  const [showDetailedFields, setShowDetailedFields] = useState(false);
  const [nativeRecordingPath, setNativeRecordingPath] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);

  const { position: dragPos, handlePointerDown: onDragStart } = useDraggable();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const recordingTimeRef = useRef(0);
  const stopRecordingRef = useRef<(() => void) | null>(null);
  const webMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const webChunksRef = useRef<Blob[]>([]);
  const webStreamRef = useRef<MediaStream | null>(null);

  // Dropdown options for standardized metadata
  const weatherOptions = [
    { value: '', label: 'Seleccionar...' },
    { value: 'sunny', label: '☀️ Soleado' },
    { value: 'cloudy', label: '☁️ Nublado' },
    { value: 'rainy', label: '🌧️ Lluvioso' },
    { value: 'stormy', label: '⛈️ Tormentoso' },
    { value: 'foggy', label: '🌫️ Niebla' },
    { value: 'windy', label: '💨 Ventoso' },
    { value: 'snowy', label: '❄️ Nevado' }
  ];

  const temperatureOptions = [
    { value: '', label: 'Seleccionar...' },
    { value: 'very_cold', label: '🥶 Muy frío (<0°C)' },
    { value: 'cold', label: '❄️ Frío (0-10°C)' },
    { value: 'cool', label: '🌤️ Fresco (10-20°C)' },
    { value: 'warm', label: '☀️ Cálido (20-30°C)' },
    { value: 'hot', label: '🔥 Caluroso (>30°C)' }
  ];

  const speciesOptions = [
    { value: 'bird', label: '🐦 Ave' },
    { value: 'mammal', label: '🦊 Mamífero' },
    { value: 'amphibian', label: '🐸 Anfibio' },
    { value: 'reptile', label: '🦎 Reptil' },
    { value: 'insect', label: '🦗 Insecto' },
    { value: 'water', label: '💧 Agua' },
    { value: 'wind', label: '🌬️ Viento' },
    { value: 'human', label: '👤 Humano' },
    { value: 'other', label: '❓ Otro' }
  ];

  const habitatOptions = [
    { value: '', label: 'Seleccionar...' },
    { value: 'forest', label: '🌳 Bosque' },
    { value: 'wetland', label: '🌊 Humedal' },
    { value: 'grassland', label: '🌾 Pastizal' },
    { value: 'riverside', label: '🏞️ Ribera' },
    { value: 'urban', label: '🏙️ Urbano' },
    { value: 'farmland', label: '🌱 Cultivo' },
    { value: 'paramo', label: '⛰️ Páramo' },
    { value: 'mangrove', label: '🌴 Manglar' },
    { value: 'cave', label: '🕳️ Cueva' }
  ];

  const heightPositionOptions = [
    { value: '', label: 'Seleccionar...' },
    { value: 'ground', label: '🦶 Suelo' },
    { value: 'understory', label: '🌿 Sotobosque' },
    { value: 'canopy', label: '🌲 Dosel' },
    { value: 'aerial', label: '🦅 Aéreo' },
    { value: 'subaquatic', label: '🐟 Subacuático' }
  ];

  const distanceOptions = [
    { value: '', label: 'Seleccionar...' },
    { value: 'very_close', label: '📏 <5m' },
    { value: 'close', label: '📏 5-20m' },
    { value: 'medium', label: '📏 20-50m' },
    { value: 'far', label: '📏 >50m' }
  ];

  const activityOptions = [
    { value: '', label: 'Seleccionar...' },
    { value: 'song', label: '🎵 Canto' },
    { value: 'alarm', label: '⚠️ Alarma' },
    { value: 'foraging', label: '🔍 Forrajeo' },
    { value: 'movement', label: '🏃 Desplazamiento' },
    { value: 'chorus', label: '🎶 Coro' },
    { value: 'unknown', label: '❓ Desconocido' }
  ];

  const anthropophonyOptions = [
    { value: '', label: 'Seleccionar...' },
    { value: 'none', label: '🤫 Ninguna' },
    { value: 'low', label: '🔈 Baja' },
    { value: 'medium', label: '🔉 Media' },
    { value: 'high', label: '🔊 Alta' }
  ];

  // Metadata form state - aligned with AudioService structure
  const [metadata, setMetadata] = useState({
    filename: '',
    notes: '',
    speciesTags: [] as string[],
    weather: '',
    temperature: '',
    quality: 'medium',
    habitat: '',
    heightPosition: '',
    distanceEstimate: '',
    activityType: '',
    anthropophony: ''
  });

  // Validation state
  const [validationErrors, setValidationErrors] = useState({});

  // Debug logging
  useEffect(() => {
    console.log('AudioRecorder props:', {
      userLocation,
      locationAccuracy,
      isVisible,
      onSaveRecording: typeof onSaveRecording,
      onCancel: typeof onCancel
    });
  }, [userLocation, locationAccuracy, isVisible, onSaveRecording, onCancel]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Validation — all fields optional now
  const validateMetadata = () => {
    setValidationErrors({});
    return true;
  };



  const generateFilename = () => {
    if (!userLocation) return 'recording';

    const lat = userLocation.lat.toFixed(4);
    const lng = userLocation.lng.toFixed(4);
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');

    // Clean filename from metadata
    let cleanFilename = metadata.filename.trim();
    if (cleanFilename) {
      cleanFilename = cleanFilename.replace(/[^a-zA-Z0-9\s-_]/g, '').replace(/\s+/g, '_');
      cleanFilename = cleanFilename.substring(0, 20); // Limit length
    } else {
      cleanFilename = 'recording';
    }

    const locationStr = `${lat}_${lng}`;

    // Get file extension based on MIME type
    const getFileExtension = (mimeType) => {
      if (mimeType?.includes('mp4')) return '.mp4';
      if (mimeType?.includes('webm')) return '.webm';
      if (mimeType?.includes('ogg')) return '.ogg';
      if (mimeType?.includes('wav')) return '.wav';
      return '.mp4'; // default fallback — cross-platform compatible
    };

    const webMime = webMediaRecorderRef.current?.mimeType || audioBlob?.type || null;
    const extension = getFileExtension(webMime);
    return `${cleanFilename}${locationStr}_${dateStr}_${timeStr}${extension}`;
  };

  // Remove getSupportedMimeType and all MediaRecorder logic

  // --- Native Capacitor Plugin Recording ---
  const startRecording = async () => {
    AudioLogger.log('startRecording called', { userLocation });
    if (!userLocation) {
      AudioLogger.error('No GPS location available');
      showAlert('Please wait for GPS location before recording');
      return;
    }
    try {
      // Use native plugin for Android/iOS
      if ((window as any).Capacitor?.isNativePlatform()) {
        AudioLogger.log('Using capacitor-voice-recorder plugin for recording');
        await VoiceRecorder.requestAudioRecordingPermission();
        await VoiceRecorder.startRecording();
        setIsRecording(true);
        setRecordingTime(0);

        // Auto-start derive session if not already active (derive owns breadcrumb tracking)
        onRecordingStart?.();

        // Start timer with 5-min auto-stop
        recordingTimeRef.current = 0;
        timerRef.current = setInterval(() => {
          recordingTimeRef.current += 1;
          const t = recordingTimeRef.current;
          setRecordingTime(t);
          if (t >= 300) {
            // Auto-stop at 5 minutes — called outside state updater
            stopRecordingRef.current?.();
          }
        }, 1000);
        return;
      }
      // Web fallback: use MediaRecorder API (Safari, Chrome, Firefox)
      AudioLogger.log('Using web MediaRecorder for recording');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      webStreamRef.current = stream;
      webChunksRef.current = [];

      // Pick best supported MIME type — prefer mp4 for Safari/iOS compatibility
      const mimeType = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg']
        .find(t => MediaRecorder.isTypeSupported(t)) || '';
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) webChunksRef.current.push(e.data);
      };
      webMediaRecorderRef.current = recorder;
      recorder.start(1000); // collect chunks every second
      setIsRecording(true);
      setRecordingTime(0);

      // Auto-start derive session if not already active (derive owns breadcrumb tracking)
      onRecordingStart?.();

      recordingTimeRef.current = 0;
      timerRef.current = setInterval(() => {
        recordingTimeRef.current += 1;
        const t = recordingTimeRef.current;
        setRecordingTime(t);
        if (t >= 300) {
          stopRecordingRef.current?.();
        }
      }, 1000);
    } catch (err) {
      AudioLogger.error('Failed to start recording', err);
      showAlert('Error al iniciar grabación: ' + (err?.message || err));
    }
  };

  const stopRecording = async () => {
    AudioLogger.log('stopRecording called');
    if ((window as any).Capacitor?.isNativePlatform()) {
      try {
        const result = await VoiceRecorder.stopRecording();
        AudioLogger.log('Native recording stopped', result);
        setIsRecording(false);
        if (timerRef.current) clearInterval(timerRef.current);
        recordingTimeRef.current = 0;
        setRecordingTime(0);

        if (result?.value?.path) {
          setNativeRecordingPath(result.value.path);
          setAudioBlob(null);
          setShowMetadata(true); // Show metadata form after recording
        } else if (result?.value?.recordDataBase64) {
          // Convert base64 to Blob
          const base64 = result.value.recordDataBase64;
          const mimeType = result.value.mimeType || 'audio/aac';
          const byteString = atob(base64);
          const ab = new ArrayBuffer(byteString.length);
          const ia = new Uint8Array(ab);
          for (let i = 0; i < byteString.length; i++) {
            ia[i] = byteString.charCodeAt(i);
          }
          const blob = new Blob([ab], { type: mimeType });
          setAudioBlob(blob);
          setNativeRecordingPath(null);
          setShowMetadata(true); // Show metadata form after recording
        } else {
          showAlert('No se guardó el archivo de audio.');
        }
      } catch (err) {
        AudioLogger.error('Failed to stop native recording', err);
        showAlert('Error al detener grabación: ' + (err?.message || err));
      }
      return;
    }
    // Web fallback: stop MediaRecorder
    const recorder = webMediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      AudioLogger.log('Stopping web MediaRecorder');
      return new Promise<void>((resolve) => {
        recorder.onstop = () => {
          setIsRecording(false);
          if (timerRef.current) clearInterval(timerRef.current);
          recordingTimeRef.current = 0;
          setRecordingTime(0);

          const chunks = webChunksRef.current;
          if (chunks.length > 0) {
            const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/mp4' });
            setAudioBlob(blob);
            setNativeRecordingPath(null);
            setShowMetadata(true);
          } else {
            showAlert('No se capturó audio.');
          }

          // Stop all mic tracks
          webStreamRef.current?.getTracks().forEach(t => t.stop());
          webStreamRef.current = null;
          webMediaRecorderRef.current = null;
          webChunksRef.current = [];
          resolve();
        };
        recorder.stop();
      });
    }
  };
  stopRecordingRef.current = stopRecording;

  const playRecording = () => {
    // Play from file path if available, otherwise from blob
    if (nativeRecordingPath && audioRef.current) {
      audioRef.current.src = nativeRecordingPath;
      audioRef.current.play();
      setIsPlaying(true);
      audioRef.current.onended = () => setIsPlaying(false);
    } else if (audioBlob && audioRef.current) {
      const url = URL.createObjectURL(audioBlob);
      audioRef.current.src = url;
      audioRef.current.play();
      setIsPlaying(true);
      audioRef.current.onended = () => {
        setIsPlaying(false);
        URL.revokeObjectURL(url);
      };
    }
  };

  const getAudioDuration = (audioBlobOrUrl) => {
    return new Promise((resolve) => {
      try {
        const audio = document.createElement('audio');
        audio.preload = 'metadata';
        audio.onloadedmetadata = () => {
          resolve(Number(audio.duration));
        };
        audio.onerror = () => {
          resolve(0);
        };
        if (audioBlobOrUrl instanceof Blob) {
          audio.src = URL.createObjectURL(audioBlobOrUrl);
        } else {
          audio.src = audioBlobOrUrl;
        }
      } catch (e) {
        resolve(0);
      }
    });
  };

  const validateAudioData = async (audioBlob, nativeRecordingPath) => {
    let hasValidAudio = false;
    let duration = recordingTime;
    let fileSize = 0;

    if (audioBlob && audioBlob.size > 0) {
      fileSize = audioBlob.size;
      // Check size limits early
      const maxSize = 12 * 1024 * 1024; // 12MB
      if (fileSize > maxSize) {
        const sizeMB = (fileSize / (1024 * 1024)).toFixed(1);
        throw new Error(`Audio file too large (${sizeMB}MB). Maximum size is 12MB. Please record a shorter audio clip.`);
      }

      hasValidAudio = true;
      duration = await getAudioDuration(audioBlob);
      AudioLogger.log('✅ Valid audio blob found:', fileSize, 'bytes, duration:', duration);
    } else if (nativeRecordingPath) {
      try {
        const { Filesystem } = await import('@capacitor/filesystem');
        const fileInfo = await Filesystem.stat({ path: nativeRecordingPath });
        fileSize = fileInfo.size;

        // Check size limits for native files too
        const maxSize = 12 * 1024 * 1024; // 12MB
        if (fileSize > maxSize) {
          const sizeMB = (fileSize / (1024 * 1024)).toFixed(1);
          throw new Error(`Audio file too large (${sizeMB}MB). Maximum size is 12MB. Please record a shorter audio clip.`);
        }

        if (fileSize > 0) {
          hasValidAudio = true;
          duration = await getAudioDuration(nativeRecordingPath);
          AudioLogger.log('✅ Valid native audio file found:', fileSize, 'bytes, duration:', duration);
        } else {
          AudioLogger.error('Native audio file is empty:', fileSize, 'bytes');
        }
      } catch (fileError) {
        if (fileError.message.includes('too large')) {
          throw fileError; // Re-throw size errors
        }
        AudioLogger.error('Failed to validate native audio file:', fileError);
        throw new Error(`Cannot access audio file: ${fileError.message}`);
      }
    }

    if (!hasValidAudio) {
      throw new Error('No valid audio data found. The recording may be incomplete or corrupted.');
    }

    // Validate duration
    if (!duration || duration <= 0) {
      AudioLogger.log('Warning: Could not determine audio duration, using recording time:', recordingTime);
      duration = recordingTime || 1;
    }

    // Minimum recording duration check
    if (duration < 1) {
      throw new Error('Recording is too short (less than 1 second). Please record for longer.');
    }

    return { hasValidAudio, duration, fileSize };
  };

  const handleSave = async () => {
    try {
      // Validate metadata first
      if (!validateMetadata()) {
        showAlert('Error de validación.');
        return;
      }

      // Auto-generate filename if empty
      if (!metadata.filename.trim()) {
        const now = new Date();
        const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
        metadata.filename = `rec_${timeStr}`;
      }

      // Validate that we have actual recording data
      if (!nativeRecordingPath && !audioBlob) {
        showAlert('No recording data found. Please record audio before saving.');
        return;
      }

      // Validate audio data with proper error handling
      const { duration, fileSize } = await validateAudioData(audioBlob, nativeRecordingPath);

      AudioLogger.log('Audio validation passed:', { duration, fileSize });
      if ((window as any).Capacitor?.isNativePlatform()) {
        // Save metadata and file path or blob
        const generatedFilename = generateFilename();

        // Get breadcrumb session data if available
        const currentSession = breadcrumbService.getCurrentSession();
        const breadcrumbs = breadcrumbService.getCurrentBreadcrumbs();

        const recordingMetadata = {
          uniqueId: `recording-${Date.now()}`,
          filename: generatedFilename,
          displayName: metadata.filename.trim(),
          timestamp: new Date().toISOString(),
          duration: Math.round(duration),
          fileSize: fileSize,
          mimeType: audioBlob?.type || 'audio/mp4',
          location: userLocation,
          speciesTags: metadata.speciesTags || [], // Already an array from multi-select
          notes: metadata.notes.trim(),
          quality: metadata.quality || 'medium',
          weather: metadata.weather || null,
          temperature: metadata.temperature || null,
          // Bioacoustic metadata
          habitat: metadata.habitat || null,
          heightPosition: metadata.heightPosition || null,
          distanceEstimate: metadata.distanceEstimate || null,
          activityType: metadata.activityType || null,
          anthropophony: metadata.anthropophony || null,
          // Auto-captured context
          altitude: userLocation?.altitude ?? null,
          gpsAccuracy: locationAccuracy ?? null,
          deviceModel: navigator.userAgent || null,
          // Add breadcrumb data
          breadcrumbSession: currentSession,
          breadcrumbs: breadcrumbs,
          movementPattern: breadcrumbs.length > 0 ? breadcrumbService.generateSessionSummary().pattern : 'unknown',
          // Walk session linking
          walkSessionId: walkSessionId || null
        };

        // --- Robust validation for required fields ---
        if (!recordingMetadata.location || typeof recordingMetadata.location.lat !== 'number' || !isFinite(recordingMetadata.location.lat) || typeof recordingMetadata.location.lng !== 'number' || !isFinite(recordingMetadata.location.lng)) {
          throw new Error('Recording location is missing or invalid. Please ensure GPS is available.');
        }
        if (!recordingMetadata.filename || !recordingMetadata.filename.trim()) {
          throw new Error('Filename is required.');
        }
        if (!recordingMetadata.timestamp) {
          throw new Error('Timestamp is missing.');
        }
        if (!recordingMetadata.duration || !isFinite(recordingMetadata.duration) || recordingMetadata.duration <= 0) {
          throw new Error('Duration is missing or invalid.');
        }
        // --- End robust validation ---

        const recordingData = {
          audioPath: nativeRecordingPath,
          audioBlob: audioBlob,
          metadata: recordingMetadata
        };

        // Call the save function
        onSaveRecording(recordingData);
        reset();
        return;
      }
      // Web fallback: save from audioBlob (MediaRecorder result)
      if (audioBlob) {
        const generatedFilename = generateFilename();
        const currentSession = breadcrumbService.getCurrentSession();
        const breadcrumbs = breadcrumbService.getCurrentBreadcrumbs();

        const recordingMetadata = {
          uniqueId: `recording-${Date.now()}`,
          filename: generatedFilename,
          displayName: metadata.filename.trim(),
          timestamp: new Date().toISOString(),
          duration: Math.round(duration),
          fileSize: fileSize,
          mimeType: audioBlob.type || 'audio/mp4',
          location: userLocation,
          speciesTags: metadata.speciesTags || [],
          notes: metadata.notes.trim(),
          quality: metadata.quality || 'medium',
          weather: metadata.weather || null,
          temperature: metadata.temperature || null,
          habitat: metadata.habitat || null,
          heightPosition: metadata.heightPosition || null,
          distanceEstimate: metadata.distanceEstimate || null,
          activityType: metadata.activityType || null,
          anthropophony: metadata.anthropophony || null,
          altitude: userLocation?.altitude ?? null,
          gpsAccuracy: locationAccuracy ?? null,
          deviceModel: navigator.userAgent || null,
          breadcrumbSession: currentSession,
          breadcrumbs: breadcrumbs,
          movementPattern: breadcrumbs.length > 0 ? breadcrumbService.generateSessionSummary().pattern : 'unknown',
          walkSessionId: walkSessionId || null
        };

        if (!recordingMetadata.location || typeof recordingMetadata.location.lat !== 'number' || !isFinite(recordingMetadata.location.lat) || typeof recordingMetadata.location.lng !== 'number' || !isFinite(recordingMetadata.location.lng)) {
          throw new Error('Recording location is missing or invalid. Please ensure GPS is available.');
        }

        onSaveRecording({ audioPath: null, audioBlob: audioBlob, metadata: recordingMetadata });
        reset();
        return;
      }
      throw new Error('No recording data available to save.');
    } catch (error) {
      AudioLogger.error('Failed to save recording:', error);
      showAlert(error.message || 'Error al guardar grabación. Intenta de nuevo.');
    }
  };

  const reset = () => {
    setNativeRecordingPath(null);
    setAudioBlob(null);
    setRecordingTime(0);
    setIsPlaying(false);
    setShowMetadata(false);
    setShowDetailedFields(false);
    setMetadata({
      filename: '',
      notes: '',
      speciesTags: [],
      weather: '',
      temperature: '',
      quality: 'medium',
      habitat: '',
      heightPosition: '',
      distanceEstimate: '',
      activityType: '',
      anthropophony: ''
    });
  };

  const handleCancel = () => {
    console.log('handleCancel called');
    reset();
    onCancel();
  };

  // Remove all useEffects and cleanup related to MediaRecorder, stream, and audioBlob

  // Optionally, add a listener for visibility changes to log them
  useEffect(() => {
    const handler = () => {
      AudioLogger.log('Document visibility changed', { hidden: document.hidden, visibilityState: document.visibilityState });
    };
    document.addEventListener('visibilitychange', handler);
    return () => { document.removeEventListener('visibilitychange', handler); };
  }, []);

  console.log('AudioRecorder rendering, isVisible:', isVisible);

  if (!isVisible) {
    console.log('AudioRecorder not visible, returning null');
    return null;
  }

  console.log('AudioRecorder rendering modal');

  return (
    <div style={{
      position: 'fixed',
      bottom: '190px',
      left: '50%',
      transform: `translate(calc(-50% + ${dragPos.x}px), ${dragPos.y}px)`,
      zIndex: 999999,
      pointerEvents: 'auto'
    }}>
      <div style={{
        backgroundColor: 'rgba(220,225,235,0.78)',
        borderRadius: '16px',
        boxShadow: 'rgba(78,78,134,0.25) 0px 10px 30px',
        padding: '14px',
        minWidth: '280px',
        maxWidth: '360px',
        width: '88vw',
        maxHeight: '65vh',
        overflow: 'auto',
        position: 'relative'
      }}>
        <div
          onPointerDown={onDragStart}
          style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '10px',
          cursor: 'grab',
          touchAction: 'none'
        }}>
          <h3 style={{
            fontSize: '15px',
            fontWeight: '600',
            color: 'rgb(1 9 2 / 84%)',
            margin: 0
          }}>
            {isRecording ? 'Grabando...' : (nativeRecordingPath || audioBlob) ? 'Revisar grabación' : 'Grabadora'}
          </h3>
          <button
            onClick={handleCancel}
            style={{
              color: '#6B7280',
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '4px'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Recording Status */}
        <div style={{ textAlign: 'center', marginBottom: '12px' }}>
          <div style={{
            fontSize: '20px',
            fontFamily: 'monospace',
            color: 'rgb(1 9 2 / 84%)',
            marginBottom: '4px'
          }}>
            {formatTime(recordingTime)}
          </div>

          {/* Time Warning */}
          {recordingTime > 0 && (
            <div style={{
              fontSize: '12px',
              color: recordingTime >= 270 ? '#c24a6e' : recordingTime >= 240 ? '#F59E0B' : '#6B7280',
              marginBottom: '4px'
            }}>
              {recordingTime >= 300 ? '⏹ Máximo 5 min alcanzado' :
                recordingTime >= 270 ? `⚠️ ${Math.floor((300 - recordingTime) / 60)}:${String((300 - recordingTime) % 60).padStart(2, '0')} restantes` :
                  `Máximo: 5 min`}
            </div>
          )}

          {isRecording && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}>
              <div style={{
                width: '12px',
                height: '12px',
                backgroundColor: recordingTime >= 270 ? '#c24a6e' : '#9dc04cd4',
                borderRadius: '50%',
                animation: 'pulse 1s infinite'
              }}></div>
              <span style={{
                fontSize: '14px',
                color: recordingTime >= 270 ? '#c24a6e' : '#6B7280'
              }}>
                {recordingTime >= 270 ? 'Se detendrá pronto' : 'Grabando...'}
              </span>
            </div>
          )}
        </div>

        {/* Controls */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '12px',
          marginBottom: '12px'
        }}>
          {!isRecording && !nativeRecordingPath && (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                startRecording();
              }}
              disabled={!userLocation}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '52px',
                height: '52px',
                backgroundColor: userLocation ? '#c24a6e' : '#9CA3AF',
                color: 'white',
                border: 'none',
                borderRadius: '50%',
                cursor: userLocation ? 'pointer' : 'not-allowed',
                transition: 'background-color 0.2s'
              }}
            >
              <Mic size={20} />
            </button>
          )}

          {isRecording && (
            <button
              onClick={stopRecording}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '52px',
                height: '52px',
                backgroundColor: '#4B5563',
                color: 'white',
                border: 'none',
                borderRadius: '50%',
                cursor: 'pointer',
                transition: 'background-color 0.2s'
              }}
            >
              <Square size={20} />
            </button>
          )}

          {(nativeRecordingPath || audioBlob) && !isRecording && (
            <button
              onClick={playRecording}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '40px',
                height: '40px',
                backgroundColor: '#4e4e86',
                color: 'white',
                border: 'none',
                borderRadius: '50%',
                cursor: 'pointer',
                transition: 'background-color 0.2s'
              }}
            >
              {isPlaying ? <Pause size={20} /> : <Play size={20} />}
            </button>
          )}
        </div>

        {/* Audio element for native playback */}
        {nativeRecordingPath && <audio ref={audioRef} style={{ display: 'none' }} />}
        {audioBlob && <audio ref={audioRef} style={{ display: 'none' }} />}

        {/* Location info */}
        {userLocation && (
          <div style={{
            fontSize: '11px',
            color: '#6B7280',
            textAlign: 'center',
            marginBottom: '8px'
          }}>
            📍 {userLocation.lat.toFixed(6)}, {userLocation.lng.toFixed(6)}
            {userLocation.altitude != null && ` · ${Math.round(userLocation.altitude)}m alt`}
            {locationAccuracy && ` · ±${Math.round(locationAccuracy)}m`}
          </div>
        )}

        {/* Metadata form */}
        {showMetadata && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {/* Default: just optional note */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: '500',
                color: 'rgb(1 9 2 / 84%)',
                marginBottom: '3px'
              }}>
                Nota (opcional)
              </label>
              <textarea
                value={metadata.notes}
                onChange={(e) => setMetadata({ ...metadata, notes: e.target.value })}
                placeholder="Describe brevemente el sonido..."
                rows={2}
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  border: '1px solid rgba(78,78,134,0.22)',
                  borderRadius: '6px',
                  fontSize: '13px',
                  outline: 'none',
                  resize: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Bioacoustic quick fields — always visible */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: 'rgb(1 9 2 / 84%)', marginBottom: '3px' }}>
                  Hábitat
                </label>
                <select
                  value={metadata.habitat}
                  onChange={(e) => setMetadata({ ...metadata, habitat: e.target.value })}
                  style={{ width: '100%', padding: '6px 8px', border: '1px solid rgba(78,78,134,0.22)', borderRadius: '6px', fontSize: '13px', outline: 'none', boxSizing: 'border-box', backgroundColor: 'white' }}
                >
                  {habitatOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: 'rgb(1 9 2 / 84%)', marginBottom: '3px' }}>
                  Estrato vertical
                </label>
                <select
                  value={metadata.heightPosition}
                  onChange={(e) => setMetadata({ ...metadata, heightPosition: e.target.value })}
                  style={{ width: '100%', padding: '6px 8px', border: '1px solid rgba(78,78,134,0.22)', borderRadius: '6px', fontSize: '13px', outline: 'none', boxSizing: 'border-box', backgroundColor: 'white' }}
                >
                  {heightPositionOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: 'rgb(1 9 2 / 84%)', marginBottom: '3px' }}>
                  Distancia
                </label>
                <select
                  value={metadata.distanceEstimate}
                  onChange={(e) => setMetadata({ ...metadata, distanceEstimate: e.target.value })}
                  style={{ width: '100%', padding: '6px 8px', border: '1px solid rgba(78,78,134,0.22)', borderRadius: '6px', fontSize: '13px', outline: 'none', boxSizing: 'border-box', backgroundColor: 'white' }}
                >
                  {distanceOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: 'rgb(1 9 2 / 84%)', marginBottom: '3px' }}>
                  Actividad
                </label>
                <select
                  value={metadata.activityType}
                  onChange={(e) => setMetadata({ ...metadata, activityType: e.target.value })}
                  style={{ width: '100%', padding: '6px 8px', border: '1px solid rgba(78,78,134,0.22)', borderRadius: '6px', fontSize: '13px', outline: 'none', boxSizing: 'border-box', backgroundColor: 'white' }}
                >
                  {activityOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>

            {/* Toggle for detailed fields */}
            <button
              onClick={() => setShowDetailedFields(!showDetailedFields)}
              style={{
                background: 'none',
                border: '1px solid rgba(78,78,134,0.22)',
                borderRadius: '6px',
                padding: '6px 12px',
                fontSize: '13px',
                color: '#6B7280',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px'
              }}
            >
              {showDetailedFields ? '▲ Menos detalles' : '▼ Más detalles'}
            </button>

            {/* Expanded detailed fields */}
            {showDetailedFields && (
            <>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: 'rgb(1 9 2 / 84%)', marginBottom: '3px' }}>
                Nombre del archivo
              </label>
              <input
                type="text"
                value={metadata.filename}
                onChange={(e) => setMetadata({ ...metadata, filename: e.target.value })}
                placeholder="rec_HH-MM-SS (auto si vacío)"
                style={{ width: '100%', padding: '6px 8px', border: '1px solid rgba(78,78,134,0.22)', borderRadius: '6px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: 'rgb(1 9 2 / 84%)', marginBottom: '3px' }}>
                  Clima
                </label>
                <select
                  value={metadata.weather}
                  onChange={(e) => setMetadata({ ...metadata, weather: e.target.value })}
                  style={{ width: '100%', padding: '6px 8px', border: '1px solid rgba(78,78,134,0.22)', borderRadius: '6px', fontSize: '13px', outline: 'none', boxSizing: 'border-box', backgroundColor: 'white' }}
                >
                  {weatherOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: 'rgb(1 9 2 / 84%)', marginBottom: '3px' }}>
                  Temperatura
                </label>
                <select
                  value={metadata.temperature}
                  onChange={(e) => setMetadata({ ...metadata, temperature: e.target.value })}
                  style={{ width: '100%', padding: '6px 8px', border: '1px solid rgba(78,78,134,0.22)', borderRadius: '6px', fontSize: '13px', outline: 'none', boxSizing: 'border-box', backgroundColor: 'white' }}
                >
                  {temperatureOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: 'rgb(1 9 2 / 84%)', marginBottom: '3px' }}>
                  Ruido humano
                </label>
                <select
                  value={metadata.anthropophony}
                  onChange={(e) => setMetadata({ ...metadata, anthropophony: e.target.value })}
                  style={{ width: '100%', padding: '6px 8px', border: '1px solid rgba(78,78,134,0.22)', borderRadius: '6px', fontSize: '13px', outline: 'none', boxSizing: 'border-box', backgroundColor: 'white' }}
                >
                  {anthropophonyOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '8px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: 'rgb(1 9 2 / 84%)', marginBottom: '4px' }}>
                  Especies
                </label>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '4px',
                  maxHeight: '120px',
                  overflowY: 'auto',
                  padding: '6px',
                  border: '1px solid rgba(78,78,134,0.22)',
                  borderRadius: '6px',
                  backgroundColor: '#F9FAFB'
                }}>
                  {speciesOptions.map(option => (
                    <label
                      key={option.value}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '12px',
                        cursor: 'pointer',
                        padding: '2px'
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={metadata.speciesTags.includes(option.value)}
                        onChange={(e) => {
                          const newTags = e.target.checked
                            ? [...metadata.speciesTags, option.value]
                            : metadata.speciesTags.filter(tag => tag !== option.value);
                          setMetadata({ ...metadata, speciesTags: newTags });
                        }}
                        style={{
                          cursor: 'pointer'
                        }}
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: 'rgb(1 9 2 / 84%)', marginBottom: '3px' }}>
                  Calidad
                </label>
                <select
                  value={metadata.quality}
                  onChange={(e) => setMetadata({ ...metadata, quality: e.target.value })}
                  style={{ width: '100%', padding: '6px 8px', border: '1px solid rgba(78,78,134,0.22)', borderRadius: '6px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                >
                  <option value="low">Baja</option>
                  <option value="medium">Media</option>
                  <option value="high">Alta</option>
                </select>
              </div>
            </div>
            </>
            )}

            <div style={{ display: 'flex', gap: '8px', paddingTop: '10px' }}>
              <button
                onClick={handleSave}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  backgroundColor: '#9dc04cd4',
                  color: 'white',
                  padding: '7px 12px',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  transition: 'background-color 0.2s'
                }}
              >
                <Save size={14} />
                <span>Guardar</span>
              </button>
              <button
                onClick={reset}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '7px 12px',
                  border: '1px solid rgba(78,78,134,0.22)',
                  borderRadius: '6px',
                  color: 'rgb(1 9 2 / 84%)',
                  backgroundColor: 'white',
                  cursor: 'pointer',
                  fontSize: '13px',
                  transition: 'background-color 0.2s'
                }}
              >
                Re-grabar
              </button>
            </div>
          </div>
        )}

        {!userLocation && (
          <div style={{
            textAlign: 'center',
            fontSize: '12px',
            color: '#D97706',
            backgroundColor: '#FEF3C7',
            borderRadius: '6px',
            padding: '6px'
          }}>
            Esperando ubicación GPS...
          </div>
        )}
      </div>

      <style>
        {`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
        `}
      </style>
    </div>
  );
};

export default AudioRecorder;