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
        <img src="/src/assets/BioMapp_logo.png" alt="BioMapp" style={{ maxWidth: '420px', width: '80vw', height: 'auto', zIndex: 2 }} />
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
