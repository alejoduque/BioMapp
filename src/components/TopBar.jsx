import React from 'react';
import { withStyles } from '@mui/material/styles';
import Input from '@mui/material/Input';
import ResultsIcon from './../assets/results-icon.png'
import { Mic, MapPin, MapPinOff, ArrowLeft, RefreshCw } from 'lucide-react';

class TopBar extends React.Component {

  handleChange = event => {
    this.props.updateQuery(event.target.value)
  }

  render () {
    var icon = null
    if(this.props.query && this.props.query.length > 0) icon = <img className="w-4 h-4 m-2 mr-4" src={ResultsIcon} />
    const locationStatus = this.props.userLocation ? 'active' : 'inactive';

    // Determine mic button color
    let micColor = '#ef4444'; // red (ready)
    if (this.props.isRecording) micColor = '#F59E42'; // amber (recording)
    if (this.props.isMicDisabled) micColor = '#9CA3AF'; // gray (disabled)

    return (
      <>
        {/* Back button for collector mode - moved down to avoid zoom controls */}
        {this.props.onBackToLanding && (
          <button 
            onClick={this.props.onBackToLanding} 
            style={{
              position: 'fixed',
              left: '50%',
              bottom: '80px', // original
              transform: 'translate(-50%, 0)',
              marginBottom: '20px', // original
              zIndex: 1001,
              padding: '12px 20px', // original
              background: 'rgba(255, 255, 255, 0.95)',
              borderRadius: '12px', // original
              boxShadow: '0 8px 25px rgba(0,0,0,0.2), 0 4px 10px rgba(0,0,0,0.1)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px', // original
              minWidth: 140, // original
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              backdropFilter: 'blur(10px)',
              fontSize: '16px', // original
              fontWeight: '600',
              color: '#1F2937'
            }}
            onMouseEnter={(e) => {
              e.target.style.transform = 'translate(-50%, 0) scale(1.05)';
              e.target.style.boxShadow = '0 12px 35px rgba(0,0,0,0.25), 0 6px 15px rgba(0,0,0,0.15)';
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = 'translate(-50%, 0) scale(1)';
              e.target.style.boxShadow = '0 8px 25px rgba(0,0,0,0.2), 0 4px 10px rgba(0,0,0,0.1)';
            }}
            title="Back to menu"
          >
            <ArrowLeft size={20} />
            <span style={{ fontSize: '16px', fontWeight: '600' }}>Back to Menu</span>
          </button>
        )}

        {/* Main top bar controls (location, search, mic) */}
        <div
          className="absolute pin-t pin-r m-2 mr-16 flex items-center"
          style={{
            position: 'fixed',
            top: 'env(safe-area-inset-top, 4px)',
            left: 0,
            right: 0,
            zIndex: 1001,
            height: '40px', // smaller height
            minHeight: '40px',
            maxHeight: '44px',
            fontSize: '13px',
            padding: '0 4px', // minimal horizontal padding
            background: 'rgba(255,255,255,0.95)',
            borderRadius: '0 0 10px 10px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px', // tighter gap
            width: '100vw',
            maxWidth: '100vw',
            overflow: 'hidden',
            border: 'none',
            fontWeight: '600',
            color: '#1F2937'
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
              <MapPin size={40} className="text-green-500" title="Location active" />
            ) : (
              <MapPinOff size={40} className="text-gray-400" title="Location inactive" />
            )}
            <span style={{ fontSize: '20px', marginLeft: '8px', color: '#666' }}>
              {this.props.userLocation ? 'ON' : 'OFF'}
            </span>
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
                padding: '4px'
              }}
              title="Refresh location"
            >
              <RefreshCw size={28} className="text-gray-500" />
            </button>
          </div>

          {icon}
          <div style={{ flex: 1, minWidth: 0 }}>
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
                style: { fontSize: '16px', padding: '8px 6px', maxWidth: '100%', width: '100%', boxSizing: 'border-box' }
              }}
              style={{ width: '100%', maxWidth: '100vw' }}
            />
          </div>
        </div>
      </>
    )
  }
}

export default TopBar
