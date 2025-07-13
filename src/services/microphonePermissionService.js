class MicrophonePermissionService {
  constructor() {
    this.hasPermission = false;
    this.isChecking = false;
  }

  /**
   * Check if microphone permission is available and granted
   */
  async checkMicrophonePermission() {
    if (this.isChecking) {
      return this.hasPermission;
    }

    this.isChecking = true;

    try {
      // First, try to check if we're in a Capacitor environment
      if (window.Capacitor && window.Capacitor.isNative) {
        console.log('Running in Capacitor native environment');
        return await this.checkNativePermission();
      } else {
        console.log('Running in web environment');
        return await this.checkWebPermission();
      }
    } catch (error) {
      console.error('Error checking microphone permission:', error);
      return false;
    } finally {
      this.isChecking = false;
    }
  }

  /**
   * Check permission in native Capacitor environment
   */
  async checkNativePermission() {
    try {
      // Import Capacitor plugins dynamically
      const { Permissions } = await import('@capacitor/core');
      
      // Check microphone permission
      const permission = await Permissions.query({ name: 'microphone' });
      console.log('Native microphone permission state:', permission.state);
      
      this.hasPermission = permission.state === 'granted';
      return this.hasPermission;
    } catch (error) {
      console.error('Error checking native permission:', error);
      // Fallback to web API
      return await this.checkWebPermission();
    }
  }

  /**
   * Check permission in web environment
   */
  async checkWebPermission() {
    try {
      if (!navigator.permissions) {
        console.log('Permissions API not available, assuming permission needed');
        return false;
      }

      const permission = await navigator.permissions.query({ name: 'microphone' });
      console.log('Web microphone permission state:', permission.state);
      
      this.hasPermission = permission.state === 'granted';
      return this.hasPermission;
    } catch (error) {
      console.error('Error checking web permission:', error);
      return false;
    }
  }

  /**
   * Request microphone permission
   */
  async requestMicrophonePermission() {
    try {
      console.log('Requesting microphone permission...');

      // Try native permission first if in Capacitor
      if (window.Capacitor && window.Capacitor.isNative) {
        const granted = await this.requestNativePermission();
        if (granted) {
          this.hasPermission = true;
          return true;
        }
      }

      // Fallback to web API
      const granted = await this.requestWebPermission();
      this.hasPermission = granted;
      return granted;
    } catch (error) {
      console.error('Error requesting microphone permission:', error);
      this.hasPermission = false;
      return false;
    }
  }

  /**
   * Request permission in native Capacitor environment
   */
  async requestNativePermission() {
    try {
      const { Permissions } = await import('@capacitor/core');
      
      // Request microphone permission
      const permission = await Permissions.request({ name: 'microphone' });
      console.log('Native microphone permission result:', permission.state);
      
      return permission.state === 'granted';
    } catch (error) {
      console.error('Error requesting native permission:', error);
      return false;
    }
  }

  /**
   * Request permission in web environment
   */
  async requestWebPermission() {
    try {
      // Test microphone access by requesting a small audio stream
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          sampleRate: 44100,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
        } 
      });

      // If we get here, permission was granted
      console.log('Web microphone permission granted');
      
      // Stop the test stream immediately
      stream.getTracks().forEach(track => track.stop());
      
      return true;
    } catch (error) {
      console.error('Web microphone permission denied:', error);
      return false;
    }
  }

  /**
   * Get microphone stream with proper error handling
   */
  async getMicrophoneStream() {
    try {
      // First check if we have permission
      if (!this.hasPermission) {
        const granted = await this.requestMicrophonePermission();
        if (!granted) {
          throw new Error('Microphone permission denied');
        }
      }

      // Request the stream
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          sampleRate: 44100,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
        } 
      });

      console.log('Microphone stream obtained successfully');
      return stream;
    } catch (error) {
      console.error('Error getting microphone stream:', error);
      
      // Provide user-friendly error messages
      let errorMessage = 'Could not access microphone';
      
      if (error.name === 'NotAllowedError') {
        errorMessage = 'Microphone permission denied. Please allow microphone access in your device settings.';
      } else if (error.name === 'NotFoundError') {
        errorMessage = 'No microphone found on this device.';
      } else if (error.name === 'NotReadableError') {
        errorMessage = 'Microphone is already in use by another application.';
      } else if (error.name === 'OverconstrainedError') {
        errorMessage = 'Microphone does not support the requested audio settings.';
      } else if (error.name === 'TypeError') {
        errorMessage = 'Microphone access is not supported on this device.';
      }
      
      throw new Error(errorMessage);
    }
  }

  /**
   * Check if microphone is available on this device
   */
  async isMicrophoneAvailable() {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        return false;
      }

      // Check if any audio input devices are available
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter(device => device.kind === 'audioinput');
      
      console.log('Available audio input devices:', audioInputs.length);
      return audioInputs.length > 0;
    } catch (error) {
      console.error('Error checking microphone availability:', error);
      return false;
    }
  }

  /**
   * Get detailed microphone status
   */
  async getMicrophoneStatus() {
    const available = await this.isMicrophoneAvailable();
    const hasPermission = await this.checkMicrophonePermission();
    
    return {
      available,
      hasPermission,
      canRecord: available && hasPermission
    };
  }
}

// Create singleton instance
const microphonePermissionService = new MicrophonePermissionService();

export default microphonePermissionService; 