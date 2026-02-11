// Breadcrumb Service for tracking GPS movement during audio recording
import locationService from './locationService.js';

class BreadcrumbService {
  constructor() {
    this.isTracking = false;
    this.currentSession = null;
    this.breadcrumbs = [];
    this.lastPosition = null;
    this.lastTimestamp = 0;
    this.movementThreshold = 5; // meters
    this.speedThreshold = 0.5; // m/s
    this.maxBreadcrumbs = 1000;
    this.gpsInterval = 1000; // 1 second default
  }

  // Start breadcrumb tracking for a recording session
  async startTracking(sessionId, userLocation = null) {
    if (this.isTracking) {
      console.warn('Breadcrumb tracking already active');
      return;
    }

    console.log('Starting breadcrumb tracking for session:', sessionId);
    
    this.currentSession = {
      id: sessionId,
      startTime: Date.now(),
      startLocation: userLocation
    };
    
    this.breadcrumbs = [];
    this.isTracking = true;
    this.lastPosition = userLocation;
    this.lastTimestamp = Date.now();

    // Add initial breadcrumb if location is available
    if (userLocation) {
      this.addBreadcrumb(userLocation, {
        isRecording: true,
        audioLevel: 0,
        isMoving: false,
        movementSpeed: 0,
        direction: null
      });
    }

    // Note: We don't start our own location watch here anymore
    // Location updates should be provided via updateLocation() method
  }

  // Stop breadcrumb tracking
  stopTracking() {
    if (!this.isTracking) {
      console.warn('Breadcrumb tracking not active');
      return;
    }

    console.log('Stopping breadcrumb tracking');
    
    this.isTracking = false;

    const sessionData = {
      ...this.currentSession,
      endTime: Date.now(),
      duration: Date.now() - this.currentSession.startTime,
      breadcrumbs: [...this.breadcrumbs],
      summary: this.generateSessionSummary()
    };

    this.currentSession = null;
    this.breadcrumbs = [];
    this.lastPosition = null;

    return sessionData;
  }

  // Update location from external source (e.g., component's location updates)
  updateLocation(position) {
    if (!this.isTracking || !this.currentSession) {
      console.log('📍 Breadcrumb service: Not tracking or no session');
      return;
    }

    const now = Date.now();
    const timeSinceLastUpdate = now - this.lastTimestamp;

    // Adaptive GPS frequency based on movement
    const isMoving = this.lastPosition ? this.calculateDistance(
      this.lastPosition.lat, this.lastPosition.lng,
      position.lat, position.lng
    ) > this.movementThreshold : false;

    // Adjust GPS interval based on movement
    const targetInterval = isMoving ? 1000 : 3000; // 1s when moving, 3s when stationary
    
    if (timeSinceLastUpdate < targetInterval) {
      console.log('📍 Breadcrumb service: Skipping update, too soon');
      return;
    }

    const movementSpeed = this.lastPosition ? 
      this.calculateSpeed(this.lastPosition, position, timeSinceLastUpdate) : 0;

    const direction = this.lastPosition ? 
      this.calculateDirection(this.lastPosition, position) : null;

    console.log('📍 Breadcrumb service: Adding breadcrumb, movement:', isMoving, 'speed:', movementSpeed);

    this.addBreadcrumb(position, {
      isRecording: true,
      audioLevel: 0, // Will be updated by audio service
      isMoving: movementSpeed > this.speedThreshold,
      movementSpeed,
      direction
    });

    this.lastPosition = position;
    this.lastTimestamp = now;
  }

  // Add a breadcrumb to the current session
  addBreadcrumb(position, metadata = {}) {
    if (!this.isTracking || !this.currentSession) return;

    const breadcrumb = {
      lat: position.lat,
      lng: position.lng,
      timestamp: Date.now(),
      accuracy: position.accuracy || null,
      altitude: position.altitude || null,
      sessionId: this.currentSession.id,
      ...metadata
    };

    this.breadcrumbs.push(breadcrumb);

    // Limit breadcrumb count to prevent memory issues
    if (this.breadcrumbs.length > this.maxBreadcrumbs) {
      this.breadcrumbs = this.breadcrumbs.slice(-this.maxBreadcrumbs);
    }

    console.log('Added breadcrumb:', breadcrumb);
  }

  // Update audio level for the current session
  updateAudioLevel(audioLevel) {
    if (!this.isTracking || this.breadcrumbs.length === 0) return;

    const lastBreadcrumb = this.breadcrumbs[this.breadcrumbs.length - 1];
    lastBreadcrumb.audioLevel = audioLevel;
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

  // Calculate speed in m/s
  calculateSpeed(fromPosition, toPosition, timeMs) {
    const distance = this.calculateDistance(
      fromPosition.lat, fromPosition.lng,
      toPosition.lat, toPosition.lng
    );
    return distance / (timeMs / 1000);
  }

  // Calculate direction in degrees (0-360)
  calculateDirection(fromPosition, toPosition) {
    const lat1 = fromPosition.lat * Math.PI / 180;
    const lat2 = toPosition.lat * Math.PI / 180;
    const lng1 = fromPosition.lng * Math.PI / 180;
    const lng2 = toPosition.lng * Math.PI / 180;
    
    const y = Math.sin(lng2 - lng1) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - 
              Math.sin(lat1) * Math.cos(lat2) * Math.cos(lng2 - lng1);
    
    let bearing = Math.atan2(y, x) * 180 / Math.PI;
    bearing = (bearing + 360) % 360;
    
    return bearing;
  }

  // Generate session summary
  generateSessionSummary() {
    if (this.breadcrumbs.length === 0) {
      return {
        totalDistance: 0,
        averageSpeed: 0,
        maxSpeed: 0,
        stationaryTime: 0,
        movingTime: 0,
        pattern: 'stationary'
      };
    }

    let totalDistance = 0;
    let totalSpeed = 0;
    let maxSpeed = 0;
    let stationaryCount = 0;
    let movingCount = 0;

    for (let i = 1; i < this.breadcrumbs.length; i++) {
      const prev = this.breadcrumbs[i - 1];
      const curr = this.breadcrumbs[i];
      
      const distance = this.calculateDistance(prev.lat, prev.lng, curr.lat, curr.lng);
      const timeDiff = curr.timestamp - prev.timestamp;
      const speed = distance / (timeDiff / 1000);
      
      totalDistance += distance;
      totalSpeed += speed;
      maxSpeed = Math.max(maxSpeed, speed);
      
      if (curr.isMoving) {
        movingCount++;
      } else {
        stationaryCount++;
      }
    }

    const averageSpeed = totalSpeed / (this.breadcrumbs.length - 1);
    const totalTime = this.breadcrumbs[this.breadcrumbs.length - 1].timestamp - 
                     this.breadcrumbs[0].timestamp;
    const stationaryTime = (stationaryCount / this.breadcrumbs.length) * totalTime;
    const movingTime = totalTime - stationaryTime;

    // Determine pattern
    let pattern = 'mixed';
    if (movingCount / this.breadcrumbs.length > 0.8) pattern = 'moving';
    else if (stationaryCount / this.breadcrumbs.length > 0.8) pattern = 'stationary';

    return {
      totalDistance: Math.round(totalDistance),
      averageSpeed: Math.round(averageSpeed * 100) / 100,
      maxSpeed: Math.round(maxSpeed * 100) / 100,
      stationaryTime: Math.round(stationaryTime / 1000),
      movingTime: Math.round(movingTime / 1000),
      pattern
    };
  }

  // Get current breadcrumbs
  getCurrentBreadcrumbs() {
    return [...this.breadcrumbs];
  }

  // Get current session info
  getCurrentSession() {
    return this.currentSession ? { ...this.currentSession } : null;
  }

  // Check if tracking is active
  isTrackingActive() {
    return this.isTracking;
  }

  // Compress breadcrumbs using Douglas-Peucker algorithm
  compressBreadcrumbs(breadcrumbs, tolerance = 5) {
    if (breadcrumbs.length <= 2) return breadcrumbs;

    const findPerpendicularDistance = (point, lineStart, lineEnd) => {
      const A = point.lat - lineStart.lat;
      const B = point.lng - lineStart.lng;
      const C = lineEnd.lat - lineStart.lat;
      const D = lineEnd.lng - lineStart.lng;

      const dot = A * C + B * D;
      const lenSq = C * C + D * D;
      let param = -1;

      if (lenSq !== 0) param = dot / lenSq;

      let xx, yy;

      if (param < 0) {
        xx = lineStart.lat;
        yy = lineStart.lng;
      } else if (param > 1) {
        xx = lineEnd.lat;
        yy = lineEnd.lng;
      } else {
        xx = lineStart.lat + param * C;
        yy = lineStart.lng + param * D;
      }

      const dx = point.lat - xx;
      const dy = point.lng - yy;
      return Math.sqrt(dx * dx + dy * dy);
    };

    const douglasPeucker = (points, tolerance) => {
      if (points.length <= 2) return points;

      let maxDistance = 0;
      let index = 0;

      for (let i = 1; i < points.length - 1; i++) {
        const distance = findPerpendicularDistance(
          points[i], 
          points[0], 
          points[points.length - 1]
        );
        if (distance > maxDistance) {
          index = i;
          maxDistance = distance;
        }
      }

      if (maxDistance > tolerance) {
        const firstLine = douglasPeucker(points.slice(0, index + 1), tolerance);
        const secondLine = douglasPeucker(points.slice(index), tolerance);
        return [...firstLine.slice(0, -1), ...secondLine];
      } else {
        return [points[0], points[points.length - 1]];
      }
    };

    return douglasPeucker(breadcrumbs, tolerance);
  }

  // Export breadcrumbs in different formats
  exportBreadcrumbs(sessionData, format = 'geojson') {
    switch (format) {
      case 'geojson':
        return this.exportAsGeoJSON(sessionData);
      case 'gpx':
        return this.exportAsGPX(sessionData);
      case 'csv':
        return this.exportAsCSV(sessionData);
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  // Export as GeoJSON
  exportAsGeoJSON(sessionData) {
    const features = sessionData.breadcrumbs.map((crumb, index) => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [crumb.lng, crumb.lat]
      },
      properties: {
        index,
        timestamp: crumb.timestamp,
        audioLevel: crumb.audioLevel || 0,
        isMoving: crumb.isMoving || false,
        movementSpeed: crumb.movementSpeed || 0,
        direction: crumb.direction,
        accuracy: crumb.accuracy,
        altitude: crumb.altitude
      }
    }));

    // Add line feature for the path
    const coordinates = sessionData.breadcrumbs.map(crumb => [crumb.lng, crumb.lat]);
    features.push({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates
      },
      properties: {
        type: 'breadcrumb_path',
        sessionId: sessionData.id,
        summary: sessionData.summary
      }
    });

    return {
      type: 'FeatureCollection',
      features
    };
  }

  // Export as GPX
  exportAsGPX(sessionData) {
    const formatTime = (timestamp) => {
      return new Date(timestamp).toISOString();
    };

    let gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="BioMap Breadcrumb Service">
  <metadata>
    <name>BioMap Recording Session ${sessionData.id}</name>
    <time>${formatTime(sessionData.startTime)}</time>
  </metadata>
  <trk>
    <name>Recording Path</name>
    <trkseg>`;

    sessionData.breadcrumbs.forEach(crumb => {
      gpx += `
      <trkpt lat="${crumb.lat}" lon="${crumb.lng}">
        <time>${formatTime(crumb.timestamp)}</time>
        ${crumb.altitude ? `<ele>${crumb.altitude}</ele>` : ''}
        <extensions>
          <audioLevel>${crumb.audioLevel || 0}</audioLevel>
          <isMoving>${crumb.isMoving || false}</isMoving>
          <movementSpeed>${crumb.movementSpeed || 0}</movementSpeed>
          <direction>${crumb.direction || ''}</direction>
        </extensions>
      </trkpt>`;
    });

    gpx += `
    </trkseg>
  </trk>
</gpx>`;

    return gpx;
  }

  // Export as CSV
  exportAsCSV(sessionData) {
    const headers = [
      'timestamp', 'lat', 'lng', 'audioLevel', 'isMoving', 
      'movementSpeed', 'direction', 'accuracy', 'altitude'
    ];

    const csv = [
      headers.join(','),
      ...sessionData.breadcrumbs.map(crumb => [
        new Date(crumb.timestamp).toISOString(),
        crumb.lat,
        crumb.lng,
        crumb.audioLevel || 0,
        crumb.isMoving || false,
        crumb.movementSpeed || 0,
        crumb.direction || '',
        crumb.accuracy || '',
        crumb.altitude || ''
      ].join(','))
    ].join('\n');

    return csv;
  }
}

// Create singleton instance
const breadcrumbService = new BreadcrumbService();

export default breadcrumbService; 