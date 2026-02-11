/**
 * BioMapp State Manager
 * Centralized state management for cross-component data sharing
 */

class BiomappStateManager {
  constructor() {
    this.subscribers = new Map();
    this.state = {
      recordings: [],
      currentSession: null,
      breadcrumbs: [],
      userLocation: null,
      locationPermission: 'unknown',
      isRecording: false,
      currentAudio: null,
      isPlaying: false,
      nearbySpots: [],
      tracklog: [],
      currentLayer: 'OpenStreetMap',
      showBreadcrumbs: false,
      breadcrumbVisualization: 'line'
    };
    
    // Load initial state from localStorage
    this.loadInitialState();
  }

  /**
   * Subscribe a component to state changes
   * @param {string} componentId - Unique identifier for the component
   * @param {Function} callback - Function to call when state changes
   */
  subscribe(componentId, callback) {
    this.subscribers.set(componentId, callback);
    
    // Immediately call with current state
    callback(this.state);
    
    return () => {
      this.subscribers.delete(componentId);
    };
  }

  /**
   * Update state and notify all subscribers
   * @param {Object} updates - Partial state updates
   */
  updateState(updates) {
    const previousState = { ...this.state };
    this.state = { ...this.state, ...updates };
    
    // Persist certain state changes
    this.persistState(updates, previousState);
    
    // Notify all subscribers
    this.notifySubscribers(updates, previousState);
  }

  /**
   * Get current state
   * @returns {Object} Current state
   */
  getState() {
    return { ...this.state };
  }

  /**
   * Get specific state property
   * @param {string} key - State property key
   * @returns {any} State property value
   */
  getStateProperty(key) {
    return this.state[key];
  }

  /**
   * Notify all subscribers of state changes
   * @param {Object} updates - The updates that were made
   * @param {Object} previousState - The previous state
   */
  notifySubscribers(updates, previousState) {
    this.subscribers.forEach((callback, componentId) => {
      try {
        callback(this.state, updates, previousState);
      } catch (error) {
        console.error(`Error notifying subscriber ${componentId}:`, error);
      }
    });
  }

  /**
   * Load initial state from localStorage
   */
  loadInitialState() {
    try {
      // Load recordings
      const recordings = JSON.parse(localStorage.getItem('manakai_audio_recordings') || '[]');
      
      // Load tracklog
      const tracklog = JSON.parse(localStorage.getItem('biomap_tracklog') || '[]');
      
      // Load user preferences
      const preferences = JSON.parse(localStorage.getItem('biomap_preferences') || '{}');
      
      this.state = {
        ...this.state,
        recordings,
        tracklog,
        currentLayer: preferences.currentLayer || 'OpenStreetMap',
        showBreadcrumbs: preferences.showBreadcrumbs || false,
        breadcrumbVisualization: preferences.breadcrumbVisualization || 'line'
      };
    } catch (error) {
      console.error('Error loading initial state:', error);
    }
  }

  /**
   * Persist certain state changes to localStorage
   * @param {Object} updates - The updates that were made
   * @param {Object} previousState - The previous state
   */
  persistState(updates, previousState) {
    try {
      // Persist recordings if they changed
      if (updates.recordings && updates.recordings !== previousState.recordings) {
        localStorage.setItem('manakai_audio_recordings', JSON.stringify(updates.recordings));
      }

      // Persist tracklog if it changed
      if (updates.tracklog && updates.tracklog !== previousState.tracklog) {
        localStorage.setItem('biomap_tracklog', JSON.stringify(updates.tracklog));
      }

      // Persist user preferences
      const preferencesToPersist = ['currentLayer', 'showBreadcrumbs', 'breadcrumbVisualization'];
      const preferencesChanged = preferencesToPersist.some(key => 
        updates[key] !== undefined && updates[key] !== previousState[key]
      );

      if (preferencesChanged) {
        const preferences = {
          currentLayer: this.state.currentLayer,
          showBreadcrumbs: this.state.showBreadcrumbs,
          breadcrumbVisualization: this.state.breadcrumbVisualization
        };
        localStorage.setItem('biomap_preferences', JSON.stringify(preferences));
      }
    } catch (error) {
      console.error('Error persisting state:', error);
    }
  }

  /**
   * Add a new recording to state
   * @param {Object} recording - Recording object
   */
  addRecording(recording) {
    const recordings = [...this.state.recordings, recording];
    this.updateState({ recordings });
  }

  /**
   * Update an existing recording
   * @param {string} recordingId - Recording ID
   * @param {Object} updates - Updates to apply
   */
  updateRecording(recordingId, updates) {
    const recordings = this.state.recordings.map(recording =>
      recording.uniqueId === recordingId
        ? { ...recording, ...updates }
        : recording
    );
    this.updateState({ recordings });
  }

  /**
   * Remove a recording from state
   * @param {string} recordingId - Recording ID to remove
   */
  removeRecording(recordingId) {
    const recordings = this.state.recordings.filter(
      recording => recording.uniqueId !== recordingId
    );
    this.updateState({ recordings });
  }

  /**
   * Add a breadcrumb to current session
   * @param {Object} breadcrumb - Breadcrumb object
   */
  addBreadcrumb(breadcrumb) {
    const breadcrumbs = [...this.state.breadcrumbs, breadcrumb];
    this.updateState({ breadcrumbs });
  }

  /**
   * Clear all breadcrumbs
   */
  clearBreadcrumbs() {
    this.updateState({ breadcrumbs: [] });
  }

  /**
   * Add a point to the tracklog
   * @param {Object} point - Tracklog point
   */
  addTracklogPoint(point) {
    const tracklog = [...this.state.tracklog];
    
    // Only add if different from last point
    const lastPoint = tracklog[tracklog.length - 1];
    if (!lastPoint || lastPoint.lat !== point.lat || lastPoint.lng !== point.lng) {
      tracklog.push({ ...point, timestamp: Date.now() });
      this.updateState({ tracklog });
    }
  }

  /**
   * Clear the tracklog
   */
  clearTracklog() {
    this.updateState({ tracklog: [] });
  }

  /**
   * Update nearby spots based on user location
   * @param {Object} userLocation - User's current location
   * @param {number} radius - Search radius in meters (default: 15)
   */
  updateNearbySpots(userLocation, radius = 15) {
    if (!userLocation || !this.state.recordings.length) {
      this.updateState({ nearbySpots: [] });
      return;
    }

    const nearbySpots = this.state.recordings.filter(recording => {
      if (!recording.location) return false;
      
      const distance = this.calculateDistance(
        userLocation.lat, userLocation.lng,
        recording.location.lat, recording.location.lng
      );
      
      return distance <= radius;
    });

    this.updateState({ nearbySpots });
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
   * Reset state to initial values
   */
  reset() {
    this.state = {
      recordings: [],
      currentSession: null,
      breadcrumbs: [],
      userLocation: null,
      locationPermission: 'unknown',
      isRecording: false,
      currentAudio: null,
      isPlaying: false,
      nearbySpots: [],
      tracklog: [],
      currentLayer: 'OpenStreetMap',
      showBreadcrumbs: false,
      breadcrumbVisualization: 'line'
    };
    
    this.notifySubscribers({}, {});
  }

  /**
   * Cleanup method to remove all subscribers
   */
  cleanup() {
    this.subscribers.clear();
  }
}

// Create and export singleton instance
const biomappStateManager = new BiomappStateManager();

export default biomappStateManager;