// Derive Sonora Importer
// Imports a Derive Sonora ZIP package into local storage
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
import walkSessionService from '../services/walkSessionService.js';
import localStorageService from '../services/localStorageService.js';

class DeriveSonoraImporter {

  /**
   * Check if a ZIP file is a Derive Sonora package.
   * Returns the manifest if valid, null otherwise.
   */
  static async detectDerivePackage(zipFile) {
    try {
      const zip = await JSZip.loadAsync(zipFile);
      const manifestFile = zip.file('manifest.json');
      if (!manifestFile) return null;

      const manifestText = await manifestFile.async('text');
      const manifest = JSON.parse(manifestText);
      if (manifest.packageType === 'derive_sonora') return manifest;
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Import a Derive Sonora package.
   * @param {File|Blob} zipFile
   * @returns {Object} Import summary
   */
  static async importDerive(zipFile) {
    const zip = await JSZip.loadAsync(zipFile);

    // 1. Read manifest
    const manifestFile = zip.file('manifest.json');
    if (!manifestFile) throw new Error('Not a valid Derive Sonora package (missing manifest.json)');
    const manifest = JSON.parse(await manifestFile.async('text'));
    if (manifest.packageType !== 'derive_sonora') {
      throw new Error('Invalid package type: ' + manifest.packageType);
    }

    // 2. Read session
    const sessionFile = zip.file('session/session.json');
    if (!sessionFile) throw new Error('Missing session data');
    const sessionData = JSON.parse(await sessionFile.async('text'));

    // 3. Read breadcrumbs from GeoJSON
    let breadcrumbs = [];
    const geojsonFile = zip.file('session/tracklog.geojson');
    if (geojsonFile) {
      try {
        const geojson = JSON.parse(await geojsonFile.async('text'));
        const pointFeatures = geojson.features?.filter(f => f.geometry?.type === 'Point') || [];
        breadcrumbs = pointFeatures.map(f => ({
          lat: f.geometry.coordinates[1],
          lng: f.geometry.coordinates[0],
          timestamp: f.properties?.timestamp || 0,
          audioLevel: f.properties?.audioLevel || 0,
          isMoving: f.properties?.isMoving || false,
          movementSpeed: f.properties?.movementSpeed || 0,
          direction: f.properties?.direction || null,
          accuracy: f.properties?.accuracy || null,
          altitude: f.properties?.altitude || null
        }));
      } catch (e) {
        console.warn('Failed to parse GeoJSON breadcrumbs:', e);
      }
    }

    // 4. Import audio files + metadata
    const importedSessionId = `imported_${Date.now()}`;
    const importedRecordingIds = [];
    const metadataFolder = zip.folder('metadata');
    const audioFolder = zip.folder('audio');

    if (metadataFolder) {
      const metaFiles = [];
      metadataFolder.forEach((relativePath, file) => {
        if (relativePath.endsWith('_metadata.json')) {
          metaFiles.push(file);
        }
      });

      for (const metaFile of metaFiles) {
        try {
          const metaText = await metaFile.async('text');
          const recording = this._normalizeRecording(JSON.parse(metaText));

          // Assign new unique ID to avoid collisions
          const originalId = recording.uniqueId;
          const newId = `imported-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          recording.uniqueId = newId;
          recording.importedFrom = manifest.createdBy?.alias || 'unknown';
          recording.importedSessionId = sessionData.sessionId;
          recording.walkSessionId = importedSessionId;

          // Try to find matching audio file
          let audioBlob = null;
          if (audioFolder) {
            const audioFilename = recording.filename || `${originalId}.webm`;
            const audioFile = zip.file(`audio/${audioFilename}`);
            if (audioFile) {
              audioBlob = await audioFile.async('blob');
            }
          }

          await localStorageService.saveRecording(recording, audioBlob);
          importedRecordingIds.push(newId);
        } catch (e) {
          console.warn('Failed to import recording:', e);
        }
      }
    }

    // 5. Create imported session entry
    const importedSession = {
      sessionId: importedSessionId,
      userAlias: manifest.createdBy?.alias || 'imported',
      deviceId: manifest.createdBy?.deviceId || 'imported',
      title: sessionData.title || manifest.session?.title || 'Imported Derive',
      description: sessionData.description || '',
      startTime: sessionData.startTime || new Date(manifest.session?.startTime).getTime(),
      endTime: sessionData.endTime || new Date(manifest.session?.endTime).getTime(),
      status: 'completed',
      breadcrumbs: breadcrumbs,
      recordingIds: importedRecordingIds,
      summary: sessionData.summary || {
        totalDistance: manifest.session?.totalDistance || 0,
        totalRecordings: importedRecordingIds.length,
        breadcrumbCount: breadcrumbs.length
      },
      importedAt: new Date().toISOString(),
      importedFromPackage: manifest.session?.sessionId
    };

    // Save to sessions storage
    const sessionsKey = 'soundwalk_sessions';
    let sessions = [];
    try {
      const raw = localStorage.getItem(sessionsKey);
      sessions = raw ? JSON.parse(raw) : [];
    } catch { /* empty */ }
    sessions.push(importedSession);
    localStorage.setItem(sessionsKey, JSON.stringify(sessions));

    return {
      sessionId: importedSession.sessionId,
      recordingsImported: importedRecordingIds.length,
      breadcrumbsImported: breadcrumbs.length,
      userAlias: importedSession.userAlias,
      title: importedSession.title
    };
  }
  /**
   * Normalize recording metadata from v2.0 (flat) or v2.1 (structured) into
   * the flat format the app uses internally. If v2.1 structured blocks exist,
   * lift their fields to top-level. If only flat fields exist (v2.0), use them
   * as-is. This makes the importer forward AND backward compatible.
   */
  static _normalizeRecording(raw) {
    const rec = { ...raw };

    // v2.1 structured → lift to flat (structured blocks take precedence)
    if (raw.capture) {
      if (!rec.location && (raw.capture.lat != null || raw.capture.lng != null)) {
        rec.location = { lat: raw.capture.lat, lng: raw.capture.lng };
      }
      if (raw.capture.timestamp && !rec.timestamp) rec.timestamp = raw.capture.timestamp;
      if (raw.capture.altitude != null) rec.altitude = raw.capture.altitude;
      if (raw.capture.gpsAccuracy != null) rec.gpsAccuracy = raw.capture.gpsAccuracy;
      if (raw.capture.deviceModel) rec.deviceModel = raw.capture.deviceModel;
    }

    if (raw.bioacoustic) {
      const b = raw.bioacoustic;
      if (b.speciesTags) rec.speciesTags = b.speciesTags;
      if (b.habitat) rec.habitat = b.habitat;
      // v2.1 uses verticalStratum, app uses heightPosition
      if (b.verticalStratum) rec.heightPosition = b.verticalStratum;
      if (b.distanceEstimate) rec.distanceEstimate = b.distanceEstimate;
      if (b.activityType) rec.activityType = b.activityType;
      if (b.anthropophony) rec.anthropophony = b.anthropophony;
      if (b.weather) rec.weather = b.weather;
      if (b.temperature) rec.temperature = b.temperature;
      if (b.quality) rec.quality = b.quality;
      if (b.movementPattern) rec.movementPattern = b.movementPattern;
    }

    if (raw.provenance) {
      if (raw.provenance.recordedBy) rec.importedFrom = raw.provenance.recordedBy;
      if (raw.provenance.importedAt) rec.importedAt = raw.provenance.importedAt;
    }

    if (raw.session) {
      if (raw.session.walkSessionId) rec.walkSessionId = raw.session.walkSessionId;
      if (raw.session.originalSessionId) rec.importedSessionId = raw.session.originalSessionId;
    }

    // Use id field from v2.1 if uniqueId not present
    if (!rec.uniqueId && raw.id) rec.uniqueId = raw.id;

    // Ensure speciesTags is always an array
    if (!Array.isArray(rec.speciesTags)) rec.speciesTags = [];

    return rec;
  }
}

export default DeriveSonoraImporter;
