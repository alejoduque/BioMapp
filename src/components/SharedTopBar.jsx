import React from 'react';
import { withStyles } from '@mui/material/styles';
import Input from '@mui/material/Input';
import { Mic, MapPin, MapPinOff, ArrowLeft, RefreshCw, ZoomIn, ZoomOut, Layers, Map, Activity, Play, ChevronDown, Info, Upload, Download } from 'lucide-react';
import markerIconUrl from 'leaflet/dist/images/marker-icon.png';
import TracklogImportModal from './TracklogImportModal.jsx';

class SharedTopBar extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      layerMenuOpen: false,
      showLayerInfo: false,
      showImportModal: false
    };
    this.infoModalRef = React.createRef();
  }

  handleChange = event => {
    if (this.props.updateQuery) {
      this.props.updateQuery(event.target.value)
    }
  }

  handleZoomIn = () => {
    if (this.props.mapInstance) {
      this.props.mapInstance.zoomIn();
    }
  }

  handleZoomOut = () => {
    if (this.props.mapInstance) {
      this.props.mapInstance.zoomOut();
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
    // Add click outside handler
    document.addEventListener('click', this.handleClickOutside);
  }

  componentWillUnmount() {
    // Remove click outside handler
    document.removeEventListener('click', this.handleClickOutside);
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
          {/* Back to Menu Button - Compact, just 'Back' */}
          {this.props.onBackToLanding && (
            <button 
              onClick={this.props.onBackToLanding} 
              style={{
                ...bottomButtonStyle,
                padding: '10px 16px',
                fontSize: '15px',
                height: '40px',
                display: 'flex',
                alignItems: 'center',
                minWidth: '64px',
                maxWidth: '90px',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                gap: '4px' // Reduce gap between arrow and text
              }}
              onMouseEnter={(e) => {
                e.target.style.transform = 'scale(1.05)';
                e.target.style.boxShadow = unifiedShadowHover;
              }}
              onMouseLeave={(e) => {
                e.target.style.transform = 'scale(1)';
                e.target.style.boxShadow = unifiedShadow;
              }}
              title="Volver"
            >
              <ArrowLeft size={20} style={{minWidth: 20, minHeight: 20}}/>
              <span>Volver</span>
            </button>
          )}

          {/* Zoom Controls - Center */}
          {this.props.showZoomControls && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: '40px',
              flexShrink: 0
            }}>
              <button
                onClick={() => {
                  if (this.props.mapInstance) {
                    const currentZoom = this.props.mapInstance.getZoom();
                    this.props.mapInstance.setZoom(currentZoom + 1);
                  }
                }}
                style={{
                  ...bottomButtonStyle,
                  padding: '8px',
                  borderRadius: '50%',
                  width: '40px',
                  height: '40px',
                  justifyContent: 'center',
                  minWidth: '40px',
                  flexShrink: 0
                }}
                title="Acercar"
                disabled={!this.props.mapInstance}
              >
                <ZoomIn size={16} />
              </button>
              <button
                onClick={() => {
                  if (this.props.mapInstance) {
                    const currentZoom = this.props.mapInstance.getZoom();
                    this.props.mapInstance.setZoom(currentZoom - 1);
                  }
                }}
                style={{
                  ...bottomButtonStyle,
                  padding: '8px',
                  borderRadius: '50%',
                  width: '40px',
                  height: '40px',
                  justifyContent: 'center',
                  minWidth: '40px',
                  flexShrink: 0
                }}
                title="Alejar"
                disabled={!this.props.mapInstance}
              >
                <ZoomOut size={16} />
              </button>
              

            </div>
          )}

          {/* Layer Selector Dropdown - Right side, compact */}
          {this.props.showLayerSelector && (
            <div 
              ref={(el) => this.layerMenuRef = el}
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                height: '40px',
                minWidth: '90px', // Slightly wider to accommodate "Humanitarian"
                flexShrink: 0,
                whiteSpace: 'nowrap',
                zIndex: 1003, // Ensure dropdown appears above other elements
                marginTop: '20px', // Add top margin to ensure dropdown has space above
                overflow: 'visible', // Critical: Allow dropdown to extend beyond container
              }}>
              <button
                onClick={this.toggleLayerMenu}
                style={{
                  ...bottomButtonStyle,
                  padding: '8px 12px',
                  fontSize: '13px',
                  height: '40px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  minWidth: '90px', // Slightly wider to accommodate "Humanitarian"
                  flexShrink: 0,
                  backgroundColor: 'rgba(255, 255, 255, 0.85)',
                  color: '#1F2937',
                  position: 'relative', // Ensure proper positioning context
                }}
                title="Seleccionar Capa de Mapa"
              >
                <Layers size={16} />
                <ChevronDown size={14} style={{ 
                  transform: this.state.layerMenuOpen ? 'rotate(0deg)' : 'rotate(180deg)',
                  transition: 'transform 0.2s ease'
                }} />
              </button>
              
              {/* Dropdown Menu */}
              {this.state.layerMenuOpen && (
                <div style={{
                  position: 'fixed', // Use fixed positioning to avoid parent clipping
                  bottom: 'auto', // Reset bottom positioning
                  top: 'auto', // Reset top positioning
                  left: '50%', // Center horizontally
                  transform: 'translateX(-50%)', // Center the dropdown
                  marginTop: '-280px', // Position above the layer selector button
                  background: 'rgba(255, 255, 255, 0.95)',
                  borderRadius: '12px',
                  boxShadow: unifiedShadow,
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(0,0,0,0.1)',
                  zIndex: 1005, // Highest z-index to ensure visibility
                  overflow: 'visible', // Allow dropdown to extend beyond container
                  minHeight: '200px', // Ensure enough space for 4 options
                  maxHeight: '300px', // Prevent excessive height
                  width: '120px', // Fixed width for consistency
                }}>
                  <button
                    onClick={() => this.handleLayerChange('OpenStreetMap')}
                    style={{
                      width: '100%',
                      padding: '14px 16px',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: '600',
                      color: this.props.currentLayer === 'OpenStreetMap' ? '#10B981' : '#1F2937',
                      backgroundColor: this.props.currentLayer === 'OpenStreetMap' ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.backgroundColor = this.props.currentLayer === 'OpenStreetMap' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(0,0,0,0.05)';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.backgroundColor = this.props.currentLayer === 'OpenStreetMap' ? 'rgba(16, 185, 129, 0.1)' : 'transparent';
                    }}
                    title="OpenStreetMap"
                  >
                    OSM
                  </button>
                  <button
                    onClick={() => this.handleLayerChange('OpenTopoMap')}
                    style={{
                      width: '100%',
                      padding: '14px 16px',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: '600',
                      color: this.props.currentLayer === 'OpenTopoMap' ? '#10B981' : '#1F2937',
                      backgroundColor: this.props.currentLayer === 'OpenTopoMap' ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.backgroundColor = this.props.currentLayer === 'OpenTopoMap' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(0,0,0,0.05)';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.backgroundColor = this.props.currentLayer === 'OpenTopoMap' ? 'rgba(16, 185, 129, 0.1)' : 'transparent';
                    }}
                    title="OpenTopoMap (Contornos/Sombreado)"
                  >
                    Topo
                  </button>
                  <button
                    onClick={() => this.handleLayerChange('CartoDB')}
                    style={{
                      width: '100%',
                      padding: '14px 16px',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: '600',
                      color: this.props.currentLayer === 'CartoDB' ? '#10B981' : '#1F2937',
                      backgroundColor: this.props.currentLayer === 'CartoDB' ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.backgroundColor = this.props.currentLayer === 'CartoDB' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(0,0,0,0.05)';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.backgroundColor = this.props.currentLayer === 'CartoDB' ? 'rgba(16, 185, 129, 0.1)' : 'transparent';
                    }}
                    title="CartoDB Positron"
                  >
                    Carto
                  </button>
                  <button onClick={() => this.handleLayerChange('OSMHumanitarian')}
                    style={{
                      width: '100%',
                      padding: '14px 16px',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: '600',
                      color: this.props.currentLayer === 'OSMHumanitarian' ? '#10B981' : '#1F2937',
                      backgroundColor: this.props.currentLayer === 'OSMHumanitarian' ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.backgroundColor = this.props.currentLayer === 'OSMHumanitarian' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(0,0,0,0.05)';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.backgroundColor = this.props.currentLayer === 'OSMHumanitarian' ? 'rgba(16, 185, 129, 0.1)' : 'transparent';
                    }}
                    title="OSM Humanitario"
                  >
                    Humanitarian
                  </button>
                  <button onClick={() => this.handleLayerChange('StadiaSatellite')}
                    style={{
                      width: '100%',
                      padding: '14px 16px',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: '600',
                      color: this.props.currentLayer === 'StadiaSatellite' ? '#10B981' : '#1F2937',
                      backgroundColor: this.props.currentLayer === 'StadiaSatellite' ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.backgroundColor = this.props.currentLayer === 'StadiaSatellite' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(0,0,0,0.05)';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.backgroundColor = this.props.currentLayer === 'StadiaSatellite' ? 'rgba(16, 185, 129, 0.1)' : 'transparent';
                    }}
                    title="Stadia Satellite"
                  >
                    Satélite
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Breadcrumb Controls */}
          {this.props.showBreadcrumbs !== undefined && (
            <div style={{
              display: 'flex',
              gap: '4px',
              alignItems: 'center',
              height: '40px',
              minWidth: '120px',
              flexShrink: 0,
              whiteSpace: 'nowrap',
            }}>
              <button
                onClick={this.props.onToggleBreadcrumbs}
                style={{
                  ...bottomButtonStyle,
                  padding: '8px 12px',
                  fontSize: '13px',
                  height: '40px',
                  display: 'flex',
                  alignItems: 'center',
                  minWidth: '56px',
                  flexShrink: 0,
                  backgroundColor: this.props.showBreadcrumbs ? '#10B981' : 'rgba(255, 255, 255, 0.85)',
                  color: this.props.showBreadcrumbs ? 'white' : '#1F2937'
                }}
                title="Rastro de Migas de Pan"
              >
                <Map size={16} />
              </button>
              {this.props.showBreadcrumbs && (
                <>
                  <button
                    onClick={() => this.props.onSetBreadcrumbVisualization('line')}
                    style={{
                      ...bottomButtonStyle,
                      padding: '6px',
                      borderRadius: '50%',
                      width: '32px',
                      height: '32px',
                      justifyContent: 'center',
                      minWidth: '32px',
                      flexShrink: 0,
                      backgroundColor: this.props.breadcrumbVisualization === 'line' ? '#3B82F6' : 'rgba(255, 255, 255, 0.85)',
                      color: this.props.breadcrumbVisualization === 'line' ? 'white' : '#1F2937'
                    }}
                    title="Vista de Línea"
                  >
                    <Activity size={14} />
                  </button>
                  <button
                    onClick={() => this.props.onSetBreadcrumbVisualization('heatmap')}
                    style={{
                      ...bottomButtonStyle,
                      padding: '6px',
                      borderRadius: '50%',
                      width: '32px',
                      height: '32px',
                      justifyContent: 'center',
                      minWidth: '32px',
                      flexShrink: 0,
                      backgroundColor: this.props.breadcrumbVisualization === 'heatmap' ? '#EF4444' : 'rgba(255, 255, 255, 0.85)',
                      color: this.props.breadcrumbVisualization === 'heatmap' ? 'white' : '#1F2937'
                    }}
                    title="Vista de Mapa de Calor"
                  >
                    <Map size={14} />
                  </button>
                  <button
                    onClick={() => this.props.onSetBreadcrumbVisualization('animated')}
                    style={{
                      ...bottomButtonStyle,
                      padding: '6px',
                      borderRadius: '50%',
                      width: '32px',
                      height: '32px',
                      justifyContent: 'center',
                      minWidth: '32px',
                      flexShrink: 0,
                      backgroundColor: this.props.breadcrumbVisualization === 'animated' ? '#8B5CF6' : 'rgba(255, 255, 255, 0.85)',
                      color: this.props.breadcrumbVisualization === 'animated' ? 'white' : '#1F2937'
                    }}
                    title="Reproducción Animada"
                  >
                    <Play size={14} />
                  </button>
                </>
              )}
            </div>
          )}

          {/* Import Button (icon = Download for importing into the app) */}
          {this.props.showImportButton && (
            <button
              onClick={this.toggleImportModal}
              style={{
                ...bottomButtonStyle,
                padding: '8px 12px',
                fontSize: '13px',
                height: '40px',
                display: 'flex',
                alignItems: 'center',
                minWidth: '56px',
                flexShrink: 0,
                backgroundColor: 'rgba(255, 255, 255, 0.85)',
                color: '#1F2937'
              }}
              title="Importar Tracklog"
            >
              <Download size={16} />
            </button>
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
        </div>

        {/* Main top bar controls (location, search, mic) */}
        <div
          className="absolute pin-t pin-r m-2 mr-16 flex items-center"
          style={{
            position: 'fixed',
            top: 'max(calc(env(safe-area-inset-top, 0px) + 40px), 64px)',
            left: 0,
            right: 0,
            zIndex: 1001,
            height: '40px',
            minHeight: '40px',
            maxHeight: '44px',
            fontSize: '13px',
            padding: '0 4px',
            background: 'rgba(255,255,255,0.95)',
            borderRadius: '0 0 10px 10px',
            boxShadow: unifiedShadow,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            width: '100vw',
            maxWidth: '100vw',
            overflow: 'hidden',
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
                filter: this.props.userLocation ? 'hue-rotate(200deg) brightness(1.2)' : 'none',
                transition: 'filter 0.3s ease'
              }} 
            />
          </button>

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
            width: 'min(92vw, 640px)',
            maxWidth: '92vw',
            maxHeight: '85vh',
            overflowY: 'auto',
            overflowX: 'hidden',
            padding: '16px'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px',
              borderBottom: '2px solid #E5E7EB',
              paddingBottom: '12px'
            }}>
              <h2 style={{
                margin: 0,
                fontSize: '20px',
                fontWeight: '700',
                color: '#1F2937'
              }}>
                💡 Guía de Uso de SoundWalk
              </h2>
              <button
                onClick={this.toggleLayerInfo}
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
                title="Cerrar"
              >
                ×
              </button>
            </div>
            <div style={{
              background: 'linear-gradient(135deg,rgba(235, 248, 255, 0.62) 0%,rgba(225, 245, 254, 0.45) 100%)',
              borderRadius: '12px',
              padding: '20px',
              color: '#2D3748',
              boxShadow: '0 4px 12px rgba(59, 130, 246, 0.1)',
              marginBottom: '16px',
              border: '1px solid #BEE3F8'
            }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '700' }}>
                🇪🇸 Consejos de Uso
              </h3>
              <div style={{ fontSize: '12px', lineHeight: '1.5', opacity: 0.9 }}>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: '600' }}>🎯 Para Nuevos Usuarios:</h4>
                <ul style={{ margin: '0 0 16px 0', paddingLeft: '20px' }}>
                  <li><strong>Comienza con Info de Capas</strong> para entender las opciones del mapa</li>
                  <li><strong>Usa el Botón Atrás</strong> para navegar entre modos</li>
                  <li><strong>Verifica el Estado de Ubicación</strong> para asegurar que GPS funcione</li>
                  <li><strong>Prueba diferentes capas</strong> para diferentes actividades</li>
                </ul>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: '600' }}>🎙️ Para Grabar:</h4>
                <ul style={{ margin: '0 0 16px 0', paddingLeft: '20px' }}>
                  <li><strong>Asegura que GPS esté activo</strong> (pin marcador)</li>
                  <li><strong>Elige la capa apropiada</strong> para tu entorno</li>
                  <li><strong>Usa el botón de micrófono</strong> para comenzar a grabar</li>
                  <li><strong>Revisa las migas de pan</strong> para rastrear tu ruta</li>
                </ul>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: '600' }}>🗺️ Para Navegación:</h4>
                <ul style={{ margin: '0 0 0 0', paddingLeft: '20px' }}>
                  <li><strong>Usa controles de zoom</strong> para ajustar el nivel de detalle</li>
                  <li><strong>Cambia capas</strong> para diferentes perspectivas</li>
                  <li><strong>Usa recentrar</strong> para volver a tu ubicación</li>
                  <li><strong>Activa migas de pan</strong> para rastrear movimiento</li>
                </ul>
              </div>
            </div>
            <div style={{
              background: '#F9FAFB',
              borderRadius: '8px',
              padding: '16px',
              marginTop: '16px',
              border: '1px solid #E5E7EB'
            }}>
              <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: '600', color: '#374151' }}>
                🎯 Referencia Rápida:
              </h4>
              <div style={{ fontSize: '11px', color: '#6B7280', lineHeight: '1.5' }}>
                <p style={{ margin: '0 0 8px 0' }}>
                  Usa migas de pan en todos los modos para rastrear tu ruta de movimiento
                </p>
                <p style={{ margin: 0 }}>
                  El cambio de capas funciona idénticamente en Collector, SoundWalk y SoundWalkAndroid
                </p>
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
              // Optionally refresh the map or show success message
              if (this.props.onImportComplete) {
                this.props.onImportComplete(result);
              }
            }}
          />
        )}
      </>
    )
  }
}

export default SharedTopBar 