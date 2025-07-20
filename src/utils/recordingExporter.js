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
   * Export all recordings as individual files to Android internal storage or Downloads folder
   */
  static async exportAllRecordings() {
    try {
      const recordings = localStorageService.getAllRecordings();
      if (recordings.length === 0) {
        throw new Error('No recordings found');
      }

      // Try Android Filesystem API first (Capacitor)
      if (window.Capacitor && window.Capacitor.isNative) {
        try {
          const { Filesystem } = await import('@capacitor/filesystem');
          
          // Test filesystem access first
          console.log('🧪 Testing Capacitor Filesystem access...');
          try {
            const testResult = await Filesystem.readdir({
              path: '',
              directory: 'DOCUMENTS'
            });
            console.log('✅ Filesystem test successful:', testResult);
            
            // Also save test result to a log file
            const testLogText = `Filesystem test successful: ${JSON.stringify(testResult)}\n`;
            const testLogBase64 = btoa(unescape(encodeURIComponent(testLogText)));
            
            await Filesystem.writeFile({
              path: 'biomap_export_test.log',
              data: testLogBase64,
              directory: 'DOCUMENTS',
              recursive: true
            });
          } catch (testError) {
            console.error('❌ Filesystem test failed:', testError);
            
            // Save error to log file
            try {
              const errorLogText = `Filesystem test failed: ${testError.message}\n${testError.stack}\n`;
              const errorLogBase64 = btoa(unescape(encodeURIComponent(errorLogText)));
              
              await Filesystem.writeFile({
                path: 'biomap_export_error.log',
                data: errorLogBase64,
                directory: 'DOCUMENTS',
                recursive: true
              });
            } catch (logError) {
              console.error('Failed to write error log:', logError);
            }
            
            throw new Error(`Filesystem not accessible: ${testError.message}`);
          }
          
          // Create BioMap directory in Android/data or Documents
          const biomapDir = 'BioMapp_Audio';
          
          let successCount = 0;
          let failCount = 0;
          const savedFiles = [];
          
                      // Show progress
            alert(`Starting export of ${recordings.length} recordings...`);
            
            // Create export log
            let exportLog = `Export started at ${new Date().toISOString()}\n`;
            exportLog += `Total recordings: ${recordings.length}\n\n`;
          
                    for (let i = 0; i < recordings.length; i++) {
            const recording = recordings[i];
            try {
              console.log(`🔄 Processing recording ${i + 1}/${recordings.length}: ${recording.uniqueId}`);
              
              const audioBlob = await localStorageService.getAudioBlob(recording.uniqueId);
              if (audioBlob && audioBlob.size > 0) {
                const baseName = recording.filename || recording.uniqueId;
                const filename = baseName.includes('.') ? baseName : `${baseName}.webm`;
                
                // Convert blob to base64 using FileReader to avoid stack overflow
                console.log(`🔄 Converting blob for ${filename} (size: ${audioBlob.size} bytes)`);
                
                // Check if blob is too large for base64 conversion
                if (audioBlob.size > 10 * 1024 * 1024) { // 10MB limit (more conservative)
                  console.warn(`⚠️ Large blob detected (${audioBlob.size} bytes), skipping this file`);
                  failCount++;
                  console.error(`❌ File ${filename} too large (${audioBlob.size} bytes), skipping`);
                  continue;
                }
                
                // Use FileReader for safer base64 conversion
                const base64Data = await new Promise((resolve, reject) => {
                  const reader = new FileReader();
                  reader.onload = () => {
                    const result = reader.result;
                    // Extract base64 data from data URL
                    const base64 = result.split(',')[1];
                    resolve(base64);
                  };
                  reader.onerror = () => reject(new Error('FileReader failed'));
                  reader.readAsDataURL(audioBlob);
                });
                console.log(`✅ Blob converted to base64 (length: ${base64Data.length})`);
                
                // Write to Android internal storage
                console.log(`📝 Writing file: ${biomapDir}/${filename}`);
                await Filesystem.writeFile({
                  path: `${biomapDir}/${filename}`,
                  data: base64Data,
                  directory: 'DOCUMENTS',
                  recursive: true
                });
                console.log(`✅ File write completed for ${filename}`);
                
                // Verify file was written
                try {
                  console.log(`🔍 Verifying file: ${biomapDir}/${filename}`);
                  const fileInfo = await Filesystem.stat({
                    path: `${biomapDir}/${filename}`,
                    directory: 'DOCUMENTS'
                  });
                  
                  console.log(`📊 File info for ${filename}:`, fileInfo);
                  
                  if (fileInfo.size > 0) {
                    savedFiles.push(filename);
                    successCount++;
                    console.log(`✅ Exported recording ${i + 1}/${recordings.length}: ${filename} (${fileInfo.size} bytes)`);
                    exportLog += `✅ ${i + 1}/${recordings.length}: ${filename} (${fileInfo.size} bytes)\n`;
                  } else {
                                          failCount++;
                      console.error(`❌ File ${filename} was created but is empty (size: ${fileInfo.size})`);
                      exportLog += `❌ ${i + 1}/${recordings.length}: ${filename} - EMPTY FILE (${fileInfo.size} bytes)\n`;
                  }
                } catch (verifyError) {
                  failCount++;
                  console.error(`❌ Failed to verify file ${filename}:`, verifyError);
                  exportLog += `❌ ${i + 1}/${recordings.length}: ${filename} - VERIFICATION FAILED: ${verifyError.message}\n`;
                  console.error(`Verification error details:`, {
                    message: verifyError.message,
                    stack: verifyError.stack,
                    path: `${biomapDir}/${filename}`,
                    directory: 'DOCUMENTS'
                  });
                }
              } else {
                failCount++;
                console.warn(`❌ No audio blob found for recording ${recording.uniqueId}`);
                exportLog += `❌ ${i + 1}/${recordings.length}: ${recording.uniqueId} - NO AUDIO BLOB\n`;
              }
            } catch (error) {
              failCount++;
              console.error(`❌ Failed to export recording ${recording.uniqueId}:`, error);
              exportLog += `❌ ${i + 1}/${recordings.length}: ${recording.uniqueId} - EXPORT FAILED: ${error.message}\n`;
              console.error(`Error details:`, {
                message: error.message,
                stack: error.stack,
                recordingId: recording.uniqueId,
                filename: recording.filename
              });
            }
          }
          
                      // Save export log
            try {
              exportLog += `\nExport completed at ${new Date().toISOString()}\n`;
              exportLog += `Success: ${successCount}, Failed: ${failCount}\n`;
              
              console.log('📝 Attempting to save export log...');
              console.log('📝 Log content length:', exportLog.length);
              
              // Convert log text to base64 for proper storage
              const logBase64 = btoa(unescape(encodeURIComponent(exportLog)));
              
              await Filesystem.writeFile({
                path: 'biomap_export_log.txt',
                data: logBase64,
                directory: 'DOCUMENTS',
                recursive: true
              });
              console.log('📝 Export log saved to Documents/biomap_export_log.txt');
              
              // Test if we can read it back
              try {
                const testRead = await Filesystem.readFile({
                  path: 'biomap_export_log.txt',
                  directory: 'DOCUMENTS'
                });
                console.log('📝 Log file verification successful, size:', testRead.data.length);
              } catch (readError) {
                console.error('📝 Failed to read back log file:', readError);
              }
            } catch (logError) {
              console.error('Failed to save export log:', logError);
              console.error('Log error details:', {
                message: logError.message,
                stack: logError.stack
              });
            }
            
            // Final verification - list all files in directory
            try {
              const dirContents = await Filesystem.readdir({
                path: biomapDir,
                directory: 'DOCUMENTS'
              });
            
            const actualFileCount = dirContents.files.length;
            console.log(`📁 Directory contains ${actualFileCount} files:`, dirContents.files);
            
            // Show detailed results
            let resultMessage = `Export completed!\n\n`;
            resultMessage += `📊 Results:\n`;
            resultMessage += `✅ Successfully saved: ${successCount} files\n`;
            resultMessage += `❌ Failed: ${failCount} files\n`;
            resultMessage += `📁 Directory: Android Documents/BioMapp_Audio/\n`;
            resultMessage += `🔍 Actual files in directory: ${actualFileCount}\n\n`;
            
            if (savedFiles.length > 0) {
              resultMessage += `📋 Saved files:\n`;
              savedFiles.slice(0, 10).forEach(file => {
                resultMessage += `• ${file}\n`;
              });
              if (savedFiles.length > 10) {
                resultMessage += `... and ${savedFiles.length - 10} more\n`;
              }
            }
            
            if (failCount > 0) {
              resultMessage += `\n⚠️ Some files failed to save. Check console for details.`;
            }
            
            alert(resultMessage);
          } catch (listError) {
            console.warn('Failed to list directory contents:', listError);
            alert(`Export completed!\n✅ ${successCount} files saved\n❌ ${failCount} files failed\n📁 Check Android Documents/BioMapp_Audio/`);
          }
          
          return;
        } catch (error) {
          console.warn('Android Filesystem API failed, falling back to downloads:', error);
        }
      }

      // Try File System Access API (Desktop browsers)
      if (window.showDirectoryPicker && !window.Capacitor?.isNative) {
        try {
          const dirHandle = await window.showDirectoryPicker({ id: 'biomap-audio-export', mode: 'readwrite' });
          const audioDir = await dirHandle.getDirectoryHandle('audio', { create: true });
          for (const recording of recordings) {
            try {
              const audioBlob = await localStorageService.getAudioBlob(recording.uniqueId);
              if (audioBlob && audioBlob.size > 0) {
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
        } catch (error) {
          console.warn('File System Access API failed, falling back to downloads:', error);
        }
      }

      // Fallback: Download each file
      for (const recording of recordings) {
        try {
          const audioBlob = await localStorageService.getAudioBlob(recording.uniqueId);
          if (audioBlob && audioBlob.size > 0) {
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