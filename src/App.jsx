import React, { Component } from 'react';
import MapContainer from './components/MapContainer.jsx';
import LandingPage from './components/LandingPage.jsx';
import SoundWalk from './components/SoundWalk.jsx';
import SoundWalkAndroid from './components/SoundWalkAndroid.jsx';
import AndroidPermissionRequest from './components/AndroidPermissionRequest.jsx';

class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      mode: null, // null = landing page, 'soundwalk' = soundwalk mode, 'collector' = collector mode
      showPermissionRequest: false,
      permissionsGranted: false
    };
  }

  handleModeSelect = (mode) => {
    this.setState({ mode });
  };

  handleBackToLanding = () => {
    this.setState({ mode: null });
  };

  handlePermissionsGranted = () => {
    this.setState({ 
      showPermissionRequest: false, 
      permissionsGranted: true 
    });
  };

  handlePermissionsDenied = (error) => {
    console.log('Permissions denied:', error);
    this.setState({ 
      showPermissionRequest: false, 
      permissionsGranted: false 
    });
  };

  componentDidMount() {
    // Check if we're on Android and need to request permissions
    const isAndroid = /Android/.test(navigator.userAgent);
    if (isAndroid) {
      this.setState({ showPermissionRequest: true });
    }
  }

  render() {
    const { mode, showPermissionRequest } = this.state;

    // Detect Android platform
    const isAndroid = /Android/.test(navigator.userAgent);

    // Show permission request for Android
    if (showPermissionRequest) {
      return (
        <AndroidPermissionRequest
          onPermissionsGranted={this.handlePermissionsGranted}
          onPermissionsDenied={this.handlePermissionsDenied}
        />
      );
    }

    if (mode === null) {
      return <LandingPage onModeSelect={this.handleModeSelect} />;
    }

    if (mode === 'soundwalk') {
      return isAndroid ? 
        <SoundWalkAndroid onBackToLanding={this.handleBackToLanding} /> : 
        <SoundWalk onBackToLanding={this.handleBackToLanding} />;
    }

    if (mode === 'collector') {
      return <MapContainer onBackToLanding={this.handleBackToLanding} />;
    }

    return <LandingPage onModeSelect={this.handleModeSelect} />;
  }
}

export default App;
