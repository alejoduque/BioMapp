// Derive Sonora Importer
// Imports a Derive Sonora ZIP package into local storage
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
          const recording = JSON.parse(metaText);

          // Assign new unique ID to avoid collisions
          const originalId = recording.uniqueId;
          const newId = `imported-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          recording.uniqueId = newId;
          recording.importedFrom = manifest.createdBy?.alias || 'unknown';
          recording.importedSessionId = sessionData.sessionId;

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
      sessionId: `imported_${Date.now()}`,
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
}

export default DeriveSonoraImporter;
