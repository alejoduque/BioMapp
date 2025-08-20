import React, { useState, useEffect } from 'react';
import locationService from '../services/locationService.js';
import permissionManager from '../services/permissionManager.js';

const LocationPermission = ({ onLocationGranted, onLocationDenied, onError }) => {
  const [permissionState, setPermissionState] = useState('unknown');
  const [isRequesting, setIsRequesting] = useState(false);
  const [error, setError] = useState(null);

  // [REMOVE REDUNDANT PERMISSION REQUESTS]
  // Remove the useEffect and checkPermission/requestLocation logic

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
            Acceso a la Ubicación Requerido
          </h3>
          
          <p className="text-sm text-gray-500 mb-6">
            Esta aplicación necesita acceso a tu ubicación para mostrar tu posición en el mapa y grabar audio con datos de ubicación para la Reserva Natural MANAKAI.
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
              {isRequesting ? 'Solicitando...' : 'Permitir Acceso a la Ubicación'}
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
              Denegar Acceso
            </button>
          </div>

          <p className="text-xs text-gray-400 mt-4">
            Puedes cambiar este permiso más tarde en la configuración de tu navegador.
          </p>
        </div>
      </div>
    </div>
  );
};

export default LocationPermission; 