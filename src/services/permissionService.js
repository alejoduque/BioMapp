// Permission Service for BioMap
// Handles permissions for both web and Android platforms

class PermissionService {
  constructor() {
    this.isCapacitor = typeof window !== 'undefined' && window.Capacitor;
    this.isAndroid = /Android/.test(navigator.userAgent);
  }

  // Request location permission
  async requestLocationPermission() {
    try {
      if (this.isCapacitor && this.isAndroid) {
        // Use Capacitor Geolocation plugin for Android
        const { Geolocation } = await import('@capacitor/geolocation');
        
        // Check current permission
        const permission = await Geolocation.checkPermissions();
        
        if (permission.location === 'granted') {
          return { granted: true, message: 'Location permission already granted' };
        }
        
        // Request permission
        const requestResult = await Geolocation.requestPermissions();
        
        if (requestResult.location === 'granted') {
          return { granted: true, message: 'Location permission granted' };
        } else {
          return { granted: false, message: 'Location permission denied' };
        }
      } else {
        // Web browser permission handling
        return new Promise((resolve) => {
          if (!navigator.geolocation) {
            resolve({ granted: false, message: 'Geolocation not supported' });
            return;
          }

          navigator.geolocation.getCurrentPosition(
            () => resolve({ granted: true, message: 'Location permission granted' }),
            (error) => {
              let message = 'Location permission denied';
              switch (error.code) {
                case error.PERMISSION_DENIED:
                  message = 'Location permission denied by user';
                  break;
                case error.POSITION_UNAVAILABLE:
                  message = 'Location information unavailable';
                  break;
                case error.TIMEOUT:
                  message = 'Location request timed out';
                  break;
              }
              resolve({ granted: false, message });
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
          );
        });
      }
    } catch (error) {
      console.error('Error requesting location permission:', error);
      return { granted: false, message: 'Error requesting location permission' };
    }
  }

  // Request microphone permission
  async requestMicrophonePermission() {
    try {
      if (this.isCapacitor && this.isAndroid) {
        // For Android, we'll use the MediaDevices API but with proper error handling
        return new Promise((resolve) => {
          navigator.mediaDevices.getUserMedia({ audio: true })
            .then((stream) => {
              // Stop the stream immediately since we just wanted to test permission
              stream.getTracks().forEach(track => track.stop());
              resolve({ granted: true, message: 'Microphone permission granted' });
            })
            .catch((error) => {
              let message = 'Microphone permission denied';
              if (error.name === 'NotAllowedError') {
                message = 'Microphone permission denied by user';
              } else if (error.name === 'NotFoundError') {
                message = 'No microphone found';
              } else if (error.name === 'NotReadableError') {
                message = 'Microphone is busy';
              }
              resolve({ granted: false, message });
            });
        });
      } else {
        // Web browser permission handling
        return new Promise((resolve) => {
          navigator.mediaDevices.getUserMedia({ audio: true })
            .then((stream) => {
              // Stop the stream immediately since we just wanted to test permission
              stream.getTracks().forEach(track => track.stop());
              resolve({ granted: true, message: 'Microphone permission granted' });
            })
            .catch((error) => {
              let message = 'Microphone permission denied';
              if (error.name === 'NotAllowedError') {
                message = 'Microphone permission denied by user';
              } else if (error.name === 'NotFoundError') {
                message = 'No microphone found';
              } else if (error.name === 'NotReadableError') {
                message = 'Microphone is busy';
              }
              resolve({ granted: false, message });
            });
        });
      }
    } catch (error) {
      console.error('Error requesting microphone permission:', error);
      return { granted: false, message: 'Error requesting microphone permission' };
    }
  }

  // Check location permission status
  async checkLocationPermission() {
    try {
      if (this.isCapacitor && this.isAndroid) {
        const { Geolocation } = await import('@capacitor/geolocation');
        const permission = await Geolocation.checkPermissions();
        return permission.location;
      } else {
        // Web browser permission checking
        if (!navigator.permissions) {
          return 'unknown';
        }
        
        try {
          const permission = await navigator.permissions.query({ name: 'geolocation' });
          return permission.state;
        } catch (error) {
          return 'unknown';
        }
      }
    } catch (error) {
      console.error('Error checking location permission:', error);
      return 'unknown';
    }
  }

  // Check microphone permission status
  async checkMicrophonePermission() {
    try {
      if (this.isCapacitor && this.isAndroid) {
        // For Android, we can't easily check microphone permission without requesting it
        // So we'll try to get user media and see if it works
        return new Promise((resolve) => {
          navigator.mediaDevices.getUserMedia({ audio: true })
            .then((stream) => {
              stream.getTracks().forEach(track => track.stop());
              resolve('granted');
            })
            .catch((error) => {
              if (error.name === 'NotAllowedError') {
                resolve('denied');
              } else {
                resolve('unknown');
              }
            });
        });
      } else {
        // Web browser permission checking
        if (!navigator.permissions) {
          return 'unknown';
        }
        
        try {
          const permission = await navigator.permissions.query({ name: 'microphone' });
          return permission.state;
        } catch (error) {
          return 'unknown';
        }
      }
    } catch (error) {
      console.error('Error checking microphone permission:', error);
      return 'unknown';
    }
  }

  // Request all required permissions
  async requestAllPermissions() {
    console.log('Requesting all permissions...');
    
    const locationResult = await this.requestLocationPermission();
    const microphoneResult = await this.requestMicrophonePermission();
    
    return {
      location: locationResult,
      microphone: microphoneResult,
      allGranted: locationResult.granted && microphoneResult.granted
    };
  }

  // Check all permissions status
  async checkAllPermissions() {
    const locationStatus = await this.checkLocationPermission();
    const microphoneStatus = await this.checkMicrophonePermission();
    
    return {
      location: locationStatus,
      microphone: microphoneStatus,
      allGranted: locationStatus === 'granted' && microphoneStatus === 'granted'
    };
  }
}

// Create singleton instance
const permissionService = new PermissionService();

export default permissionService; 