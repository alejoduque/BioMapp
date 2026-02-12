import React, { useState, useRef } from 'react';
import { Upload, X, MapPin, Clock, RotateCw, Scale, Move, FileText, AlertCircle, CheckCircle } from 'lucide-react';
import TracklogImporter from '../utils/tracklogImporter.js';

const TracklogImportModal = ({ isVisible, onClose, onImportComplete }) => {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [validationResult, setValidationResult] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState(null);
  
  // Import options
  const [importOptions, setImportOptions] = useState({
    locationTransform: {
      translate: { lat: 0, lng: 0 },
      scale: 1,
      rotate: 0,
      center: { lat: 0, lng: 0 }
    },
    timeOffset: 0,
    applyTransform: false
  });

  const fileInputRef = useRef(null);
  const dropZoneRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragIn = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setDragActive(true);
    }
  };

  const handleDragOut = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = async (file) => {
    setSelectedFile(file);
    setValidationResult(null);
    setImportResult(null);
    
    try {
      const validation = await TracklogImporter.validateTracklogFile(file);
      setValidationResult(validation);
    } catch (error) {
      setValidationResult({
        valid: false,
        error: error.message
      });
    }
  };

  const handleFileInput = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  };

  const handleImport = async () => {
    if (!selectedFile || !validationResult?.valid) return;

    setIsImporting(true);
    setImportProgress(0);
    setImportResult(null);

    try {
      const options = importOptions.applyTransform ? importOptions : {};
      
      let result;
      if (validationResult.type === 'zip') {
        result = await TracklogImporter.importTracklogFromZip(selectedFile, options);
      } else if (validationResult.type === 'geojson') {
        result = await TracklogImporter.importTracklogFromGeoJSON(selectedFile, options);
      }

      setImportResult({
        success: true,
        data: result
      });

      if (onImportComplete) {
        onImportComplete(result);
      }

    } catch (error) {
      setImportResult({
        success: false,
        error: error.message
      });
    } finally {
      setIsImporting(false);
      setImportProgress(100);
    }
  };

  const updateTransformOption = (key, value) => {
    setImportOptions(prev => ({
      ...prev,
      locationTransform: {
        ...prev.locationTransform,
        [key]: value
      }
    }));
  };

  const resetTransform = () => {
    setImportOptions(prev => ({
      ...prev,
      locationTransform: {
        translate: { lat: 0, lng: 0 },
        scale: 1,
        rotate: 0,
        center: { lat: 0, lng: 0 }
      }
    }));
  };

  if (!isVisible) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '190px',
      left: '50%',
      transform: 'translateX(-50%)',
      backgroundColor: 'rgba(220,225,235,0.78)',
      borderRadius: '16px',
      boxShadow: 'rgba(78,78,134,0.25) 0px 10px 30px',
      width: '90%',
      maxWidth: '400px',
      maxHeight: '60vh',
      overflow: 'auto',
      zIndex: 10000,
      backdropFilter: 'blur(12px)',
      boxSizing: 'border-box'
    }}>
        {/* Header */}
        <div style={{
          padding: '14px 16px',
          borderBottom: '1px solid rgba(0,0,0,0.08)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          position: 'relative'
        }}>
          <h3 style={{
            margin: 0,
            fontSize: '16px',
            fontWeight: '600',
            color: '#000000c9'
          }}>
            Importar Deriva
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#6B7280',
              fontSize: '18px',
              padding: '4px',
              lineHeight: 1
            }}
            title="Cerrar"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '16px' }}>
          {/* File Upload Area */}
          <div
            ref={dropZoneRef}
            style={{
              border: `2px dashed ${dragActive ? '#4e4e86' : 'rgba(78,78,134,0.22)'}`,
              borderRadius: '12px',
              padding: '24px 16px',
              textAlign: 'center',
              backgroundColor: dragActive ? 'rgba(239,246,255,0.6)' : 'rgba(249,250,251,0.5)',
              transition: 'all 0.2s ease',
              cursor: 'pointer'
            }}
            onDragEnter={handleDragIn}
            onDragLeave={handleDragOut}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload size={36} color={dragActive ? '#4e4e86' : '#6B7280'} style={{ marginBottom: '12px' }} />
            <p style={{
              margin: '0 0 8px 0',
              fontSize: '14px',
              fontWeight: '500',
              color: '#000000c9'
            }}>
              Selecciona un archivo .zip
            </p>
            <p style={{
              margin: 0,
              fontSize: '12px',
              color: '#9CA3AF'
            }}>
              Deriva Sonora exportada (.zip)
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".zip"
              onChange={handleFileInput}
              style={{ display: 'none' }}
            />
          </div>

          {/* File Validation */}
          {validationResult && (
            <div style={{
              marginTop: '20px',
              padding: '16px',
              borderRadius: '8px',
              backgroundColor: validationResult.valid ? '#F0FDF4' : '#FEF2F2',
              border: `1px solid ${validationResult.valid ? '#BBF7D0' : '#FECACA'}`
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {validationResult.valid ? (
                  <CheckCircle size={20} color="#9dc04cd4" />
                ) : (
                  <AlertCircle size={20} color="#c24a6e" />
                )}
                <span style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  color: validationResult.valid ? '#9dc04cd4' : '#c24a6e'
                }}>
                  {validationResult.valid ? 'Archivo válido' : 'Error de validación'}
                </span>
              </div>
              {validationResult.valid ? (
                <div style={{ marginTop: '8px', fontSize: '12px', color: '#059669' }}>
                  <p>• Tipo: {validationResult.type.toUpperCase()}</p>
                  <p>• Migas de pan: {validationResult.breadcrumbCount}</p>
                  <p>• ID de sesión: {validationResult.sessionId}</p>
                </div>
              ) : (
                <p style={{ marginTop: '8px', fontSize: '12px', color: '#DC2626' }}>
                  {validationResult.error}
                </p>
              )}
            </div>
          )}

          {/* Import Options */}
          {validationResult?.valid && (
            <div style={{ marginTop: '20px' }}>
              <h4 style={{
                margin: '0 0 16px 0',
                fontSize: '16px',
                fontWeight: '600',
                color: '#000000c9'
              }}>
                ⚙️ Opciones de Importación
              </h4>

              {/* Location Transform Toggle */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: 'rgb(1 9 2 / 84%)',
                  cursor: 'pointer'
                }}>
                  <input
                    type="checkbox"
                    checked={importOptions.applyTransform}
                    onChange={(e) => setImportOptions(prev => ({
                      ...prev,
                      applyTransform: e.target.checked
                    }))}
                  />
                  Aplicar transformación de ubicación
                </label>
              </div>

              {/* Transform Options */}
              {importOptions.applyTransform && (
                <div style={{
                  padding: '16px',
                  backgroundColor: '#F9FAFB',
                  borderRadius: '8px',
                  border: '1px solid rgba(78,78,134,0.15)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <span style={{ fontSize: '14px', fontWeight: '600', color: 'rgb(1 9 2 / 84%)' }}>
                      Transformación de Ubicación
                    </span>
                    <button
                      onClick={resetTransform}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '4px',
                        borderRadius: '4px',
                        color: '#6B7280'
                      }}
                      title="Restablecer transformación"
                    >
                      <RotateCw size={16} />
                    </button>
                  </div>

                  {/* Translation */}
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ fontSize: '12px', color: '#6B7280', display: 'block', marginBottom: '4px' }}>
                      <Move size={12} style={{ marginRight: '4px' }} />
                      Traslación (grados)
                    </label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="number"
                        step="0.0001"
                        placeholder="Lat"
                        value={importOptions.locationTransform.translate.lat}
                        onChange={(e) => updateTransformOption('translate', {
                          ...importOptions.locationTransform.translate,
                          lat: parseFloat(e.target.value) || 0
                        })}
                        style={{
                          flex: 1,
                          padding: '8px',
                          border: '1px solid rgba(78,78,134,0.22)',
                          borderRadius: '4px',
                          fontSize: '12px'
                        }}
                      />
                      <input
                        type="number"
                        step="0.0001"
                        placeholder="Lng"
                        value={importOptions.locationTransform.translate.lng}
                        onChange={(e) => updateTransformOption('translate', {
                          ...importOptions.locationTransform.translate,
                          lng: parseFloat(e.target.value) || 0
                        })}
                        style={{
                          flex: 1,
                          padding: '8px',
                          border: '1px solid rgba(78,78,134,0.22)',
                          borderRadius: '4px',
                          fontSize: '12px'
                        }}
                      />
                    </div>
                  </div>

                  {/* Scale */}
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ fontSize: '12px', color: '#6B7280', display: 'block', marginBottom: '4px' }}>
                      <Scale size={12} style={{ marginRight: '4px' }} />
                      Escala
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      max="10"
                      value={importOptions.locationTransform.scale}
                      onChange={(e) => updateTransformOption('scale', parseFloat(e.target.value) || 1)}
                      style={{
                        width: '100%',
                        padding: '8px',
                        border: '1px solid rgba(78,78,134,0.22)',
                        borderRadius: '4px',
                        fontSize: '12px'
                      }}
                    />
                  </div>

                  {/* Rotation */}
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ fontSize: '12px', color: '#6B7280', display: 'block', marginBottom: '4px' }}>
                      <RotateCw size={12} style={{ marginRight: '4px' }} />
                      Rotación (grados)
                    </label>
                    <input
                      type="number"
                      step="1"
                      min="-180"
                      max="180"
                      value={importOptions.locationTransform.rotate}
                      onChange={(e) => updateTransformOption('rotate', parseFloat(e.target.value) || 0)}
                      style={{
                        width: '100%',
                        padding: '8px',
                        border: '1px solid rgba(78,78,134,0.22)',
                        borderRadius: '4px',
                        fontSize: '12px'
                      }}
                    />
                  </div>

                  {/* Time Offset */}
                  <div>
                    <label style={{ fontSize: '12px', color: '#6B7280', display: 'block', marginBottom: '4px' }}>
                      <Clock size={12} style={{ marginRight: '4px' }} />
                      Desplazamiento de tiempo (segundos)
                    </label>
                    <input
                      type="number"
                      step="1"
                      value={importOptions.timeOffset / 1000}
                      onChange={(e) => setImportOptions(prev => ({
                        ...prev,
                        timeOffset: (parseFloat(e.target.value) || 0) * 1000
                      }))}
                      style={{
                        width: '100%',
                        padding: '8px',
                        border: '1px solid rgba(78,78,134,0.22)',
                        borderRadius: '4px',
                        fontSize: '12px'
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Import Progress */}
          {isImporting && (
            <div style={{ marginTop: '20px' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '8px'
              }}>
                <div style={{
                  width: '16px',
                  height: '16px',
                  border: '2px solid rgba(78,78,134,0.15)',
                  borderTop: '2px solid #4e4e86',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }} />
                <span style={{ fontSize: '14px', color: 'rgb(1 9 2 / 84%)' }}>
                  Importando tracklog...
                </span>
              </div>
              <div style={{
                width: '100%',
                height: '4px',
                backgroundColor: 'rgba(78,78,134,0.15)',
                borderRadius: '2px',
                overflow: 'hidden'
              }}>
                <div style={{
                  width: `${importProgress}%`,
                  height: '100%',
                  backgroundColor: '#4e4e86',
                  transition: 'width 0.3s ease'
                }} />
              </div>
            </div>
          )}

          {/* Import Result */}
          {importResult && (
            <div style={{
              marginTop: '20px',
              padding: '16px',
              borderRadius: '8px',
              backgroundColor: importResult.success ? '#F0FDF4' : '#FEF2F2',
              border: `1px solid ${importResult.success ? '#BBF7D0' : '#FECACA'}`
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {importResult.success ? (
                  <CheckCircle size={20} color="#9dc04cd4" />
                ) : (
                  <AlertCircle size={20} color="#c24a6e" />
                )}
                <span style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  color: importResult.success ? '#9dc04cd4' : '#c24a6e'
                }}>
                  {importResult.success ? 'Importación exitosa' : 'Error de importación'}
                </span>
              </div>
              {importResult.success && importResult.data && (
                <div style={{ marginTop: '8px', fontSize: '12px', color: '#059669' }}>
                  <p>• Migas de pan importadas: {importResult.data.importedBreadcrumbs}</p>
                  <p>• Grabaciones importadas: {importResult.data.importedRecordings}</p>
                  <p>• Nueva sesión ID: {importResult.data.newSessionId}</p>
                </div>
              )}
              {!importResult.success && (
                <p style={{ marginTop: '8px', fontSize: '12px', color: '#DC2626' }}>
                  {importResult.error}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 16px 16px',
          borderTop: '1px solid rgba(0,0,0,0.08)',
          display: 'flex',
          gap: '10px'
        }}>
          <button
            onClick={handleImport}
            disabled={!validationResult?.valid || isImporting}
            style={{
              flex: 1,
              padding: '10px',
              border: 'none',
              borderRadius: '8px',
              backgroundColor: !validationResult?.valid || isImporting ? '#9CA3AF' : '#9dc04cd4',
              color: 'white',
              fontSize: '14px',
              fontWeight: '500',
              cursor: !validationResult?.valid || isImporting ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            <Upload size={16} />
            {isImporting ? 'Importando...' : 'Importar'}
          </button>
          <button
            onClick={onClose}
            disabled={isImporting}
            style={{
              padding: '10px 16px',
              backgroundColor: 'white',
              color: 'rgb(1 9 2 / 84%)',
              border: '1px solid rgba(78,78,134,0.22)',
              borderRadius: '8px',
              fontSize: '14px',
              cursor: isImporting ? 'not-allowed' : 'pointer',
              opacity: isImporting ? 0.5 : 1
            }}
          >
            Cancelar
          </button>
        </div>
    </div>
  );
};

export default TracklogImportModal;
