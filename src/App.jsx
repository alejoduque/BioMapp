/**
 * @fileoverview This file is part of the BioMapp project, developed for Reserva MANAKAI.
 *
 * Copyright (c) 2026 Alejandro Duque Jaramillo. All rights reserved.
 *
 * This code is licensed under the Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0) License.
 * For the full license text, please visit: https://creativecommons.org/licenses/by-nc-sa/4.0/legalcode
 *
 * You are free to:
 * - Share — copy and redistribute the material in any medium or format.
 * - Adapt — remix, transform, and build upon the material.
 *
 * Under the following terms:
 * - Attribution — You must give appropriate credit, provide a link to the license, and indicate if changes were made. You may do so in any reasonable manner, but not in any way that suggests the licensor endorses you or your use.
 * - NonCommercial — You may not use the material for commercial purposes. This includes, but is not limited to, any use of the code (including for training artificial intelligence models) that is primarily intended for or directed towards commercial advantage or monetary compensation.
 * - ShareAlike — If you remix, transform, or build upon the material, you must distribute your contributions under the same license as the original.
 *
 * This license applies to all forms of use, including by automated systems or artificial intelligence models,
 * to prevent unauthorized commercial exploitation and ensure proper attribution.
 */
import React, { Component } from 'react';
import LandingPage from './components/LandingPage.jsx';
import SoundWalkAndroid from './components/UnifiedMap.jsx';
import walkSessionService from './services/walkSessionService.js';
import localStorageService from './services/localStorageService.js';

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
      allSessions: [],
      allRecordings: [],
    };
  }

  componentDidMount() {
    // One-time first-run wipe to avoid restored local data on fresh installs
    try {
      const firstRunFlag = localStorage.getItem('biomap_first_run_initialized');
      const isNative = typeof window !== 'undefined' && window.Capacitor && (window.Capacitor.isNative || (window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()));
      if (!firstRunFlag && isNative) {
        // Remove recordings list and any audio_ keys
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (!key) continue;
          if (key === 'manakai_audio_recordings' || key.startsWith('audio_') || key.includes('biomap_')) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach(k => localStorage.removeItem(k));
        localStorage.setItem('biomap_first_run_initialized', 'true');
        console.log('First run cleanup completed. Removed keys:', keysToRemove);
      }
    } catch (e) {
      // ignore cleanup errors
    }

    // --- Data Loading on Startup ---
    walkSessionService.autoSaveStaleSession();
    const sessions = walkSessionService.getAllSessions();
    const recordings = localStorageService.getAllRecordings();
    this.setState({ allSessions: sessions, allRecordings: recordings });
    // --- End Data Loading ---

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
        <img src="/biomapp.png" alt="SoundWalk" style={{
          maxWidth: '420px',
          width: '80vw',
          height: 'auto',
          zIndex: 2,
          marginTop: '200px'
        }} />
      </div>
    );
  }

  render() {
    const { mode, locationPermission, userLocation, hasRequestedPermission, showSplash, allSessions, allRecordings } = this.state;

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

    if (mode === 'soundwalk' || mode === 'collector') {
      return <SoundWalkAndroid
        onBackToLanding={this.handleDirectBackToLanding}
        locationPermission={locationPermission}
        userLocation={userLocation}
        hasRequestedPermission={hasRequestedPermission}
        setLocationPermission={this.setLocationPermission}
        setUserLocation={this.setUserLocation}
        setHasRequestedPermission={this.setHasRequestedPermission}
        allSessions={allSessions}
        allRecordings={allRecordings}
      />;
    }

    return <LandingPage onModeSelect={this.handleModeSelect} />;
  }
}

export default App;
