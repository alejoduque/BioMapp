// Derive Sonora Exporter
// Exports a complete walk session as a shareable ZIP package
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
import userAliasService from '../services/userAliasService.js';
import breadcrumbService from '../services/breadcrumbService.js';

// Custom alert for Android
const showAlert = (message) => {
  if (window.Capacitor?.isNativePlatform()) {
    const overlay = document.createElement('div');
    overlay.style.cssText = `position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);z-index:10000;display:flex;align-items:center;justify-content:center;`;
    const modal = document.createElement('div');
    modal.style.cssText = `background:white;border-radius:8px;padding:20px;max-width:320px;margin:20px;text-align:center;box-shadow:0 10px 30px rgba(0,0,0,0.3);`;
    modal.innerHTML = `<p style="margin:0 0 15px 0;font-size:14px;color:rgb(1 9 2 / 84%);white-space:pre-line;">${message}</p><button style="background:#9dc04cd4;color:white;border:none;border-radius:6px;padding:8px 16px;cursor:pointer;font-size:14px;">OK</button>`;
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    const close = () => document.body.removeChild(overlay);
    modal.querySelector('button').onclick = close;
    overlay.onclick = (e) => e.target === overlay && close();
  } else {
    alert(message);
  }
};

class DeriveSonoraExporter {

  static async exportDerive(sessionId) {
    const session = walkSessionService.getSession(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    const userProfile = userAliasService.getProfile() || { alias: 'anon', deviceId: 'unknown' };
    // Start with explicitly linked recordings, then find nearby ones
    const allRecordings = localStorageService.getAllRecordings();
    const nearbyIds = new Set(session.recordingIds || []);

    for (const rec of allRecordings) {
      if (nearbyIds.has(rec.uniqueId) || !rec.location) continue;
      for (const crumb of (session.breadcrumbs || [])) {
        const dist = localStorageService.calculateDistance(
          rec.location.lat, rec.location.lng,
          crumb.lat, crumb.lng
        );
        if (dist <= 5) { nearbyIds.add(rec.uniqueId); break; }
      }
    }

    const recordings = [...nearbyIds]
      .map(id => localStorageService.getRecording(id))
      .filter(Boolean);

    const manualCount = (session.recordingIds || []).length;
    const autoLinkedCount = nearbyIds.size - manualCount;

    const zip = new JSZip();

    // 1. Manifest
    const manifest = {
      formatVersion: '2.1',
      schemaVersion: 'derive_sonora_recording/2.1',
      packageType: 'derive_sonora',
      createdAt: new Date().toISOString(),
      createdBy: {
        alias: session.userAlias || userProfile.alias,
        deviceId: session.deviceId || userProfile.deviceId
      },
      session: {
        sessionId: session.sessionId,
        title: session.title || '',
        startTime: new Date(session.startTime).toISOString(),
        endTime: session.endTime ? new Date(session.endTime).toISOString() : null,
        recordingCount: recordings.length,
        manualRecordingCount: manualCount,
        autoLinkedCount: autoLinkedCount,
        breadcrumbCount: session.breadcrumbs?.length || 0,
        totalDistance: session.summary?.totalDistance || 0
      }
    };
    zip.file('manifest.json', JSON.stringify(manifest, null, 2));

    // 2. Session data
    const sessionData = {
      ...session,
      exportDate: new Date().toISOString()
    };
    delete sessionData.breadcrumbs; // stored separately in tracklog/
    zip.file('session/session.json', JSON.stringify(sessionData, null, 2));

    // 3. Tracklog formats
    if (session.breadcrumbs && session.breadcrumbs.length > 0) {
      const trackSession = {
        id: session.sessionId,
        startTime: session.startTime,
        endTime: session.endTime,
        breadcrumbs: session.breadcrumbs,
        summary: session.summary
      };

      zip.file('session/tracklog.geojson', JSON.stringify(
        breadcrumbService.exportAsGeoJSON(trackSession), null, 2
      ));
      zip.file('session/tracklog.gpx', breadcrumbService.exportAsGPX(trackSession));
      zip.file('session/tracklog.csv', breadcrumbService.exportAsCSV(trackSession));
    }

    // 4. Audio files + metadata (v2.1 canonical schema)
    let audioSuccessCount = 0;
    for (const recording of recordings) {
      try {
        const audioBlob = await localStorageService.getAudioBlobFlexible(recording.uniqueId);
        if (audioBlob) {
          const filename = recording.filename || `${recording.uniqueId}.webm`;
          zip.file(`audio/${filename}`, audioBlob);
          audioSuccessCount++;
        }
        const meta = this._buildRecordingMetadata(recording, session, userProfile);
        zip.file(`metadata/${recording.uniqueId}_metadata.json`, JSON.stringify(meta, null, 2));
      } catch (error) {
        console.warn(`Failed to add recording ${recording.uniqueId}:`, error);
      }
    }

    // 5. Timeline
    const timeline = this._buildTimeline(session, recordings);
    zip.file('timeline.json', JSON.stringify(timeline, null, 2));

    // Generate ZIP
    const zipBlob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    });

    const aliasClean = (session.userAlias || 'anon').replace(/[^a-zA-Z0-9]/g, '_').substring(0, 20);
    const dateStr = new Date().toISOString().split('T')[0];
    const zipFilename = `derive_sonora_${aliasClean}_${dateStr}.zip`;

    // Save to device
    await this._saveZip(zipBlob, zipFilename, audioSuccessCount, recordings.length, session);

    // Mark as exported
    walkSessionService.markExported(sessionId);

    return manifest;
  }

  /**
   * Build v2.1 canonical metadata for a recording.
   * Structured into capture / bioacoustic / session / provenance blocks.
   * Flat top-level aliases kept for backward compat with v2.0 importers.
   */
  static _buildRecordingMetadata(recording, session, userProfile) {
    const meta = {
      _schema: 'derive_sonora_recording/2.1',

      // Top-level identity
      id: recording.uniqueId,
      filename: recording.filename || `${recording.uniqueId}.webm`,
      mimeType: recording.mimeType || 'audio/webm',
      duration: recording.duration || 0,
      fileSize: recording.fileSize || 0,

      // Structured blocks
      capture: {
        timestamp: recording.timestamp ? new Date(recording.timestamp).toISOString() : null,
        lat: recording.location?.lat || null,
        lng: recording.location?.lng || null,
        altitude: recording.altitude ?? recording.location?.altitude ?? null,
        gpsAccuracy: recording.gpsAccuracy ?? null,
        deviceModel: recording.deviceModel ?? null,
      },

      bioacoustic: {
        speciesTags: recording.speciesTags || [],
        habitat: recording.habitat || null,
        verticalStratum: recording.heightPosition || null,
        distanceEstimate: recording.distanceEstimate || null,
        activityType: recording.activityType || null,
        anthropophony: recording.anthropophony || null,
        weather: recording.weather || null,
        temperature: recording.temperature || null,
        quality: recording.quality || null,
        movementPattern: recording.movementPattern || null,
      },

      session: {
        walkSessionId: recording.walkSessionId || null,
        originalSessionId: session.sessionId,
      },

      provenance: {
        recordedBy: session.userAlias || userProfile.alias || 'anon',
        importedFrom: recording.importedFrom || null,
        importedAt: recording.importedAt || null,
      },

      notes: recording.notes || '',

      // --- Flat aliases for v2.0 backward compat ---
      uniqueId: recording.uniqueId,
      location: recording.location || null,
      timestamp: recording.timestamp || null,
      speciesTags: recording.speciesTags || [],
      habitat: recording.habitat || null,
      heightPosition: recording.heightPosition || null,
      distanceEstimate: recording.distanceEstimate || null,
      activityType: recording.activityType || null,
      anthropophony: recording.anthropophony || null,
      weather: recording.weather || null,
      temperature: recording.temperature || null,
      quality: recording.quality || null,
      walkSessionId: recording.walkSessionId || null,
    };

    return meta;
  }

  static _buildTimeline(session, recordings) {
    const events = [];

    // Session start
    if (session.breadcrumbs?.length > 0) {
      const first = session.breadcrumbs[0];
      events.push({
        type: 'session_start',
        timestamp: session.startTime,
        location: { lat: first.lat, lng: first.lng }
      });
    }

    // Recordings (enriched with bioacoustic summary for standalone timeline use)
    for (const rec of recordings) {
      events.push({
        type: 'recording',
        timestamp: new Date(rec.timestamp).getTime(),
        recordingId: rec.uniqueId,
        location: rec.location,
        duration: rec.duration,
        notes: rec.notes || '',
        speciesTags: rec.speciesTags || [],
        habitat: rec.habitat || null,
        quality: rec.quality || null,
      });
    }

    // Session end
    if (session.breadcrumbs?.length > 0) {
      const last = session.breadcrumbs[session.breadcrumbs.length - 1];
      events.push({
        type: 'session_end',
        timestamp: session.endTime || Date.now(),
        location: { lat: last.lat, lng: last.lng }
      });
    }

    events.sort((a, b) => a.timestamp - b.timestamp);

    return {
      sessionId: session.sessionId,
      userAlias: session.userAlias,
      events
    };
  }

  static async _saveZip(zipBlob, zipFilename, audioCount, totalRecordings, session) {
    const isNative = !!(window.Capacitor && (
      window.Capacitor.isNative ||
      (window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) ||
      window.Capacitor.platform === 'android'
    ));

    if (isNative) {
      try {
        const { Filesystem } = await import('@capacitor/filesystem');

        const base64Data = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result.split(',')[1]);
          reader.onerror = () => reject(new Error('FileReader failed'));
          reader.readAsDataURL(zipBlob);
        });

        const downloadsPath = `Download/${zipFilename}`;
        await Filesystem.writeFile({
          path: downloadsPath,
          data: base64Data,
          directory: 'EXTERNAL_STORAGE',
          recursive: true
        });

        const fileInfo = await Filesystem.stat({
          path: downloadsPath,
          directory: 'EXTERNAL_STORAGE'
        });

        showAlert(
          `Deriva exportada\n\n` +
          `${session.title || 'Deriva sonora'}\n` +
          `${audioCount} grabaciones incluidas\n` +
          `Archivo: ${zipFilename}\n` +
          `Ubicación: Carpeta Descargas\n` +
          `Tamaño: ${Math.round(fileInfo.size / 1024)} KB`
        );
        return;
      } catch (nativeError) {
        console.warn('Native save failed, fallback to browser:', nativeError);
      }
    }

    // Browser fallback
    const url = URL.createObjectURL(zipBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = zipFilename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showAlert(
      `Deriva exportada\n\n` +
      `${session.title || 'Deriva sonora'}\n` +
      `${audioCount}/${totalRecordings} grabaciones\n` +
      `Archivo: ${zipFilename}`
    );
  }
}

export default DeriveSonoraExporter;
