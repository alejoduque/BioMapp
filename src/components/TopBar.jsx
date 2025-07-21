import React from 'react';
import { withStyles } from '@mui/material/styles';
import Input from '@mui/material/Input';
import { Mic, MapPin, MapPinOff, ArrowLeft, RefreshCw, ZoomIn, ZoomOut, Layers, Map, Activity, Play, ChevronDown } from 'lucide-react';
import markerIconUrl from 'leaflet/dist/images/marker-icon.png';

class TopBar extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      layerMenuOpen: false
    };
  }

  handleChange = event => {
    this.props.updateQuery(event.target.value)
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

  componentDidMount() {
    // Add click outside handler
    document.addEventListener('click', this.handleClickOutside);
  }

  componentWillUnmount() {
    // Remove click outside handler
    document.removeEventListener('click', this.handleClickOutside);
  }

  handleClickOutside = (event) => {
    if (this.layerMenuRef && !this.layerMenuRef.contains(event.target)) {
      this.setState({ layerMenuOpen: false });
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
          bottom: '80px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1001,
          display: 'flex',
          gap: '12px',
          alignItems: 'center',
          flexWrap: 'nowrap', // Prevent wrapping
          justifyContent: 'center',
          maxWidth: 'calc(100vw - 16px)',
          overflowX: 'auto', // Allow horizontal scroll if needed
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

          {/* Layer Selector Dropdown - Right side, compact */}
          <div 
            ref={(el) => this.layerMenuRef = el}
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              height: '40px',
              minWidth: '80px',
              flexShrink: 0,
              whiteSpace: 'nowrap',
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
                minWidth: '80px',
                flexShrink: 0,
                backgroundColor: 'rgba(255, 255, 255, 0.85)',
                color: '#1F2937'
              }}
              title="Seleccionar Capa de Mapa"
            >
              <Layers size={16} />
              <ChevronDown size={14} style={{ 
                transform: this.state.layerMenuOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s ease'
              }} />
            </button>
            
            {/* Dropdown Menu */}
            {this.state.layerMenuOpen && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: '0',
                right: '0',
                marginTop: '8px',
                background: 'rgba(255, 255, 255, 0.95)',
                borderRadius: '12px',
                boxShadow: unifiedShadow,
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(0,0,0,0.1)',
                zIndex: 1002,
                overflow: 'hidden'
              }}>
                <button
                  onClick={() => this.handleLayerChange('OpenStreetMap')}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
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
                    padding: '10px 12px',
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
                  title="OpenTopoMap (Contours/Hillshade)"
                >
                  Topo
                </button>
                <button
                  onClick={() => this.handleLayerChange('CartoDB')}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
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
              </div>
            )}
          </div>

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
        </div>

        {/* Main top bar controls (location, search, mic) */}
        <div
          className="absolute pin-t pin-r m-2 mr-16 flex items-center"
          style={{
            position: 'fixed',
            top: 'env(safe-area-inset-top, 4px)',
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
          {/* Mic Button (always present in Collector) */}
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

          {/* Location status indicator */}
          <div className="mr-8 flex items-center">
            {locationStatus === 'active' ? (
              <MapPin size={40} style={{ color: this.props.userLocation ? '#10B981' : '#374151' }} title="Ubicación activa" />
            ) : (
              <MapPinOff size={40} className="text-gray-400" title="Ubicación inactiva" />
            )}
            {/* Removed GPS Status Text (ON/OFF) */}
            <button
              onClick={() => {
                if (this.props.onLocationRefresh) {
                  this.props.onLocationRefresh();
                }
              }}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                marginLeft: '8px',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title="Centrar el mapa en tu ubicación"
            >
              <img src={markerIconUrl} alt="Recenter" style={{ width: 24, height: 36, display: 'block' }} />
            </button>
          </div>

          <div style={{ flex: '1 1 0', minWidth: 0, boxSizing: 'border-box', maxWidth: '100vw', overflow: 'hidden' }}>
            <Input
              onKeyPress={(ev) => {
                if (ev.key === 'Enter') {
                  this.props.searchMapData(this.props.query)
                  ev.preventDefault();
                }
              }}
              placeholder="Buscar por especie, notas, o ubicación"
              type="search"
              fullWidth
              value={this.props.query}
              className=""
              onChange={this.handleChange}
              inputProps={{
                'aria-label': 'Description',
                style: { fontSize: '16px', padding: '8px 6px', maxWidth: '100%', width: '100%', boxSizing: 'border-box', overflow: 'hidden', textOverflow: 'ellipsis' }
              }}
              style={{ width: '100%', maxWidth: '100vw', boxSizing: 'border-box', overflow: 'hidden', textOverflow: 'ellipsis' }}
            />
          </div>
        </div>
      </>
    )
  }
}

export default TopBar
