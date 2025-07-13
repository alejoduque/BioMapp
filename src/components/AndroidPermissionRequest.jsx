import React, { useState, useEffect } from 'react';
import permissionService from '../services/permissionService.js';

const AndroidPermissionRequest = ({ onPermissionsGranted, onPermissionsDenied }) => {
  const [permissionStatus, setPermissionStatus] = useState({
    location: 'unknown',
    microphone: 'unknown'
  });
  const [isRequesting, setIsRequesting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    checkPermissions();
  }, []);

  const checkPermissions = async () => {
    try {
      const status = await permissionService.checkAllPermissions();
      setPermissionStatus(status);
      
      if (status.allGranted) {
        onPermissionsGranted();
      }
    } catch (error) {
      console.error('Error checking permissions:', error);
      setError('Failed to check permissions');
    }
  };

  const requestAllPermissions = async () => {
    setIsRequesting(true);
    setError(null);
    
    try {
      const result = await permissionService.requestAllPermissions();
      
      setPermissionStatus({
        location: result.location.granted ? 'granted' : 'denied',
        microphone: result.microphone.granted ? 'granted' : 'denied'
      });
      
      if (result.allGranted) {
        onPermissionsGranted();
      } else {
        setError('Some permissions were denied. The app may not work properly.');
      }
    } catch (error) {
      console.error('Error requesting permissions:', error);
      setError('Failed to request permissions');
    } finally {
      setIsRequesting(false);
    }
  };

  const handleContinueAnyway = () => {
    onPermissionsGranted();
  };

  const handleDeny = () => {
    onPermissionsDenied('Permissions denied by user');
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.9)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 999999,
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '24px',
        maxWidth: '400px',
        width: '100%',
        textAlign: 'center',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.3)'
      }}>
        <div style={{
          width: '64px',
          height: '64px',
          backgroundColor: '#3B82F6',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 16px'
        }}>
          <svg width="32" height="32" fill="white" viewBox="0 0 24 24">
            <path d="M12 2C13.1 2 14 2.9 14 4C14 5.1 13.1 6 12 6C10.9 6 10 5.1 10 4C10 2.9 10.9 2 12 2M21 9V7L15 1H5C3.89 1 3 1.89 3 3V21C3 22.11 3.89 23 5 23H19C20.11 23 21 22.11 21 21V9M19 9H14V4H5V21H19V9Z"/>
          </svg>
        </div>

        <h2 style={{
          fontSize: '20px',
          fontWeight: 'bold',
          color: '#1F2937',
          margin: '0 0 12px 0'
        }}>
          Permissions Required
        </h2>

        <p style={{
          fontSize: '14px',
          color: '#6B7280',
          margin: '0 0 20px 0',
          lineHeight: '1.5'
        }}>
          BioMap needs access to your location and microphone to record audio observations and map them to specific locations.
        </p>

        {/* Permission Status */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 0',
            borderBottom: '1px solid #E5E7EB'
          }}>
            <span style={{ fontSize: '14px', color: '#374151' }}>📍 Location</span>
            <span style={{
              fontSize: '12px',
              padding: '4px 8px',
              borderRadius: '4px',
              backgroundColor: permissionStatus.location === 'granted' ? '#D1FAE5' : '#FEE2E2',
              color: permissionStatus.location === 'granted' ? '#065F46' : '#991B1B'
            }}>
              {permissionStatus.location === 'granted' ? '✓ Granted' : '✗ Denied'}
            </span>
          </div>
          
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 0'
          }}>
            <span style={{ fontSize: '14px', color: '#374151' }}>🎤 Microphone</span>
            <span style={{
              fontSize: '12px',
              padding: '4px 8px',
              borderRadius: '4px',
              backgroundColor: permissionStatus.microphone === 'granted' ? '#D1FAE5' : '#FEE2E2',
              color: permissionStatus.microphone === 'granted' ? '#065F46' : '#991B1B'
            }}>
              {permissionStatus.microphone === 'granted' ? '✓ Granted' : '✗ Denied'}
            </span>
          </div>
        </div>

        {error && (
          <div style={{
            backgroundColor: '#FEF2F2',
            border: '1px solid #FECACA',
            borderRadius: '6px',
            padding: '12px',
            marginBottom: '16px'
          }}>
            <p style={{ fontSize: '14px', color: '#991B1B', margin: 0 }}>{error}</p>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button
            onClick={requestAllPermissions}
            disabled={isRequesting}
            style={{
              backgroundColor: '#3B82F6',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              padding: '12px 24px',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: isRequesting ? 'not-allowed' : 'pointer',
              opacity: isRequesting ? 0.6 : 1,
              transition: 'background-color 0.2s'
            }}
          >
            {isRequesting ? 'Requesting...' : 'Grant Permissions'}
          </button>

          <button
            onClick={handleContinueAnyway}
            style={{
              backgroundColor: '#F3F4F6',
              color: '#374151',
              border: '1px solid #D1D5DB',
              borderRadius: '8px',
              padding: '12px 24px',
              fontSize: '16px',
              cursor: 'pointer',
              transition: 'background-color 0.2s'
            }}
          >
            Continue Anyway
          </button>

          <button
            onClick={handleDeny}
            style={{
              backgroundColor: 'transparent',
              color: '#6B7280',
              border: 'none',
              padding: '8px 16px',
              fontSize: '14px',
              cursor: 'pointer'
            }}
          >
            Exit App
          </button>
        </div>

        <p style={{
          fontSize: '12px',
          color: '#9CA3AF',
          margin: '16px 0 0 0',
          lineHeight: '1.4'
        }}>
          You can change these permissions later in your device settings under Apps &gt; BioMap &gt; Permissions.
        </p>
      </div>
    </div>
  );
};

export default AndroidPermissionRequest; 