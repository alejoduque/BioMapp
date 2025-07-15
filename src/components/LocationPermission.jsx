import React, { useState, useEffect } from 'react';
import locationService from '../services/locationService.js';
import permissionManager from '../services/permissionManager.js';

const LocationPermission = ({ onLocationGranted, onLocationDenied, onError }) => {
  const [permissionState, setPermissionState] = useState('unknown');
  const [isRequesting, setIsRequesting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    console.log('LocationPermission: Component mounted');
    checkPermission();
  }, []);

  const checkPermission = async () => {
    try {
      console.log('LocationPermission: Checking permission...');
      const state = await permissionManager.checkLocationPermission();
      console.log('LocationPermission: Permission state:', state);
      setPermissionState(state);
      
      if (state === 'granted') {
        requestLocation();
      }
    } catch (err) {
      console.error('LocationPermission: Error checking permission:', err);
      setError('Failed to check location permission');
    }
  };

  const requestLocation = async () => {
    console.log('LocationPermission: Requesting location...');
    setIsRequesting(true);
    setError(null);
    
    try {
      const position = await locationService.requestLocation();
      console.log('LocationPermission: Location granted:', position);
      onLocationGranted(position);
    } catch (err) {
      console.error('LocationPermission: Location error:', err);
      setError(err.message);
      onLocationDenied(err.message);
    } finally {
      setIsRequesting(false);
    }
  };

  const handleRequestPermission = () => {
    console.log('LocationPermission: Allow button clicked');
    requestLocation();
  };

  const handleDenyPermission = () => {
    console.log('LocationPermission: Deny button clicked');
    onLocationDenied('Location permission denied by user');
  };

  const handleClose = () => {
    console.log('LocationPermission: Close button clicked');
    onLocationDenied('Location permission modal closed');
  };

  if (permissionState === 'granted' && !isRequesting && !error) {
    console.log('LocationPermission: Permission granted, hiding modal');
    return null; // Don't show anything if permission is granted
  }

  console.log('LocationPermission: Rendering modal, state:', { permissionState, isRequesting, error });

  return (
    <div className="location-permission-modal">
      <div className="location-permission-content">
        <div className="text-center">
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
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 mb-4">
            <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Location Access Required
          </h3>
          
          <p className="text-sm text-gray-500 mb-6">
            This app needs access to your location to show your position on the map and record audio with location data for the MANAKAI Natural Reserve.
          </p>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div className="flex flex-col space-y-3">
            <button
              onClick={handleRequestPermission}
              disabled={isRequesting}
              className="location-permission-button w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              style={{
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                padding: '12px 24px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: 'bold',
                zIndex: 10001,
                position: 'relative'
              }}
            >
              {isRequesting ? 'Requesting...' : 'Allow Location Access'}
            </button>
            
            <button
              onClick={handleDenyPermission}
              disabled={isRequesting}
              className="location-permission-button w-full bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              style={{
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                padding: '12px 24px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: 'bold',
                zIndex: 10001,
                position: 'relative'
              }}
            >
              Deny Access
            </button>
          </div>

          <p className="text-xs text-gray-400 mt-4">
            You can change this permission later in your browser settings.
          </p>
        </div>
      </div>
    </div>
  );
};

export default LocationPermission; 