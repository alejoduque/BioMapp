/**
 * Import Service
 * Handles importing data from various export formats into BioMapp
 */

import dataValidator from '../utils/dataValidator.js';
import localStorageService from './localStorageService.js';
import soundwalkSharingService from './soundwalkSharingService.js';
import biomappStateManager from './biomappStateManager.js';

class ImportService {
  constructor() {
    this.supportedFormats = [
      'application/json',
      'text/json',
      '.json',
      '.biomapp',
      '.soundwalk'
    ];
  }

  /**
   * Import data from a file
   * @param {File} file - File to import
   * @param {Object} options - Import options
   * @returns {Promise<Object>} Import result
   */
  async importFromFile(file, options = {}) {
    try {
      console.log('Starting file import:', file.name, file.type, file.size);

      // Validate file type
      if (!this.isSupportedFile(file)) {
        throw new Error(`Unsupported file type: ${file.type || file.name}`);
      }

      // Read file content
      const content = await this.readFileContent(file);
      
      // Parse JSON
      let importData;
      try {
        importData = JSON.parse(content);
      } catch (parseError) {
        throw new Error(`Invalid JSON format: ${parseError.message}`);
      }

      // Import the data
      return await this.importData(importData, options);

    } catch (error) {
      console.error('Import failed:', error);
      throw error;
    }
  }

  /**
   * Import data from JSON string
   * @param {string} jsonString - JSON string to import
   * @param {Object} options - Import options
   * @returns {Promise<Object>} Import result
   */
  async importFromJSON(jsonString, options = {}) {
    try {
      console.log('Starting JSON import');

      // Parse JSON
      let importData;
      try {
        importData = JSON.parse(jsonString);
      } catch (parseError) {
        throw new Error(`Invalid JSON format: ${parseError.message}`);
      }

      // Import the data
      return await this.importData(importData, options);

    } catch (error) {
      console.error('JSON import failed:', error);
      throw error;
    }
  }

  /**
   * Import data from object
   * @param {Object} importData - Data to import
   * @param {Object} options - Import options
   * @returns {Promise<Object>} Import result
   */
  async importData(importData, options = {}) {
    try {
      const {
        mergeStrategy = 'skip_duplicates', // 'skip_duplicates', 'overwrite', 'rename'
        importAudio = true,
        importMetadata = true,
        importBreadcrumbs = true,
        importTracklog = true,
        validateOnly = false
      } = options;

      console.log('Starting data import with options:', options);

      // Detect format
      const format = dataValidator.detectImportFormat(importData);
      console.log('Detected import format:', format);

      if (format === 'unknown') {
        throw new Error('Unknown import format');
      }

      // Validate data
      const validationResult = dataValidator.validateImportData(importData);
      if (!validationResult.valid) {
        console.error('Validation failed:', validationResult.errors);
        throw new Error(`Validation failed: ${validationResult.errors.map(e => e.message).join(', ')}`);
      }

      console.log('Validation passed:', validationResult);

      if (validateOnly) {
        return {
          success: true,
          format,
          validation: validationResult,
          message: 'Validation completed successfully'
        };
      }

      // Sanitize data
      const sanitizedData = dataValidator.sanitizeImportData(importData);
      if (!sanitizedData) {
        throw new Error('Failed to sanitize import data');
      }

      // Import based on format
      let importResult;
      switch (format) {
        case 'biomapp_package':
          importResult = await this.importBioMappPackage(sanitizedData, options);
          break;
        case 'recordings_array':
          importResult = await this.importRecordingsArray(sanitizedData, options);
          break;
        case 'metadata_export':
          importResult = await this.importMetadataExport(sanitizedData, options);
          break;
        case 'single_recording':
          importResult = await this.importSingleRecording(sanitizedData, options);
          break;
        default:
          throw new Error(`Unsupported format: ${format}`);
      }

      // Update app state
      const allRecordings = localStorageService.getAllRecordings();
      biomappStateManager.updateState({ recordings: allRecordings });

      console.log('Import completed successfully:', importResult);
      return {
        success: true,
        format,
        validation: validationResult,
        import: importResult,
        message: `Successfully imported ${importResult.imported} recordings`
      };

    } catch (error) {
      console.error('Data import failed:', error);
      throw error;
    }
  }

  /**
   * Import BioMapp package format
   * @param {Object} data - Sanitized package data
   * @param {Object} options - Import options
   * @returns {Promise<Object>} Import result
   */
  async importBioMappPackage(data, options) {
    try {
      console.log('Importing BioMapp package');

      // Use the existing soundwalk sharing service for BioMapp packages
      const importResult = await soundwalkSharingService.importSoundwalkPackage(data, options);

      return {
        type: 'biomapp_package',
        imported: importResult.imported,
        skipped: importResult.skipped,
        errors: importResult.errors,
        tracklogImported: importResult.tracklogImported,
        recordings: importResult.recordings
      };

    } catch (error) {
      console.error('BioMapp package import failed:', error);
      throw error;
    }
  }

  /**
   * Import recordings array format
   * @param {Object} data - Sanitized data with recordings array
   * @param {Object} options - Import options
   * @returns {Promise<Object>} Import result
   */
  async importRecordingsArray(data, options) {
    try {
      console.log('Importing recordings array');

      const {
        mergeStrategy = 'skip_duplicates',
        importAudio = true
      } = options;

      const importResults = {
        imported: 0,
        skipped: 0,
        errors: 0,
        recordings: []
      };

      for (const recordingData of data.recordings) {
        try {
          // Check for duplicates
          const existingRecording = localStorageService.getRecording(recordingData.uniqueId);
          
          if (existingRecording && mergeStrategy === 'skip_duplicates') {
            importResults.skipped++;
            continue;
          }

          // Create recording object
          const recording = {
            uniqueId: recordingData.uniqueId,
            filename: recordingData.filename,
            displayName: recordingData.displayName,
            duration: recordingData.duration,
            timestamp: recordingData.timestamp,
            location: recordingData.location,
            notes: recordingData.notes || '',
            speciesTags: recordingData.speciesTags || [],
            weather: recordingData.weather,
            temperature: recordingData.temperature,
            quality: recordingData.quality || 'medium',
            pendingUpload: false,
            saved: true,
            localTimestamp: Date.now(),
            imported: true,
            importDate: new Date().toISOString()
          };

          // Handle audio data if present
          let audioBlob = null;
          if (importAudio && recordingData.audio_data) {
            audioBlob = await this.base64ToBlob(recordingData.audio_data);
          }

          // Save recording
          await localStorageService.saveRecording(recording, audioBlob);
          
          importResults.imported++;
          importResults.recordings.push(recording);

        } catch (error) {
          console.error(`Error importing recording ${recordingData.uniqueId}:`, error);
          importResults.errors++;
        }
      }

      return {
        type: 'recordings_array',
        ...importResults
      };

    } catch (error) {
      console.error('Recordings array import failed:', error);
      throw error;
    }
  }

  /**
   * Import metadata export format
   * @param {Object} data - Sanitized metadata export data
   * @param {Object} options - Import options
   * @returns {Promise<Object>} Import result
   */
  async importMetadataExport(data, options) {
    try {
      console.log('Importing metadata export');

      // Convert metadata export format to recordings array format
      const recordingsData = {
        recordings: data.recordings.map(recording => ({
          ...recording,
          uniqueId: recording.uniqueId || `imported_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        }))
      };

      return await this.importRecordingsArray(recordingsData, options);

    } catch (error) {
      console.error('Metadata export import failed:', error);
      throw error;
    }
  }

  /**
   * Import single recording
   * @param {Object} recordingData - Single recording data
   * @param {Object} options - Import options
   * @returns {Promise<Object>} Import result
   */
  async importSingleRecording(recordingData, options) {
    try {
      console.log('Importing single recording');

      const {
        mergeStrategy = 'skip_duplicates',
        importAudio = true
      } = options;

      // Check for duplicates
      const existingRecording = localStorageService.getRecording(recordingData.uniqueId);
      
      if (existingRecording && mergeStrategy === 'skip_duplicates') {
        return {
          type: 'single_recording',
          imported: 0,
          skipped: 1,
          errors: 0,
          recordings: []
        };
      }

      // Create recording object
      const recording = {
        uniqueId: recordingData.uniqueId,
        filename: recordingData.filename,
        displayName: recordingData.displayName,
        duration: recordingData.duration,
        timestamp: recordingData.timestamp,
        location: recordingData.location,
        notes: recordingData.notes || '',
        speciesTags: recordingData.speciesTags || [],
        weather: recordingData.weather,
        temperature: recordingData.temperature,
        quality: recordingData.quality || 'medium',
        pendingUpload: false,
        saved: true,
        localTimestamp: Date.now(),
        imported: true,
        importDate: new Date().toISOString()
      };

      // Handle audio data if present
      let audioBlob = null;
      if (importAudio && recordingData.audio_data) {
        audioBlob = await this.base64ToBlob(recordingData.audio_data);
      }

      // Save recording
      await localStorageService.saveRecording(recording, audioBlob);

      return {
        type: 'single_recording',
        imported: 1,
        skipped: 0,
        errors: 0,
        recordings: [recording]
      };

    } catch (error) {
      console.error('Single recording import failed:', error);
      throw error;
    }
  }

  /**
   * Check if file is supported
   * @param {File} file - File to check
   * @returns {boolean} True if supported
   */
  isSupportedFile(file) {
    // Check MIME type
    if (this.supportedFormats.includes(file.type)) {
      return true;
    }

    // Check file extension
    const extension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    if (this.supportedFormats.includes(extension)) {
      return true;
    }

    return false;
  }

  /**
   * Read file content as text
   * @param {File} file - File to read
   * @returns {Promise<string>} File content
   */
  readFileContent(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
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
   * Get import statistics
   * @returns {Object} Import statistics
   */
  getImportStats() {
    const allRecordings = localStorageService.getAllRecordings();
    const importedRecordings = allRecordings.filter(r => r.imported);
    
    return {
      totalRecordings: allRecordings.length,
      importedRecordings: importedRecordings.length,
      localRecordings: allRecordings.length - importedRecordings.length,
      importDates: [...new Set(importedRecordings.map(r => r.importDate?.split('T')[0]).filter(Boolean))]
    };
  }

  /**
   * Clear imported data
   * @param {Object} options - Clear options
   * @returns {Promise<Object>} Clear result
   */
  async clearImportedData(options = {}) {
    try {
      const {
        clearAll = false,
        clearByDate = null,
        clearBySource = null
      } = options;

      const allRecordings = localStorageService.getAllRecordings();
      let recordingsToRemove = [];

      if (clearAll) {
        recordingsToRemove = allRecordings.filter(r => r.imported);
      } else if (clearByDate) {
        recordingsToRemove = allRecordings.filter(r => 
          r.imported && r.importDate?.startsWith(clearByDate)
        );
      } else if (clearBySource) {
        recordingsToRemove = allRecordings.filter(r => 
          r.imported && r.importSource === clearBySource
        );
      }

      let removedCount = 0;
      for (const recording of recordingsToRemove) {
        try {
          await localStorageService.deleteRecording(recording.uniqueId);
          removedCount++;
        } catch (error) {
          console.error(`Failed to remove recording ${recording.uniqueId}:`, error);
        }
      }

      // Update app state
      const remainingRecordings = localStorageService.getAllRecordings();
      biomappStateManager.updateState({ recordings: remainingRecordings });

      return {
        success: true,
        removed: removedCount,
        remaining: remainingRecordings.length
      };

    } catch (error) {
      console.error('Clear imported data failed:', error);
      throw error;
    }
  }
}

// Create and export singleton instance
const importService = new ImportService();

export default importService; 