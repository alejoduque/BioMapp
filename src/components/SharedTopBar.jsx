import React from 'react';
import { withStyles } from '@mui/material/styles';
import Input from '@mui/material/Input';
import { Mic, MapPin, Layers, Map, Activity, Play, Pause, Info, Download, Route, Clock, Square, List } from 'lucide-react';
import breadcrumbService from '../services/breadcrumbService.js';
import markerIconUrl from 'leaflet/dist/images/marker-icon.png';
import TracklogImportModal from './TracklogImportModal.jsx';


class SharedTopBar extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      layerMenuOpen: false,
      showLayerInfo: false,
      showImportModal: false,
      deriveElapsed: 0,
      deriveDistance: 0,
      derivePaused: false,
      showEndConfirm: false,
      sessionTitle: ''
    };
    this.infoModalRef = React.createRef();
    this._deriveTimer = null;
    this._pausedTotal = 0;      // accumulated ms spent paused
    this._pausedAt = null;       // timestamp when pause started
  }

  handleChange = event => {
    if (this.props.updateQuery) {
      this.props.updateQuery(event.target.value)
    }
  }

  handleLayerChange = (layerName) => {
    if (this.props.onLayerChange) {
      this.props.onLayerChange(layerName);
    }
    this.setState({ layerMenuOpen: false });
  }

  toggleLayerMenu = () => {
    this.setState(prevState => ({ layerMenuOpen: !prevState.layerMenuOpen }));
  }

  toggleLayerInfo = () => {
    this.setState(prevState => ({ showLayerInfo: !prevState.showLayerInfo }));
  }

  toggleImportModal = () => {
    this.setState(prevState => ({ showImportModal: !prevState.showImportModal }));
  }

  componentDidMount() {
    document.addEventListener('click', this.handleClickOutside);
    this._startDeriveTimerIfNeeded();
  }

  componentDidUpdate(prevProps) {
    if (prevProps.walkSession !== this.props.walkSession) {
      this._startDeriveTimerIfNeeded();
    }
  }

  componentWillUnmount() {
    document.removeEventListener('click', this.handleClickOutside);
    if (this._deriveTimer) clearInterval(this._deriveTimer);
    breadcrumbService.setAutoResumeCallback(null);
  }

  _handleAutoResume = () => {
    // Called by breadcrumbService when user moves >5m while paused
    if (!this.state.derivePaused) return;
    this._pausedTotal += Date.now() - this._pausedAt;
    this._pausedAt = null;
    this.setState({ derivePaused: false });
    console.log('Derive auto-resumed: user moved >5m');
  }

  _startDeriveTimerIfNeeded() {
    if (this._deriveTimer) {
      clearInterval(this._deriveTimer);
      this._deriveTimer = null;
    }
    if (this.props.walkSession) {
      // Start paused — timer only begins when user walks >5m (auto-resume)
      this._pausedTotal = 0;
      this._pausedAt = Date.now();
      this._deriveStartedMoving = false;
      // Register auto-resume callback
      breadcrumbService.setAutoResumeCallback(this._handleAutoResume);
      // Start paused — breadcrumbService will auto-resume on >5m movement
      breadcrumbService.pauseTracking();
      this.setState({ derivePaused: true, deriveElapsed: 0, deriveDistance: 0 });
      const update = () => {
        if (this.state.derivePaused) return;
        const ms = Date.now() - this.props.walkSession.startTime - this._pausedTotal;
        const data = breadcrumbService.getSessionData();
        this.setState({
          deriveElapsed: Math.floor(ms / 1000),
          deriveDistance: data?.summary?.totalDistance || 0
        });
      };
      this._deriveTimer = setInterval(update, 1000);
    } else {
      breadcrumbService.setAutoResumeCallback(null);
      this.setState({ deriveElapsed: 0, deriveDistance: 0, derivePaused: false });
    }
  }

  _toggleDerivePause = () => {
    if (this.state.derivePaused) {
      // Resume
      this._pausedTotal += Date.now() - this._pausedAt;
      this._pausedAt = null;
      breadcrumbService.resumeTracking();
      this.setState({ derivePaused: false });
    } else {
      // Pause
      this._pausedAt = Date.now();
      breadcrumbService.pauseTracking();
      this.setState({ derivePaused: true });
    }
  }

  _formatTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  _formatDistance(meters) {
    if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
    return `${Math.round(meters)} m`;
  }

  handleClickOutside = (event) => {
    // Check if the click is on the info button itself - if so, don't close
    const isInfoButton = event.target.closest('button[title="Guía de Uso"]');
    
    if (this.layerMenuRef && !this.layerMenuRef.contains(event.target)) {
      this.setState({ layerMenuOpen: false });
    }
    if (this.state.showLayerInfo && this.infoModalRef && !this.infoModalRef.current.contains(event.target) && !isInfoButton) {
      this.setState({ showLayerInfo: false });
    }
  }

  render () {
    const locationStatus = this.props.userLocation ? 'active' : 'inactive';

    // Determine mic button color
    let micColor = '#ef4444'; // red (ready)
    if (this.props.isRecording) micColor = '#F59E42'; // amber (recording)
    if (this.props.isMicDisabled) micColor = '#9CA3AF'; // gray (disabled)

    // Unified shadow system
    const unifiedShadow = '0 4px 12px rgba(0,0,0,0.15), 0 2px 6px rgba(0,0,0,0.1)';
    const unifiedShadowHover = '0 6px 20px rgba(0,0,0,0.2), 0 3px 10px rgba(0,0,0,0.15)';
    
    // Common button style for bottom controls
    const bottomButtonStyle = {
      padding: '12px 16px',
      background: 'rgba(255, 255, 255, 0.80)',
      borderRadius: '12px',
      boxShadow: unifiedShadow,
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      border: 'none',
      cursor: 'pointer',
      transition: 'all 0.3s ease',
      backdropFilter: 'blur(10px)',
      fontSize: '14px',
      fontWeight: '600',
      color: '#1F2937',
      minWidth: 'auto'
    };

    return (
      <>
        {/* Bottom control bar - unified interface */}
        <div style={{
          position: 'fixed',
          bottom: 'max(env(safe-area-inset-bottom, 0px), 80px)',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1001,
          display: 'flex',
          gap: '12px',
          alignItems: 'center',
          flexWrap: 'nowrap', // Prevent wrapping
          justifyContent: 'center',
          maxWidth: 'calc(100vw - 16px)',
          overflow: 'visible', // Allow all child elements to extend beyond boundaries
        }}>
          {/* Breadcrumb Visualization Modes — always visible */}
          {this.props.showBreadcrumbs !== undefined && (
            <div style={{
              display: 'flex',
              gap: '4px',
              alignItems: 'center',
              height: '40px',
              flexShrink: 0,
            }}>
              <button
                onClick={() => {
                  if (this.props.showBreadcrumbs && this.props.breadcrumbVisualization === 'line') {
                    this.props.onToggleBreadcrumbs(); // toggle off
                  } else {
                    if (!this.props.showBreadcrumbs) this.props.onToggleBreadcrumbs();
                    this.props.onSetBreadcrumbVisualization('line');
                  }
                }}
                style={{
                  ...bottomButtonStyle,
                  padding: '6px',
                  borderRadius: '50%',
                  width: '36px',
                  height: '36px',
                  justifyContent: 'center',
                  minWidth: '36px',
                  flexShrink: 0,
                  backgroundColor: this.props.showBreadcrumbs && this.props.breadcrumbVisualization === 'line' ? '#3B82F6' : 'rgba(255, 255, 255, 0.85)',
                  color: this.props.showBreadcrumbs && this.props.breadcrumbVisualization === 'line' ? 'white' : '#1F2937'
                }}
                title="Vista de Línea"
              >
                <Activity size={16} />
              </button>
              <button
                onClick={() => {
                  if (this.props.showBreadcrumbs && this.props.breadcrumbVisualization === 'heatmap') {
                    this.props.onToggleBreadcrumbs();
                  } else {
                    if (!this.props.showBreadcrumbs) this.props.onToggleBreadcrumbs();
                    this.props.onSetBreadcrumbVisualization('heatmap');
                  }
                }}
                style={{
                  ...bottomButtonStyle,
                  padding: '6px',
                  borderRadius: '50%',
                  width: '36px',
                  height: '36px',
                  justifyContent: 'center',
                  minWidth: '36px',
                  flexShrink: 0,
                  backgroundColor: this.props.showBreadcrumbs && this.props.breadcrumbVisualization === 'heatmap' ? '#EF4444' : 'rgba(255, 255, 255, 0.85)',
                  color: this.props.showBreadcrumbs && this.props.breadcrumbVisualization === 'heatmap' ? 'white' : '#1F2937'
                }}
                title="Vista de Mapa de Calor"
              >
                <Map size={16} />
              </button>
              <button
                onClick={() => {
                  if (this.props.showBreadcrumbs && this.props.breadcrumbVisualization === 'animated') {
                    this.props.onToggleBreadcrumbs();
                  } else {
                    if (!this.props.showBreadcrumbs) this.props.onToggleBreadcrumbs();
                    this.props.onSetBreadcrumbVisualization('animated');
                  }
                }}
                style={{
                  ...bottomButtonStyle,
                  padding: '6px',
                  borderRadius: '50%',
                  width: '36px',
                  height: '36px',
                  justifyContent: 'center',
                  minWidth: '36px',
                  flexShrink: 0,
                  backgroundColor: this.props.showBreadcrumbs && this.props.breadcrumbVisualization === 'animated' ? '#8B5CF6' : 'rgba(255, 255, 255, 0.85)',
                  color: this.props.showBreadcrumbs && this.props.breadcrumbVisualization === 'animated' ? 'white' : '#1F2937'
                }}
                title="Reproducción Animada"
              >
                <span style={{ fontSize: '14px', lineHeight: 1 }}>〰️</span>
              </button>
            </div>
          )}

          {/* Custom Controls Slot */}
          {this.props.customControls && (
            <div style={{
              display: 'flex',
              gap: '4px',
              alignItems: 'center',
              height: '40px',
              flexShrink: 0,
              whiteSpace: 'nowrap',
            }}>
              {this.props.customControls}
            </div>
          )}

          {/* Derive Sonora Controls */}
          {this.props.onStartDerive && !this.props.walkSession && (
            <div style={{
              display: 'flex',
              gap: '6px',
              alignItems: 'center',
              height: '40px',
              flexShrink: 0,
            }}>
              <button
                onClick={this.props.onStartDerive}
                style={{
                  ...bottomButtonStyle,
                  padding: '8px 14px',
                  fontSize: '13px',
                  height: '40px',
                  backgroundColor: '#10B981',
                  color: 'white',
                  flexShrink: 0,
                }}
                title="Iniciar Deriva Sonora"
              >
                <Route size={16} />
                <span>Deriva</span>
              </button>
              <button
                onClick={this.props.onShowHistory}
                style={{
                  ...bottomButtonStyle,
                  padding: '8px',
                  borderRadius: '50%',
                  width: '40px',
                  height: '40px',
                  justifyContent: 'center',
                  minWidth: '40px',
                  flexShrink: 0,
                }}
                title="Historial de Derivas"
              >
                <List size={16} />
              </button>
            </div>
          )}

          {this.props.walkSession && (
            <div style={{
              display: 'flex',
              gap: '6px',
              alignItems: 'center',
              height: '40px',
              flexShrink: 0,
            }}>
              <button
                onClick={this.props.onShowHistory}
                style={{
                  ...bottomButtonStyle,
                  padding: '8px',
                  borderRadius: '50%',
                  width: '40px',
                  height: '40px',
                  justifyContent: 'center',
                  minWidth: '40px',
                  flexShrink: 0,
                }}
                title="Historial de Derivas"
              >
                <List size={16} />
              </button>
              <button
                onClick={() => this.setState({ showEndConfirm: true })}
                style={{
                  ...bottomButtonStyle,
                  padding: '8px 12px',
                  fontSize: '13px',
                  height: '40px',
                  backgroundColor: '#6B7280',
                  color: 'white',
                  flexShrink: 0,
                }}
                title="Finalizar Deriva"
              >
                <Square size={14} />
                <span>Fin</span>
              </button>
            </div>
          )}
        </div>

        {/* Floating derive stats pill — between Mic and Play FABs */}
        {this.props.walkSession && (
          <div
            onClick={() => this.setState({ showEndConfirm: true })}
            style={{
              position: 'fixed',
              bottom: '208px',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 1001,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              transition: 'opacity 0.3s ease',
              opacity: this.state.derivePaused ? 0.35 : 1,
            }}
          >
            <span style={{
              ...bottomButtonStyle,
              padding: '6px 14px',
              fontSize: '12px',
              height: '36px',
              gap: '6px',
              whiteSpace: 'nowrap',
            }}>
              <Clock size={13} />
              {this._formatTime(this.state.deriveElapsed)}
              <span style={{ opacity: 0.4 }}>&middot;</span>
              <MapPin size={13} />
              {this._formatDistance(this.state.deriveDistance)}
              <span style={{ opacity: 0.4 }}>&middot;</span>
              <Mic size={13} style={{ color: '#10B981' }} />
              <span style={{ color: '#10B981', fontWeight: '700' }}>{this.props.walkSession.recordingIds?.length || 0}</span>
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); this._toggleDerivePause(); }}
              style={{
                ...bottomButtonStyle,
                padding: '8px',
                borderRadius: '50%',
                width: '36px',
                height: '36px',
                justifyContent: 'center',
                minWidth: '36px',
                backgroundColor: this.state.derivePaused ? '#F59E42' : 'rgba(255, 255, 255, 0.85)',
                color: this.state.derivePaused ? 'white' : '#1F2937',
              }}
              title={this.state.derivePaused ? 'Reanudar Deriva' : 'Pausar Deriva'}
            >
              {this.state.derivePaused ? <Play size={14} /> : <Pause size={14} />}
            </button>
          </div>
        )}

        {/* Main top bar controls (location, search, mic) */}
        <div
          className=""
          style={{
            position: 'fixed',
            top: 'max(calc(env(safe-area-inset-top, 0px) + 40px), 64px)',
            left: '8px',
            right: '8px',
            zIndex: 1001,
            height: '40px',
            minHeight: '40px',
            maxHeight: '44px',
            fontSize: '13px',
            padding: '0 8px',
            background: 'rgba(255,255,255,0.95)',
            borderRadius: '12px',
            boxShadow: unifiedShadow,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            width: 'auto',
            maxWidth: 'calc(100vw - 16px)',
            overflow: 'visible',
            border: 'none',
            fontWeight: '600',
            color: '#1F2937',
            boxSizing: 'border-box'
          }}
        >
          {/* Mic Button (only if showMicButton is true) */}
          {this.props.showMicButton && (
            <button
              onClick={this.props.toggleAudioRecorder}
              style={{
                background: micColor,
                color: 'white',
                border: '2px solid white',
                borderRadius: '50%',
                padding: '7px', // smaller
                boxShadow: `0 4px 12px ${micColor}60, 0 2px 6px rgba(0,0,0,0.1)`,
                cursor: this.props.isMicDisabled ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: '28px',
                minHeight: '28px',
                marginRight: '4px',
                fontSize: '16px',
                animation: 'microphone-pulse 2s infinite',
                opacity: this.props.isMicDisabled ? 0.5 : 1
              }}
              title={this.props.isRecording ? 'Grabando...' : 'Grabar Audio'}
              disabled={this.props.isMicDisabled}
            >
              <img src="/ultrared.png" alt="Record" style={{ width: 20, height: 20, objectFit: 'contain', background: 'none' }} />
            </button>
          )}


          {/* Info Button */}
          <button
            onClick={this.toggleLayerInfo}
            style={{
              background: 'rgba(255, 255, 255, 0.9)',
              border: '2px solid rgba(0,0,0,0.1)',
              borderRadius: '50%',
              padding: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: '8px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.target.style.transform = 'scale(1.1)';
              e.target.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = 'scale(1)';
              e.target.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
            }}
            title="Guía de Uso"
          >
            <Info size={20} style={{ color: '#3B82F6' }} />
          </button>

          {/* GPS/Recenter Button */}
          <button
            onClick={() => {
              // First try to request GPS access if not already granted
              if (this.props.onRequestGPSAccess && (!this.props.userLocation || locationStatus !== 'active')) {
                this.props.onRequestGPSAccess();
              }
              // Then recenter if we have location
              if (this.props.onLocationRefresh && this.props.userLocation) {
                this.props.onLocationRefresh();
              }
            }}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.target.style.transform = 'scale(1.1)';
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = 'scale(1)';
            }}
            title={this.props.userLocation ? "Centrar el mapa en tu ubicación" : "Solicitar acceso a GPS"}
          >
            <img 
              src={markerIconUrl} 
              alt="Recenter" 
              style={{ 
                width: 24, 
                height: 36, 
                display: 'block',
                filter: this.props.userLocation ? 'saturate(1.8) brightness(1.1)' : 'grayscale(0.5) opacity(0.6)',
                transition: 'filter 0.3s ease'
              }} 
            />
          </button>

          {/* Layer Selector - icon-only, dropdown opens downward */}
          {this.props.showLayerSelector && (
            <div
              ref={(el) => this.layerMenuRef = el}
              style={{ position: 'relative', display: 'flex', alignItems: 'center' }}
            >
              <button
                onClick={this.toggleLayerMenu}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s ease'
                }}
                title="Seleccionar Capa de Mapa"
              >
                <Layers size={20} style={{ color: '#1F2937' }} />
              </button>
              {this.state.layerMenuOpen && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  marginTop: '6px',
                  background: 'rgba(255, 255, 255, 0.95)',
                  borderRadius: '12px',
                  boxShadow: unifiedShadow,
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(0,0,0,0.1)',
                  zIndex: 1005,
                  width: '120px',
                  overflow: 'hidden',
                }}>
                  {[
                    { key: 'OpenStreetMap', label: 'OSM', title: 'OpenStreetMap' },
                    { key: 'OpenTopoMap', label: 'Topo', title: 'OpenTopoMap (Contornos/Sombreado)' },
                    { key: 'CartoDB', label: 'Carto', title: 'CartoDB Positron' },
                    { key: 'OSMHumanitarian', label: 'Humanitarian', title: 'OSM Humanitario' },
                    { key: 'StadiaSatellite', label: 'Satélite', title: 'Stadia Satellite' },
                  ].map(layer => (
                    <button
                      key={layer.key}
                      onClick={() => this.handleLayerChange(layer.key)}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontWeight: '600',
                        color: this.props.currentLayer === layer.key ? '#10B981' : '#1F2937',
                        backgroundColor: this.props.currentLayer === layer.key ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.backgroundColor = this.props.currentLayer === layer.key ? 'rgba(16, 185, 129, 0.15)' : 'rgba(0,0,0,0.05)';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.backgroundColor = this.props.currentLayer === layer.key ? 'rgba(16, 185, 129, 0.1)' : 'transparent';
                      }}
                      title={layer.title}
                    >
                      {layer.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Import Button - icon-only */}
          {this.props.showImportButton && (
            <button
              onClick={this.toggleImportModal}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease'
              }}
              title="Importar Tracklog"
            >
              <Download size={20} style={{ color: '#1F2937' }} />
            </button>
          )}

          {/* Search Input (only if showSearch is true) */}
          {this.props.showSearch && (
            <div style={{ flex: '1 1 0', minWidth: 0, boxSizing: 'border-box', maxWidth: '100vw', overflow: 'hidden' }}>
              <Input
                onKeyPress={(ev) => {
                  if (ev.key === 'Enter') {
                    if (this.props.searchMapData) {
                      this.props.searchMapData(this.props.query)
                    }
                    ev.preventDefault();
                  }
                }}
                placeholder="Buscar por especie, notas, o ubicación"
                type="search"
                fullWidth
                value={this.props.query || ''}
                className=""
                onChange={this.handleChange}
                inputProps={{
                  'aria-label': 'Description',
                  style: { fontSize: '16px', padding: '8px 6px', maxWidth: '100%', width: '100%', boxSizing: 'border-box', overflow: 'hidden', textOverflow: 'ellipsis' }
                }}
                style={{ width: '100%', maxWidth: '100vw', boxSizing: 'border-box', overflow: 'hidden', textOverflow: 'ellipsis' }}
              />
            </div>
          )}

          {/* Custom Top Bar Content Slot */}
          {this.props.customTopBarContent && (
            <div style={{ flex: '1 1 0', minWidth: 0, boxSizing: 'border-box', maxWidth: '100vw', overflow: 'hidden' }}>
              {this.props.customTopBarContent}
            </div>
          )}
        </div>

          {/* Layer Information Table */}
        {this.state.showLayerInfo && (
          <div 
            ref={this.infoModalRef}
            style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'rgba(255, 255, 255, 0.98)',
            borderRadius: '16px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(0,0,0,0.1)',
            zIndex: 1006,
            width: 'min(92vw, 400px)',
            maxWidth: '92vw',
            maxHeight: '85vh',
            overflowY: 'auto',
            overflowX: 'hidden',
            padding: '16px 16px 12px'
          }}>
            <button
              onClick={this.toggleLayerInfo}
              style={{
                position: 'absolute',
                top: '8px',
                right: '8px',
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
            <div style={{ fontSize: '13px', lineHeight: '1.6', color: '#2D3748' }}>
              <div style={{ marginBottom: '14px' }}>
                <div style={{ fontWeight: '700', fontSize: '14px', marginBottom: '6px' }}>Barra superior</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 10px', fontSize: '12px' }}>
                  <span>ℹ️</span><span>Abre esta guia</span>
                  <span>📍</span><span>Centra el mapa en tu ubicacion / solicita GPS</span>
                  <span>🗺️</span><span>Cambia la capa del mapa (OSM, Topo, Carto, Satelite...)</span>
                  <span>⬇️</span><span>Importa una Deriva Sonora (.zip)</span>
                  <span>🔍</span><span>Busca grabaciones por especie, notas o ubicacion</span>
                </div>
              </div>
              <div style={{ marginBottom: '14px' }}>
                <div style={{ fontWeight: '700', fontSize: '14px', marginBottom: '6px' }}>Barra inferior</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 10px', fontSize: '12px' }}>
                  <span>🗺️</span><span>Modos de migas: linea, calor o animada (siempre visibles)</span>
                  <span>🟢</span><span><strong>Deriva</strong> — inicia una caminata sonora con tracklog GPS</span>
                  <span>⏸️</span><span>Pausa / reanuda la deriva (tiempo, GPS y tracklog se detienen)</span>
                  <span>⏹️</span><span><strong>Fin</strong> — guarda la sesion con nombre opcional</span>
                  <span>📋</span><span>Historial de derivas guardadas, con exportacion ZIP</span>
                </div>
              </div>
              <div style={{ marginBottom: '14px' }}>
                <div style={{ fontWeight: '700', fontSize: '14px', marginBottom: '6px' }}>Grabacion</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 10px', fontSize: '12px' }}>
                  <span>🎤</span><span>Boton rojo flotante — graba audio geoetiquetado</span>
                  <span>📍</span><span>Verifica que el pin marcador este azul (GPS activo) antes de grabar</span>
                  <span>▶️</span><span>Reproductor: cercanos, concatenado o Jamm</span>
                </div>
              </div>
              <div style={{
                background: '#F3F4F6',
                borderRadius: '8px',
                padding: '10px 12px',
                fontSize: '11px',
                color: '#6B7280',
                lineHeight: '1.5'
              }}>
                Pellizca para zoom. Toca marcadores para escuchar. Cada grabacion incluye coordenadas, hora y metadatos.
              </div>
            </div>
          </div>
        )}

        {/* Import Modal */}
        {this.state.showImportModal && (
          <TracklogImportModal
            isVisible={this.state.showImportModal}
            onClose={this.toggleImportModal}
            onImportComplete={(result) => {
              console.log('Import completed:', result);
              this.toggleImportModal();
              if (this.props.onImportComplete) {
                this.props.onImportComplete(result);
              }
            }}
          />
        )}

        {/* End Derive Confirmation Modal — Reproductor-style floating panel */}
        {this.state.showEndConfirm && this.props.walkSession && (
          <div style={{
            position: 'fixed',
            bottom: '190px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: '#ffffffbf',
            borderRadius: '16px',
            boxShadow: 'rgb(157 58 58 / 30%) 0px 10px 30px',
            padding: '20px',
            minWidth: '300px',
            maxWidth: '400px',
            width: '90%',
            zIndex: 10001,
            boxSizing: 'border-box'
          }}>
            <button
              onClick={() => this.setState({ showEndConfirm: false })}
              style={{
                position: 'absolute',
                top: '8px',
                right: '8px',
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
            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: '600' }}>
                Finalizar Deriva Sonora
              </h3>
              <p style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#6B7280' }}>
                {this._formatTime(this.state.deriveElapsed)} caminando — {this._formatDistance(this.state.deriveDistance)} — {this.props.walkSession.recordingIds?.length || 0} grabacion(es)
              </p>
              <button
                onClick={this._toggleDerivePause}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 20px',
                  backgroundColor: this.state.derivePaused ? '#F59E42' : '#3B82F6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
              >
                {this.state.derivePaused ? <Play size={16} /> : <Pause size={16} />}
                {this.state.derivePaused ? 'Reanudar' : 'Pausar'}
              </button>
            </div>
            <input
              type="text"
              value={this.state.sessionTitle}
              onChange={(e) => this.setState({ sessionTitle: e.target.value })}
              placeholder="Nombre de la deriva (opcional)"
              autoFocus
              maxLength={60}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #D1D5DB',
                borderRadius: '8px',
                fontSize: '14px',
                outline: 'none',
                boxSizing: 'border-box',
                marginBottom: '14px'
              }}
            />
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => {
                  if (this.props.onEndDerive) {
                    this.props.onEndDerive(this.state.sessionTitle.trim());
                  }
                  this.setState({ showEndConfirm: false, sessionTitle: '' });
                }}
                style={{
                  flex: 1,
                  padding: '10px',
                  backgroundColor: '#10B981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
              >
                Guardar Deriva
              </button>
              <button
                onClick={() => this.setState({ showEndConfirm: false })}
                style={{
                  padding: '10px 16px',
                  backgroundColor: 'white',
                  color: '#374151',
                  border: '1px solid #D1D5DB',
                  borderRadius: '8px',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </>
    )
  }
}

export default SharedTopBar 