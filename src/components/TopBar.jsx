import React from 'react';
import { withStyles } from '@mui/material/styles';
import Input from '@mui/material/Input';
import { Mic, MapPin, MapPinOff, ArrowLeft, RefreshCw, ZoomIn, ZoomOut, Layers } from 'lucide-react';
import markerIconUrl from 'leaflet/dist/images/marker-icon.png';

class TopBar extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      zoomOverlay: null // For visual overlay
    };
    this.zoomOverlayTimeout = null;
  }

  showZoomOverlay = (msg) => {
    this.setState({ zoomOverlay: msg });
    if (this.zoomOverlayTimeout) clearTimeout(this.zoomOverlayTimeout);
    this.zoomOverlayTimeout = setTimeout(() => {
      this.setState({ zoomOverlay: null });
    }, 2000);
  }

  componentWillUnmount() {
    if (this.zoomOverlayTimeout) clearTimeout(this.zoomOverlayTimeout);
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
  }

  render () {
    const locationStatus = this.props.userLocation ? 'active' : 'inactive';

    // Determine mic button color
    let micColor = '#ef4444'; // red (ready)
    if (this.props.isRecording) micColor = '#F59E42'; // amber (recording)
    if (this.props.isMicDisabled) micColor = '#9CA3AF'; // gray (disabled)

    // Common button style for bottom controls
    const bottomButtonStyle = {
      padding: '12px 16px',
      background: 'rgba(255, 255, 255, 0.85)',
      borderRadius: '12px',
      boxShadow: '0 8px 25px rgba(0,0,0,0.2), 0 4px 10px rgba(0,0,0,0.1)',
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
        {/* Visual overlay for zoom feedback */}
        {this.state.zoomOverlay && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            zIndex: 2000,
            background: 'rgba(16, 185, 129, 0.95)',
            color: 'white',
            fontWeight: 700,
            fontSize: 20,
            textAlign: 'center',
            padding: '16px 0',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
          }}>
            {this.state.zoomOverlay}
          </div>
        )}
        {/* Bottom control bar - unified interface */}
        <div style={{
          position: 'fixed',
          bottom: '60px',
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
                e.target.style.boxShadow = '0 12px 35px rgba(0,0,0,0.25), 0 6px 15px rgba(0,0,0,0.15)';
              }}
              onMouseLeave={(e) => {
                e.target.style.transform = 'scale(1)';
                e.target.style.boxShadow = '0 8px 25px rgba(0,0,0,0.2), 0 4px 10px rgba(0,0,0,0.1)';
              }}
              title="Back"
            >
              <ArrowLeft size={24} style={{minWidth: 24, minHeight: 24}} />
              <span>Back</span>
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
                console.log('Zoom In clicked, mapInstance:', this.props.mapInstance);
                if (this.props.mapInstance) {
                  const currentZoom = this.props.mapInstance.getZoom();
                  console.log('Current zoom:', currentZoom);
                  this.showZoomOverlay('Zoom In! Current zoom: ' + currentZoom);
                  this.props.mapInstance.setZoom(currentZoom + 1);
                } else {
                  console.log('Map instance is null/undefined');
                  this.showZoomOverlay('Zoom In: map not ready');
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
                console.log('Zoom Out clicked, mapInstance:', this.props.mapInstance);
                if (this.props.mapInstance) {
                  const currentZoom = this.props.mapInstance.getZoom();
                  console.log('Current zoom:', currentZoom);
                  this.showZoomOverlay('Zoom Out! Current zoom: ' + currentZoom);
                  this.props.mapInstance.setZoom(currentZoom - 1);
                } else {
                  console.log('Map instance is null/undefined');
                  this.showZoomOverlay('Zoom Out: map not ready');
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

          {/* Layer Selector - Right side, same height as Back to Menu */}
          <div style={{
            display: 'flex',
            gap: '4px',
            alignItems: 'center',
            height: '40px',
            minWidth: '180px',
            flexShrink: 0,
            whiteSpace: 'nowrap',
          }}>
            <button
              onClick={() => this.handleLayerChange('OpenStreetMap')}
              style={{
                ...bottomButtonStyle,
                padding: '8px 12px',
                fontSize: '13px',
                height: '40px',
                display: 'flex',
                alignItems: 'center',
                minWidth: '56px',
                flexShrink: 0,
                backgroundColor: this.props.currentLayer === 'OpenStreetMap' ? '#10B981' : 'rgba(255, 255, 255, 0.85)',
                color: this.props.currentLayer === 'OpenStreetMap' ? 'white' : '#1F2937'
              }}
              title="OpenStreetMap"
            >
              OSM
            </button>
            <button
              onClick={() => this.handleLayerChange('OpenTopoMap')}
              style={{
                ...bottomButtonStyle,
                padding: '8px 12px',
                fontSize: '13px',
                height: '40px',
                display: 'flex',
                alignItems: 'center',
                minWidth: '56px',
                flexShrink: 0,
                backgroundColor: this.props.currentLayer === 'OpenTopoMap' ? '#10B981' : 'rgba(255, 255, 255, 0.85)',
                color: this.props.currentLayer === 'OpenTopoMap' ? 'white' : '#1F2937'
              }}
              title="OpenTopoMap (Contours/Hillshade)"
            >
              Topo
            </button>
            <button
              onClick={() => this.handleLayerChange('CartoDB')}
              style={{
                ...bottomButtonStyle,
                padding: '8px 12px',
                fontSize: '13px',
                height: '40px',
                display: 'flex',
                alignItems: 'center',
                minWidth: '56px',
                flexShrink: 0,
                backgroundColor: this.props.currentLayer === 'CartoDB' ? '#10B981' : 'rgba(255, 255, 255, 0.85)',
                color: this.props.currentLayer === 'CartoDB' ? 'white' : '#1F2937'
              }}
              title="CartoDB Positron"
            >
              Carto
            </button>
          </div>
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
            boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
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
              boxShadow: `0 2px 6px ${micColor}80, 0 1px 3px rgba(0,0,0,0.08)`,
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

          {/* Location status indicator */}
          <div className="mr-8 flex items-center">
            {locationStatus === 'active' ? (
              <MapPin size={40} style={{ color: this.props.userLocation ? '#10B981' : '#374151' }} title="Location active" />
            ) : (
              <MapPinOff size={40} className="text-gray-400" title="Location inactive" />
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
              title="Recenter map to your location"
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
