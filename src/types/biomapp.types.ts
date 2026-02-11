/**
 * BioMapp Unified Type Definitions
 * Standardized data models for better interoperability across components
 */

export interface BioMappLocation {
  lat: number;
  lng: number;
  accuracy?: number;
  altitude?: number;
  timestamp?: number;
}

export interface BioMappBreadcrumb {
  lat: number;
  lng: number;
  timestamp: number;
  accuracy?: number;
  altitude?: number;
  sessionId: string;
  audioLevel: number; // 0-1
  isMoving: boolean;
  movementSpeed: number; // m/s
  direction?: number; // degrees 0-360
  isRecording?: boolean;
}

export interface BioMappSession {
  id: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  startLocation?: BioMappLocation;
  breadcrumbs: BioMappBreadcrumb[];
  summary: {
    totalDistance: number;
    averageSpeed: number;
    maxSpeed: number;
    stationaryTime: number;
    movingTime: number;
    pattern: 'stationary' | 'moving' | 'mixed';
  };
}

export interface BioMappRecording {
  uniqueId: string;
  filename: string;
  displayName?: string;
  duration: number;
  timestamp: string; // ISO 8601
  location: BioMappLocation;
  notes?: string;
  speciesTags: string[];
  weather?: string;
  temperature?: number;
  audioBlob?: Blob;
  breadcrumbs?: BioMappBreadcrumb[];
  fileSize?: number;
  quality: 'low' | 'medium' | 'high';
  pendingUpload: boolean;
  saved: boolean;
  localTimestamp?: number;
  lastModified?: string;
}

export interface BioMappExportPackage {
  biomapp_export: {
    version: string;
    export_date: string;
    export_type: 'soundwalk_package' | 'recording_collection' | 'metadata_only';
    metadata: {
      title?: string;
      description?: string;
      duration_minutes?: number;
      total_distance_meters?: number;
      location_summary?: {
        start: BioMappLocation;
        end: BioMappLocation;
      };
    };
    recordings: BioMappRecording[];
    tracklog?: {
      total_points: number;
      compressed_points: number;
      summary: BioMappSession['summary'];
      path: Array<{
        lat: number;
        lng: number;
        timestamp: number;
        elevation?: number;
      }>;
    };
    sessions?: BioMappSession[];
  };
}

export interface BioMappAudioSpot {
  id: string;
  location: BioMappLocation;
  filename: string;
  timestamp: string;
  duration: number;
  notes?: string;
  speciesTags: string[];
  audioBlob?: Blob;
}

export interface BioMappPlaybackOptions {
  mode: 'single' | 'nearby' | 'concatenated' | 'jamm';
  proximityVolumeEnabled?: boolean;
  userLocation?: BioMappLocation;
  volume?: number;
  isMuted?: boolean;
}

export interface BioMappMapLayer {
  id: string;
  name: string;
  url: string;
  attribution: string;
  maxZoom?: number;
  opacity?: number;
}

export interface BioMappVisualizationMode {
  id: string;
  name: string;
  type: 'line' | 'heatmap' | 'markers' | 'animated';
  showMarkers?: boolean;
  showDirectionArrows?: boolean;
  lineColor?: 'auto' | 'time' | 'audio' | 'speed';
  lineWidth?: number;
  opacity?: number;
}

// Utility types for component props
export interface BioMappComponentProps {
  userLocation?: BioMappLocation;
  locationPermission: 'unknown' | 'granted' | 'denied';
  hasRequestedPermission: boolean;
  onBackToLanding?: () => void;
  setLocationPermission?: (permission: string) => void;
  setUserLocation?: (location: BioMappLocation) => void;
  setHasRequestedPermission?: (requested: boolean) => void;
}

// Event types for better type safety
export type BioMappEventType = 
  | 'recording_started'
  | 'recording_stopped'
  | 'breadcrumb_added'
  | 'location_updated'
  | 'audio_playback_started'
  | 'audio_playback_stopped'
  | 'export_completed'
  | 'import_completed';

export interface BioMappEvent {
  type: BioMappEventType;
  timestamp: number;
  data?: any;
}