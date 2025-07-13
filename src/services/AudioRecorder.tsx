import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Play, Pause, Save, X } from 'lucide-react';

const AudioRecorder = ({ 
  userLocation, 
  locationAccuracy, 
  onSaveRecording, 
  onCancel,
  isVisible = false 
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showMetadata, setShowMetadata] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
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
  const [validationErrors, setValidationErrors] = useState<{ [key: string]: string }>({});

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

  // Generate filename based on location, user input, and date
  const generateFilename = () => {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-'); // HH-MM-SS
    
    // Clean the user-provided filename
    const cleanFilename = metadata.filename.trim().replace(/[^a-zA-Z0-9\s-_]/g, '').replace(/\s+/g, '_');
    
    // Get location info if available
    let locationStr = '';
    if (userLocation) {
      const lat = userLocation.lat.toFixed(4);
      const lng = userLocation.lng.toFixed(4);
      locationStr = `_${lat}_${lng}`;
    }
    
    // Get file extension based on MIME type
    const getFileExtension = (mimeType) => {
      if (mimeType?.includes('webm')) return '.webm';
      if (mimeType?.includes('mp4')) return '.mp4';
      if (mimeType?.includes('ogg')) return '.ogg';
      if (mimeType?.includes('wav')) return '.wav';
      return '.webm'; // default fallback
    };
    
    const extension = getFileExtension(mediaRecorderRef.current?.mimeType);
    return `${cleanFilename}${locationStr}_${dateStr}_${timeStr}${extension}`;
  };

  // Helper function to get supported MIME type
  const getSupportedMimeType = () => {
    const mimeTypes = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/ogg;codecs=opus',
      'audio/wav'
    ];
    
    console.log('Checking supported MIME types...');
    for (const mimeType of mimeTypes) {
      const isSupported = MediaRecorder.isTypeSupported(mimeType);
      console.log(`${mimeType}: ${isSupported ? 'SUPPORTED' : 'NOT SUPPORTED'}`);
      if (isSupported) {
        console.log('Using MIME type:', mimeType);
        return mimeType;
      }
    }
    
    console.warn('No supported MIME type found, using default');
    return null; // Let MediaRecorder choose default
  };

  const startRecording = async () => {
    console.log('startRecording called, userLocation:', userLocation);
    
    if (!userLocation) {
      alert('Please wait for GPS location before recording');
      return;
    }

    try {
      console.log('Requesting microphone access...');
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          sampleRate: 44100,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
        }
      });

      console.log('Microphone access granted');
      streamRef.current = stream;
      chunksRef.current = [];

      const mimeType = getSupportedMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        console.log('Recording stopped');
        const mimeType = mediaRecorderRef.current?.mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: mimeType });
        setAudioBlob(blob);
        
        // Stop all tracks
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (error) {
      console.error('Recording error:', error);
      alert(`Could not start recording: ${error.message}`);
    }
  };

  const stopRecording = () => {
    console.log('stopRecording called');
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      
      setShowMetadata(true);
    }
  };

  const playRecording = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleSave = () => {
    if (!audioBlob) return;

    // Validate required fields
    if (!validateMetadata()) {
      return;
    }

    // Generate proper filename
    const generatedFilename = generateFilename();

    // Create metadata object that matches AudioService structure
    const recordingMetadata = {
      uniqueId: `recording-${Date.now()}`,
      filename: generatedFilename,
      displayName: metadata.filename.trim(), // Keep original user input for display
      timestamp: new Date().toISOString(),
      duration: recordingTime,
      fileSize: audioBlob.size,
      mimeType: audioBlob.type,
      location: userLocation,
      speciesTags: metadata.speciesTags ? metadata.speciesTags.split(',').map(tag => tag.trim()) : [],
      notes: metadata.notes.trim(),
      quality: metadata.quality || 'medium',
      weather: metadata.weather || null,
      temperature: metadata.temperature.trim()
    };

    const recordingData = {
      audioBlob: audioBlob,
      metadata: recordingMetadata
    };

    onSaveRecording(recordingData);
    reset();
  };

  const reset = () => {
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

  useEffect(() => {
    if (audioBlob && audioRef.current) {
      const url = URL.createObjectURL(audioBlob);
      audioRef.current.src = url;
      audioRef.current.onended = () => setIsPlaying(false);
      return () => URL.revokeObjectURL(url);
    }
  }, [audioBlob]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
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
            {isRecording ? 'Recording...' : audioBlob ? 'Review Recording' : 'Audio Recorder'}
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
            <X size={20} />
          </button>
        </div>

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
          {!isRecording && !audioBlob && (
            <button
              onClick={startRecording}
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

          {audioBlob && (
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

        {/* Audio element */}
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