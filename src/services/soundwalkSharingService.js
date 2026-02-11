/**
 * Soundwalk Sharing Service
 * Handles export/import of soundwalk packages for sharing between users
 */

import localStorageService from './localStorageService.js';
import breadcrumbService from './breadcrumbService.js';
import biomappStateManager from './biomappStateManager.js';

class SoundwalkSharingService {
  constructor() {
    this.version = '2.0.0';
    this.maxPackageSize = 50 * 1024 * 1024; // 50MB limit
  }

  /**
   * Export a complete soundwalk package
   * @param {Object} options - Export options
   * @returns {Object} Export package
   */
  async exportSoundwalkPackage(options = {}) {
    try {
      const {
        includeAudio = true,
        includeMetadata = true,
        includeBreadcrumbs = true,
        includeTracklog = true,
        sessionId = null,
        title = null,
        description = null,
        compressionLevel = 'medium'
      } = options;

      console.log('Starting soundwalk package export...');

      // Get all recordings or filter by session
      let recordings = localStorageService.getAllRecordings();
      
      if (sessionId) {
        recordings = recordings.filter(r => r.sessionId === sessionId);
      }

      if (recordings.length === 0) {
        throw new Error('No recordings found to export');
      }

      // Process recordings
      const processedRecordings = [];
      let totalSize = 0;

      for (const recording of recordings) {
        const processedRecording = {
          id: recording.uniqueId,
          filename: recording.filename,
          displayName: recording.displayName || recording.filename,
          duration: recording.duration,
          timestamp: recording.timestamp,
          location: recording.location,
          notes: recording.notes || '',
          species_tags: recording.speciesTags || [],
          weather: recording.weather,
          temperature: recording.temperature,
          quality: recording.quality || 'medium'
        };

        // Include audio data if requested
        if (includeAudio) {
          const audioBlob = await localStorageService.getAudioBlob(recording.uniqueId);
          if (audioBlob) {
            // Convert to base64 for JSON storage
            const base64Audio = await this.blobToBase64(audioBlob);
            processedRecording.audio_data = base64Audio;
            totalSize += audioBlob.size;

            // Check size limits
            if (totalSize > this.maxPackageSize) {
              console.warn(`Package size (${totalSize} bytes) exceeds limit, excluding remaining audio`);
              break;
            }
          }
        }

        // Include breadcrumbs if available and requested
        if (includeBreadcrumbs && recording.breadcrumbs) {
          processedRecording.breadcrumbs = recording.breadcrumbs;
        }

        processedRecordings.push(processedRecording);
      }

      // Get tracklog data
      let tracklogData = null;
      if (includeTracklog) {
        const tracklog = biomappStateManager.getStateProperty('tracklog') || [];
        if (tracklog.length > 0) {
          tracklogData = {
            total_points: tracklog.length,
            compressed_points: tracklog.length, // TODO: Implement compression
            summary: this.generateTracklogSummary(tracklog),
            path: tracklog.map(point => ({
              lat: point.lat,
              lng: point.lng,
              timestamp: point.timestamp,
              elevation: point.altitude
            }))
          };
        }
      }

      // Calculate metadata
      const startLocation = recordings[0]?.location;
      const endLocation = recordings[recordings.length - 1]?.location;
      const totalDuration = recordings.reduce((sum, r) => sum + (r.duration || 0), 0);
      const totalDistance = tracklogData?.summary?.totalDistance || 0;

      // Create export package
      const exportPackage = {
        biomapp_export: {
          version: this.version,
          export_date: new Date().toISOString(),
          export_type: 'soundwalk_package',
          metadata: {
            title: title || `Soundwalk - ${new Date().toLocaleDateString()}`,
            description: description || `BioMapp soundwalk with ${processedRecordings.length} recordings`,
            duration_minutes: Math.round(totalDuration / 60),
            total_distance_meters: Math.round(totalDistance),
            recording_count: processedRecordings.length,
            location_summary: startLocation && endLocation ? {
              start: startLocation,
              end: endLocation
            } : null,
            export_options: {
              includeAudio,
              includeMetadata,
              includeBreadcrumbs,
              includeTracklog,
              compressionLevel
            }
          },
          recordings: processedRecordings
        }
      };

      // Add tracklog if available
      if (tracklogData) {
        exportPackage.biomapp_export.tracklog = tracklogData;
      }

      console.log(`Export completed: ${processedRecordings.length} recordings, ${Math.round(totalSize / 1024)}KB`);
      return exportPackage;

    } catch (error) {
      console.error('Error exporting soundwalk package:', error);
      throw new Error(`Export failed: ${error.message}`);
    }
  }

  /**
   * Import a soundwalk package
   * @param {Object} packageData - Import package data
   * @param {Object} options - Import options
   * @returns {Object} Import result
   */
  async importSoundwalkPackage(packageData, options = {}) {
    try {
      const {
        mergeStrategy = 'skip_duplicates', // 'skip_duplicates', 'overwrite', 'rename'
        importAudio = true,
        importMetadata = true,
        importBreadcrumbs = true,
        importTracklog = true
      } = options;

      console.log('Starting soundwalk package import...');

      // Validate package format
      const validationResult = this.validateImportPackage(packageData);
      if (!validationResult.valid) {
        throw new Error(`Invalid package format: ${validationResult.error}`);
      }

      const biomappData = packageData.biomapp_export;
      const importResults = {
        imported: 0,
        skipped: 0,
        errors: 0,
        recordings: [],
        tracklogImported: false
      };

      // Import recordings
      for (const recordingData of biomappData.recordings) {
        try {
          // Check for duplicates
          const existingRecording = localStorageService.getRecording(recordingData.id);
          
          if (existingRecording && mergeStrategy === 'skip_duplicates') {
            importResults.skipped++;
            continue;
          }

          // Create recording object
          const recording = {
            uniqueId: recordingData.id,
            filename: recordingData.filename,
            displayName: recordingData.displayName,
            duration: recordingData.duration,
            timestamp: recordingData.timestamp,
            location: recordingData.location,
            notes: recordingData.notes || '',
            speciesTags: recordingData.species_tags || [],
            weather: recordingData.weather,
            temperature: recordingData.temperature,
            quality: recordingData.quality || 'medium',
            pendingUpload: false,
            saved: true,
            localTimestamp: Date.now(),
            imported: true,
            importDate: new Date().toISOString()
          };

          // Add breadcrumbs if available
          if (importBreadcrumbs && recordingData.breadcrumbs) {
            recording.breadcrumbs = recordingData.breadcrumbs;
          }

          // Handle audio data
          let audioBlob = null;
          if (importAudio && recordingData.audio_data) {
            audioBlob = await this.base64ToBlob(recordingData.audio_data);
          }

          // Save recording
          await localStorageService.saveRecording(recording, audioBlob);
          
          importResults.imported++;
          importResults.recordings.push(recording);

        } catch (error) {
          console.error(`Error importing recording ${recordingData.id}:`, error);
          importResults.errors++;
        }
      }

      // Import tracklog if available
      if (importTracklog && biomappData.tracklog) {
        try {
          const currentTracklog = biomappStateManager.getStateProperty('tracklog') || [];
          const importedPath = biomappData.tracklog.path || [];
          
          // Merge or replace tracklog based on strategy
          let newTracklog;
          if (mergeStrategy === 'overwrite') {
            newTracklog = importedPath;
          } else {
            // Merge by timestamp, avoiding duplicates
            const combined = [...currentTracklog, ...importedPath];
            newTracklog = combined
              .sort((a, b) => a.timestamp - b.timestamp)
              .filter((point, index, arr) => 
                index === 0 || 
                point.timestamp !== arr[index - 1].timestamp
              );
          }

          biomappStateManager.updateState({ tracklog: newTracklog });
          importResults.tracklogImported = true;

        } catch (error) {
          console.error('Error importing tracklog:', error);
        }
      }

      // Update state with new recordings
      const allRecordings = localStorageService.getAllRecordings();
      biomappStateManager.updateState({ recordings: allRecordings });

      console.log(`Import completed: ${importResults.imported} imported, ${importResults.skipped} skipped, ${importResults.errors} errors`);
      return importResults;

    } catch (error) {
      console.error('Error importing soundwalk package:', error);
      throw new Error(`Import failed: ${error.message}`);
    }
  }

  /**
   * Validate import package format
   * @param {Object} packageData - Package to validate
   * @returns {Object} Validation result
   */
  validateImportPackage(packageData) {
    try {
      if (!packageData || typeof packageData !== 'object') {
        return { valid: false, error: 'Package data is not an object' };
      }

      if (!packageData.biomapp_export) {
        return { valid: false, error: 'Missing biomapp_export section' };
      }

      const biomappData = packageData.biomapp_export;

      if (!biomappData.version) {
        return { valid: false, error: 'Missing version information' };
      }

      if (!biomappData.recordings || !Array.isArray(biomappData.recordings)) {
        return { valid: false, error: 'Missing or invalid recordings array' };
      }

      // Validate each recording
      for (const recording of biomappData.recordings) {
        if (!recording.id || !recording.filename || !recording.location) {
          return { valid: false, error: 'Invalid recording data: missing required fields' };
        }

        if (!recording.location.lat || !recording.location.lng) {
          return { valid: false, error: 'Invalid recording location data' };
        }
      }

      return { valid: true };

    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  /**
   * Generate QR code data for sharing (metadata only)
   * @param {Object} packageData - Package data
   * @returns {string} QR code data
   */
  generateQRCodeData(packageData) {
    try {
      // Create lightweight version for QR code
      const qrData = {
        type: 'biomapp_soundwalk',
        version: this.version,
        metadata: packageData.biomapp_export.metadata,
        recording_count: packageData.biomapp_export.recordings.length,
        // Include only essential location data
        locations: packageData.biomapp_export.recordings.map(r => ({
          lat: r.location.lat,
          lng: r.location.lng,
          timestamp: r.timestamp
        }))
      };

      return JSON.stringify(qrData);

    } catch (error) {
      console.error('Error generating QR code data:', error);
      throw new Error(`QR code generation failed: ${error.message}`);
    }
  }

  /**
   * Convert blob to base64 string
   * @param {Blob} blob - Blob to convert
   * @returns {Promise<string>} Base64 string
   */
  async blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Convert base64 string to blob
   * @param {string} base64 - Base64 string
   * @returns {Promise<Blob>} Blob object
   */
  async base64ToBlob(base64) {
    try {
      const response = await fetch(base64);
      return await response.blob();
    } catch (error) {
      console.error('Error converting base64 to blob:', error);
      throw new Error('Failed to convert audio data');
    }
  }

  /**
   * Generate tracklog summary
   * @param {Array} tracklog - Tracklog points
   * @returns {Object} Summary statistics
   */
  generateTracklogSummary(tracklog) {
    if (!tracklog || tracklog.length < 2) {
      return {
        totalDistance: 0,
        averageSpeed: 0,
        maxSpeed: 0,
        stationaryTime: 0,
        movingTime: 0,
        pattern: 'stationary'
      };
    }

    let totalDistance = 0;
    let totalSpeed = 0;
    let maxSpeed = 0;
    const speeds = [];

    for (let i = 1; i < tracklog.length; i++) {
      const prev = tracklog[i - 1];
      const curr = tracklog[i];
      
      const distance = this.calculateDistance(prev.lat, prev.lng, curr.lat, curr.lng);
      const timeDiff = (curr.timestamp - prev.timestamp) / 1000; // seconds
      const speed = timeDiff > 0 ? distance / timeDiff : 0;
      
      totalDistance += distance;
      totalSpeed += speed;
      maxSpeed = Math.max(maxSpeed, speed);
      speeds.push(speed);
    }

    const averageSpeed = totalSpeed / (tracklog.length - 1);
    const totalTime = (tracklog[tracklog.length - 1].timestamp - tracklog[0].timestamp) / 1000;
    
    // Estimate moving vs stationary time based on speed threshold
    const movingThreshold = 0.5; // m/s
    const movingCount = speeds.filter(s => s > movingThreshold).length;
    const movingTime = (movingCount / speeds.length) * totalTime;
    const stationaryTime = totalTime - movingTime;

    let pattern = 'mixed';
    if (movingCount / speeds.length > 0.8) pattern = 'moving';
    else if (movingCount / speeds.length < 0.2) pattern = 'stationary';

    return {
      totalDistance: Math.round(totalDistance),
      averageSpeed: Math.round(averageSpeed * 100) / 100,
      maxSpeed: Math.round(maxSpeed * 100) / 100,
      stationaryTime: Math.round(stationaryTime),
      movingTime: Math.round(movingTime),
      pattern
    };
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
}

// Create and export singleton instance
const soundwalkSharingService = new SoundwalkSharingService();

export default soundwalkSharingService;