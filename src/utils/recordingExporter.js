// Recording Exporter Utility
// Exports recordings from localStorage as downloadable files

import JSZip from 'jszip';
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
   * Export all recordings as a zip file
   */
  static async exportAllRecordings() {
    try {
      const recordings = localStorageService.getAllRecordings();
      if (recordings.length === 0) {
        throw new Error('No recordings found');
      }

      const zip = new JSZip();
      
      // Add each recording to the zip
      for (const recording of recordings) {
        try {
          const audioBlob = await localStorageService.getAudioBlob(recording.uniqueId);
          if (audioBlob) {
            const baseName = recording.filename || recording.uniqueId;
            // Check if the filename already has an extension
            const filename = baseName.includes('.') ? baseName : `${baseName}.webm`;
            zip.file(filename, audioBlob);
            
            // Also add metadata as JSON
            const metadata = { ...recording };
            delete metadata.audioBlob; // Remove audio blob from metadata
            zip.file(`${recording.uniqueId}_metadata.json`, JSON.stringify(metadata, null, 2));
          }
        } catch (error) {
          console.warn(`Failed to add recording ${recording.uniqueId} to zip:`, error);
        }
      }

      // Generate and download zip file
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `biomap_recordings_${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      console.log(`Exported ${recordings.length} recordings as zip file`);
    } catch (error) {
      console.error('Error exporting all recordings:', error);
      throw error;
    }
  }

  /**
   * Export all recordings as a zip file (audio + metadata)
   */
  static async exportAsZip() {
    try {
      const recordings = localStorageService.getAllRecordings();
      if (recordings.length === 0) {
        throw new Error('No recordings found');
      }

      const zip = new JSZip();
      
      // Add each recording to the zip
      for (const recording of recordings) {
        try {
          const audioBlob = await localStorageService.getAudioBlob(recording.uniqueId);
          if (audioBlob) {
            const baseName = recording.filename || recording.uniqueId;
            const filename = baseName.includes('.') ? baseName : `${baseName}.webm`;
            zip.file(`audio/${filename}`, audioBlob);
            
            // Also add metadata as JSON
            const metadata = { ...recording };
            delete metadata.audioBlob; // Remove audio blob from metadata
            zip.file(`metadata/${recording.uniqueId}_metadata.json`, JSON.stringify(metadata, null, 2));
          }
        } catch (error) {
          console.warn(`Failed to add recording ${recording.uniqueId} to zip:`, error);
        }
      }

      // Add a summary file
      const summary = {
        exportDate: new Date().toISOString(),
        totalRecordings: recordings.length,
        description: 'BioMap Audio Recordings Export'
      };
      zip.file('export_summary.json', JSON.stringify(summary, null, 2));

      // Generate and download zip file
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `biomap_recordings_${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      console.log(`Exported ${recordings.length} recordings as zip file`);
    } catch (error) {
      console.error('Error exporting as zip:', error);
      throw error;
    }
  }

  /**
   * Export recordings metadata as JSON file
   */
  static exportMetadata() {
    try {
      const recordings = localStorageService.getAllRecordings();
      if (recordings.length === 0) {
        throw new Error('No recordings found');
      }

      // Clean metadata (remove audio blobs)
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
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `biomap_metadata_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      console.log(`Exported metadata for ${cleanRecordings.length} recordings`);
    } catch (error) {
      console.error('Error exporting metadata:', error);
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