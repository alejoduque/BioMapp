// Derive Sonora Exporter
// Exports a complete walk session as a shareable ZIP package
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
    modal.innerHTML = `<p style="margin:0 0 15px 0;font-size:14px;color:#374151;white-space:pre-line;">${message}</p><button style="background:#10B981;color:white;border:none;border-radius:6px;padding:8px 16px;cursor:pointer;font-size:14px;">OK</button>`;
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
    const recordings = (session.recordingIds || [])
      .map(id => localStorageService.getRecording(id))
      .filter(Boolean);

    const zip = new JSZip();

    // 1. Manifest
    const manifest = {
      formatVersion: '2.0',
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

    // 4. Audio files + metadata
    let audioSuccessCount = 0;
    for (const recording of recordings) {
      try {
        const audioBlob = await localStorageService.getAudioBlobFlexible(recording.uniqueId);
        if (audioBlob) {
          const filename = recording.filename || `${recording.uniqueId}.webm`;
          zip.file(`audio/${filename}`, audioBlob);
          audioSuccessCount++;
        }
        const meta = { ...recording };
        delete meta.audioBlob;
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

    // Recordings
    for (const rec of recordings) {
      events.push({
        type: 'recording',
        timestamp: new Date(rec.timestamp).getTime(),
        recordingId: rec.uniqueId,
        location: rec.location,
        duration: rec.duration,
        notes: rec.notes || ''
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
