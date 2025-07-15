import { Geolocation } from '@capacitor/geolocation';
import permissionManager from './permissionManager.js';

class LocationService {
  constructor() {
    this.currentPosition = null;
    this.watchId = null;
    this.onLocationUpdate = null;
    this.onLocationError = null;
  }

  // Request location permission and get current position using Capacitor
  async requestLocation() {
    try {
      // First check if permission is already granted
      const currentPermission = await this.checkLocationPermission();
      console.log('Location service: Current permission state:', currentPermission);
      
      if (currentPermission !== 'granted') {
        // Only request permission if not already granted
        const permissionResult = await permissionManager.requestLocationPermission();
        console.log('Location service: Permission result:', permissionResult);
        
        if (!permissionResult.granted) {
          throw new Error(permissionResult.reason || 'Location permission not granted');
        }
      } else {
        console.log('Location service: Permission already granted, proceeding to get location');
      }
      
      // Permission granted, get position
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000
      });
      
      this.currentPosition = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: position.timestamp
      };
      return this.currentPosition;
    } catch (error) {
      console.error('Location service error:', error);
      throw new Error(`Location error: ${error.message}`);
    }
  }

  // Check location permission state
  async checkLocationPermission() {
    return await permissionManager.checkLocationPermission();
  }

  // Start watching location updates using Capacitor
  async startLocationWatch(onUpdate, onError) {
    try {
      this.onLocationUpdate = onUpdate;
      this.onLocationError = onError;

      this.watchId = await Geolocation.watchPosition({
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000
      }, (position) => {
        this.currentPosition = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp
        };
        
        if (this.onLocationUpdate) {
          this.onLocationUpdate(this.currentPosition);
        }
      });
    } catch (error) {
      console.error('Location watch error:', error);
      if (this.onLocationError) {
        this.onLocationError(new Error(`Location watch error: ${error.message}`));
      }
    }
  }

  // Stop watching location updates
  async stopLocationWatch() {
    if (this.watchId) {
      try {
        await Geolocation.clearWatch({ id: this.watchId });
        this.watchId = null;
      } catch (error) {
        console.error('Error stopping location watch:', error);
      }
    }
  }

  // Get current position (cached)
  getCurrentPosition() {
    return this.currentPosition;
  }

  // Calculate distance between two points in meters
  calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lng2 - lng1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }
}

// Export singleton instance
const locationService = new LocationService();
export default locationService; 