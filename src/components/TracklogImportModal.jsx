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
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '16px',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
        maxWidth: '600px',
        width: '100%',
        maxHeight: '90vh',
        overflow: 'auto',
        position: 'relative'
      }}>
        {/* Header */}
        <div style={{
          padding: '24px 24px 16px 24px',
          borderBottom: '1px solid #E5E7EB',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h2 style={{
            margin: 0,
            fontSize: '20px',
            fontWeight: '700',
            color: '#1F2937'
          }}>
            📁 Importar Tracklog
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: '#6B7280',
              padding: '4px',
              borderRadius: '4px',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => e.target.style.color = '#EF4444'}
            onMouseLeave={(e) => e.target.style.color = '#6B7280'}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '24px' }}>
          {/* File Upload Area */}
          <div
            ref={dropZoneRef}
            style={{
              border: `2px dashed ${dragActive ? '#3B82F6' : '#D1D5DB'}`,
              borderRadius: '12px',
              padding: '40px 20px',
              textAlign: 'center',
              backgroundColor: dragActive ? '#EFF6FF' : '#F9FAFB',
              transition: 'all 0.2s ease',
              cursor: 'pointer'
            }}
            onDragEnter={handleDragIn}
            onDragLeave={handleDragOut}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload size={48} color={dragActive ? '#3B82F6' : '#6B7280'} style={{ marginBottom: '16px' }} />
            <h3 style={{
              margin: '0 0 8px 0',
              fontSize: '18px',
              fontWeight: '600',
              color: '#1F2937'
            }}>
              Arrastra y suelta tu archivo aquí
            </h3>
            <p style={{
              margin: '0 0 16px 0',
              fontSize: '14px',
              color: '#6B7280'
            }}>
              o haz clic para seleccionar un archivo
            </p>
            <p style={{
              margin: 0,
              fontSize: '12px',
              color: '#9CA3AF'
            }}>
              Formatos soportados: .zip, .geojson
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".zip,.geojson,.json"
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
                  <CheckCircle size={20} color="#10B981" />
                ) : (
                  <AlertCircle size={20} color="#EF4444" />
                )}
                <span style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  color: validationResult.valid ? '#10B981' : '#EF4444'
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
                color: '#1F2937'
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
                  color: '#374151',
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
                  border: '1px solid #E5E7EB'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <span style={{ fontSize: '14px', fontWeight: '600', color: '#374151' }}>
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
                          border: '1px solid #D1D5DB',
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
                          border: '1px solid #D1D5DB',
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
                        border: '1px solid #D1D5DB',
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
                        border: '1px solid #D1D5DB',
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
                        border: '1px solid #D1D5DB',
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
                  border: '2px solid #E5E7EB',
                  borderTop: '2px solid #3B82F6',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }} />
                <span style={{ fontSize: '14px', color: '#374151' }}>
                  Importando tracklog...
                </span>
              </div>
              <div style={{
                width: '100%',
                height: '4px',
                backgroundColor: '#E5E7EB',
                borderRadius: '2px',
                overflow: 'hidden'
              }}>
                <div style={{
                  width: `${importProgress}%`,
                  height: '100%',
                  backgroundColor: '#3B82F6',
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
                  <CheckCircle size={20} color="#10B981" />
                ) : (
                  <AlertCircle size={20} color="#EF4444" />
                )}
                <span style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  color: importResult.success ? '#10B981' : '#EF4444'
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
          padding: '16px 24px 24px 24px',
          borderTop: '1px solid #E5E7EB',
          display: 'flex',
          gap: '12px',
          justifyContent: 'flex-end'
        }}>
          <button
            onClick={onClose}
            disabled={isImporting}
            style={{
              padding: '10px 20px',
              border: '1px solid #D1D5DB',
              borderRadius: '8px',
              backgroundColor: 'white',
              color: '#374151',
              fontSize: '14px',
              fontWeight: '500',
              cursor: isImporting ? 'not-allowed' : 'pointer',
              opacity: isImporting ? 0.5 : 1
            }}
          >
            Cancelar
          </button>
          <button
            onClick={handleImport}
            disabled={!validationResult?.valid || isImporting}
            style={{
              padding: '10px 20px',
              border: 'none',
              borderRadius: '8px',
              backgroundColor: !validationResult?.valid || isImporting ? '#9CA3AF' : '#3B82F6',
              color: 'white',
              fontSize: '14px',
              fontWeight: '500',
              cursor: !validationResult?.valid || isImporting ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <Upload size={16} />
            {isImporting ? 'Importando...' : 'Importar Tracklog'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TracklogImportModal;
