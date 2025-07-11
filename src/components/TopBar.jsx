import React from 'react';
import { withStyles } from '@mui/material/styles';
import Input from '@mui/material/Input';
import ResultsIcon from './../assets/results-icon.png'
import { Mic, MapPin, MapPinOff, ArrowLeft } from 'lucide-react';

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
            className="fixed top-20 left-4 p-2 bg-white rounded-lg shadow-md hover:bg-gray-50 z-50 flex items-center gap-2"
            title="Back to menu"
            style={{ minWidth: 120 }}
          >
            <ArrowLeft size={16} />
            <span className="text-sm font-medium">Back to Menu</span>
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
