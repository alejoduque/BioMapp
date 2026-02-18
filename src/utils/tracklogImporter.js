// Tracklog Importer Utility
// Imports tracklogs from other users and handles location reassignment

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
 * - ShareAlike — If you remix, transform, and build upon the material, you must distribute your contributions under the same license as the original.
 *
 * This license applies to all forms of use, including by automated systems or artificial intelligence models,
 * to prevent unauthorized commercial exploitation and ensure proper attribution.
 */

import JSZip from 'jszip';
import breadcrumbService from '../services/breadcrumbService.js';
import localStorageService from '../services/localStorageService.js';
import DeriveSonoraImporter from './deriveSonoraImporter.js';

class TracklogImporter {

  /**
   * Import a tracklog from a ZIP file
   * @param {File} zipFile - The ZIP file containing the tracklog
   * @param {Object} options - Import options
   */
  static async importTracklogFromZip(zipFile, options = {}) {
    try {
      // Check if this is a Derive Sonora package first
      const deriveManifest = await DeriveSonoraImporter.detectDerivePackage(zipFile);
      if (deriveManifest) {
        console.log('Detected Derive Sonora package, delegating to DeriveSonoraImporter');
        return await DeriveSonoraImporter.importDerive(zipFile);
      }

      const zip = new JSZip();
      const zipContent = await zip.loadAsync(zipFile);
      
      // Read tracklog data
      const tracklogJson = await zipContent.file('tracklog/tracklog.json').async('string');
      const tracklogData = JSON.parse(tracklogJson);
      
      // Read export summary
      const summaryJson = await zipContent.file('export_summary.json').async('string');
      const summary = JSON.parse(summaryJson);
      
      console.log('Importing tracklog:', summary);
      
      // Import audio files and metadata
      const importedRecordings = await this.importAudioFiles(zipContent, options);
      
      // Import breadcrumbs
      const importedBreadcrumbs = await this.importBreadcrumbs(tracklogData, options);
      
      // Create import summary
      const importSummary = {
        originalSessionId: tracklogData.sessionId,
        newSessionId: `imported-${Date.now()}`,
        importedRecordings: importedRecordings.length,
        importedBreadcrumbs: importedBreadcrumbs.length,
        importDate: new Date().toISOString(),
        options: options
      };
      
      console.log('Import completed:', importSummary);
      return importSummary;
      
    } catch (error) {
      console.error('Error importing tracklog:', error);
      throw new Error(`Failed to import tracklog: ${error.message}`);
    }
  }

  /**
   * Import audio files from ZIP
   */
  static async importAudioFiles(zipContent, options = {}) {
    const importedRecordings = [];

    // Build filename → metadata lookup from all metadata/*.json files
    // The exporter names audio by recording.filename but metadata by recording.uniqueId,
    // so we can't simply strip the extension — we must scan all metadata files.
    const metadataByFilename = {};
    const metadataByUniqueId = {};
    const metadataPaths = Object.keys(zipContent.files).filter(k => k.startsWith('metadata/') && k.endsWith('.json'));
    for (const mPath of metadataPaths) {
      try {
        const meta = JSON.parse(await zipContent.file(mPath).async('string'));
        if (meta.filename) metadataByFilename[meta.filename] = meta;
        if (meta.uniqueId) metadataByUniqueId[meta.uniqueId] = meta;
      } catch (e) { /* skip malformed */ }
    }

    // Get all audio files
    const audioFiles = Object.keys(zipContent.files).filter(key =>
      key.startsWith('audio/') && !key.endsWith('/')
    );

    for (const audioPath of audioFiles) {
      try {
        // Get audio file
        const audioBlob = await zipContent.file(audioPath).async('blob');
        const filename = audioPath.replace('audio/', '');
        const filenameNoExt = filename.replace(/\.[^/.]+$/, '');

        // Look up metadata: by filename, then by uniqueId match, then fallback
        let metadata = metadataByFilename[filename]
          || metadataByUniqueId[filenameNoExt]
          || metadataByFilename[filenameNoExt]
          || null;

        if (!metadata) {
          // Create basic metadata if not available
          metadata = {
            uniqueId: filenameNoExt,
            filename: filename,
            timestamp: new Date().toISOString(),
            duration: 0,
            location: null,
            speciesTags: [],
            notes: 'Imported recording'
          };
        }
        
        // Apply location transformation if specified
        if (options.locationTransform) {
          metadata.location = this.transformLocation(metadata.location, options.locationTransform);
        }
        
        // Apply time offset if specified
        if (options.timeOffset) {
          const originalTime = new Date(metadata.timestamp).getTime();
          metadata.timestamp = new Date(originalTime + options.timeOffset).toISOString();
        }
        
        // Skip recordings with no location — can't place them on the map
        if (!metadata.location || !metadata.location.lat || !metadata.location.lng) {
          console.warn(`Skipping ${filename}: no GPS location in metadata`);
          continue;
        }

        // Ensure duration is positive (use 1s minimum for import)
        if (!metadata.duration || metadata.duration <= 0) {
          metadata.duration = 1;
        }

        // Save recording
        const newRecordingId = await localStorageService.saveRecording(metadata, audioBlob);
        importedRecordings.push({
          originalId: metadata.uniqueId || filenameNoExt,
          newId: newRecordingId,
          filename: filename
        });
        
      } catch (error) {
        console.warn(`Failed to import audio file ${audioPath}:`, error);
      }
    }
    
    return importedRecordings;
  }

  /**
   * Import breadcrumbs from tracklog data
   */
  static async importBreadcrumbs(tracklogData, options = {}) {
    if (!tracklogData.breadcrumbs || !Array.isArray(tracklogData.breadcrumbs)) {
      console.warn('No breadcrumbs found in tracklog data');
      return [];
    }
    
    const importedBreadcrumbs = [];
    
    for (const breadcrumb of tracklogData.breadcrumbs) {
      try {
        // Apply location transformation if specified
        let transformedLocation = { lat: breadcrumb.lat, lng: breadcrumb.lng };
        if (options.locationTransform) {
          transformedLocation = this.transformLocation(transformedLocation, options.locationTransform);
        }
        
        // Apply time offset if specified
        let timestamp = breadcrumb.timestamp;
        if (options.timeOffset) {
          timestamp = breadcrumb.timestamp + options.timeOffset;
        }
        
        // Create new breadcrumb
        const newBreadcrumb = {
          ...breadcrumb,
          lat: transformedLocation.lat,
          lng: transformedLocation.lng,
          timestamp: timestamp,
          sessionId: `imported-${Date.now()}`,
          imported: true,
          originalSessionId: tracklogData.sessionId
        };
        
        importedBreadcrumbs.push(newBreadcrumb);
        
      } catch (error) {
        console.warn(`Failed to import breadcrumb:`, error);
      }
    }
    
    // Store breadcrumbs in localStorage for later use
    this.storeImportedBreadcrumbs(importedBreadcrumbs);
    
    return importedBreadcrumbs;
  }

  /**
   * Transform location based on transformation options
   */
  static transformLocation(location, transform) {
    if (!location) return null;
    
    let newLocation = { ...location };
    
    // Apply translation
    if (transform.translate) {
      newLocation.lat += transform.translate.lat || 0;
      newLocation.lng += transform.translate.lng || 0;
    }
    
    // Apply scaling
    if (transform.scale) {
      const center = transform.center || { lat: 0, lng: 0 };
      newLocation.lat = center.lat + (newLocation.lat - center.lat) * (transform.scale || 1);
      newLocation.lng = center.lng + (newLocation.lng - center.lng) * (transform.scale || 1);
    }
    
    // Apply rotation (around center point)
    if (transform.rotate) {
      const center = transform.center || { lat: 0, lng: 0 };
      const angle = transform.rotate * Math.PI / 180; // Convert to radians
      
      const dx = newLocation.lng - center.lng;
      const dy = newLocation.lat - center.lat;
      
      newLocation.lng = center.lng + dx * Math.cos(angle) - dy * Math.sin(angle);
      newLocation.lat = center.lat + dx * Math.sin(angle) + dy * Math.cos(angle);
    }
    
    return newLocation;
  }

  /**
   * Store imported breadcrumbs in localStorage
   */
  static storeImportedBreadcrumbs(breadcrumbs) {
    try {
      const existingBreadcrumbs = JSON.parse(localStorage.getItem('imported_breadcrumbs') || '[]');
      const updatedBreadcrumbs = [...existingBreadcrumbs, ...breadcrumbs];
      localStorage.setItem('imported_breadcrumbs', JSON.stringify(updatedBreadcrumbs));
    } catch (error) {
      console.error('Failed to store imported breadcrumbs:', error);
    }
  }

  /**
   * Get imported breadcrumbs from localStorage
   */
  static getImportedBreadcrumbs() {
    try {
      return JSON.parse(localStorage.getItem('imported_breadcrumbs') || '[]');
    } catch (error) {
      console.error('Failed to get imported breadcrumbs:', error);
      return [];
    }
  }

  /**
   * Import audio-only export ZIP (from recordingExporter.js — has audio/ + metadata/ + export_summary.json)
   */
  static async importAudioExportZip(zipFile) {
    const zip = new JSZip();
    const zipContent = await zip.loadAsync(zipFile);
    const importedRecordings = await this.importAudioFiles(zipContent, {});
    return {
      importedBreadcrumbs: 0,
      importedRecordings: importedRecordings.length,
      sessionId: null,
    };
  }

  /**
   * Import tracklog from GeoJSON file
   */
  static async importTracklogFromGeoJSON(geojsonFile, options = {}) {
    try {
      const text = await geojsonFile.text();
      const geojson = JSON.parse(text);
      
      if (geojson.type !== 'FeatureCollection') {
        throw new Error('Invalid GeoJSON: must be a FeatureCollection');
      }
      
      // Extract breadcrumbs and audio recordings
      const breadcrumbs = [];
      const audioRecordings = [];
      
      geojson.features.forEach(feature => {
        if (feature.geometry.type === 'Point') {
          if (feature.properties.type === 'audio_recording') {
            audioRecordings.push(feature);
          } else {
            breadcrumbs.push({
              lat: feature.geometry.coordinates[1],
              lng: feature.geometry.coordinates[0],
              timestamp: feature.properties.timestamp,
              audioLevel: feature.properties.audioLevel || 0,
              isMoving: feature.properties.isMoving || false,
              movementSpeed: feature.properties.movementSpeed || 0,
              direction: feature.properties.direction,
              accuracy: feature.properties.accuracy,
              altitude: feature.properties.altitude
            });
          }
        }
      });
      
      // Create tracklog data structure
      const tracklogData = {
        id: `imported-geojson-${Date.now()}`,
        startTime: Math.min(...breadcrumbs.map(b => b.timestamp)),
        endTime: Math.max(...breadcrumbs.map(b => b.timestamp)),
        breadcrumbs: breadcrumbs,
        summary: this.generateSummaryFromBreadcrumbs(breadcrumbs)
      };
      
      // Import breadcrumbs
      const importedBreadcrumbs = await this.importBreadcrumbs(tracklogData, options);
      
      return {
        importedBreadcrumbs: importedBreadcrumbs.length,
        audioRecordings: audioRecordings.length,
        importDate: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('Error importing GeoJSON tracklog:', error);
      throw new Error(`Failed to import GeoJSON: ${error.message}`);
    }
  }

  /**
   * Generate summary from breadcrumbs
   */
  static generateSummaryFromBreadcrumbs(breadcrumbs) {
    if (breadcrumbs.length === 0) {
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
    let stationaryCount = 0;
    let movingCount = 0;

    for (let i = 1; i < breadcrumbs.length; i++) {
      const prev = breadcrumbs[i - 1];
      const curr = breadcrumbs[i];
      
      const distance = this.calculateDistance(prev.lat, prev.lng, curr.lat, curr.lng);
      const timeDiff = curr.timestamp - prev.timestamp;
      const speed = distance / (timeDiff / 1000);
      
      totalDistance += distance;
      totalSpeed += speed;
      maxSpeed = Math.max(maxSpeed, speed);
      
      if (curr.isMoving) {
        movingCount++;
      } else {
        stationaryCount++;
      }
    }

    const averageSpeed = totalSpeed / (breadcrumbs.length - 1);
    const totalTime = breadcrumbs[breadcrumbs.length - 1].timestamp - breadcrumbs[0].timestamp;
    const stationaryTime = (stationaryCount / breadcrumbs.length) * totalTime;
    const movingTime = totalTime - stationaryTime;

    let pattern = 'mixed';
    if (movingCount / breadcrumbs.length > 0.8) pattern = 'moving';
    else if (stationaryCount / breadcrumbs.length > 0.8) pattern = 'stationary';

    return {
      totalDistance: Math.round(totalDistance),
      averageSpeed: Math.round(averageSpeed * 100) / 100,
      maxSpeed: Math.round(maxSpeed * 100) / 100,
      stationaryTime: Math.round(stationaryTime / 1000),
      movingTime: Math.round(movingTime / 1000),
      pattern
    };
  }

  /**
   * Calculate distance between two points in meters
   */
  static calculateDistance(lat1, lng1, lat2, lng2) {
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
   * Validate tracklog file before import
   */
  static async validateTracklogFile(file) {
    try {
      if (file.name.endsWith('.zip')) {
        const zip = new JSZip();
        const zipContent = await zip.loadAsync(file);

        // Check if this is a Derive Sonora package (v2.x)
        const manifestFile = zipContent.file('manifest.json');
        if (manifestFile) {
          const manifest = JSON.parse(await manifestFile.async('string'));
          if (manifest.packageType === 'derive_sonora') {
            return {
              type: 'derive_sonora',
              valid: true,
              breadcrumbCount: manifest.session?.breadcrumbCount || 0,
              recordingCount: manifest.session?.recordingCount || 0,
              sessionId: manifest.session?.sessionId,
              userAlias: manifest.createdBy?.alias,
              title: manifest.session?.title,
            };
          }
        }

        // Audio-only export ZIP (from recordingExporter.js) — has export_summary.json, no tracklog
        const summaryFile = zipContent.file('export_summary.json');
        if (summaryFile) {
          const summary = JSON.parse(await summaryFile.async('string'));
          const audioFiles = Object.keys(zipContent.files).filter(f => f.startsWith('audio/'));
          return {
            type: 'audio_export',
            valid: true,
            breadcrumbCount: 0,
            recordingCount: summary.totalRecordings || audioFiles.length,
            sessionId: null,
          };
        }

        // Legacy tracklog ZIP format
        if (!zipContent.file('tracklog/tracklog.json')) {
          throw new Error('Formato no reconocido: falta manifest.json, export_summary.json o tracklog/tracklog.json');
        }

        // Validate tracklog.json
        const tracklogJson = await zipContent.file('tracklog/tracklog.json').async('string');
        const tracklogData = JSON.parse(tracklogJson);

        if (!tracklogData.breadcrumbs || !Array.isArray(tracklogData.breadcrumbs)) {
          throw new Error('Invalid tracklog data: missing breadcrumbs');
        }

        return {
          type: 'zip',
          valid: true,
          breadcrumbCount: tracklogData.breadcrumbs.length,
          sessionId: tracklogData.sessionId
        };
        
      } else if (file.name.endsWith('.geojson') || file.name.endsWith('.json')) {
        const text = await file.text();
        const geojson = JSON.parse(text);
        
        if (geojson.type !== 'FeatureCollection') {
          throw new Error('Invalid GeoJSON: must be a FeatureCollection');
        }
        
        const breadcrumbCount = geojson.features.filter(f => 
          f.geometry.type === 'Point' && f.properties.type !== 'audio_recording'
        ).length;
        
        return {
          type: 'geojson',
          valid: true,
          breadcrumbCount: breadcrumbCount,
          sessionId: `geojson-${Date.now()}`
        };
        
      } else {
        throw new Error('Unsupported file format. Please use .zip or .geojson files.');
      }
      
    } catch (error) {
      return {
        valid: false,
        error: error.message
      };
    }
  }
}

export default TracklogImporter;
