/**
 * Data Validator Utility
 * Validates data structures and ensures consistency across BioMapp components
 */

class DataValidator {
  constructor() {
    this.errors = [];
  }

  /**
   * Clear validation errors
   */
  clearErrors() {
    this.errors = [];
  }

  /**
   * Add validation error
   * @param {string} field - Field name
   * @param {string} message - Error message
   */
  addError(field, message) {
    this.errors.push({ field, message });
  }

  /**
   * Get validation errors
   * @returns {Array} Array of error objects
   */
  getErrors() {
    return [...this.errors];
  }

  /**
   * Check if validation passed
   * @returns {boolean} True if no errors
   */
  isValid() {
    return this.errors.length === 0;
  }

  /**
   * Validate recording object
   * @param {Object} recording - Recording to validate
   * @returns {boolean} True if valid
   */
  validateRecording(recording) {
    this.clearErrors();

    if (!recording || typeof recording !== 'object') {
      this.addError('recording', 'Recording must be an object');
      return false;
    }

    // Required fields
    const requiredFields = [
      'uniqueId',
      'filename', 
      'duration',
      'timestamp',
      'location'
    ];

    for (const field of requiredFields) {
      if (!recording[field]) {
        this.addError(field, `${field} is required`);
      }
    }

    // Validate uniqueId
    if (recording.uniqueId && typeof recording.uniqueId !== 'string') {
      this.addError('uniqueId', 'uniqueId must be a string');
    }

    // Validate filename
    if (recording.filename && typeof recording.filename !== 'string') {
      this.addError('filename', 'filename must be a string');
    }

    // Validate duration
    if (recording.duration !== undefined) {
      if (typeof recording.duration !== 'number' || recording.duration <= 0) {
        this.addError('duration', 'duration must be a positive number');
      }
    }

    // Validate timestamp
    if (recording.timestamp) {
      const timestamp = new Date(recording.timestamp);
      if (isNaN(timestamp.getTime())) {
        this.addError('timestamp', 'timestamp must be a valid date');
      }
    }

    // Validate location
    if (recording.location) {
      if (!this.validateLocation(recording.location)) {
        this.addError('location', 'location must have valid lat and lng coordinates');
      }
    }

    // Validate optional fields
    if (recording.speciesTags && !Array.isArray(recording.speciesTags)) {
      this.addError('speciesTags', 'speciesTags must be an array');
    }

    if (recording.quality && !['low', 'medium', 'high'].includes(recording.quality)) {
      this.addError('quality', 'quality must be low, medium, or high');
    }

    if (recording.pendingUpload !== undefined && typeof recording.pendingUpload !== 'boolean') {
      this.addError('pendingUpload', 'pendingUpload must be a boolean');
    }

    return this.isValid();
  }

  /**
   * Validate location object
   * @param {Object} location - Location to validate
   * @returns {boolean} True if valid
   */
  validateLocation(location) {
    if (!location || typeof location !== 'object') {
      return false;
    }

    // Check required coordinates
    if (typeof location.lat !== 'number' || typeof location.lng !== 'number') {
      return false;
    }

    // Check coordinate ranges
    if (location.lat < -90 || location.lat > 90) {
      return false;
    }

    if (location.lng < -180 || location.lng > 180) {
      return false;
    }

    // Check for NaN or Infinity
    if (!isFinite(location.lat) || !isFinite(location.lng)) {
      return false;
    }

    // Validate optional fields
    if (location.accuracy !== undefined) {
      if (typeof location.accuracy !== 'number' || location.accuracy < 0) {
        return false;
      }
    }

    if (location.altitude !== undefined) {
      if (typeof location.altitude !== 'number' || !isFinite(location.altitude)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Validate breadcrumb object
   * @param {Object} breadcrumb - Breadcrumb to validate
   * @returns {boolean} True if valid
   */
  validateBreadcrumb(breadcrumb) {
    this.clearErrors();

    if (!breadcrumb || typeof breadcrumb !== 'object') {
      this.addError('breadcrumb', 'Breadcrumb must be an object');
      return false;
    }

    // Validate location
    if (!this.validateLocation(breadcrumb)) {
      this.addError('location', 'Breadcrumb must have valid location coordinates');
    }

    // Validate timestamp
    if (typeof breadcrumb.timestamp !== 'number' || breadcrumb.timestamp <= 0) {
      this.addError('timestamp', 'timestamp must be a positive number');
    }

    // Validate sessionId
    if (!breadcrumb.sessionId || typeof breadcrumb.sessionId !== 'string') {
      this.addError('sessionId', 'sessionId is required and must be a string');
    }

    // Validate audioLevel
    if (breadcrumb.audioLevel !== undefined) {
      if (typeof breadcrumb.audioLevel !== 'number' || 
          breadcrumb.audioLevel < 0 || breadcrumb.audioLevel > 1) {
        this.addError('audioLevel', 'audioLevel must be a number between 0 and 1');
      }
    }

    // Validate isMoving
    if (breadcrumb.isMoving !== undefined && typeof breadcrumb.isMoving !== 'boolean') {
      this.addError('isMoving', 'isMoving must be a boolean');
    }

    // Validate movementSpeed
    if (breadcrumb.movementSpeed !== undefined) {
      if (typeof breadcrumb.movementSpeed !== 'number' || breadcrumb.movementSpeed < 0) {
        this.addError('movementSpeed', 'movementSpeed must be a non-negative number');
      }
    }

    // Validate direction
    if (breadcrumb.direction !== undefined) {
      if (typeof breadcrumb.direction !== 'number' || 
          breadcrumb.direction < 0 || breadcrumb.direction >= 360) {
        this.addError('direction', 'direction must be a number between 0 and 359');
      }
    }

    return this.isValid();
  }

  /**
   * Validate export package
   * @param {Object} packageData - Package to validate
   * @returns {boolean} True if valid
   */
  validateExportPackage(packageData) {
    this.clearErrors();

    if (!packageData || typeof packageData !== 'object') {
      this.addError('package', 'Package data must be an object');
      return false;
    }

    if (!packageData.biomapp_export) {
      this.addError('biomapp_export', 'Missing biomapp_export section');
      return false;
    }

    const biomappData = packageData.biomapp_export;

    // Validate version
    if (!biomappData.version || typeof biomappData.version !== 'string') {
      this.addError('version', 'version is required and must be a string');
    }

    // Validate export_date
    if (!biomappData.export_date) {
      this.addError('export_date', 'export_date is required');
    } else {
      const date = new Date(biomappData.export_date);
      if (isNaN(date.getTime())) {
        this.addError('export_date', 'export_date must be a valid ISO date string');
      }
    }

    // Validate export_type
    const validTypes = ['soundwalk_package', 'recording_collection', 'metadata_only'];
    if (!biomappData.export_type || !validTypes.includes(biomappData.export_type)) {
      this.addError('export_type', `export_type must be one of: ${validTypes.join(', ')}`);
    }

    // Validate recordings array
    if (!biomappData.recordings || !Array.isArray(biomappData.recordings)) {
      this.addError('recordings', 'recordings must be an array');
    } else {
      // Validate each recording
      biomappData.recordings.forEach((recording, index) => {
        if (!this.validateExportRecording(recording)) {
          this.addError(`recordings[${index}]`, 'Invalid recording data');
        }
      });
    }

    // Validate metadata if present
    if (biomappData.metadata && typeof biomappData.metadata !== 'object') {
      this.addError('metadata', 'metadata must be an object');
    }

    // Validate tracklog if present
    if (biomappData.tracklog) {
      if (!this.validateTracklog(biomappData.tracklog)) {
        this.addError('tracklog', 'Invalid tracklog data');
      }
    }

    return this.isValid();
  }

  /**
   * Validate export recording format
   * @param {Object} recording - Recording to validate
   * @returns {boolean} True if valid
   */
  validateExportRecording(recording) {
    if (!recording || typeof recording !== 'object') {
      return false;
    }

    // Required fields for export format
    const requiredFields = ['id', 'filename', 'location'];
    for (const field of requiredFields) {
      if (!recording[field]) {
        return false;
      }
    }

    // Validate location
    if (!this.validateLocation(recording.location)) {
      return false;
    }

    // Validate optional fields
    if (recording.duration !== undefined && 
        (typeof recording.duration !== 'number' || recording.duration <= 0)) {
      return false;
    }

    if (recording.timestamp) {
      const timestamp = new Date(recording.timestamp);
      if (isNaN(timestamp.getTime())) {
        return false;
      }
    }

    if (recording.species_tags && !Array.isArray(recording.species_tags)) {
      return false;
    }

    return true;
  }

  /**
   * Validate tracklog data
   * @param {Object} tracklog - Tracklog to validate
   * @returns {boolean} True if valid
   */
  validateTracklog(tracklog) {
    if (!tracklog || typeof tracklog !== 'object') {
      return false;
    }

    // Validate required fields
    if (typeof tracklog.total_points !== 'number' || tracklog.total_points < 0) {
      return false;
    }

    if (typeof tracklog.compressed_points !== 'number' || tracklog.compressed_points < 0) {
      return false;
    }

    // Validate path array
    if (!tracklog.path || !Array.isArray(tracklog.path)) {
      return false;
    }

    // Validate each path point
    for (const point of tracklog.path) {
      if (!point || typeof point !== 'object') {
        return false;
      }

      if (typeof point.lat !== 'number' || typeof point.lng !== 'number') {
        return false;
      }

      if (!isFinite(point.lat) || !isFinite(point.lng)) {
        return false;
      }

      if (point.lat < -90 || point.lat > 90 || point.lng < -180 || point.lng > 180) {
        return false;
      }

      if (typeof point.timestamp !== 'number' || point.timestamp <= 0) {
        return false;
      }
    }

    // Validate summary if present
    if (tracklog.summary) {
      const summary = tracklog.summary;
      const numericFields = ['totalDistance', 'averageSpeed', 'maxSpeed', 'stationaryTime', 'movingTime'];
      
      for (const field of numericFields) {
        if (summary[field] !== undefined && 
            (typeof summary[field] !== 'number' || summary[field] < 0)) {
          return false;
        }
      }

      if (summary.pattern && !['stationary', 'moving', 'mixed'].includes(summary.pattern)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Sanitize recording data
   * @param {Object} recording - Recording to sanitize
   * @returns {Object} Sanitized recording
   */
  sanitizeRecording(recording) {
    if (!recording || typeof recording !== 'object') {
      return null;
    }

    const sanitized = {
      uniqueId: String(recording.uniqueId || ''),
      filename: String(recording.filename || ''),
      displayName: recording.displayName ? String(recording.displayName) : undefined,
      duration: Number(recording.duration) || 0,
      timestamp: recording.timestamp || new Date().toISOString(),
      location: this.sanitizeLocation(recording.location),
      notes: recording.notes ? String(recording.notes) : '',
      speciesTags: Array.isArray(recording.speciesTags) ? 
        recording.speciesTags.map(tag => String(tag)) : [],
      weather: recording.weather ? String(recording.weather) : undefined,
      temperature: recording.temperature ? Number(recording.temperature) : undefined,
      quality: ['low', 'medium', 'high'].includes(recording.quality) ? 
        recording.quality : 'medium',
      pendingUpload: Boolean(recording.pendingUpload),
      saved: Boolean(recording.saved)
    };

    // Remove undefined values
    Object.keys(sanitized).forEach(key => {
      if (sanitized[key] === undefined) {
        delete sanitized[key];
      }
    });

    return sanitized;
  }

  /**
   * Sanitize location data
   * @param {Object} location - Location to sanitize
   * @returns {Object} Sanitized location
   */
  sanitizeLocation(location) {
    if (!location || typeof location !== 'object') {
      return null;
    }

    const sanitized = {
      lat: Number(location.lat),
      lng: Number(location.lng)
    };

    // Validate coordinates
    if (!isFinite(sanitized.lat) || !isFinite(sanitized.lng)) {
      return null;
    }

    // Clamp to valid ranges
    sanitized.lat = Math.max(-90, Math.min(90, sanitized.lat));
    sanitized.lng = Math.max(-180, Math.min(180, sanitized.lng));

    // Add optional fields if valid
    if (location.accuracy && typeof location.accuracy === 'number' && location.accuracy >= 0) {
      sanitized.accuracy = location.accuracy;
    }

    if (location.altitude && typeof location.altitude === 'number' && isFinite(location.altitude)) {
      sanitized.altitude = location.altitude;
    }

    if (location.timestamp && typeof location.timestamp === 'number' && location.timestamp > 0) {
      sanitized.timestamp = location.timestamp;
    }

    return sanitized;
  }

  /**
   * Generate validation report
   * @returns {Object} Validation report
   */
  generateReport() {
    return {
      isValid: this.isValid(),
      errorCount: this.errors.length,
      errors: this.getErrors(),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Validate import package
   * @param {Object} importData - Data to validate for import
   * @returns {Object} Validation result with details
   */
  validateImportData(importData) {
    this.clearErrors();

    if (!importData || typeof importData !== 'object') {
      this.addError('importData', 'Import data must be an object');
      return { valid: false, errors: this.getErrors() };
    }

    // Check for different import formats
    if (importData.biomapp_export) {
      // BioMapp export package format
      return this.validateExportPackage(importData);
    } else if (importData.recordings && Array.isArray(importData.recordings)) {
      // Simple recordings array format
      return this.validateRecordingsArray(importData);
    } else if (importData.exportDate || importData.totalRecordings) {
      // Metadata export format
      return this.validateMetadataExport(importData);
    } else {
      this.addError('format', 'Unknown import format');
      return { valid: false, errors: this.getErrors() };
    }
  }

  /**
   * Validate recordings array format
   * @param {Object} data - Data with recordings array
   * @returns {Object} Validation result
   */
  validateRecordingsArray(data) {
    if (!data.recordings || !Array.isArray(data.recordings)) {
      this.addError('recordings', 'recordings must be an array');
      return { valid: false, errors: this.getErrors() };
    }

    let validCount = 0;
    let errorCount = 0;

    data.recordings.forEach((recording, index) => {
      if (this.validateRecording(recording)) {
        validCount++;
      } else {
        errorCount++;
        this.addError(`recordings[${index}]`, `Invalid recording at index ${index}`);
      }
    });

    if (validCount === 0) {
      this.addError('recordings', 'No valid recordings found');
    }

    return {
      valid: this.isValid(),
      errors: this.getErrors(),
      stats: {
        total: data.recordings.length,
        valid: validCount,
        errors: errorCount
      }
    };
  }

  /**
   * Validate metadata export format
   * @param {Object} data - Metadata export data
   * @returns {Object} Validation result
   */
  validateMetadataExport(data) {
    if (!data.exportDate) {
      this.addError('exportDate', 'exportDate is required');
    } else {
      const date = new Date(data.exportDate);
      if (isNaN(date.getTime())) {
        this.addError('exportDate', 'exportDate must be a valid ISO date string');
      }
    }

    if (typeof data.totalRecordings !== 'number' || data.totalRecordings < 0) {
      this.addError('totalRecordings', 'totalRecordings must be a non-negative number');
    }

    if (!data.recordings || !Array.isArray(data.recordings)) {
      this.addError('recordings', 'recordings must be an array');
    } else {
      // Validate each recording
      data.recordings.forEach((recording, index) => {
        if (!this.validateRecording(recording)) {
          this.addError(`recordings[${index}]`, 'Invalid recording data');
        }
      });
    }

    return {
      valid: this.isValid(),
      errors: this.getErrors(),
      stats: {
        total: data.recordings?.length || 0,
        valid: data.recordings?.filter(r => this.validateRecording(r)).length || 0
      }
    };
  }

  /**
   * Detect import format
   * @param {Object} data - Data to analyze
   * @returns {string} Format type
   */
  detectImportFormat(data) {
    if (!data || typeof data !== 'object') {
      return 'unknown';
    }

    if (data.biomapp_export) {
      return 'biomapp_package';
    } else if (data.recordings && Array.isArray(data.recordings)) {
      return 'recordings_array';
    } else if (data.exportDate || data.totalRecordings) {
      return 'metadata_export';
    } else if (data.uniqueId || data.filename) {
      return 'single_recording';
    }

    return 'unknown';
  }

  /**
   * Sanitize import data
   * @param {Object} data - Data to sanitize
   * @returns {Object} Sanitized data
   */
  sanitizeImportData(data) {
    const format = this.detectImportFormat(data);
    
    switch (format) {
      case 'biomapp_package':
        return this.sanitizeExportPackage(data);
      case 'recordings_array':
        return this.sanitizeRecordingsArray(data);
      case 'metadata_export':
        return this.sanitizeMetadataExport(data);
      case 'single_recording':
        return this.sanitizeRecording(data);
      default:
        return null;
    }
  }

  /**
   * Sanitize export package
   * @param {Object} data - Export package to sanitize
   * @returns {Object} Sanitized package
   */
  sanitizeExportPackage(data) {
    if (!data.biomapp_export) {
      return null;
    }

    const sanitized = {
      biomapp_export: {
        version: String(data.biomapp_export.version || '1.0.0'),
        export_date: data.biomapp_export.export_date || new Date().toISOString(),
        export_type: data.biomapp_export.export_type || 'soundwalk_package',
        recordings: []
      }
    };

    // Sanitize recordings
    if (data.biomapp_export.recordings && Array.isArray(data.biomapp_export.recordings)) {
      sanitized.biomapp_export.recordings = data.biomapp_export.recordings
        .map(recording => this.sanitizeExportRecording(recording))
        .filter(recording => recording !== null);
    }

    // Sanitize metadata
    if (data.biomapp_export.metadata) {
      sanitized.biomapp_export.metadata = {
        title: String(data.biomapp_export.metadata.title || ''),
        description: String(data.biomapp_export.metadata.description || ''),
        duration_minutes: Number(data.biomapp_export.metadata.duration_minutes) || 0,
        total_distance_meters: Number(data.biomapp_export.metadata.total_distance_meters) || 0,
        recording_count: Number(data.biomapp_export.metadata.recording_count) || 0
      };
    }

    // Sanitize tracklog
    if (data.biomapp_export.tracklog) {
      sanitized.biomapp_export.tracklog = this.sanitizeTracklog(data.biomapp_export.tracklog);
    }

    return sanitized;
  }

  /**
   * Sanitize recordings array
   * @param {Object} data - Data with recordings array
   * @returns {Object} Sanitized data
   */
  sanitizeRecordingsArray(data) {
    const sanitized = {
      recordings: []
    };

    if (data.recordings && Array.isArray(data.recordings)) {
      sanitized.recordings = data.recordings
        .map(recording => this.sanitizeRecording(recording))
        .filter(recording => recording !== null);
    }

    return sanitized;
  }

  /**
   * Sanitize metadata export
   * @param {Object} data - Metadata export data
   * @returns {Object} Sanitized data
   */
  sanitizeMetadataExport(data) {
    const sanitized = {
      exportDate: data.exportDate || new Date().toISOString(),
      totalRecordings: Number(data.totalRecordings) || 0,
      recordings: []
    };

    if (data.recordings && Array.isArray(data.recordings)) {
      sanitized.recordings = data.recordings
        .map(recording => this.sanitizeRecording(recording))
        .filter(recording => recording !== null);
    }

    return sanitized;
  }

  /**
   * Sanitize export recording format
   * @param {Object} recording - Recording to sanitize
   * @returns {Object} Sanitized recording
   */
  sanitizeExportRecording(recording) {
    if (!recording || typeof recording !== 'object') {
      return null;
    }

    const sanitized = {
      id: String(recording.id || recording.uniqueId || ''),
      filename: String(recording.filename || ''),
      displayName: recording.displayName ? String(recording.displayName) : undefined,
      duration: Number(recording.duration) || 0,
      timestamp: recording.timestamp || new Date().toISOString(),
      location: this.sanitizeLocation(recording.location),
      notes: recording.notes ? String(recording.notes) : '',
      species_tags: Array.isArray(recording.species_tags || recording.speciesTags) ? 
        (recording.species_tags || recording.speciesTags).map(tag => String(tag)) : [],
      weather: recording.weather ? String(recording.weather) : undefined,
      temperature: recording.temperature ? Number(recording.temperature) : undefined,
      quality: ['low', 'medium', 'high'].includes(recording.quality) ? 
        recording.quality : 'medium'
    };

    // Handle audio data if present
    if (recording.audio_data) {
      sanitized.audio_data = String(recording.audio_data);
    }

    // Handle breadcrumbs if present
    if (recording.breadcrumbs && Array.isArray(recording.breadcrumbs)) {
      sanitized.breadcrumbs = recording.breadcrumbs
        .map(crumb => this.sanitizeBreadcrumb(crumb))
        .filter(crumb => crumb !== null);
    }

    // Remove undefined values
    Object.keys(sanitized).forEach(key => {
      if (sanitized[key] === undefined) {
        delete sanitized[key];
      }
    });

    return sanitized;
  }

  /**
   * Sanitize breadcrumb data
   * @param {Object} breadcrumb - Breadcrumb to sanitize
   * @returns {Object} Sanitized breadcrumb
   */
  sanitizeBreadcrumb(breadcrumb) {
    if (!breadcrumb || typeof breadcrumb !== 'object') {
      return null;
    }

    const sanitized = {
      lat: Number(breadcrumb.lat),
      lng: Number(breadcrumb.lng),
      timestamp: Number(breadcrumb.timestamp) || Date.now(),
      sessionId: String(breadcrumb.sessionId || '')
    };

    // Validate coordinates
    if (!isFinite(sanitized.lat) || !isFinite(sanitized.lng)) {
      return null;
    }

    // Clamp to valid ranges
    sanitized.lat = Math.max(-90, Math.min(90, sanitized.lat));
    sanitized.lng = Math.max(-180, Math.min(180, sanitized.lng));

    // Add optional fields if valid
    if (breadcrumb.audioLevel !== undefined) {
      const audioLevel = Number(breadcrumb.audioLevel);
      if (audioLevel >= 0 && audioLevel <= 1) {
        sanitized.audioLevel = audioLevel;
      }
    }

    if (breadcrumb.isMoving !== undefined) {
      sanitized.isMoving = Boolean(breadcrumb.isMoving);
    }

    if (breadcrumb.movementSpeed !== undefined) {
      const speed = Number(breadcrumb.movementSpeed);
      if (speed >= 0) {
        sanitized.movementSpeed = speed;
      }
    }

    if (breadcrumb.direction !== undefined) {
      const direction = Number(breadcrumb.direction);
      if (direction >= 0 && direction < 360) {
        sanitized.direction = direction;
      }
    }

    if (breadcrumb.accuracy !== undefined) {
      const accuracy = Number(breadcrumb.accuracy);
      if (accuracy >= 0) {
        sanitized.accuracy = accuracy;
      }
    }

    return sanitized;
  }
}

// Create and export singleton instance
const dataValidator = new DataValidator();

export default dataValidator;