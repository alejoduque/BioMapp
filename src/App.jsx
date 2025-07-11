import React, { Component } from 'react';
import MapContainer from './components/MapContainer.jsx';
import LandingPage from './components/LandingPage.jsx';
import SoundWalk from './components/SoundWalk.jsx';

class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      mode: null // null = landing page, 'soundwalk' = soundwalk mode, 'collector' = collector mode
    };
  }

  handleModeSelect = (mode) => {
    this.setState({ mode });
  };

  handleBackToLanding = () => {
    this.setState({ mode: null });
  };

  render() {
    const { mode } = this.state;

    if (mode === null) {
      return <LandingPage onModeSelect={this.handleModeSelect} />;
    }

    if (mode === 'soundwalk') {
      return <SoundWalk onBackToLanding={this.handleBackToLanding} />;
    }

    if (mode === 'collector') {
      return <MapContainer onBackToLanding={this.handleBackToLanding} />;
    }

    return <LandingPage onModeSelect={this.handleModeSelect} />;
  }
}

export default App;
