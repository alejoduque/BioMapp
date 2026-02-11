import React, { useState, useRef, useEffect } from 'react';
import { Upload, Download, CheckCircle, AlertCircle, X } from 'lucide-react';
import importService from '../services/importService.js';
import dataValidator from '../utils/dataValidator.js';
import permissionManager from '../services/permissionManager';

const ImportModal = ({ isVisible, onClose, onImportComplete }) => {
  const [importState, setImportState] = useState('idle'); // idle, importing, success, error
  const [importResult, setImportResult] = useState(null);
  const [importOptions, setImportOptions] = useState({
    mergeStrategy: 'skip_duplicates',
    importAudio: true,
    importMetadata: true,
    importBreadcrumbs: true,
    importTracklog: true,
    validateOnly: false
  });
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [jsonInput, setJsonInput] = useState('');
  const [importMode, setImportMode] = useState('file'); // file, json
  const [debugLogs, setDebugLogs] = useState([]);
  const [manualFilePath, setManualFilePath] = useState('');
  const [permissionStatus, setPermissionStatus] = useState('unknown');
  const fileInputRef = useRef(null);

  // Add debug log function
  const addDebugLog = (message) => {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = `[${timestamp}] ${message}`;
    setDebugLogs(prev => [...prev, logEntry].slice(-10)); // Keep last 10 logs
    console.log(logEntry);
  };

  // Check permission status on component mount
  useEffect(() => {
    const checkPermissionStatus = async () => {
      try {
        const status = await permissionManager.checkFilesPermission();
        setPermissionStatus(status);
        addDebugLog(`Initial file permission status: ${status}`);
      } catch (error) {
        addDebugLog(`Error checking permission status: ${error.message}`);
        setPermissionStatus('error');
      }
    };
    
    if (isVisible) {
      checkPermissionStatus();
    }
  }, [isVisible]);

  // Initialize file input when modal becomes visible
  useEffect(() => {
    if (isVisible && fileInputRef.current) {
      console.log('Initializing file input');
      fileInputRef.current.accept = '.json,.biomapp,.soundwalk';
      fileInputRef.current.multiple = false;
    }
  }, [isVisible]);

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      console.log('File selected:', file.name, file.size, file.type);
      setSelectedFile(file);
      setImportState('idle');
      setImportResult(null);
    }
  };

  const handleFileButtonClick = async () => {
    addDebugLog('File button clicked');
    
    // First check and request file permissions
    try {
      addDebugLog('Checking file permissions...');
      const permissionResult = await permissionManager.requestFilesPermission();
      addDebugLog(`File permission result: ${JSON.stringify(permissionResult)}`);
      
      if (!permissionResult.granted) {
        addDebugLog('File permission denied, showing alert');
        alert(`Permiso de archivos denegado: ${permissionResult.reason || 'Acceso denegado'}`);
        return;
      }
      
      addDebugLog('File permission granted, proceeding with file selection');
    } catch (permissionError) {
      addDebugLog(`Permission check error: ${permissionError.message}`);
      alert(`Error al verificar permisos: ${permissionError.message}`);
      return;
    }
    
    // Try multiple approaches for mobile compatibility
    try {
      // Approach 1: Create a new file input directly (bypass ref issues)
      addDebugLog('Creating new file input directly');
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = '.json,.biomapp,.soundwalk,application/json,text/json,*/*';
      fileInput.multiple = false;
      fileInput.style.position = 'absolute';
      fileInput.style.left = '-9999px';
      fileInput.style.top = '-9999px';
      
      // Add event listener
      fileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
          addDebugLog(`File selected: ${file.name} (${file.size} bytes, ${file.type})`);
          setSelectedFile(file);
          setImportState('idle');
          setImportResult(null);
        } else {
          addDebugLog('No file selected');
        }
        // Clean up
        document.body.removeChild(fileInput);
      });
      
      // Add error handling
      fileInput.addEventListener('error', (error) => {
        addDebugLog(`File input error: ${error.message}`);
        document.body.removeChild(fileInput);
      });
      
      // Add to DOM and trigger
      document.body.appendChild(fileInput);
      addDebugLog('File input added to DOM');
      
      // Try to trigger file dialog
      setTimeout(() => {
        try {
          fileInput.click();
          addDebugLog('File dialog triggered');
        } catch (clickError) {
          addDebugLog(`Click error: ${clickError.message}`);
          // Fallback: try to focus and click
          fileInput.focus();
          fileInput.click();
        }
      }, 100);
      
    } catch (error) {
      addDebugLog(`Error in file selection: ${error.message}`);
      alert(`Error al abrir el selector de archivos: ${error.message}`);
    }
  };

  

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = e.dataTransfer.files;
    if (files && files[0]) {
      setSelectedFile(files[0]);
      setImportState('idle');
      setImportResult(null);
    }
  };

  const handleImport = async () => {
    if (importMode === 'file' && !selectedFile) {
      setImportResult({ error: 'Por favor selecciona un archivo para importar' });
      setImportState('error');
      return;
    }

    if (importMode === 'json' && !jsonInput.trim()) {
      setImportResult({ error: 'Por favor ingresa datos JSON para importar' });
      setImportState('error');
      return;
    }

    setImportState('importing');
    setImportResult(null);

    try {
      let result;
      
      if (importMode === 'file') {
        result = await importService.importFromFile(selectedFile, importOptions);
      } else {
        result = await importService.importFromJSON(jsonInput, importOptions);
      }

      setImportResult(result);
      setImportState('success');
      
      if (onImportComplete) {
        onImportComplete(result);
      }

    } catch (error) {
      console.error('Import failed:', error);
      setImportResult({ error: error.message });
      setImportState('error');
    }
  };

  const handleValidateOnly = async () => {
    if (importMode === 'file' && !selectedFile) {
      setImportResult({ error: 'Por favor selecciona un archivo para validar' });
      setImportState('error');
      return;
    }

    if (importMode === 'json' && !jsonInput.trim()) {
      setImportResult({ error: 'Por favor ingresa datos JSON para validar' });
      setImportState('error');
      return;
    }

    setImportState('importing');
    setImportResult(null);

    try {
      let result;
      const validateOptions = { ...importOptions, validateOnly: true };
      
      if (importMode === 'file') {
        result = await importService.importFromFile(selectedFile, validateOptions);
      } else {
        result = await importService.importFromJSON(jsonInput, validateOptions);
      }

      setImportResult(result);
      setImportState('success');

    } catch (error) {
      console.error('Validation failed:', error);
      setImportResult({ error: error.message });
      setImportState('error');
    }
  };

  const resetImport = () => {
    setImportState('idle');
    setImportResult(null);
    setSelectedFile(null);
    setJsonInput('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const getImportStats = () => {
    return importService.getImportStats();
  };

  if (!isVisible) return null;

  const stats = getImportStats();

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '16px',
        padding: '24px',
        maxWidth: '600px',
        width: '100%',
        maxHeight: '90vh',
        overflow: 'auto',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '24px'
        }}>
          <h2 style={{
            margin: 0,
            fontSize: '24px',
            fontWeight: '600',
            color: '#1F2937'
          }}>
            Importar Datos
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '8px',
              borderRadius: '8px',
              color: '#6B7280',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Permission Status */}
        <div style={{
          backgroundColor: '#F3F4F6',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '24px'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '12px'
          }}>
            <h3 style={{
              margin: '0',
              fontSize: '16px',
              fontWeight: '600',
              color: '#374151'
            }}>
              📄 Estado de Permisos
            </h3>
            <button
              onClick={async () => {
                addDebugLog('Manually requesting file permissions...');
                try {
                  const result = await permissionManager.requestFilesPermission();
                  setPermissionStatus(result.state);
                  addDebugLog(`Manual permission request result: ${JSON.stringify(result)}`);
                  if (result.granted) {
                    alert('¡Permiso de archivos concedido!');
                  } else {
                    alert(`Permiso denegado: ${result.reason || 'Acceso denegado'}`);
                  }
                } catch (error) {
                  addDebugLog(`Manual permission request error: ${error.message}`);
                  alert(`Error al solicitar permisos: ${error.message}`);
                }
              }}
              style={{
                backgroundColor: '#3B82F6',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                padding: '6px 12px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: '500'
              }}
            >
              Solicitar Permisos
            </button>
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: '12px',
            fontSize: '14px'
          }}>
            <div>
              <div style={{ color: '#6B7280', marginBottom: '4px' }}>Estado de Permiso</div>
              <div style={{ 
                fontWeight: '600', 
                color: '#1F2937',
                display: 'flex',
                alignItems: 'center'
              }}>
                {permissionStatus === 'granted' ? (
                  <CheckCircle size={16} style={{ color: '#059669', marginRight: '8px' }} />
                ) : permissionStatus === 'denied' ? (
                  <AlertCircle size={16} style={{ color: '#DC2626', marginRight: '8px' }} />
                ) : (
                  <X size={16} style={{ color: '#6B7280', marginRight: '8px' }} />
                )}
                {permissionStatus}
              </div>
            </div>
            <div>
              <div style={{ color: '#6B7280', marginBottom: '4px' }}>Permiso de Archivos</div>
              <div style={{ 
                fontWeight: '600', 
                color: '#1F2937',
                display: 'flex',
                alignItems: 'center'
              }}>
                {permissionStatus === 'granted' ? (
                  <CheckCircle size={16} style={{ color: '#059669', marginRight: '8px' }} />
                ) : (
                  <AlertCircle size={16} style={{ color: '#DC2626', marginRight: '8px' }} />
                )}
                {permissionStatus === 'granted' ? 'Concedido' : 'Denegado'}
              </div>
            </div>
          </div>
        </div>

        {/* Import Statistics */}
        <div style={{
          backgroundColor: '#F3F4F6',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '24px'
        }}>
          <h3 style={{
            margin: '0 0 12px 0',
            fontSize: '16px',
            fontWeight: '600',
            color: '#374151'
          }}>
            📊 Estadísticas de Importación
          </h3>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
            gap: '12px',
            fontSize: '14px'
          }}>
            <div>
              <div style={{ color: '#6B7280', marginBottom: '4px' }}>Total Grabaciones</div>
              <div style={{ fontWeight: '600', color: '#1F2937' }}>{stats.totalRecordings}</div>
            </div>
            <div>
              <div style={{ color: '#6B7280', marginBottom: '4px' }}>Importadas</div>
              <div style={{ fontWeight: '600', color: '#059669' }}>{stats.importedRecordings}</div>
            </div>
            <div>
              <div style={{ color: '#6B7280', marginBottom: '4px' }}>Locales</div>
              <div style={{ fontWeight: '600', color: '#1F2937' }}>{stats.localRecordings}</div>
            </div>
            <div>
              <div style={{ color: '#6B7280', marginBottom: '4px' }}>Fechas Importación</div>
              <div style={{ fontWeight: '600', color: '#1F2937' }}>{stats.importDates.length}</div>
            </div>
          </div>
        </div>

        {/* Import Mode Tabs */}
        <div style={{
          display: 'flex',
          marginBottom: '20px',
          borderBottom: '1px solid #E5E7EB'
        }}>
          <button
            onClick={() => setImportMode('file')}
            style={{
              padding: '12px 20px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              borderBottom: importMode === 'file' ? '2px solid #3B82F6' : '2px solid transparent',
              color: importMode === 'file' ? '#3B82F6' : '#6B7280',
              fontWeight: importMode === 'file' ? '600' : '400'
            }}
          >
            <FileText size={16} style={{ marginRight: '8px' }} />
            Importar Archivo
          </button>
          <button
            onClick={() => setImportMode('json')}
            style={{
              padding: '12px 20px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              borderBottom: importMode === 'json' ? '2px solid #3B82F6' : '2px solid transparent',
              color: importMode === 'json' ? '#3B82F6' : '#6B7280',
              fontWeight: importMode === 'json' ? '600' : '400'
            }}
          >
            <FileText size={16} style={{ marginRight: '8px' }} />
            Entrada JSON
          </button>
        </div>

        {/* File Import */}
        {importMode === 'file' && (
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            style={{
              border: dragActive ? '2px dashed #3B82F6' : '2px dashed #D1D5DB',
              borderRadius: '12px',
              padding: '32px',
              textAlign: 'center',
              backgroundColor: dragActive ? '#EFF6FF' : '#F9FAFB',
              marginBottom: '20px',
              transition: 'all 0.2s ease'
            }}
          >
            <Upload size={48} style={{ color: '#6B7280', marginBottom: '16px' }} />
            <p style={{ margin: '0 0 16px 0', color: '#374151', fontSize: '16px' }}>
              {selectedFile ? selectedFile.name : 'Arrastra y suelta un archivo aquí, o haz clic para seleccionar'}
            </p>
            <button
              onClick={handleFileButtonClick}
              style={{
                backgroundColor: '#3B82F6',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                padding: '12px 24px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500'
              }}
            >
              Seleccionar Archivo
            </button>
            
            
            
            {/* Debug Logs Display */}
            <div style={{
              marginTop: '16px',
              padding: '12px',
              backgroundColor: '#1F2937',
              borderRadius: '8px',
              border: '1px solid #374151'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '8px'
              }}>
                <span style={{ color: '#D1D5DB', fontSize: '12px', fontWeight: '600' }}>
                  Debug Logs (últimos 10):
                </span>
                <button
                  onClick={() => {
                    const logText = debugLogs.join('\n');
                    navigator.clipboard.writeText(logText).then(() => {
                      addDebugLog('Logs copied to clipboard');
                    }).catch(() => {
                      addDebugLog('Failed to copy logs');
                    });
                  }}
                  style={{
                    backgroundColor: '#3B82F6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '4px 8px',
                    cursor: 'pointer',
                    fontSize: '10px'
                  }}
                >
                  Copiar
                </button>
              </div>
              <div style={{
                backgroundColor: '#111827',
                borderRadius: '4px',
                padding: '8px',
                maxHeight: '120px',
                overflow: 'auto',
                fontFamily: 'monospace',
                fontSize: '10px',
                color: '#10B981'
              }}>
                {debugLogs.length === 0 ? (
                  <span style={{ color: '#6B7280' }}>No logs yet...</span>
                ) : (
                  debugLogs.map((log, index) => (
                    <div key={index} style={{ marginBottom: '2px' }}>
                      {log}
                    </div>
                  ))
                )}
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,.biomapp,.soundwalk,application/json"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
              id="file-import-input"
              name="file-import"
            />
            {selectedFile && (
              <div style={{
                marginTop: '16px',
                padding: '12px',
                backgroundColor: '#ECFDF5',
                borderRadius: '8px',
                border: '1px solid #A7F3D0'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CheckCircle size={16} style={{ color: '#059669', marginRight: '8px' }} />
                  <span style={{ color: '#065F46', fontSize: '14px' }}>
                    Seleccionado: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* JSON Input */}
        {importMode === 'json' && (
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontSize: '14px',
              fontWeight: '500',
              color: '#374151'
            }}>
              Datos JSON
            </label>
            <textarea
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
              placeholder="Pega tus datos JSON aquí..."
              style={{
                width: '100%',
                minHeight: '200px',
                padding: '12px',
                border: '1px solid #D1D5DB',
                borderRadius: '8px',
                fontSize: '14px',
                fontFamily: 'monospace',
                resize: 'vertical'
              }}
            />
          </div>
        )}

        {/* Import Options */}
        <div style={{
          backgroundColor: '#F9FAFB',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '20px'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: '12px'
          }}>
            <Settings size={16} style={{ marginRight: '8px', color: '#6B7280' }} />
            <h4 style={{
              margin: 0,
              fontSize: '14px',
              fontWeight: '600',
              color: '#374151'
            }}>
              Opciones de Importación
            </h4>
          </div>
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '12px'
          }}>
            <div>
              <label style={{
                display: 'block',
                marginBottom: '4px',
                fontSize: '12px',
                color: '#6B7280'
              }}>
                Estrategia de Fusión
              </label>
              <select
                value={importOptions.mergeStrategy}
                onChange={(e) => setImportOptions({
                  ...importOptions,
                  mergeStrategy: e.target.value
                })}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #D1D5DB',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
              >
                <option value="skip_duplicates">Omitir Duplicados</option>
                <option value="overwrite">Sobrescribir</option>
                <option value="rename">Renombrar</option>
              </select>
            </div>
            
            <div>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                fontSize: '12px',
                color: '#6B7280',
                cursor: 'pointer'
              }}>
                <input
                  type="checkbox"
                  checked={importOptions.importAudio}
                  onChange={(e) => setImportOptions({
                    ...importOptions,
                    importAudio: e.target.checked
                  })}
                  style={{ marginRight: '8px' }}
                />
                Importar Datos de Audio
              </label>
            </div>
            
            <div>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                fontSize: '12px',
                color: '#6B7280',
                cursor: 'pointer'
              }}>
                <input
                  type="checkbox"
                  checked={importOptions.importBreadcrumbs}
                  onChange={(e) => setImportOptions({
                    ...importOptions,
                    importBreadcrumbs: e.target.checked
                  })}
                  style={{ marginRight: '8px' }}
                />
                Importar Migas de Pan
              </label>
            </div>
            
            <div>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                fontSize: '12px',
                color: '#6B7280',
                cursor: 'pointer'
              }}>
                <input
                  type="checkbox"
                  checked={importOptions.importTracklog}
                  onChange={(e) => setImportOptions({
                    ...importOptions,
                    importTracklog: e.target.checked
                  })}
                  style={{ marginRight: '8px' }}
                />
                Importar Registro de Ruta
              </label>
            </div>
            
            {/* Manual File Path Input for Android */}
            <div style={{
              marginTop: '16px',
              padding: '12px',
              backgroundColor: '#FEF3C7',
              borderRadius: '8px',
              border: '1px solid #F59E0B'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                marginBottom: '8px'
              }}>
                <span style={{ color: '#92400E', fontSize: '12px', fontWeight: '600' }}>
                  📱 Para Android (si el selector no funciona):
                </span>
              </div>
              
              {/* Direct JSON Input */}
              <div style={{ marginBottom: '12px' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '4px',
                  fontSize: '12px',
                  color: '#92400E'
                }}>
                  Pegar JSON directamente:
                </label>
                <textarea
                  value={jsonInput}
                  onChange={(e) => setJsonInput(e.target.value)}
                  placeholder="Pega aquí el contenido JSON del archivo..."
                  style={{
                    width: '100%',
                    minHeight: '100px',
                    padding: '8px',
                    border: '1px solid #F59E0B',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontFamily: 'monospace',
                    resize: 'vertical'
                  }}
                />
                <button
                  onClick={() => {
                    if (jsonInput.trim()) {
                      addDebugLog('JSON content pasted directly');
                      setImportMode('json');
                    } else {
                      alert('Por favor pega contenido JSON primero');
                    }
                  }}
                  style={{
                    backgroundColor: '#F59E0B',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '6px 12px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    marginTop: '4px'
                  }}
                >
                  Usar JSON Pegado
                </button>
              </div>
              
              {/* File Path Input */}
              <div style={{
                display: 'flex',
                gap: '8px',
                alignItems: 'center'
              }}>
                <input
                  type="text"
                  value={manualFilePath}
                  onChange={(e) => setManualFilePath(e.target.value)}
                  placeholder="Ruta del archivo (ej: /storage/emulated/0/Download/export.json)"
                  style={{
                    flex: 1,
                    padding: '8px',
                    border: '1px solid #D1D5DB',
                    borderRadius: '4px',
                    fontSize: '12px'
                  }}
                />
                <button
                  onClick={() => {
                    addDebugLog(`Manual path entered: ${manualFilePath}`);
                    // For now, just log the path - you can implement file reading later
                    alert(`Ruta ingresada: ${manualFilePath}\n\nEsta funcionalidad se implementará próximamente.`);
                  }}
                  style={{
                    backgroundColor: '#F59E0B',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '8px 12px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    whiteSpace: 'nowrap'
                  }}
                >
                  Probar Ruta
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Import Result */}
        {importResult && (
          <div style={{
            marginBottom: '20px',
            padding: '16px',
            borderRadius: '12px',
            backgroundColor: importState === 'success' ? '#ECFDF5' : '#FEF2F2',
            border: `1px solid ${importState === 'success' ? '#A7F3D0' : '#FECACA'}`
          }}>
            {importState === 'success' ? (
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                <CheckCircle size={16} style={{ color: '#059669', marginRight: '8px' }} />
                <span style={{ color: '#065F46', fontWeight: '600' }}>
                  Importación Exitosa
                </span>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                <AlertCircle size={16} style={{ color: '#DC2626', marginRight: '8px' }} />
                <span style={{ color: '#991B1B', fontWeight: '600' }}>
                  Error de Importación
                </span>
              </div>
            )}
            
            {importResult.error && (
              <p style={{ margin: 0, color: '#991B1B', fontSize: '14px' }}>
                {importResult.error}
              </p>
            )}
            
            {importResult.import && (
              <div style={{ fontSize: '14px', color: '#065F46' }}>
                <p style={{ margin: '8px 0' }}>
                  ✅ Importadas: {importResult.import.imported} grabaciones
                </p>
                <p style={{ margin: '8px 0' }}>
                  ⏭️ Omitidas: {importResult.import.skipped} grabaciones
                </p>
                {importResult.import.errors > 0 && (
                  <p style={{ margin: '8px 0', color: '#991B1B' }}>
                    ❌ Errores: {importResult.import.errors} grabaciones
                  </p>
                )}
                {importResult.import.tracklogImported && (
                  <p style={{ margin: '8px 0' }}>
                    🗺️ Registro de ruta importado exitosamente
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div style={{
          display: 'flex',
          gap: '12px',
          justifyContent: 'flex-end'
        }}>
          <button
            onClick={resetImport}
            style={{
              padding: '12px 20px',
              border: '1px solid #D1D5DB',
              backgroundColor: 'white',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              color: '#374151'
            }}
          >
            Reiniciar
          </button>
          
          <button
            onClick={handleValidateOnly}
            disabled={importState === 'importing'}
            style={{
              padding: '12px 20px',
              border: '1px solid #3B82F6',
              backgroundColor: 'white',
              borderRadius: '8px',
              cursor: importState === 'importing' ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              color: '#3B82F6',
              opacity: importState === 'importing' ? 0.5 : 1
            }}
          >
            Solo Validar
          </button>
          
          <button
            onClick={handleImport}
            disabled={importState === 'importing'}
            style={{
              padding: '12px 24px',
              border: 'none',
              backgroundColor: importState === 'importing' ? '#9CA3AF' : '#3B82F6',
              borderRadius: '8px',
              cursor: importState === 'importing' ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              color: 'white'
            }}
          >
            {importState === 'importing' ? 'Importando...' : 'Importar Datos'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImportModal; 