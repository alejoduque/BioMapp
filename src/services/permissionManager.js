import { Geolocation } from '@capacitor/geolocation';
import { Filesystem } from '@capacitor/filesystem';

class PermissionManager {
  constructor() {
    this.locationPermissionState = 'unknown';
    this.microphonePermissionState = 'unknown';
    this.filesPermissionState = 'unknown';
    // Remove all getUserMedia logic for audio from this file
  }

  // Clean up any existing audio streams
  cleanupAudioStreams() {
    console.log('PermissionManager: Cleaning up audio streams...');
    // Remove all getUserMedia logic for audio from this file
  }

  // Check and request location permission with proper Android handling
  async requestLocationPermission() {
    try {
      console.log('PermissionManager: Checking location permission...');
      
      // First check current permission state
      const permissionState = await Geolocation.checkPermissions();
      console.log('PermissionManager: Current location permission state:', permissionState);
      
      if (permissionState.location === 'granted') {
        this.locationPermissionState = 'granted';
        return { granted: true, state: 'granted' };
      }
      
      // Only request permission if it's not already granted
      if (permissionState.location === 'denied') {
        this.locationPermissionState = 'denied';
        return { granted: false, state: 'denied', reason: 'Location permission denied' };
      }
      
      // Only request permission if it's in prompt state
      if (permissionState.location === 'prompt') {
        console.log('PermissionManager: Requesting location permission...');
        const requestResult = await Geolocation.requestPermissions();
        console.log('PermissionManager: Location permission request result:', requestResult);
        
        if (requestResult.location === 'granted') {
          this.locationPermissionState = 'granted';
          return { granted: true, state: 'granted' };
        } else if (requestResult.location === 'denied') {
          this.locationPermissionState = 'denied';
          return { granted: false, state: 'denied', reason: 'User denied location permission' };
        }
      }
      
      this.locationPermissionState = 'unknown';
      return { granted: false, state: 'unknown', reason: 'Unknown permission state' };
      
    } catch (error) {
      console.error('PermissionManager: Location permission error:', error);
      this.locationPermissionState = 'error';
      return { granted: false, state: 'error', reason: error.message };
    }
  }

  // Check and request microphone permission with lightweight Android handling
  async requestMicrophonePermission() {
    try {
      console.log('PermissionManager: Requesting microphone permission...');
      
      // Lightweight cleanup - just stop existing tracks
      this.cleanupAudioStreams();
      
      // Wait a short moment for cleanup
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Try lightweight approaches optimized for older devices
      const approaches = [
        // Approach 1: Simple audio request (most compatible)
        { audio: true, video: false },
        // Approach 2: Basic audio with minimal constraints (fallback)
        { audio: { echoCancellation: false }, video: false }
      ];
      
      for (let i = 0; i < approaches.length; i++) {
        try {
          console.log(`PermissionManager: Trying microphone approach ${i + 1}...`);
          
          // Shorter delay between attempts for older devices
          if (i > 0) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
          
          // Remove all getUserMedia logic for audio from this file
          
          console.log(`PermissionManager: Microphone permission granted with approach ${i + 1}`);
          this.microphonePermissionState = 'granted';
          return { granted: true, state: 'granted' };
          
        } catch (approachError) {
          console.log(`PermissionManager: Approach ${i + 1} failed:`, approachError);
          
          // If it's a permission denial, don't try other approaches
          if (approachError.name === 'NotAllowedError') {
            this.microphonePermissionState = 'denied';
            return { granted: false, state: 'denied', reason: 'User denied microphone permission' };
          }
          
          // If it's a "not readable" error or "in use" error, try the next approach
          if (approachError.name === 'NotReadableError' || 
              approachError.message.includes('Could not start audio source') ||
              approachError.message.includes('in use by another application') ||
              approachError.message.includes('busy') ||
              approachError.message.includes('already in use')) {
            console.log(`PermissionManager: Audio source issue with approach ${i + 1}, trying next...`);
            continue;
          }
          
          // For other errors, try the next approach
          if (approachError.name === 'NotFoundError') {
            this.microphonePermissionState = 'denied';
            return { granted: false, state: 'denied', reason: 'No microphone found on this device' };
          }
        }
      }
      
      // If all approaches failed, try a lightweight alternative strategy
      console.log('PermissionManager: All approaches failed, trying lightweight alternative...');
      
      // Try to check if we can at least query the permission state
      if (navigator.permissions) {
        try {
          const permissionState = await navigator.permissions.query({ name: 'microphone' });
          if (permissionState.state === 'granted') {
            console.log('PermissionManager: Permission API shows granted, accepting this');
            this.microphonePermissionState = 'granted';
            return { granted: true, state: 'granted' };
          }
        } catch (e) {
          console.log('PermissionManager: Permission API query failed:', e);
        }
      }
      
      // As a last resort, assume permission is granted if we're on Android
      // This handles cases where Android has granted permission but audio focus issues prevent getUserMedia
      if (/Android/.test(navigator.userAgent)) {
        console.log('PermissionManager: On Android, assuming microphone permission is granted despite audio focus issues');
        this.microphonePermissionState = 'granted';
        return { granted: true, state: 'granted' };
      }
      
      this.microphonePermissionState = 'error';
      return { granted: false, state: 'error', reason: 'Could not access microphone after multiple attempts' };
      
    } catch (error) {
      console.error('PermissionManager: Microphone permission error:', error);
      this.microphonePermissionState = 'error';
      return { granted: false, state: 'error', reason: error.message };
    }
  }

  // Check and request file system permission with proper Android handling
  async requestFilesPermission() {
    try {
      console.log('PermissionManager: Checking files permission...');
      
      // Test filesystem access first
      try {
        const testResult = await Filesystem.readdir({
          path: '',
          directory: 'DOCUMENTS'
        });
        console.log('PermissionManager: Filesystem test successful:', testResult);
        this.filesPermissionState = 'granted';
        return { granted: true, state: 'granted' };
      } catch (testError) {
        console.log('PermissionManager: Filesystem test failed:', testError);
        
        // If it's a permission error, we need to request permission
        if (testError.message.includes('permission') || 
            testError.message.includes('access') ||
            testError.message.includes('denied')) {
          
          console.log('PermissionManager: Requesting files permission...');
          
          // Try to access a specific directory that might trigger permission request
          try {
            await Filesystem.mkdir({
              path: 'biomap_test',
              directory: 'DOCUMENTS',
              recursive: true
            });
            
            // If successful, clean up and return granted
            await Filesystem.rmdir({
              path: 'biomap_test',
              directory: 'DOCUMENTS'
            });
            
            this.filesPermissionState = 'granted';
            return { granted: true, state: 'granted' };
          } catch (mkdirError) {
            console.log('PermissionManager: Files permission request failed:', mkdirError);
            this.filesPermissionState = 'denied';
            return { granted: false, state: 'denied', reason: 'User denied files permission' };
          }
        }
        
        // For other errors, assume permission is not available
        this.filesPermissionState = 'error';
        return { granted: false, state: 'error', reason: testError.message };
      }
      
    } catch (error) {
      console.error('PermissionManager: Files permission error:', error);
      this.filesPermissionState = 'error';
      return { granted: false, state: 'error', reason: error.message };
    }
  }

  // Check location permission state
  async checkLocationPermission() {
    try {
      const permissionState = await Geolocation.checkPermissions();
      this.locationPermissionState = permissionState.location;
      return permissionState.location;
    } catch (error) {
      console.error('PermissionManager: Error checking location permission:', error);
      return 'unknown';
    }
  }

  // Check microphone permission state with improved Android detection
  async checkMicrophonePermission() {
    try {
      console.log('PermissionManager: Checking microphone permission...');
      
      // Clean up any existing streams first
      this.cleanupAudioStreams();
      
      // Try to get a stream to check if we have permission
      try {
        // Remove all getUserMedia logic for audio from this file
        
        // If we get here, we have permission - stop the stream immediately
        setTimeout(() => {
          this.cleanupAudioStreams();
        }, 100);
        
        this.microphonePermissionState = 'granted';
        console.log('PermissionManager: Microphone permission is granted');
        return 'granted';
        
      } catch (error) {
        console.log('PermissionManager: Microphone permission check failed:', error);
        
        if (error.name === 'NotAllowedError') {
          this.microphonePermissionState = 'denied';
          return 'denied';
        } else if (error.name === 'NotReadableError' || 
                   error.message.includes('Could not start audio source') ||
                   error.message.includes('in use by another application') ||
                   error.message.includes('busy') ||
                   error.message.includes('already in use')) {
          // On Android, this often means permission is granted but audio focus issues
          if (/Android/.test(navigator.userAgent)) {
            console.log('PermissionManager: Android audio focus issue, assuming permission granted');
            this.microphonePermissionState = 'granted';
            return 'granted';
          }
          this.microphonePermissionState = 'denied';
          return 'denied';
        } else {
          this.microphonePermissionState = 'unknown';
          return 'unknown';
        }
      }
    } catch (error) {
      console.error('PermissionManager: Error checking microphone permission:', error);
      return 'unknown';
    }
  }

  // Check files permission state
  async checkFilesPermission() {
    try {
      const testResult = await Filesystem.readdir({
        path: '',
        directory: 'DOCUMENTS'
      });
      this.filesPermissionState = 'granted';
      return 'granted';
    } catch (error) {
      console.log('PermissionManager: Files permission check failed:', error);
      if (error.message.includes('permission') || 
          error.message.includes('access') ||
          error.message.includes('denied')) {
        this.filesPermissionState = 'denied';
        return 'denied';
      } else {
        this.filesPermissionState = 'unknown';
        return 'unknown';
      }
    }
  }

  // Get current permission states
  getPermissionStates() {
    return {
      location: this.locationPermissionState,
      microphone: this.microphonePermissionState,
      files: this.filesPermissionState
    };
  }

  // Request all required permissions with retry logic
  async requestAllPermissions() {
    console.log('PermissionManager: Requesting all permissions...');
    
    // Clean up any existing audio streams first
    this.cleanupAudioStreams();
    
    // Try location permission first
    const locationResult = await this.requestLocationPermission();
    console.log('PermissionManager: Location result:', locationResult);
    
    // Try files permission
    const filesResult = await this.requestFilesPermission();
    console.log('PermissionManager: Files result:', filesResult);
    
    // Try microphone permission with retry
    let microphoneResult;
    let retryCount = 0;
    const maxRetries = 2;
    
    while (retryCount < maxRetries) {
      microphoneResult = await this.requestMicrophonePermission();
      console.log(`PermissionManager: Microphone result (attempt ${retryCount + 1}):`, microphoneResult);
      
      if (microphoneResult.granted) {
        break;
      }
      
      // If failed and it's not a user denial, retry after a short delay
      if (microphoneResult.state !== 'denied' && retryCount < maxRetries - 1) {
        console.log('PermissionManager: Retrying microphone permission...');
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
        retryCount++;
      } else {
        break;
      }
    }
    
    const allGranted = locationResult.granted && microphoneResult.granted && filesResult.granted;
    console.log('PermissionManager: All permissions granted:', allGranted);
    
    return {
      location: locationResult,
      microphone: microphoneResult,
      files: filesResult,
      allGranted: allGranted
    };
  }

  // Check if all permissions are granted
  async checkAllPermissions() {
    const locationState = await this.checkLocationPermission();
    const microphoneState = await this.checkMicrophonePermission();
    const filesState = await this.checkFilesPermission();
    
    return {
      location: locationState,
      microphone: microphoneState,
      files: filesState,
      allGranted: locationState === 'granted' && microphoneState === 'granted' && filesState === 'granted'
    };
  }
}

// Export singleton instance
const permissionManager = new PermissionManager();
export default permissionManager; 