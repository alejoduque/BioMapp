// Recording Exporter Utility
// Exports recordings from localStorage as downloadable files

import localStorageService from '../services/localStorageService.js';

class RecordingExporter {
  
  /**
   * Export a single recording as a downloadable file
   * @param {string} recordingId - The ID of the recording to export
   * @param {string} filename - Optional custom filename
   */
  static async exportSingleRecording(recordingId, filename = null) {
    try {
      // Get the recording metadata
      const recording = localStorageService.getRecording(recordingId);
      if (!recording) {
        throw new Error('Recording not found');
      }

      // Get the audio blob
      const audioBlob = await localStorageService.getAudioBlob(recordingId);
      if (!audioBlob) {
        throw new Error('Audio data not found');
      }

      // Create filename if not provided
      let finalFilename = filename;
      if (!finalFilename) {
        const baseName = recording.filename || recording.uniqueId;
        // Check if the filename already has an extension
        if (baseName.includes('.')) {
          finalFilename = baseName;
        } else {
          finalFilename = `${baseName}.webm`;
        }
      }

      // Create download link
      const url = URL.createObjectURL(audioBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = finalFilename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      console.log(`Exported recording: ${finalFilename}`);
      return finalFilename;
    } catch (error) {
      console.error('Error exporting recording:', error);
      throw error;
    }
  }

  /**
   * Export all recordings as individual files to the Downloads folder (using File System Access API if available)
   */
  static async exportAllRecordings() {
    try {
      const recordings = localStorageService.getAllRecordings();
      if (recordings.length === 0) {
        throw new Error('No recordings found');
      }

      // Try File System Access API (Chromium browsers)
      if (window.showDirectoryPicker) {
        const dirHandle = await window.showDirectoryPicker({ id: 'biomap-audio-export', mode: 'readwrite' });
        const audioDir = await dirHandle.getDirectoryHandle('audio', { create: true });
        for (const recording of recordings) {
          try {
            const audioBlob = await localStorageService.getAudioBlob(recording.uniqueId);
            if (audioBlob) {
              const baseName = recording.filename || recording.uniqueId;
              const filename = baseName.includes('.') ? baseName : `${baseName}.webm`;
              const fileHandle = await audioDir.getFileHandle(filename, { create: true });
              const writable = await fileHandle.createWritable();
              await writable.write(audioBlob);
              await writable.close();
              console.log(`Exported recording to audio/${filename}`);
            }
          } catch (error) {
            console.warn(`Failed to export recording ${recording.uniqueId}:`, error);
          }
        }
        alert(`Exported ${recordings.length} recordings to the selected folder/audio/`);
        return;
      }

      // Fallback: Download each file
      for (const recording of recordings) {
        try {
          const audioBlob = await localStorageService.getAudioBlob(recording.uniqueId);
          if (audioBlob) {
            const baseName = recording.filename || recording.uniqueId;
            const filename = baseName.includes('.') ? baseName : `${baseName}.webm`;
            const url = URL.createObjectURL(audioBlob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            console.log(`Exported recording: ${filename}`);
          }
        } catch (error) {
          console.warn(`Failed to export recording ${recording.uniqueId}:`, error);
        }
      }
      alert(`Exported ${recordings.length} recordings as downloads`);
    } catch (error) {
      console.error('Error exporting all recordings:', error);
      alert('Export failed: ' + error.message);
      throw error;
    }
  }

  /**
   * Export recordings metadata as JSON file to the Downloads folder (using File System Access API if available)
   */
  static async exportMetadata() {
    try {
      const recordings = localStorageService.getAllRecordings();
      if (recordings.length === 0) {
        throw new Error('No recordings found');
      }
      const cleanRecordings = recordings.map(recording => {
        const clean = { ...recording };
        delete clean.audioBlob;
        return clean;
      });
      const metadata = {
        exportDate: new Date().toISOString(),
        totalRecordings: cleanRecordings.length,
        recordings: cleanRecordings
      };
      const blob = new Blob([JSON.stringify(metadata, null, 2)], { type: 'application/json' });
      const filename = `biomap_metadata_${new Date().toISOString().split('T')[0]}.json`;

      // Try File System Access API (Chromium browsers)
      if (window.showDirectoryPicker) {
        const dirHandle = await window.showDirectoryPicker({ id: 'biomap-metadata-export', mode: 'readwrite' });
        const metaDir = await dirHandle.getDirectoryHandle('metadata', { create: true });
        const fileHandle = await metaDir.getFileHandle(filename, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();
        alert(`Exported metadata to metadata/${filename}`);
        return;
      }

      // Fallback: Download file
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      alert(`Exported metadata as download`);
    } catch (error) {
      console.error('Error exporting metadata:', error);
      alert('Export failed: ' + error.message);
      throw error;
    }
  }

  /**
   * Get storage statistics
   */
  static getStorageStats() {
    return localStorageService.getStorageStats();
  }
}

export default RecordingExporter; 