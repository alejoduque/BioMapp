import React, { useState, useEffect } from 'react';
import microphonePermissionService from '../services/microphonePermissionService.js';

const MicrophonePermissionModal = ({ isVisible, onPermissionGranted, onPermissionDenied, onClose }) => {
  const [isRequesting, setIsRequesting] = useState(false);
  const [error, setError] = useState(null);
  const [micStatus, setMicStatus] = useState(null);

  useEffect(() => {
    if (isVisible) {
      checkMicrophoneStatus();
    }
  }, [isVisible]);

  const checkMicrophoneStatus = async () => {
    try {
      const status = await microphonePermissionService.getMicrophoneStatus();
      setMicStatus(status);
      console.log('Microphone status checked:', status);
    } catch (error) {
      console.error('Error checking microphone status:', error);
      setError('Could not check microphone status');
    }
  };

  const handleRequestPermission = async () => {
    setIsRequesting(true);
    setError(null);
    
    try {
      console.log('Requesting microphone permission...');
      const granted = await microphonePermissionService.requestMicrophonePermission();
      
      if (granted) {
        console.log('Microphone permission granted');
        onPermissionGranted();
      } else {
        console.log('Microphone permission denied');
        setError('Microphone permission was denied. Please allow microphone access in your device settings to record audio.');
      }
    } catch (error) {
      console.error('Error requesting microphone permission:', error);
      setError(error.message || 'Failed to request microphone permission');
    } finally {
      setIsRequesting(false);
    }
  };

  const handleDenyPermission = () => {
    console.log('User denied microphone permission');
    onPermissionDenied('Microphone permission denied by user');
  };

  const handleClose = () => {
    console.log('Microphone permission modal closed');
    onClose();
  };

  if (!isVisible) {
    return null;
  }

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
        padding: '24px',
        maxWidth: '400px',
        margin: '16px',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        position: 'relative'
      }}>
        {/* Close button */}
        <button
          onClick={handleClose}
          style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            background: 'none',
            border: 'none',
            fontSize: '20px',
            cursor: 'pointer',
            color: '#666',
            zIndex: 10002
          }}
        >
          ×
        </button>

        <div style={{ textAlign: 'center' }}>
          {/* Microphone icon */}
          <div style={{
            margin: '0 auto 16px',
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            backgroundColor: '#FEF3C7',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              <line x1="12" y1="19" x2="12" y2="23"/>
              <line x1="8" y1="23" x2="16" y2="23"/>
            </svg>
          </div>
          
          <h3 style={{
            fontSize: '18px',
            fontWeight: '600',
            color: '#111827',
            marginBottom: '8px'
          }}>
            Microphone Access Required
          </h3>
          
          <p style={{
            fontSize: '14px',
            color: '#6B7280',
            marginBottom: '24px',
            lineHeight: '1.5'
          }}>
            This app needs access to your microphone to record audio for the MANAKAI Natural Reserve biodiversity study.
          </p>

          {/* Microphone status */}
          {micStatus && (
            <div style={{
              backgroundColor: '#F3F4F6',
              borderRadius: '6px',
              padding: '12px',
              marginBottom: '16px',
              textAlign: 'left'
            }}>
              <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '4px' }}>
                Microphone Status:
              </div>
              <div style={{ fontSize: '14px', color: '#374151' }}>
                <div>• Available: {micStatus.available ? '✅ Yes' : '❌ No'}</div>
                <div>• Permission: {micStatus.hasPermission ? '✅ Granted' : '❌ Not granted'}</div>
                <div>• Can Record: {micStatus.canRecord ? '✅ Yes' : '❌ No'}</div>
              </div>
            </div>
          )}

          {error && (
            <div style={{
              backgroundColor: '#FEF2F2',
              border: '1px solid #FECACA',
              borderRadius: '6px',
              padding: '12px',
              marginBottom: '16px'
            }}>
              <p style={{ fontSize: '14px', color: '#DC2626', margin: 0 }}>{error}</p>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button
              onClick={handleRequestPermission}
              disabled={isRequesting || (micStatus && !micStatus.available)}
              style={{
                backgroundColor: micStatus && !micStatus.available ? '#9CA3AF' : '#EF4444',
                color: 'white',
                border: 'none',
                padding: '12px 24px',
                borderRadius: '6px',
                cursor: micStatus && !micStatus.available ? 'not-allowed' : 'pointer',
                fontSize: '16px',
                fontWeight: '600',
                transition: 'background-color 0.2s'
              }}
            >
              {isRequesting ? 'Requesting...' : 'Allow Microphone Access'}
            </button>
            
            <button
              onClick={handleDenyPermission}
              disabled={isRequesting}
              style={{
                backgroundColor: '#6B7280',
                color: 'white',
                border: 'none',
                padding: '12px 24px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: '600',
                transition: 'background-color 0.2s'
              }}
            >
              Deny Access
            </button>
          </div>

          <p style={{
            fontSize: '12px',
            color: '#9CA3AF',
            marginTop: '16px',
            marginBottom: 0
          }}>
            You can change this permission later in your device settings.
          </p>
        </div>
      </div>
    </div>
  );
};

export default MicrophonePermissionModal; 