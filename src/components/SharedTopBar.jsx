import React from 'react';
import { withStyles } from '@mui/material/styles';
import Input from '@mui/material/Input';
import { Mic, MapPin, MapPinOff, ArrowLeft, RefreshCw, ZoomIn, ZoomOut, Layers, Map, Activity, Play, ChevronDown, Info } from 'lucide-react';
import markerIconUrl from 'leaflet/dist/images/marker-icon.png';

class SharedTopBar extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      layerMenuOpen: false,
      showLayerInfo: false
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
    const isInfoButton = event.target.closest('button[title="Usage Guide"]');
    
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
              title="Back"
            >
              <ArrowLeft size={20} style={{minWidth: 20, minHeight: 20}}/>
              <span>Back</span>
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
                title="Zoom in"
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
                title="Zoom out"
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
                title="Select Map Layer"
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
                    title="OpenTopoMap (Contours/Hillshade)"
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
                  <button
                    onClick={() => this.handleLayerChange('OSMHumanitarian')}
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
                    title="OSM Humanitarian"
                  >
                    Humanitarian
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
                title="Toggle Breadcrumb Trail"
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
                    title="Line View"
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
                    title="Heat Map View"
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
                    title="Animated Playback"
                  >
                    <Play size={14} />
                  </button>
                </>
              )}
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
              title={this.props.isRecording ? 'Recording...' : 'Record Audio'}
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
            title="Usage Guide"
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
            title={this.props.userLocation ? "Recenter map to your location" : "Request GPS access"}
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

        {/* Info Overlay - Fullscreen, 75% transparent, closes on click/tap */}
        {this.state.showLayerInfo && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100vw',
              height: '100vh',
              background: 'rgba(30, 41, 59, 0.75)', // slate-800 with 75% opacity
              zIndex: 2000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'background 0.2s ease'
            }}
            onClick={() => this.setState({ showLayerInfo: false })}
          >
            <div
              style={{
                background: 'rgba(255,255,255,0.85)', // changed from 0.97 to 0.85
                borderRadius: '20px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
                padding: '32px 24px',
                maxWidth: 600,
                width: '90vw',
                maxHeight: '90vh',
                overflowY: 'auto',
                cursor: 'auto',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                border: '1.5px solid #e0e7ef',
              }}
              onClick={e => e.stopPropagation()}
            >
              <h2 style={{
                fontSize: 24,
                fontWeight: 800,
                marginBottom: 16,
                color: '#1E293B',
                letterSpacing: 1
              }}>
                BioMapp Guide
              </h2>
              <p style={{ fontSize: 15, color: '#334155', marginBottom: 20, textAlign: 'center' }}>
                Tap/click anywhere to close this overlay.
              </p>
              <div style={{ width: '100%', marginBottom: 24 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, background: 'none' }}>
                  <thead>
                    <tr style={{ background: '#F1F5F9' }}>
                      <th style={{ padding: 8, borderRadius: 6, color: '#334155', fontWeight: 700 }}>Icon</th>
                      <th style={{ padding: 8, color: '#334155', fontWeight: 700 }}>Function</th>
                      <th style={{ padding: 8, color: '#334155', fontWeight: 700 }}>Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ textAlign: 'center', padding: 8 }}><ArrowLeft size={18} /></td>
                      <td style={{ padding: 8 }}>Back</td>
                      <td style={{ padding: 8 }}>Return to previous screen or landing page</td>
                    </tr>
                    <tr>
                      <td style={{ textAlign: 'center', padding: 8 }}><Layers size={18} /></td>
                      <td style={{ padding: 8 }}>Layer Selector</td>
                      <td style={{ padding: 8 }}>Switch between map backgrounds (e.g. Humanitarian, Satellite)</td>
                    </tr>
                    <tr>
                      <td style={{ textAlign: 'center', padding: 8 }}><img src={markerIconUrl} alt="GPS" style={{ width: 18, height: 27, verticalAlign: 'middle' }} /></td>
                      <td style={{ padding: 8 }}>GPS/Location</td>
                      <td style={{ padding: 8 }}>Request GPS permission or recenter map to your location</td>
                    </tr>
                    <tr>
                      <td style={{ textAlign: 'center', padding: 8 }}><Mic size={18} /></td>
                      <td style={{ padding: 8 }}>Record</td>
                      <td style={{ padding: 8 }}>Start/stop audio recording (if available)</td>
                    </tr>
                    <tr>
                      <td style={{ textAlign: 'center', padding: 8 }}>🍞</td>
                      <td style={{ padding: 8 }}>Breadcrumbs</td>
                      <td style={{ padding: 8 }}>
                        Visualize your movement path on the map.<br/>
                        <strong>Modes:</strong> Line (simple path), Heatmap (density), Animated Trail (dynamic movement)
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div style={{ width: '100%', fontSize: 12, color: '#64748B', marginBottom: 8 }}>
                <strong>Breadcrumbs:</strong> Enable/disable to track your movement path on the map.<br/>
                <strong>Layer switching:</strong> Works identically across all modes.<br/>
                <strong>Usage tips:</strong> Try different layers for different activities, and always check GPS status before recording.
              </div>
            </div>
          </div>
        )}
      </>
    )
  }
}

export default SharedTopBar 