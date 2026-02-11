/**
 * Audio Playback Service
 * Centralized audio playback logic for all BioMapp components
 */

import localStorageService from './localStorageService.js';
import biomappStateManager from './biomappStateManager.js';

class AudioPlaybackService {
  constructor() {
    this.audioRefs = [];
    this.audioContext = null;
    this.isPlayingRef = false;
    this.playbackTimeoutRef = null;
    this.currentPlaybackMode = 'single';
    this.volume = 0.7;
    this.isMuted = false;
    this.proximityVolumeEnabled = false;
  }

  /**
   * Initialize audio context (call this on first user interaction)
   */
  async initializeAudioContext() {
    if (!this.audioContext) {
      try {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        if (this.audioContext.state === 'suspended') {
          await this.audioContext.resume();
        }
      } catch (error) {
        console.warn('AudioContext not supported:', error);
      }
    }
  }

  /**
   * Play a single recording
   * @param {Object} recording - Recording object
   * @param {Object} options - Playback options
   */
  async playRecording(recording, options = {}) {
    try {
      await this.initializeAudioContext();
      
      if (this.isPlayingRef) {
        await this.stopAllAudio();
      }

      const audioBlob = await localStorageService.getAudioBlob(recording.uniqueId || recording.id);
      if (!audioBlob) {
        throw new Error('Audio data not found');
      }

      const audio = new Audio(URL.createObjectURL(audioBlob));
      audio.preload = 'auto';
      audio.crossOrigin = 'anonymous';

      // Set volume based on options
      if (options.proximityVolumeEnabled && options.userLocation && recording.location) {
        const distance = this.calculateDistance(
          options.userLocation.lat, options.userLocation.lng,
          recording.location.lat, recording.location.lng
        );
        audio.volume = this.getProximityVolume(distance);
      } else {
        audio.volume = options.isMuted ? 0 : (options.volume || this.volume);
      }

      this.audioRefs.push(audio);
      this.isPlayingRef = true;
      this.currentPlaybackMode = 'single';

      // Update state
      biomappStateManager.updateState({
        currentAudio: recording,
        isPlaying: true
      });

      // Set up event handlers
      audio.onended = () => {
        this.handleAudioEnded();
      };

      audio.onerror = (error) => {
        console.error('Audio playback error:', error);
        this.handleAudioEnded();
      };

      await audio.play();
      return audio;

    } catch (error) {
      console.error('Error playing recording:', error);
      this.handleAudioEnded();
      throw error;
    }
  }

  /**
   * Play nearby recordings in sequence
   * @param {Array} recordings - Array of nearby recordings
   * @param {Object} userLocation - User's current location
   * @param {Object} options - Playback options
   */
  async playNearbyRecordings(recordings, userLocation, options = {}) {
    if (!recordings || recordings.length === 0) {
      throw new Error('No recordings to play');
    }

    try {
      await this.initializeAudioContext();
      await this.stopAllAudio();

      this.currentPlaybackMode = 'nearby';
      biomappStateManager.updateState({ isPlaying: true });

      // Sort recordings by timestamp
      const sortedRecordings = [...recordings].sort((a, b) => 
        new Date(a.timestamp) - new Date(b.timestamp)
      );

      for (const recording of sortedRecordings) {
        if (!this.isPlayingRef) break;

        try {
          const audioBlob = await localStorageService.getAudioBlob(recording.uniqueId || recording.id);
          if (audioBlob) {
            await this.playRecording(recording, { 
              ...options, 
              userLocation,
              proximityVolumeEnabled: options.proximityVolumeEnabled 
            });

            // Wait for audio to finish or timeout
            await new Promise((resolve) => {
              const timeout = setTimeout(resolve, 30000); // 30 second timeout
              
              if (this.audioRefs[0]) {
                this.audioRefs[0].onended = () => {
                  clearTimeout(timeout);
                  resolve();
                };
              } else {
                clearTimeout(timeout);
                resolve();
              }
            });
          }
        } catch (error) {
          console.error('Error playing recording in sequence:', recording.uniqueId, error);
        }
      }

    } catch (error) {
      console.error('Error playing nearby recordings:', error);
      throw error;
    } finally {
      this.handleAudioEnded();
    }
  }

  /**
   * Play recordings in concatenated mode (one after another)
   * @param {Array} recordings - Array of recordings to concatenate
   * @param {Object} options - Playback options
   */
  async playConcatenated(recordings, options = {}) {
    if (!recordings || recordings.length === 0) {
      throw new Error('No recordings to concatenate');
    }

    try {
      await this.initializeAudioContext();
      await this.stopAllAudio();

      this.currentPlaybackMode = 'concatenated';
      
      // Get all audio blobs
      const audioBlobs = [];
      for (const recording of recordings) {
        const blob = await localStorageService.getAudioBlob(recording.uniqueId || recording.id);
        if (blob) {
          audioBlobs.push(blob);
        }
      }

      if (audioBlobs.length === 0) {
        throw new Error('No audio data found for concatenation');
      }

      // Create concatenated blob
      const concatenatedBlob = new Blob(audioBlobs, { type: 'audio/webm' });
      
      // Play the concatenated audio
      await this.playRecording({
        uniqueId: 'concatenated',
        filename: `${recordings.length} recordings concatenated`,
        duration: recordings.reduce((sum, r) => sum + (r.duration || 0), 0)
      }, {
        ...options,
        audioBlob: concatenatedBlob
      });

    } catch (error) {
      console.error('Error playing concatenated recordings:', error);
      throw error;
    }
  }

  /**
   * Play recordings in jamm mode (simultaneously)
   * @param {Array} recordings - Array of recordings to play simultaneously
   * @param {Object} options - Playback options
   */
  async playJamm(recordings, options = {}) {
    if (!recordings || recordings.length === 0) {
      throw new Error('No recordings to jamm');
    }

    try {
      await this.initializeAudioContext();
      await this.stopAllAudio();

      this.currentPlaybackMode = 'jamm';
      this.isPlayingRef = true;

      const audioElements = [];
      
      // Create audio elements for each recording
      for (const recording of recordings) {
        const audioBlob = await localStorageService.getAudioBlob(recording.uniqueId || recording.id);
        if (audioBlob) {
          const audio = new Audio(URL.createObjectURL(audioBlob));
          audio.volume = (options.isMuted ? 0 : (options.volume || this.volume)) / recordings.length;
          audio.loop = true; // Loop for jamm mode
          
          this.audioRefs.push(audio);
          audioElements.push(audio);
        }
      }

      if (audioElements.length === 0) {
        throw new Error('No audio data found for jamm mode');
      }

      // Update state
      biomappStateManager.updateState({
        currentAudio: {
          uniqueId: 'jamm',
          filename: `${recordings.length} recordings jamming`,
          duration: Math.max(...recordings.map(r => r.duration || 0))
        },
        isPlaying: true
      });

      // Start all audio elements simultaneously
      for (const audio of audioElements) {
        try {
          await audio.play();
        } catch (error) {
          console.error('Error starting jamm audio:', error);
        }
      }

    } catch (error) {
      console.error('Error playing jamm recordings:', error);
      this.handleAudioEnded();
      throw error;
    }
  }

  /**
   * Stop all audio playback
   */
  async stopAllAudio() {
    this.isPlayingRef = false;

    // Clear any timeouts
    if (this.playbackTimeoutRef) {
      clearTimeout(this.playbackTimeoutRef);
      this.playbackTimeoutRef = null;
    }

    // Stop and cleanup all audio elements
    this.audioRefs.forEach(audio => {
      try {
        audio.pause();
        audio.currentTime = 0;
        audio.src = '';
        URL.revokeObjectURL(audio.src);
      } catch (error) {
        console.error('Error stopping audio:', error);
      }
    });

    this.audioRefs = [];

    // Update state
    biomappStateManager.updateState({
      currentAudio: null,
      isPlaying: false
    });
  }

  /**
   * Toggle mute state
   */
  toggleMute() {
    this.isMuted = !this.isMuted;
    
    this.audioRefs.forEach(audio => {
      audio.volume = this.isMuted ? 0 : this.volume;
    });

    return this.isMuted;
  }

  /**
   * Set volume level
   * @param {number} newVolume - Volume level (0-1)
   */
  setVolume(newVolume) {
    this.volume = Math.max(0, Math.min(1, newVolume));
    
    if (!this.isMuted) {
      this.audioRefs.forEach(audio => {
        audio.volume = this.volume;
      });
    }

    return this.volume;
  }

  /**
   * Calculate proximity-based volume
   * @param {number} distance - Distance in meters
   * @returns {number} Volume level (0-1)
   */
  getProximityVolume(distance) {
    const maxDistance = 15; // 15 meters
    const minVolume = 0.1;
    const maxVolume = 1.0;

    if (distance <= 5) return maxVolume;
    if (distance >= maxDistance) return minVolume;

    // Exponential decay for more natural sound falloff
    return minVolume + (maxVolume - minVolume) * Math.exp(-(distance - 5) / 3);
  }

  /**
   * Calculate distance between two points in meters
   * @param {number} lat1 - First point latitude
   * @param {number} lng1 - First point longitude
   * @param {number} lat2 - Second point latitude
   * @param {number} lng2 - Second point longitude
   * @returns {number} Distance in meters
   */
  calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lng2 - lng1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  /**
   * Handle audio ended event
   */
  handleAudioEnded() {
    this.isPlayingRef = false;
    
    biomappStateManager.updateState({
      currentAudio: null,
      isPlaying: false
    });
  }

  /**
   * Get current playback state
   * @returns {Object} Current playback state
   */
  getPlaybackState() {
    return {
      isPlaying: this.isPlayingRef,
      currentMode: this.currentPlaybackMode,
      volume: this.volume,
      isMuted: this.isMuted,
      proximityVolumeEnabled: this.proximityVolumeEnabled,
      activeAudioCount: this.audioRefs.length
    };
  }

  /**
   * Cleanup method
   */
  cleanup() {
    this.stopAllAudio();
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}

// Create and export singleton instance
const audioPlaybackService = new AudioPlaybackService();

export default audioPlaybackService;