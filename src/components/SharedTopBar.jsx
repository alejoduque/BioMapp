import React from 'react';
import { ArrowLeft, MapPin, Volume2 } from 'lucide-react';
import permissionManager from '../services/permissionManager.js';

const SharedTopBar = ({ 
  onBackToLanding, 
  onLocationRefresh, 
  onMicrophoneRequest,
  locationPermission = 'unknown',
  microphonePermission = 'unknown',
  userLocation = null,
  showMap = true,
  onToggleMap = null,
  onExportAll = null,
  onExportZip = null,
  onExportMetadata = null,
  audioSpotsCount = 0
}) => {
  
  // GPS Permission request function
  const handleGPSPermissionRequest = async () => {
    try {
      console.log('SharedTopBar: Requesting GPS permission...');
      
      const locationResult = await permissionManager.requestLocationPermission();
      console.log('SharedTopBar: GPS permission result:', locationResult);
      
      if (locationResult.granted) {
        // Try to get current location
        try {
          const position = await permissionManager.getCurrentLocation();
          console.log('SharedTopBar: Location obtained after permission:', position);
          if (onLocationRefresh) {
            onLocationRefresh(position);
          }
        } catch (error) {
          console.error('SharedTopBar: Error getting location after permission:', error);
        }
      } else {
        alert(`GPS permission denied: ${locationResult.error}`);
      }
    } catch (error) {
      console.error('SharedTopBar: Error requesting GPS permission:', error);
      alert(`Error requesting GPS permission: ${error.message}`);
    }
  };

  // Microphone Permission request function
  const handleMicrophonePermissionRequest = async () => {
    try {
      console.log('SharedTopBar: Requesting microphone permission...');
      
      const microphoneResult = await permissionManager.requestMicrophonePermission();
      console.log('SharedTopBar: Microphone permission result:', microphoneResult);
      
      if (microphoneResult.granted) {
        if (onMicrophoneRequest) {
          onMicrophoneRequest();
        }
      } else {
        alert(`Microphone permission denied: ${microphoneResult.error}`);
      }
    } catch (error) {
      console.error('SharedTopBar: Error requesting microphone permission:', error);
      alert(`Error requesting microphone permission: ${error.message}`);
    }
  };

  // Get GPS button color based on permission status
  const getGPSButtonColor = () => {
    if (userLocation) return '#10B981'; // Green - location available
    switch (locationPermission) {
      case 'granted':
        return '#10B981'; // Green
      case 'denied':
        return '#EF4444'; // Red
      default:
        return '#F59E0B'; // Orange (unknown/loading)
    }
  };

  // Get GPS button text based on permission status
  const getGPSButtonText = () => {
    if (userLocation) return 'GPS ✓';
    switch (locationPermission) {
      case 'granted':
        return 'GPS ✓';
      case 'denied':
        return 'GPS ✗';
      default:
        return 'GPS ?';
    }
  };

  // Get microphone button color
  const getMicrophoneButtonColor = () => {
    switch (microphonePermission) {
      case 'granted':
        return '#10B981'; // Green
      case 'denied':
        return '#EF4444'; // Red
      default:
        return '#F59E0B'; // Orange (unknown/loading)
    }
  };

  // Get microphone button text
  const getMicrophoneButtonText = () => {
    switch (microphonePermission) {
      case 'granted':
        return 'MIC ✓';
      case 'denied':
        return 'MIC ✗';
      default:
        return 'MIC ?';
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: '60px', // Moved down from 20px to avoid status bar
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 1000,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      gap: '12px', // Reduced gap to fit more buttons
      flexWrap: 'wrap',
      padding: '0 20px', // Add horizontal padding
      maxWidth: 'calc(100vw - 40px)', // Ensure buttons don't go off screen
      maxHeight: 'calc(100vh - 120px)', // Limit height to prevent overflow
      overflowY: 'auto' // Allow scrolling if needed
    }}>
      {/* Back Button */}
      <button
        onClick={onBackToLanding}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          backgroundColor: 'white',
          color: '#374151',
          border: 'none',
          borderRadius: '12px',
          padding: '12px 16px', // Slightly smaller padding
          fontSize: '14px', // Slightly smaller font
          cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
          fontWeight: '600'
        }}
      >
        <ArrowLeft size={18} />
        Back to Menu
      </button>

      {/* GPS Button - Smaller */}
      <div style={{
        backgroundColor: getGPSButtonColor(),
        borderRadius: '12px',
        padding: '12px 16px', // Slightly smaller padding
        fontSize: '14px', // Slightly smaller font
        color: 'white',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        cursor: 'pointer',
        fontWeight: '700',
        minWidth: '120px', // Smaller min width
        justifyContent: 'center',
        transition: 'all 0.2s ease'
      }}
      onClick={handleGPSPermissionRequest}
      title="Click to request GPS permission"
      >
        <MapPin size={18} />
        {getGPSButtonText()}
      </div>

      {/* Removed Microphone Button for SoundWalk interface */}

      {/* Map Toggle Button (if provided) */}
      {onToggleMap && (
        <button
          onClick={onToggleMap}
          style={{
            backgroundColor: 'white',
            color: '#374151',
            border: 'none',
            borderRadius: '12px',
            padding: '12px 16px', // Slightly smaller padding
            fontSize: '14px', // Slightly smaller font
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
            fontWeight: '600'
          }}
        >
          {showMap ? 'Hide Map' : 'Show Map'}
        </button>
      )}

      {/* Export Buttons (if provided) - Always visible */}
      {onExportAll && (
        <button
          onClick={onExportAll}
          disabled={audioSpotsCount === 0}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: audioSpotsCount > 0 ? '#10B981' : '#9CA3AF',
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            padding: '12px 16px', // Slightly smaller padding
            fontSize: '14px', // Slightly smaller font
            cursor: audioSpotsCount > 0 ? 'pointer' : 'not-allowed',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
            fontWeight: '600',
            minWidth: '120px' // Ensure consistent width
          }}
          title={audioSpotsCount > 0 ? `Export all ${audioSpotsCount} audio files` : 'No audio files to export'}
        >
          📁 Export All ({audioSpotsCount})
        </button>
      )}

      {onExportZip && (
        <button
          onClick={onExportZip}
          disabled={audioSpotsCount === 0}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: audioSpotsCount > 0 ? '#8B5CF6' : '#9CA3AF',
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            padding: '12px 16px', // Slightly smaller padding
            fontSize: '14px', // Slightly smaller font
            cursor: audioSpotsCount > 0 ? 'pointer' : 'not-allowed',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
            fontWeight: '600',
            minWidth: '120px' // Ensure consistent width
          }}
          title={audioSpotsCount > 0 ? `Export ${audioSpotsCount} audio files as ZIP` : 'No audio files to export'}
        >
          📦 Export ZIP
        </button>
      )}

      {onExportMetadata && (
        <button
          onClick={onExportMetadata}
          disabled={audioSpotsCount === 0}
          style={{
            backgroundColor: audioSpotsCount > 0 ? '#3B82F6' : '#9CA3AF',
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            padding: '12px 16px', // Slightly smaller padding
            fontSize: '14px', // Slightly smaller font
            cursor: audioSpotsCount > 0 ? 'pointer' : 'not-allowed',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
            fontWeight: '600',
            minWidth: '120px' // Ensure consistent width
          }}
          title={audioSpotsCount > 0 ? `Export metadata for ${audioSpotsCount} audio files` : 'No audio files to export'}
        >
          📄 Export Metadata
        </button>
      )}
    </div>
  );
};

export default SharedTopBar; 