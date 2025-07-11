// Basic Local Storage Service for MANAKAI Audio Recordings
import config from '../config.json';

class LocalStorageService {
  constructor() {
    this.storageKey = config.storage.recordingsKey;
    this.maxStorageSize = config.storage.maxStorageSize;
    this.autoCleanupDays = config.storage.autoCleanupDays;
  }

  /**
   * Initialize storage and perform cleanup if needed
   */
  init() {
    this.cleanupOldRecordings();
    this.checkStorageSpace();
  }

  /**
   * Save a recording to local storage
   * @param {Object} recording - The recording object to save
   * @param {Blob} audioBlob - The audio blob to save separately
   * @returns {Promise<string>} - The unique ID of the saved recording
   */
  async saveRecording(recording, audioBlob = null) {
    try {
      const recordings = this.getAllRecordings();
      const recordingId = recording.uniqueId || `recording-${Date.now()}`;
      
      // Add timestamp if not present
      if (!recording.timestamp) {
        recording.timestamp = new Date().toISOString();
      }
      
      // Create the recording object (without audio blob)
      const recordingData = {
        ...recording,
        uniqueId: recordingId,
        saved: true,
        localTimestamp: Date.now(),
        pendingUpload: true,
      };
      
      // Remove audioBlob from metadata to avoid localStorage size issues
      delete recordingData.audioBlob;
      
      // Add to recordings array
      recordings.push(recordingData);
      
      // Save to localStorage
      localStorage.setItem(this.storageKey, JSON.stringify(recordings));
      
      // Save audio blob separately if provided
      if (audioBlob) {
        await this.saveAudioBlob(recordingId, audioBlob);
      }
      
      console.log('Recording saved to localStorage:', recordingId);
      return recordingId;
    } catch (error) {
      console.error('Error saving recording:', error);
      throw new Error('Failed to save recording to local storage');
    }
  }

  /**
   * Save audio blob separately using IndexedDB or as data URL
   * @param {string} recordingId - The unique ID of the recording
   * @param {Blob} audioBlob - The audio blob to save
   */
  async saveAudioBlob(recordingId, audioBlob) {
    try {
      // Convert blob to data URL for storage
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result;
        localStorage.setItem(`audio_${recordingId}`, dataUrl);
        console.log('Audio blob saved for recording:', recordingId);
      };
      reader.readAsDataURL(audioBlob);
    } catch (error) {
      console.error('Error saving audio blob:', error);
    }
  }

  /**
   * Get audio blob for a recording
   * @param {string} recordingId - The unique ID of the recording
   * @returns {Blob|null} - The audio blob or null if not found
   */
  getAudioBlob(recordingId) {
    try {
      const dataUrl = localStorage.getItem(`audio_${recordingId}`);
      if (dataUrl) {
        // Convert data URL back to blob
        const response = fetch(dataUrl);
        return response.then(res => res.blob());
      }
      return null;
    } catch (error) {
      console.error('Error getting audio blob:', error);
      return null;
    }
  }

  /**
   * Get all recordings from local storage
   * @returns {Array} - Array of recording objects
   */
  getAllRecordings() {
    try {
      const recordings = localStorage.getItem(this.storageKey);
      return recordings ? JSON.parse(recordings) : [];
    } catch (error) {
      console.error('Error loading recordings:', error);
      return [];
    }
  }

  /**
   * Get a specific recording by ID
   * @param {string} recordingId - The unique ID of the recording
   * @returns {Object|null} - The recording object or null if not found
   */
  getRecording(recordingId) {
    const recordings = this.getAllRecordings();
    return recordings.find(r => r.uniqueId === recordingId) || null;
  }

  /**
   * Delete a recording by ID
   * @param {string} recordingId - The unique ID of the recording to delete
   * @returns {boolean} - True if deleted, false if not found
   */
  deleteRecording(recordingId) {
    try {
      const recordings = this.getAllRecordings();
      const filteredRecordings = recordings.filter(r => r.uniqueId !== recordingId);
      
      if (filteredRecordings.length === recordings.length) {
        return false; // Recording not found
      }
      
      localStorage.setItem(this.storageKey, JSON.stringify(filteredRecordings));
      console.log('Recording deleted:', recordingId);
      return true;
    } catch (error) {
      console.error('Error deleting recording:', error);
      return false;
    }
  }

  /**
   * Update a recording
   * @param {string} recordingId - The unique ID of the recording
   * @param {Object} updates - Object with fields to update
   * @returns {boolean} - True if updated, false if not found
   */
  updateRecording(recordingId, updates) {
    try {
      const recordings = this.getAllRecordings();
      const recordingIndex = recordings.findIndex(r => r.uniqueId === recordingId);
      
      if (recordingIndex === -1) {
        return false; // Recording not found
      }
      
      // Update the recording
      recordings[recordingIndex] = {
        ...recordings[recordingIndex],
        ...updates,
        lastModified: new Date().toISOString()
      };
      
      localStorage.setItem(this.storageKey, JSON.stringify(recordings));
      console.log('Recording updated:', recordingId);
      return true;
    } catch (error) {
      console.error('Error updating recording:', error);
      return false;
    }
  }

  /**
   * Search recordings by various criteria
   * @param {Object} criteria - Search criteria
   * @returns {Array} - Array of matching recordings
   */
  searchRecordings(criteria = {}) {
    const recordings = this.getAllRecordings();
    
    return recordings.filter(recording => {
      // Search by filename
      if (criteria.filename && !recording.filename?.toLowerCase().includes(criteria.filename.toLowerCase())) {
        return false;
      }
      
      // Search by species tags
      if (criteria.species && !recording.speciesTags?.some(tag => 
        tag.toLowerCase().includes(criteria.species.toLowerCase()))) {
        return false;
      }
      
      // Search by date range
      if (criteria.startDate && new Date(recording.timestamp) < new Date(criteria.startDate)) {
        return false;
      }
      
      if (criteria.endDate && new Date(recording.timestamp) > new Date(criteria.endDate)) {
        return false;
      }
      
      // Search by location (if coordinates are available)
      if (criteria.location && recording.location) {
        const distance = this.calculateDistance(
          criteria.location.lat, criteria.location.lon,
          recording.location.lat, recording.location.lon
        );
        if (distance > (criteria.radius || 1000)) { // Default 1km radius
          return false;
        }
      }
      
      return true;
    });
  }

  /**
   * Calculate distance between two coordinates in meters
   * @param {number} lat1 - Latitude of first point
   * @param {number} lon1 - Longitude of first point
   * @param {number} lat2 - Latitude of second point
   * @param {number} lon2 - Longitude of second point
   * @returns {number} - Distance in meters
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Earth's radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  /**
   * Clean up recordings older than specified days
   */
  cleanupOldRecordings() {
    try {
      const recordings = this.getAllRecordings();
      const cutoffDate = Date.now() - (this.autoCleanupDays * 24 * 60 * 60 * 1000);
      
      const activeRecordings = recordings.filter(recording => {
        const recordingDate = new Date(recording.timestamp).getTime();
        return recordingDate > cutoffDate;
      });
      
      if (activeRecordings.length !== recordings.length) {
        localStorage.setItem(this.storageKey, JSON.stringify(activeRecordings));
        console.log(`Cleaned up ${recordings.length - activeRecordings.length} old recordings`);
      }
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }

  /**
   * Check storage space and warn if approaching limits
   */
  checkStorageSpace() {
    try {
      const recordings = this.getAllRecordings();
      const storageUsed = JSON.stringify(recordings).length;
      const usagePercent = (storageUsed / this.maxStorageSize) * 100;
      
      if (usagePercent > 80) {
        console.warn(`Storage usage at ${usagePercent.toFixed(1)}% - consider cleaning up old recordings`);
      }
      
      return {
        used: storageUsed,
        max: this.maxStorageSize,
        percentage: usagePercent
      };
    } catch (error) {
      console.error('Error checking storage space:', error);
      return null;
    }
  }

  /**
   * Get storage statistics
   * @returns {Object} - Storage statistics
   */
  getStorageStats() {
    const recordings = this.getAllRecordings();
    const spaceInfo = this.checkStorageSpace();
    
    return {
      totalRecordings: recordings.length,
      storageUsed: spaceInfo?.used || 0,
      storageMax: spaceInfo?.max || 0,
      storagePercentage: spaceInfo?.percentage || 0,
      oldestRecording: recordings.length > 0 ? 
        recordings.reduce((oldest, current) => 
          new Date(current.timestamp) < new Date(oldest.timestamp) ? current : oldest
        ).timestamp : null,
      newestRecording: recordings.length > 0 ? 
        recordings.reduce((newest, current) => 
          new Date(current.timestamp) > new Date(newest.timestamp) ? current : newest
        ).timestamp : null
    };
  }

  /**
   * Clear all recordings (use with caution)
   */
  clearAllRecordings() {
    localStorage.removeItem(this.storageKey);
    console.log('All recordings cleared from localStorage');
  }

  /**
   * Export recordings data for backup
   * @returns {string} - JSON string of all recordings
   */
  exportRecordings() {
    const recordings = this.getAllRecordings();
    return JSON.stringify(recordings, null, 2);
  }

  /**
   * Import recordings from backup
   * @param {string} jsonData - JSON string of recordings to import
   * @returns {boolean} - True if successful
   */
  importRecordings(jsonData) {
    try {
      const recordings = JSON.parse(jsonData);
      
      if (!Array.isArray(recordings)) {
        throw new Error('Invalid recordings data format');
      }
      
      localStorage.setItem(this.storageKey, JSON.stringify(recordings));
      console.log(`Imported ${recordings.length} recordings`);
      return true;
    } catch (error) {
      console.error('Error importing recordings:', error);
      return false;
    }
  }

  /**
   * Create a new recording object template
   * @param {Object} data - Initial recording data
   * @returns {Object} - Recording object template
   */
  createRecordingTemplate(data = {}) {
    return {
      uniqueId: `recording-${Date.now()}`,
      filename: data.filename || `recording-${Date.now()}.mp3`,
      timestamp: new Date().toISOString(),
      duration: data.duration || 0,
      fileSize: data.fileSize || 0,
      location: data.location || null,
      speciesTags: data.speciesTags || [],
      notes: data.notes || '',
      audioData: data.audioData || null,
      quality: data.quality || 'medium',
      weather: data.weather || null,
      temperature: data.temperature || null,
      saved: false,
      ...data
    };
  }

  /**
   * Get all recordings pending upload
   */
  getPendingUploads() {
    return this.getAllRecordings().filter(r => r.pendingUpload);
  }

  /**
   * Mark a recording as uploaded
   */
  markUploaded(recordingId) {
    return this.updateRecording(recordingId, { pendingUpload: false });
  }
}

// Create and export singleton instance
const localStorageService = new LocalStorageService();
export default localStorageService;