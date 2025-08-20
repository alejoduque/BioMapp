import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Play, Pause, Save, X } from 'lucide-react';
import audioService from './audioService.js';
import { VoiceRecorder } from 'capacitor-voice-recorder';
import breadcrumbService from './breadcrumbService.js';

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
  isVisible = false 
}) => {
  // Remove all refs and state related to MediaRecorder, audioBlob, and web audio
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showMetadata, setShowMetadata] = useState(false);
  const [showLogViewer, setShowLogViewer] = useState(false);
  const [logText, setLogText] = useState('');
  const [nativeRecordingPath, setNativeRecordingPath] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Metadata form state - aligned with AudioService structure
  const [metadata, setMetadata] = useState({
    filename: '',
    notes: '',
    speciesTags: '',
    weather: '',
    temperature: '',
    quality: 'medium'
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

  // Validation functions
  const validateMetadata = () => {
    const errors: { [key: string]: string } = {};
    
    if (!metadata.filename.trim()) {
      errors.filename = 'Filename is required';
    }
    
    if (!metadata.notes.trim()) {
      errors.notes = 'Description is required';
    }
    
    if (!metadata.temperature.trim()) {
      errors.temperature = 'Temperature is required';
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
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
      if (mimeType?.includes('webm')) return '.webm';
      if (mimeType?.includes('mp4')) return '.mp4';
      if (mimeType?.includes('ogg')) return '.ogg';
      if (mimeType?.includes('wav')) return '.wav';
      return '.webm'; // default fallback
    };
    
    const extension = getFileExtension(null); // No web MIME type to check here
    return `${cleanFilename}${locationStr}_${dateStr}_${timeStr}${extension}`;
  };

  // Remove getSupportedMimeType and all MediaRecorder logic

  // --- Native Capacitor Plugin Recording ---
  const startRecording = async () => {
    AudioLogger.log('startRecording called', { userLocation });
    if (!userLocation) {
      AudioLogger.error('No GPS location available');
      alert('Please wait for GPS location before recording');
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
        
        // Start breadcrumb tracking
        const sessionId = `recording_${Date.now()}`;
        await breadcrumbService.startTracking(sessionId, userLocation);
        
        // Start timer
        timerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000);
        return;
      }
      // No fallback for Android: show error
      AudioLogger.log('Native plugin not available, cannot record on this platform.');
      alert('Native audio recording is not available on this platform.');
    } catch (err) {
      AudioLogger.error('Failed to start native recording', err);
      alert('Failed to start recording: ' + (err?.message || err));
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
        setRecordingTime(0);
        
        // Stop breadcrumb tracking and get session data
        const breadcrumbSession = breadcrumbService.stopTracking();
        console.log('Breadcrumb session completed:', breadcrumbSession);
        
        if (result?.value?.recordDataBase64) {
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
        } else if (result?.value?.path) {
          // Fallback: if only path is provided, keep old behavior
          setNativeRecordingPath(result.value.path);
          setAudioBlob(null);
          setShowMetadata(true);
        } else {
          alert('No audio file was saved.');
        }
      } catch (err) {
        AudioLogger.error('Failed to stop native recording', err);
        alert('Failed to stop recording: ' + (err?.message || err));
      }
      return;
    }
    // No fallback for Android: show error
    AudioLogger.log('Native plugin not available, cannot stop recording on this platform.');
  };

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

  const handleSave = async () => {
    // Validate metadata first
    if (!validateMetadata()) {
      alert('Please fill in all required fields: Filename, Description, and Temperature.');
      return;
    }
    
    // Validate that we have actual recording data
    if (!nativeRecordingPath && !audioBlob) {
      alert('No recording data found. Please record audio before saving.');
      return;
    }
    
    // Validate audio data quality
    let hasValidAudio = false;
    let duration = recordingTime;
    
    if (audioBlob && audioBlob.size > 0) {
      hasValidAudio = true;
      duration = await getAudioDuration(audioBlob);
      AudioLogger.log('✅ Valid audio blob found:', audioBlob.size, 'bytes, duration:', duration);
    } else if (nativeRecordingPath) {
      try {
        const { Filesystem } = await import('@capacitor/filesystem');
        const fileInfo = await Filesystem.stat({ path: nativeRecordingPath });
        if (fileInfo.size > 0) {
          hasValidAudio = true;
          duration = await getAudioDuration(nativeRecordingPath);
          AudioLogger.log('✅ Valid native audio file found:', fileInfo.size, 'bytes, duration:', duration);
        } else {
          AudioLogger.error('Native audio file is empty:', fileInfo.size, 'bytes');
        }
      } catch (fileError) {
        AudioLogger.error('Failed to validate native audio file:', fileError);
      }
    }
    
    if (!hasValidAudio) {
      alert('No valid audio data found. The recording may be incomplete or corrupted. Please try recording again.');
      return;
    }
    
    // Validate duration
    if (!duration || duration <= 0) {
      AudioLogger.log('Warning: Could not determine audio duration, defaulting to 10s');
      duration = 10;
    }
    
    // Minimum recording duration check
    if (duration < 1) {
      alert('Recording is too short (less than 1 second). Please record for longer.');
      return;
    }
    if ((window as any).Capacitor?.isNativePlatform()) {
        if (!nativeRecordingPath && !audioBlob) {
        alert('No recording to save.');
        return;
      }
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
        fileSize: null, // You can get this with Filesystem plugin if needed
        mimeType: 'audio/m4a', // Default for plugin
        location: userLocation,
        speciesTags: metadata.speciesTags ? metadata.speciesTags.split(',').map(tag => tag.trim()) : [],
        notes: metadata.notes.trim(),
        quality: metadata.quality || 'medium',
        weather: metadata.weather || null,
        temperature: metadata.temperature.trim(),
        // Add breadcrumb data
        breadcrumbSession: currentSession,
        breadcrumbs: breadcrumbs,
        movementPattern: breadcrumbs.length > 0 ? breadcrumbService.generateSessionSummary().pattern : 'unknown'
      };
      // --- Robust validation for required fields ---
      if (!recordingMetadata.location || typeof recordingMetadata.location.lat !== 'number' || !isFinite(recordingMetadata.location.lat) || typeof recordingMetadata.location.lng !== 'number' || !isFinite(recordingMetadata.location.lng)) {
        alert('Recording location is missing or invalid. Please ensure GPS is available.');
        return;
      }
      if (!recordingMetadata.filename || !recordingMetadata.filename.trim()) {
        alert('Filename is required.');
        return;
      }
      if (!recordingMetadata.timestamp) {
        alert('Timestamp is missing.');
        return;
      }
      if (!recordingMetadata.duration || !isFinite(recordingMetadata.duration) || recordingMetadata.duration <= 0) {
        alert('Duration is missing or invalid.');
        return;
      }
      // --- End robust validation ---
      // Prefer webm blobs for consistent playback/storage
      const recordingData = {
        audioPath: nativeRecordingPath,
        audioBlob: audioBlob,
        metadata: {
          ...recordingMetadata,
          // If we have a blob, force filename extension to .webm for consistency
          filename: audioBlob ? recordingMetadata.filename.replace(/\.[^.]+$/, '') + '.webm' : recordingMetadata.filename,
          mimeType: audioBlob ? 'audio/webm' : recordingMetadata.mimeType
        }
      };
      onSaveRecording(recordingData);
      reset();
      return;
    }
    // No fallback for Android: show error
    alert('Native audio recording is not available on this platform.');
  };

  const reset = () => {
    setNativeRecordingPath(null);
    setAudioBlob(null);
    setRecordingTime(0);
    setIsPlaying(false);
    setShowMetadata(false);
    setMetadata({
      filename: '',
      notes: '',
      speciesTags: '',
      weather: '',
      temperature: '',
      quality: 'medium'
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
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      width: '100vw',
      height: '100vh',
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 999999,
      pointerEvents: 'auto'
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.3)',
        padding: '24px',
        maxWidth: '400px',
        width: '90%',
        maxHeight: '90vh',
        overflow: 'auto',
        position: 'relative',
        zIndex: 1000000
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px'
        }}>
          <h3 style={{
            fontSize: '18px',
            fontWeight: '600',
            color: '#374151',
            margin: 0
          }}>
            {isRecording ? 'Recording...' : nativeRecordingPath ? 'Review Recording' : 'Audio Recorder'}
          </h3>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={async () => {
                const success = await AudioLogger.saveLogs();
                if (success) {
                  alert('Audio logs saved successfully! Check your downloads folder.');
                } else {
                  alert('Failed to save logs. Check console for details.');
                }
              }}
              style={{
                color: '#6B7280',
                backgroundColor: 'transparent',
                border: '1px solid #D1D5DB',
                borderRadius: '4px',
                cursor: 'pointer',
                padding: '4px 8px',
                fontSize: '12px'
              }}
              title="Save audio debug logs"
            >
              Save Logs
            </button>
            <button
              onClick={() => {
                setLogText(JSON.stringify({
                  deviceInfo: AudioLogger.getDeviceInfo(),
                  logs: AudioLogger.logs,
                  summary: {
                    totalLogs: AudioLogger.logs.length,
                    errorCount: AudioLogger.logs.filter(log => log.includes('ERROR:')).length,
                    timestamp: new Date().toISOString()
                  }
                }, null, 2));
                setShowLogViewer(true);
              }}
              style={{
                color: '#2563EB',
                backgroundColor: 'transparent',
                border: '1px solid #93C5FD',
                borderRadius: '4px',
                cursor: 'pointer',
                padding: '4px 8px',
                fontSize: '12px'
              }}
              title="Show audio debug logs for copy-paste"
            >
              Show Logs
            </button>
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
              <X size={20} />
            </button>
          </div>
        </div>

        {showLogViewer && (
          <div style={{ margin: '16px 0' }}>
            <label style={{ fontWeight: 600, color: '#374151', marginBottom: 4, display: 'block' }}>Audio Debug Log (copy below):</label>
            <textarea
              value={logText}
              readOnly
              style={{ width: '100%', minHeight: 200, fontFamily: 'monospace', fontSize: 12, color: '#111827', background: '#F3F4F6', border: '1px solid #D1D5DB', borderRadius: 4, padding: 8, marginBottom: 8 }}
              onFocus={e => e.target.select()}
            />
            <button
              onClick={() => setShowLogViewer(false)}
              style={{ color: '#EF4444', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 14 }}
            >
              Close Log Viewer
            </button>
          </div>
        )}

        {/* Recording Status */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{
            fontSize: '24px',
            fontFamily: 'monospace',
            color: '#374151',
            marginBottom: '8px'
          }}>
            {formatTime(recordingTime)}
          </div>
          
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
                backgroundColor: '#EF4444',
                borderRadius: '50%',
                animation: 'pulse 1s infinite'
              }}></div>
              <span style={{ fontSize: '14px', color: '#6B7280' }}>Recording in progress</span>
            </div>
          )}
        </div>

        {/* Controls */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '16px',
          marginBottom: '24px'
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
                width: '64px',
                height: '64px',
                backgroundColor: userLocation ? '#EF4444' : '#9CA3AF',
                color: 'white',
                border: 'none',
                borderRadius: '50%',
                cursor: userLocation ? 'pointer' : 'not-allowed',
                transition: 'background-color 0.2s'
              }}
            >
              <Mic size={24} />
            </button>
          )}

          {isRecording && (
            <button
              onClick={stopRecording}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '64px',
                height: '64px',
                backgroundColor: '#4B5563',
                color: 'white',
                border: 'none',
                borderRadius: '50%',
                cursor: 'pointer',
                transition: 'background-color 0.2s'
              }}
            >
              <Square size={24} />
            </button>
          )}

          {nativeRecordingPath && (
            <button
              onClick={playRecording}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '48px',
                height: '48px',
                backgroundColor: '#3B82F6',
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
            fontSize: '12px',
            color: '#6B7280',
            textAlign: 'center',
            marginBottom: '16px'
          }}>
            📍 GPS: {userLocation.lat.toFixed(6)}, {userLocation.lng.toFixed(6)}
            {locationAccuracy && ` (±${Math.round(locationAccuracy)}m)`}
          </div>
        )}

        {/* Metadata form */}
        {showMetadata && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '4px'
              }}>
                Filename *
              </label>
              <input
                type="text"
                value={metadata.filename}
                onChange={(e) => {
                  setMetadata({...metadata, filename: e.target.value});
                  if (validationErrors.filename) {
                    setValidationErrors({...validationErrors, filename: ''});
                  }
                }}
                placeholder="Recording name"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: validationErrors.filename ? '1px solid #EF4444' : '1px solid #D1D5DB',
                  borderRadius: '6px',
                  fontSize: '14px',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
              {validationErrors.filename && (
                <div style={{
                  fontSize: '12px',
                  color: '#EF4444',
                  marginTop: '4px'
                }}>
                  {validationErrors.filename}
                </div>
              )}
            </div>

            <div>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '4px'
              }}>
                Description *
              </label>
              <textarea
                value={metadata.notes}
                onChange={(e) => {
                  setMetadata({...metadata, notes: e.target.value});
                  if (validationErrors.notes) {
                    setValidationErrors({...validationErrors, notes: ''});
                  }
                }}
                placeholder="What sounds did you record?"
                rows={2}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: validationErrors.notes ? '1px solid #EF4444' : '1px solid #D1D5DB',
                  borderRadius: '6px',
                  fontSize: '14px',
                  outline: 'none',
                  resize: 'none',
                  boxSizing: 'border-box'
                }}
              />
              {validationErrors.notes && (
                <div style={{
                  fontSize: '12px',
                  color: '#EF4444',
                  marginTop: '4px'
                }}>
                  {validationErrors.notes}
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#374151',
                  marginBottom: '4px'
                }}>
                  Weather
                </label>
                <input
                  type="text"
                  value={metadata.weather}
                  onChange={(e) => setMetadata({...metadata, weather: e.target.value})}
                  placeholder="Sunny, rainy..."
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #D1D5DB',
                    borderRadius: '6px',
                    fontSize: '14px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#374151',
                  marginBottom: '4px'
                }}>
                  Temperature *
                </label>
                <input
                  type="text"
                  value={metadata.temperature}
                  onChange={(e) => {
                    setMetadata({...metadata, temperature: e.target.value});
                    if (validationErrors.temperature) {
                      setValidationErrors({...validationErrors, temperature: ''});
                    }
                  }}
                  placeholder="25°C"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: validationErrors.temperature ? '1px solid #EF4444' : '1px solid #D1D5DB',
                    borderRadius: '6px',
                    fontSize: '14px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
                {validationErrors.temperature && (
                  <div style={{
                    fontSize: '12px',
                    color: '#EF4444',
                    marginTop: '4px'
                  }}>
                    {validationErrors.temperature}
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#374151',
                  marginBottom: '4px'
                }}>
                  Species Tags
                </label>
                <input
                  type="text"
                  value={metadata.speciesTags}
                  onChange={(e) => setMetadata({...metadata, speciesTags: e.target.value})}
                  placeholder="bird, frog, insect (comma separated)"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #D1D5DB',
                    borderRadius: '6px',
                    fontSize: '14px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#374151',
                  marginBottom: '4px'
                }}>
                  Quality
                </label>
                <select
                  value={metadata.quality}
                  onChange={(e) => setMetadata({...metadata, quality: e.target.value})}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #D1D5DB',
                    borderRadius: '6px',
                    fontSize: '14px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', paddingTop: '16px' }}>
              <button
                onClick={handleSave}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  backgroundColor: '#10B981',
                  color: 'white',
                  padding: '8px 16px',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  transition: 'background-color 0.2s'
                }}
              >
                <Save size={16} />
                <span>Save Recording</span>
              </button>
              <button
                onClick={reset}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '8px 16px',
                  border: '1px solid #D1D5DB',
                  borderRadius: '6px',
                  color: '#374151',
                  backgroundColor: 'white',
                  cursor: 'pointer',
                  fontSize: '14px',
                  transition: 'background-color 0.2s'
                }}
              >
                Re-record
              </button>
            </div>
          </div>
        )}

        {!userLocation && (
          <div style={{
            textAlign: 'center',
            fontSize: '14px',
            color: '#D97706',
            backgroundColor: '#FEF3C7',
            borderRadius: '6px',
            padding: '8px'
          }}>
            ⚠️ Waiting for GPS location...
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