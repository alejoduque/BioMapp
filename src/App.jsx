import React, { Component } from 'react';
import MapContainer from './components/MapContainer.jsx';
import LandingPage from './components/LandingPage.jsx';
import SoundWalk from './components/SoundWalk.jsx';
import SoundWalkAndroid from './components/SoundWalkAndroid.jsx';
import locationService from './services/locationService.js';

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
      showContent: false,
      _requestingLocation: false // New state for location request
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
    console.log('🚨 handleModeSelect called with mode:', mode);
    this.setState({ mode });
  };

  handleBackToLanding = () => {
    // Only reset mode, do not reset permission state
    console.log('🚨 handleBackToLanding called');
    this.setState({ mode: null });
  };

  // New method for direct navigation without splash
  handleDirectBackToLanding = () => {
    // Only reset mode, do not reset permission state
    console.log('🚨 handleDirectBackToLanding called');
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
    try {
      const { mode, locationPermission, userLocation, hasRequestedPermission, showSplash } = this.state;

      // Emergency debug logging
      console.log('🚨 App.jsx render - EMERGENCY DEBUG');
      console.log('🚨 Mode:', mode);
      console.log('🚨 LocationPermission:', locationPermission);
      console.log('🚨 UserLocation:', userLocation);
      console.log('🚨 HasRequestedPermission:', hasRequestedPermission);
      console.log('🚨 ShowSplash:', showSplash);

      if (showSplash) {
        console.log('🚨 Rendering splash screen');
        return this.renderSplash();
      }

    // --- SoundWalk entry: ensure valid location state ---
    if (mode === 'soundwalk') {
      console.log('🚨 SoundWalk mode detected');
      
      // TEST MODE: Skip location check and render SoundWalk directly
      const testMode = true; // Set to false to disable test mode
      
      if (testMode) {
        console.log('🚨 TEST MODE: Rendering SoundWalk without location check');
        return <>
          {/* Large visible debug overlay */}
          <div style={{
            position:'fixed',
            top:0,
            left:0,
            right:0,
            zIndex:99999,
            background:'purple',
            color:'white',
            padding:'8px 12px',
            fontWeight:'bold',
            fontSize:'14px',
            textAlign:'center',
            borderBottom:'2px solid white'
          }}>
            🚨 APP: TEST MODE - RENDERING SOUNDWALK WITHOUT LOCATION CHECK
          </div>
          <SoundWalkAndroid 
            onBackToLanding={this.handleDirectBackToLanding}
            locationPermission={locationPermission}
            userLocation={userLocation}
            hasRequestedPermission={hasRequestedPermission}
            setLocationPermission={this.setLocationPermission}
            setUserLocation={this.setUserLocation}
            setHasRequestedPermission={this.setHasRequestedPermission}
          />
        </>;
      }
      
      // If location is missing or permission not granted, request location
      if (!userLocation || locationPermission !== 'granted') {
        console.log('🚨 Location missing, requesting location...');
        // Show loading spinner/message while requesting location
        if (!this.state._requestingLocation) {
          console.log('🚨 Starting location request...');
          this.setState({ _requestingLocation: true });
          locationService.requestLocation()
            .then((position) => {
              console.log('🚨 Location granted:', position);
              this.setState({
                userLocation: position,
                locationPermission: 'granted',
                hasRequestedPermission: true,
                _requestingLocation: false
              });
            })
            .catch((error) => {
              console.log('🚨 Location denied:', error);
              this.setState({
                userLocation: null,
                locationPermission: 'denied',
                hasRequestedPermission: true,
                _requestingLocation: false
              });
            });
        }
        return (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#fff' }}>
            {/* Debug overlay for location request */}
            <div style={{
              position:'fixed',
              top:0,
              left:0,
              right:0,
              zIndex:99999,
              background:'yellow',
              color:'black',
              padding:'8px 12px',
              fontWeight:'bold',
              fontSize:'14px',
              textAlign:'center',
              borderBottom:'2px solid orange'
            }}>
              🚨 APP: REQUESTING LOCATION - MODE: {mode} - LOCATION: {userLocation ? 'OK' : 'MISSING'} - PERMISSION: {locationPermission}
            </div>
            <div style={{ fontSize: 20, color: '#3B82F6', marginBottom: 16 }}>Requesting location for SoundWalk...</div>
            <div style={{ width: 40, height: 40, border: '4px solid #e5e7eb', borderTop: '4px solid #3B82F6', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
          </div>
        );
      }
      console.log('🚨 App rendering SoundWalk - all conditions met');
      return <>
        {/* Large visible debug overlay */}
        <div style={{
          position:'fixed',
          top:0,
          left:0,
          right:0,
          zIndex:99999,
          background:'orange',
          color:'black',
          padding:'8px 12px',
          fontWeight:'bold',
          fontSize:'14px',
          textAlign:'center',
          borderBottom:'2px solid red'
        }}>
          🚨 APP: RENDERING SOUNDWALK - MODE: {mode} - LOCATION: {userLocation ? 'OK' : 'MISSING'} - PERMISSION: {locationPermission}
        </div>
        <SoundWalkAndroid 
          onBackToLanding={this.handleDirectBackToLanding}
          locationPermission={locationPermission}
          userLocation={userLocation}
          hasRequestedPermission={hasRequestedPermission}
          setLocationPermission={this.setLocationPermission}
          setUserLocation={this.setUserLocation}
          setHasRequestedPermission={this.setHasRequestedPermission}
        />
      </>;
    }

    if (mode === 'collector') {
      console.log('🚨 Collector mode detected');
      return <>
        {/* Debug overlay for collector */}
        <div style={{
          position:'fixed',
          top:0,
          left:0,
          right:0,
          zIndex:99999,
          background:'green',
          color:'white',
          padding:'8px 12px',
          fontWeight:'bold',
          fontSize:'14px',
          textAlign:'center',
          borderBottom:'2px solid darkgreen'
        }}>
          🚨 APP: COLLECTOR MODE - LOCATION: {userLocation ? 'OK' : 'MISSING'} - PERMISSION: {locationPermission}
        </div>
        <MapContainer 
          onBackToLanding={this.handleDirectBackToLanding}
          locationPermission={locationPermission}
          userLocation={userLocation}
          hasRequestedPermission={hasRequestedPermission}
          setLocationPermission={this.setLocationPermission}
          setUserLocation={this.setUserLocation}
          setHasRequestedPermission={this.setHasRequestedPermission}
        />
      </>;
    }

    console.log('🚨 Rendering LandingPage (default)');
    return <>
      {/* Debug overlay for landing page */}
      <div style={{
        position:'fixed',
        top:0,
        left:0,
        right:0,
        zIndex:99999,
        background:'blue',
        color:'white',
        padding:'8px 12px',
        fontWeight:'bold',
        fontSize:'14px',
        textAlign:'center',
        borderBottom:'2px solid darkblue'
      }}>
        🚨 APP: LANDING PAGE - MODE: {mode} - LOCATION: {userLocation ? 'OK' : 'MISSING'} - PERMISSION: {locationPermission}
      </div>
      <LandingPage onModeSelect={this.handleModeSelect} />
    </>;
    } catch (error) {
      console.error('🚨 CRITICAL ERROR in App.jsx render:', error);
      return (
        <div style={{
          width: '100%', 
          height: '100vh', 
          background: 'red', 
          color: 'white', 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center',
          fontSize: '20px',
          textAlign: 'center',
          padding: '20px'
        }}>
          <div>
            <h1>🚨 CRITICAL APP ERROR</h1>
            <p>App.jsx crashed during rendering</p>
            <p>Error: {error.message}</p>
            <p>Stack: {error.stack}</p>
            <button 
              onClick={() => window.location.reload()} 
              style={{
                background: 'white',
                color: 'red',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '8px',
                fontSize: '16px',
                cursor: 'pointer',
                marginTop: '20px'
              }}
            >
              Reload App
            </button>
          </div>
        </div>
      );
    }
  }
}

export default App;
