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
    this.cleanupCorruptedAudioBlobs();
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
      // Validate recording metadata
      if (!recording || typeof recording !== 'object') {
        throw new Error('Invalid recording metadata: must be an object');
      }
      
      if (!recording.uniqueId && !recording.filename) {
        throw new Error('Invalid recording: missing uniqueId or filename');
      }
      
      if (!recording.location || !recording.location.lat || !recording.location.lng) {
        throw new Error('Invalid recording: missing or invalid location data');
      }
      
      if (!recording.duration || recording.duration <= 0) {
        throw new Error('Invalid recording: missing or invalid duration');
      }
      
      // Validate audio blob if provided
      if (audioBlob) {
        if (!(audioBlob instanceof Blob)) {
          throw new Error('Invalid audio blob: must be a Blob object');
        }
        
        if (audioBlob.size === 0) {
          throw new Error('Invalid audio blob: size is 0 bytes');
        }
        
        if (audioBlob.size > 50 * 1024 * 1024) { // 50MB limit
          throw new Error('Audio blob too large: maximum 50MB allowed');
        }
        
        console.log('✅ Audio blob validation passed:', audioBlob.size, 'bytes');
      } else {
        console.warn('⚠️ No audio blob provided for recording:', recording.uniqueId || recording.filename);
      }
      
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
      
      console.log('✅ Recording saved to localStorage:', recordingId);
      return recordingId;
    } catch (error) {
      console.error('❌ Error saving recording:', error);
      throw new Error(`Failed to save recording to local storage: ${error.message}`);
    }
  }

  /**
   * Save audio blob separately using IndexedDB or as data URL
   * @param {string} recordingId - The unique ID of the recording
   * @param {Blob} audioBlob - The audio blob to save
   */
  async saveAudioBlob(recordingId, audioBlob) {
    try {
      // Check blob size before saving
      const blobSize = audioBlob.size;
      const maxSize = 5 * 1024 * 1024; // 5MB limit for localStorage
      
      if (blobSize > maxSize) {
        console.warn(`Audio blob too large (${blobSize} bytes), skipping save to localStorage`);
        // Store a reference instead of the actual blob
        localStorage.setItem(`audio_${recordingId}`, 'TOO_LARGE');
        return;
      }
      
      // Convert blob to data URL for storage
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const dataUrl = reader.result;
            localStorage.setItem(`audio_${recordingId}`, dataUrl);
            console.log('Audio blob saved for recording:', recordingId, 'Size:', blobSize);
            resolve();
          } catch (error) {
            console.error('Error saving data URL to localStorage:', error);
            // If localStorage fails, store a reference
            localStorage.setItem(`audio_${recordingId}`, 'STORAGE_ERROR');
            reject(error);
          }
        };
        reader.onerror = () => {
          console.error('Error reading audio blob');
          reject(new Error('Failed to read audio blob'));
        };
        reader.readAsDataURL(audioBlob);
      });
    } catch (error) {
      console.error('Error saving audio blob:', error);
      // Store a reference to indicate error
      localStorage.setItem(`audio_${recordingId}`, 'ERROR');
    }
  }

  /**
   * Get audio blob for a recording
   * @param {string} recordingId - The unique ID of the recording
   * @returns {Promise<Blob|null>} - Promise that resolves to the audio blob or null if not found
   */
  async getAudioBlob(recordingId) {
    try {
      const storedData = localStorage.getItem(`audio_${recordingId}`);
      if (!storedData) {
        return null;
      }
      
      // Check for error states
      if (storedData === 'TOO_LARGE' || storedData === 'STORAGE_ERROR' || storedData === 'ERROR') {
        console.warn(`Audio blob for ${recordingId} has error state: ${storedData}`);
        return null;
      }
      
      // Convert data URL back to blob
      const response = await fetch(storedData);
      return await response.blob();
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
   * Clean up corrupted audio blob entries
   */
  cleanupCorruptedAudioBlobs() {
    try {
      const recordings = this.getAllRecordings();
      let cleanedCount = 0;
      
      recordings.forEach(recording => {
        const audioKey = `audio_${recording.uniqueId}`;
        const storedData = localStorage.getItem(audioKey);
        
        if (storedData === 'TOO_LARGE' || storedData === 'STORAGE_ERROR' || storedData === 'ERROR') {
          localStorage.removeItem(audioKey);
          cleanedCount++;
          console.log(`Cleaned up corrupted audio blob for recording: ${recording.uniqueId}`);
        }
      });
      
      if (cleanedCount > 0) {
        console.log(`Cleaned up ${cleanedCount} corrupted audio blob entries`);
      }
    } catch (error) {
      console.error('Error cleaning up corrupted audio blobs:', error);
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
    
    // Count corrupted audio blobs
    let corruptedBlobs = 0;
    let totalBlobs = 0;
    recordings.forEach(recording => {
      const audioKey = `audio_${recording.uniqueId}`;
      const storedData = localStorage.getItem(audioKey);
      if (storedData) {
        totalBlobs++;
        if (storedData === 'TOO_LARGE' || storedData === 'STORAGE_ERROR' || storedData === 'ERROR') {
          corruptedBlobs++;
        }
      }
    });
    
    return {
      totalRecordings: recordings.length,
      storageUsed: spaceInfo?.used || 0,
      storageMax: spaceInfo?.max || 0,
      storagePercentage: spaceInfo?.percentage || 0,
      totalAudioBlobs: totalBlobs,
      corruptedAudioBlobs: corruptedBlobs,
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
   * Nuclear option: Clear everything and start fresh
   */
  nuclearClear() {
    try {
      // Clear all recordings
      localStorage.removeItem(this.storageKey);
      
      // Clear all audio blobs
      const recordings = this.getAllRecordings();
      recordings.forEach(recording => {
        const audioKey = `audio_${recording.uniqueId}`;
        localStorage.removeItem(audioKey);
      });
      
      // Clear any other related data
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.includes('audio_') || key.includes('recording') || key.includes('biomap'))) {
          keysToRemove.push(key);
        }
      }
      
      keysToRemove.forEach(key => localStorage.removeItem(key));
      
      console.log('Nuclear clear completed - all data removed');
      return true;
    } catch (error) {
      console.error('Error during nuclear clear:', error);
      return false;
    }
  }

  /**
   * Clear all audio blobs from localStorage (use with caution)
   */
  clearAllAudioBlobs() {
    try {
      const recordings = this.getAllRecordings();
      let clearedCount = 0;
      
      recordings.forEach(recording => {
        const audioKey = `audio_${recording.uniqueId}`;
        if (localStorage.getItem(audioKey)) {
          localStorage.removeItem(audioKey);
          clearedCount++;
        }
      });
      
      console.log(`Cleared ${clearedCount} audio blobs from localStorage`);
      return clearedCount;
    } catch (error) {
      console.error('Error clearing audio blobs:', error);
      return 0;
    }
  }

  /**
   * Clear all corrupted recordings from localStorage
   */
  clearCorruptedRecordings() {
    try {
      const recordings = this.getAllRecordings();
      const validRecordings = recordings.filter(recording => {
        try {
          if (!recording || typeof recording !== 'object') return false;
          if (!recording.uniqueId) return false;
          if (!recording.location || typeof recording.location !== 'object') return false;
          if (typeof recording.location.lat !== 'number' || isNaN(recording.location.lat)) return false;
          if (typeof recording.location.lng !== 'number' || isNaN(recording.location.lng)) return false;
          if (!recording.filename && !recording.displayName) return false;
          return true;
        } catch (error) {
          return false;
        }
      });
      
      const corruptedCount = recordings.length - validRecordings.length;
      if (corruptedCount > 0) {
        localStorage.setItem(this.storageKey, JSON.stringify(validRecordings));
        console.log(`Cleared ${corruptedCount} corrupted recordings from localStorage`);
      }
      return corruptedCount;
    } catch (error) {
      console.error('Error clearing corrupted recordings:', error);
      return 0;
    }
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