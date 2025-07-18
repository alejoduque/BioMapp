import React, { Component } from 'react';
import MapContainer from './components/MapContainer.jsx';
import LandingPage from './components/LandingPage.jsx';
import SoundWalk from './components/SoundWalk.jsx';
import SoundWalkAndroid from './components/SoundWalkAndroid.jsx';

// Platform detection utility (robust version with debug logging)
function isCapacitorAndroid() {
  // Primary: Capacitor platform detection
  if (
    typeof window !== 'undefined' &&
    window.Capacitor &&
    window.Capacitor.platform === 'android'
  ) {
    return true;
  }
  // Fallback: user agent detection for Android WebView
  if (
    typeof navigator !== 'undefined' &&
    /Android/i.test(navigator.userAgent) &&
    !/Chrome|Firefox|Safari/i.test(navigator.userAgent)
  ) {
    return true;
  }
  return false;
}

class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      mode: null, // null = landing page, 'soundwalk' = soundwalk mode, 'collector' = collector mode
      locationPermission: 'unknown',
      userLocation: null,
      hasRequestedPermission: false,
      showSplash: true,
      showContent: false
    };
  }

  componentDidMount() {
    // Show splash for 3 seconds, then fade out and show content
    setTimeout(() => {
      this.setState({ showSplash: false });
    }, 3000);
  }

  setLocationPermission = (permission) => {
    this.setState({ locationPermission: permission });
  };

  setUserLocation = (location) => {
    this.setState({ userLocation: location });
  };

  setHasRequestedPermission = (hasRequested) => {
    this.setState({ hasRequestedPermission: hasRequested });
  };

  handleModeSelect = (mode) => {
    this.setState({ mode });
  };

  handleBackToLanding = () => {
    // Only reset mode, do not reset permission state
    this.setState({ mode: null });
  };

  // New method for direct navigation without splash
  handleDirectBackToLanding = () => {
    // Only reset mode, do not reset permission state
    this.setState({ mode: null });
  };

  renderSplash() {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundImage: `url('/images/background-image.jpg')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 999999,
        padding: '20px'
      }}>
        {/* Animated ASCII Art Layer */}
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 1,
          pointerEvents: 'none',
          opacity: 1,
          transition: 'opacity 1s ease-in-out'
        }}>
          <div style={{
            fontFamily: "'Courier New', monospace",
            fontSize: '11px',
            lineHeight: '1.2',
            whiteSpace: 'pre',
            textAlign: 'center',
            textShadow: '2px 2px 4px rgba(0, 0, 0, 0.8)'
          }}>
            <span style={{ color: '#00ff00' }}>🌳</span><span style={{ color: '#ffff00' }}>     ██████  ██  ██████  ███    ███  █████  ██████  </span><span style={{ color: '#00ff00' }}>🌳</span>{'\n'}
            <span style={{ color: '#00af00' }}>🦇</span><span style={{ color: '#ffff00' }}>      ██   ██ ██ ██    ██ ████  ████ ██   ██ ██   ██  </span><span style={{ color: '#00af00' }}>🦇</span>{'\n'}
            <span style={{ color: '#005f00' }}>🦇</span><span style={{ color: '#ffff00' }}>      ██████  ██ ██    ██ ██ ████ ██ ███████ ██████   </span><span style={{ color: '#005f00' }}>🦇</span>{'\n'}
            <span style={{ color: '#008700' }}>🦧</span><span style={{ color: '#ffff00' }}>      ██   ██ ██ ██    ██ ██  ██  ██ ██   ██ ██       </span><span style={{ color: '#008700' }}>🦧</span>{'\n'}
            <span style={{ color: '#00ff00' }}>🌱</span><span style={{ color: '#ffff00' }}>      ██████  ██  ██████  ██      ██ ██   ██ ██       </span><span style={{ color: '#00ff00' }}>🌱</span>
          </div>
          <div style={{
            textAlign: 'center',
            marginTop: '15px',
            textShadow: '2px 2px 4px rgba(0, 0, 0, 0.8)'
          }}>
            <div style={{
              fontSize: '16px',
              fontWeight: 'bold',
              color: '#ffaf00',
              margin: '8px 0'
            }}>
              🌅 Bioacoustic Mapping Safari 🌅
            </div>
            <div style={{
              fontSize: '14px',
              color: '#00ff00',
              margin: '5px 0'
            }}>
              Loading...
            </div>
          </div>
        </div>
      </div>
    );
  }

  render() {
    const { mode, locationPermission, userLocation, hasRequestedPermission, showSplash } = this.state;

    if (showSplash) {
      return this.renderSplash();
    }

    if (mode === null) {
      return <LandingPage 
        onModeSelect={this.handleModeSelect} 
        hasRequestedPermission={hasRequestedPermission}
        setHasRequestedPermission={this.setHasRequestedPermission}
      />;
    }

    if (mode === 'soundwalk') {
      return <SoundWalkAndroid 
        onBackToLanding={this.handleDirectBackToLanding}
        locationPermission={locationPermission}
        userLocation={userLocation}
        hasRequestedPermission={hasRequestedPermission}
        setLocationPermission={this.setLocationPermission}
        setUserLocation={this.setUserLocation}
        setHasRequestedPermission={this.setHasRequestedPermission}
      />;
    }

    if (mode === 'collector') {
      return <MapContainer 
        onBackToLanding={this.handleDirectBackToLanding}
        locationPermission={locationPermission}
        userLocation={userLocation}
        hasRequestedPermission={hasRequestedPermission}
        setLocationPermission={this.setLocationPermission}
        setUserLocation={this.setUserLocation}
        setHasRequestedPermission={this.setHasRequestedPermission}
      />;
    }

    return <LandingPage onModeSelect={this.handleModeSelect} />;
  }
}

export default App;
