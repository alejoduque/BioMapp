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

    return (
      <>
        {/* Back button for collector mode - moved down to avoid zoom controls */}
        {this.props.onBackToLanding && (
          <button 
            onClick={this.props.onBackToLanding} 
            style={{
              position: 'fixed',
              left: '50%',
              bottom: 0,
              transform: 'translate(-50%, 0)',
              marginBottom: '20px',
              zIndex: 1001,
              padding: '12px 20px',
              background: 'rgba(255, 255, 255, 0.95)',
              borderRadius: '12px',
              boxShadow: '0 8px 25px rgba(0,0,0,0.2), 0 4px 10px rgba(0,0,0,0.1)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              minWidth: 140,
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              backdropFilter: 'blur(10px)',
              fontSize: '16px',
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

        {/* Main top bar controls (mic, location, search) */}
        <div className="absolute pin-t pin-r m-2 mr-16 flex items-center">
          {/* Red glowing microphone button with solid icon */}
          <button 
            onClick={this.props.toggleAudioRecorder} 
            className="microphone-button mr-4"
            title="Record Audio"
          >
            <Mic size={24} />
          </button>

          {/* Location status indicator */}
          <div className="mr-4 flex items-center">
            {locationStatus === 'active' ? (
              <MapPin size={20} className="text-green-500" title="Location active" />
            ) : (
              <MapPinOff size={20} className="text-gray-400" title="Location inactive" />
            )}
            {/* Debug info - remove this later */}
            <span style={{ fontSize: '10px', marginLeft: '4px', color: '#666' }}>
              {this.props.userLocation ? 'ON' : 'OFF'}
            </span>
            {/* Location refresh button */}
            <button
              onClick={() => {
                console.log('Manual location refresh requested');
                if (this.props.onLocationRefresh) {
                  this.props.onLocationRefresh();
                }
              }}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                marginLeft: '4px',
                padding: '2px'
              }}
              title="Refresh location"
            >
              <RefreshCw size={14} className="text-gray-500" />
            </button>
          </div>

          {icon}
          <div className= "w-64">
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
             }}
           />
          </div>
        </div>
      </>
    )
  }
}

export default TopBar
