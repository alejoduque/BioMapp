import React from 'react';
import MapData from './MapData.js'
import BaseMap from './BaseMap.jsx'
import DetailView from './DetailView.jsx'
import SharedTopBar from './SharedTopBar.jsx'
import LocationPermission from './LocationPermission.jsx'
import BreadcrumbVisualization from './BreadcrumbVisualization.jsx'
import config from '../config.json'
import localStorageService from '../services/localStorageService.js';
import AudioRecorder from '../services/AudioRecorder.tsx';
import locationService from '../services/locationService.js';
import breadcrumbService from '../services/breadcrumbService.js';

class MapContainer extends React.Component {
  constructor (props) {
    super(props)

    this.mapData = new MapData()

    this.state = {
      geoJson: {},
      loaded: false,
      bounds: null,
      center: {lng: config.centroMapa.lon, lat: config.centroMapa.lat},
      selectedPoint: null,
      query: '',
      animate: false,
      searchResults: [],
      isAudioRecorderVisible: false,
      locationError: null,
      showLocationPermission: false, // Changed to false by default
      pendingUploads: localStorageService.getPendingUploads(),
      isOnline: navigator.onLine,
      tracklog: this.loadTracklogFromStorage(),
      mapInstance: null, // Add map instance state
      currentLayer: 'OpenStreetMap', // Add current layer state
      breadcrumbVisualization: 'line', // 'line', 'heatmap', 'markers', 'animated'
      showBreadcrumbs: true, // Enable by default
      currentBreadcrumbs: []
    }
    
    this.lastAcceptedPosition = null; // For debouncing GPS updates
    this.lastAcceptedTimestamp = 0;
    this.updateSelectedPoint = this.updateSelectedPoint.bind(this)
    this.getNextRecording = this.getNextRecording.bind(this)
    this.getPreviousRecording = this.getPreviousRecording.bind(this)
    this.searchMapData = this.searchMapData.bind(this)
    this.clearSearch = this.clearSearch.bind(this)
    this.toggleAudioRecorder = this.toggleAudioRecorder.bind(this)
    this.handleSaveRecording = this.handleSaveRecording.bind(this)
    this.updateQuery = this.updateQuery.bind(this)
    this.handleLocationGranted = this.handleLocationGranted.bind(this)
    this.handleLocationDenied = this.handleLocationDenied.bind(this)
    this.handleLocationError = this.handleLocationError.bind(this)
    this.handlePlayAudio = this.handlePlayAudio.bind(this)
    this.handleUploadPending = this.handleUploadPending.bind(this);
    this.handleLocationRefresh = this.handleLocationRefresh.bind(this)
    this.addTracklogPoint = this.addTracklogPoint.bind(this);
    this.clearTracklog = this.clearTracklog.bind(this);
    this.handleMapCreated = this.handleMapCreated.bind(this);
    this.handleLayerChange = this.handleLayerChange.bind(this);
    this.toggleBreadcrumbs = this.toggleBreadcrumbs.bind(this);
    this.setBreadcrumbVisualization = this.setBreadcrumbVisualization.bind(this);
  }

  // --- Tracklog helpers ---
  loadTracklogFromStorage() {
    try {
      const data = localStorage.getItem('biomap_tracklog');
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }

  saveTracklogToStorage(tracklog) {
    try {
      localStorage.setItem('biomap_tracklog', JSON.stringify(tracklog));
    } catch (e) {}
  }

  addTracklogPoint(position) {
    if (!position || !position.lat || !position.lng) return;
    const { tracklog } = this.state;
    // Only add if different from last point
    if (tracklog.length === 0 || tracklog[tracklog.length-1].lat !== position.lat || tracklog[tracklog.length-1].lng !== position.lng) {
      const newTracklog = [...tracklog, { ...position, timestamp: Date.now() }];
      this.setState({ tracklog: newTracklog }, () => {
        this.saveTracklogToStorage(newTracklog);
      });
    }
  }

  clearTracklog() {
    this.setState({ tracklog: [] }, () => {
      this.saveTracklogToStorage([]);
    });
  }

  updateQuery(query) {
    this.setState({ query: query })
  }

  toggleAudioRecorder() {
    this.setState({ isAudioRecorderVisible: !this.state.isAudioRecorderVisible })
  }

  async handleSaveRecording(recordingData) {
    try {
      // Validate recording data before saving
      if (!recordingData || !recordingData.metadata) {
        throw new Error('Invalid recording data: missing metadata');
      }
      
      // Check if we have valid audio data
      let hasValidAudio = false;
      
      if (recordingData.audioBlob && recordingData.audioBlob.size > 0) {
        hasValidAudio = true;
        console.log('✅ Valid audio blob found:', recordingData.audioBlob.size, 'bytes');
      } else if (recordingData.audioPath) {
        // For native recordings, check if the file exists
        try {
          const { Filesystem } = await import('@capacitor/filesystem');
          const fileInfo = await Filesystem.stat({ path: recordingData.audioPath });
          if (fileInfo.size > 0) {
            hasValidAudio = true;
            console.log('✅ Valid native audio file found:', fileInfo.size, 'bytes');
          }
        } catch (fileError) {
          console.warn('Native audio file not accessible:', fileError);
        }
      }
      
      if (!hasValidAudio) {
        throw new Error('No valid audio data found. Recording may be incomplete or corrupted.');
      }
      
      // Validate metadata
      const metadata = recordingData.metadata;
      if (!metadata.location || !metadata.location.lat || !metadata.location.lng) {
        throw new Error('Invalid recording location data');
      }
      
      if (!metadata.filename || !metadata.filename.trim()) {
        throw new Error('Invalid recording filename');
      }
      
      if (!metadata.duration || metadata.duration <= 0) {
        throw new Error('Invalid recording duration');
      }
      
      console.log('✅ Recording validation passed, saving...');
      
      // Save to localStorage
      // Include native audio file path in metadata (if available) so export can use it later
      const metadataToSave = {
        ...recordingData.metadata,
        ...(recordingData.audioPath ? { audioPath: recordingData.audioPath } : {})
      };
      const recordingId = await localStorageService.saveRecording(metadataToSave, recordingData.audioBlob);
      
      // Reload recordings and update map state
      this.loadExistingRecordings();
      const geoJson = this.mapData.getAudioRecordingsGeoJson();
      this.setState({ 
        geoJson: geoJson, 
        isAudioRecorderVisible: false 
      });
      
      // Show success message
      alert(`Grabación "${recordingData.metadata.displayName}" guardada exitosamente!`);
    } catch (error) {
      console.error('Recording save failed:', error);
      alert(`No se pudo guardar la grabación: ${error.message}`);
    }
  }

  updateSelectedPoint(point, animate) {
    console.log('selected point', point, animate)
    this.setState({selectedPoint: point, animate: animate})
  }

  clearSearch () {
    this.setState({ searchResults: [], query: ''})
  }
  
  searchMapData(query) {
    var results = this.mapData.searchData(query)
    console.log('results', query, results)
    this.setState({ searchResults: results, query: query})
  }

  getNextRecording(point) {
    var index = point.index
    index++
    if(point.index >= this.state.geoJson.features.length) index = 0
    this.setState({ selectedPoint: this.state.geoJson.features[index], animate: true})
  }

  getPreviousRecording(point) {
    var index = point.index
    index--
    if(point.index < 0) index = this.state.geoJson.features.length - 1
    this.setState({ selectedPoint: this.state.geoJson.features[index], animate: true})
  }

  // Helper to calculate distance between two lat/lng points in meters
  calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371e3;
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

  handleLocationGranted(position) {
    // Debounce/throttle: Only update if >7m and >30s since last
    const now = Date.now();
    let shouldUpdate = false;
    if (!this.lastAcceptedPosition) {
      shouldUpdate = true;
    } else {
      const dist = this.calculateDistance(
        this.lastAcceptedPosition.lat,
        this.lastAcceptedPosition.lng,
        position.lat,
        position.lng
      );
      if (dist > 7 && (now - this.lastAcceptedTimestamp > 30000)) {
        shouldUpdate = true;
      }
    }
    if (shouldUpdate) {
      this.lastAcceptedPosition = { lat: position.lat, lng: position.lng };
      this.lastAcceptedTimestamp = now;
      this.props.setUserLocation(position);
      this.props.setLocationPermission('granted');
      this.setState({
        center: { lat: position.lat, lng: position.lng },
        locationError: null,
        showLocationPermission: false,
      });
      this.props.setHasRequestedPermission(true);
      this.addTracklogPoint(position); // <-- Add to tracklog
    }
    // Always (re)start the location watch
    locationService.startLocationWatch(
      (newPosition) => {
        // Debounce/throttle: Only update if >7m and >30s since last
        const now = Date.now();
        let shouldUpdate = false;
        if (!this.lastAcceptedPosition) {
          shouldUpdate = true;
        } else {
          const dist = this.calculateDistance(
            this.lastAcceptedPosition.lat,
            this.lastAcceptedPosition.lng,
            newPosition.lat,
            newPosition.lng
          );
          if (dist > 7 && (now - this.lastAcceptedTimestamp > 30000)) {
            shouldUpdate = true;
          }
        }
        if (shouldUpdate) {
          this.lastAcceptedPosition = { lat: newPosition.lat, lng: newPosition.lng };
          this.lastAcceptedTimestamp = now;
          this.props.setUserLocation(newPosition);
          this.setState({
            center: { lat: newPosition.lat, lng: newPosition.lng }
          });
          this.addTracklogPoint(newPosition); // <-- Add to tracklog on every update
        }
      },
      (error) => {
        this.setState({ locationError: error.message });
      }
    );
  }

  handleLocationDenied(errorMessage) {
    this.props.setLocationPermission('denied');
    this.props.setUserLocation(null);
    this.setState({
      locationError: errorMessage,
      showLocationPermission: false,
    });
    this.props.setHasRequestedPermission(true);
  }

  handleLocationError(error) {
    console.log('Location error:', error);
    this.setState({
      locationError: error.message
    });
  }

  handleLocationRefresh() {
    console.log('MapContainer: Manual location refresh requested');
    // Stop any existing location watch
    locationService.stopLocationWatch();
    
    // Request location again
    locationService.requestLocation()
      .then((position) => {
        console.log('MapContainer: Location refresh successful:', position);
        this.handleLocationGranted(position);
      })
      .catch((error) => {
        console.log('MapContainer: Location refresh failed:', error.message);
        this.setState({
          locationError: error.message,
        });
        this.props.setUserLocation(null);
        this.props.setLocationPermission('denied');
        this.props.setHasRequestedPermission(true);
      });
  }



  async handlePlayAudio(recordingId) {
    try {
      const recording = this.mapData.AudioRecordings.byId[recordingId];
      if (recording) {
        // Try flexible blob (localStorage or native file)
        const audioBlob = await localStorageService.getAudioBlobFlexible(recordingId);
        if (audioBlob) {
          const audio = new Audio(URL.createObjectURL(audioBlob));
          audio.play().catch(error => {
            console.error('Error playing audio (blob):', error);
            alert('Error al reproducir el archivo de audio');
          });
          return;
        }
        // As last resort, try native path via convertFileSrc
        if (recording.audioPath) {
          const playableUrl = await localStorageService.getPlayableUrl(recordingId);
          if (playableUrl) {
            const audio = new Audio(playableUrl);
            try { await audio.play(); return; } catch (_) {}
          }
        }
        console.log('Audio data not found for recording:', recordingId);
        alert('Archivo de audio no disponible');
      } else {
        console.log('Recording not found:', recordingId);
        alert('Grabación no encontrada');
      }
    } catch (error) {
      console.error('Error playing audio:', error);
      alert('Error al reproducir el archivo de audio');
    }
  }

  handleMapCreated(map) {
    this.setState({ mapInstance: map });
  }

  handleLayerChange(layerName) {
    console.log('MapContainer: handleLayerChange called with:', layerName);
    this.setState({ currentLayer: layerName }, () => {
      console.log('MapContainer: currentLayer state updated to:', this.state.currentLayer);
    });
  }

  toggleBreadcrumbs() {
    this.setState(prevState => ({ showBreadcrumbs: !prevState.showBreadcrumbs }));
  }

  setBreadcrumbVisualization(mode) {
    this.setState({ breadcrumbVisualization: mode });
  }

  startBreadcrumbTracking() {
    breadcrumbService.startTracking();
    
    // Update breadcrumbs periodically
    this.breadcrumbInterval = setInterval(() => {
      if (this.state.showBreadcrumbs) {
        const breadcrumbs = breadcrumbService.getCurrentBreadcrumbs();
        this.setState({ currentBreadcrumbs: breadcrumbs });
      }
    }, 1000);
  }

  stopBreadcrumbTracking() {
    if (this.breadcrumbInterval) {
      clearInterval(this.breadcrumbInterval);
      this.breadcrumbInterval = null;
    }
    
    breadcrumbService.stopTracking();
  }

  componentDidMount() {
    // Load existing recordings first
    this.loadExistingRecordings();
    
    // Then load any additional data and update the map
    this.mapData.loadData().then(() => {
      // After loading data, get the complete GeoJSON including existing recordings
      const geoJson = this.mapData.getAudioRecordingsGeoJson();
      console.log('MapContainer: Component mounted, GeoJSON features count:', geoJson.features.length);
      this.setState({ geoJson: geoJson, loaded: true });
    }).catch(error => {
      console.error('Error loading map data:', error);
      // Even if mapData.loadData fails, we still want to show existing recordings
      const geoJson = this.mapData.getAudioRecordingsGeoJson();
      this.setState({ geoJson: geoJson, loaded: true });
    });
    
    // Add global playAudio function for popup buttons
    window.playAudio = this.handlePlayAudio;
    
    // Check for cached permission state first
    // [REMOVE REDUNDANT PERMISSION REQUESTS]
    // Remove checkCachedPermissionState and related permission request logic
    if (this.props.onRequestLocation) {
      this.props.onRequestLocation(); // Ensure location tracking starts automatically
    }

    // Start breadcrumb tracking if enabled
    if (this.state.showBreadcrumbs) {
      this.startBreadcrumbTracking();
    }
  }

  componentDidUpdate(prevProps) {
    // Automatically center map to userLocation when it changes
    if (
      this.props.userLocation &&
      (!prevProps.userLocation ||
        this.props.userLocation.lat !== prevProps.userLocation.lat ||
        this.props.userLocation.lng !== prevProps.userLocation.lng)
    ) {
      this.setState({
        center: {
          lat: this.props.userLocation.lat,
          lng: this.props.userLocation.lng,
        },
      });
      
      // Start breadcrumb tracking when user location becomes available
      if (this.state.showBreadcrumbs && !this.breadcrumbInterval) {
        this.startBreadcrumbTracking();
      }
    }
  }

  // New method to check cached permission state
  // [REMOVE REDUNDANT PERMISSION REQUESTS]
  // Remove checkCachedPermissionState and related permission request logic

  loadExistingRecordings() {
    try {
      const recordings = localStorageService.getAllRecordings();
      console.log('Found recordings in localStorage:', recordings.length);
      console.log('Raw recordings:', recordings);
      // Clear existing data first
      this.mapData.AudioRecordings.all = [];
      this.mapData.AudioRecordings.byId = {};
      recordings.forEach(recording => {
        console.log('Processing recording:', recording);
        if (recording.uniqueId && recording.location) {
          this.mapData.AudioRecordings.all.push(recording.uniqueId);
          this.mapData.AudioRecordings.byId[recording.uniqueId] = recording;
          console.log('✅ Loaded recording:', recording.uniqueId, recording.displayName || recording.filename);
          
          // Load breadcrumbs if available
          if (recording.breadcrumbs && recording.breadcrumbs.length > 0) {
            console.log('📍 Found breadcrumbs for recording:', recording.uniqueId, recording.breadcrumbs.length);
          }
        } else {
          console.warn('❌ Skipping recording without uniqueId or location:', recording);
          console.warn('  - uniqueId:', recording.uniqueId);
          console.warn('  - location:', recording.location);
        }
      });
      console.log('Successfully loaded recordings:', this.mapData.AudioRecordings.all.length);
      console.log('MapData AudioRecordings.all:', this.mapData.AudioRecordings.all);
      console.log('MapData AudioRecordings.byId keys:', Object.keys(this.mapData.AudioRecordings.byId));
    } catch (error) {
      console.error('Error loading existing recordings:', error);
    }
  }

  // Load breadcrumbs for a specific recording
  loadBreadcrumbsForRecording(recordingId) {
    const recording = this.mapData.AudioRecordings.byId[recordingId];
    if (recording && recording.breadcrumbs && recording.breadcrumbs.length > 0) {
      this.setState({ 
        currentBreadcrumbs: recording.breadcrumbs,
        showBreadcrumbs: true 
      });
      console.log('📍 Loaded breadcrumbs for recording:', recordingId, recording.breadcrumbs.length);
    } else {
      this.setState({ 
        currentBreadcrumbs: [],
        showBreadcrumbs: false 
      });
      console.log('📍 No breadcrumbs found for recording:', recordingId);
    }
  }

  componentWillUnmount() {
    locationService.stopLocationWatch();
    window.removeEventListener('online', this.handleOnlineStatus);
    window.removeEventListener('offline', this.handleOnlineStatus);
    
    // Stop breadcrumb tracking
    this.stopBreadcrumbTracking();
  }

  handleOnlineStatus = () => {
    this.setState({ isOnline: navigator.onLine });
  }

  async handleUploadPending() {
    const pending = localStorageService.getPendingUploads();
    for (const rec of pending) {
      // TODO: Replace with real upload logic
      // Simulate upload success
      localStorageService.markUploaded(rec.uniqueId);
    }
    this.setState({ pendingUploads: localStorageService.getPendingUploads() });
    alert('Grabaciones pendientes marcadas como subidas!');
  }

  render () {
    // Determine if AudioRecorder is recording
    const isRecording = this.state.isAudioRecorderVisible && this.audioRecorderIsRecording;
    // For now, mic is disabled if no GPS
    const isMicDisabled = !this.props.userLocation;
    return <div>
      {/* Pending uploads banner */}
      {this.state.pendingUploads.length > 0 && (
        <div style={{
          background: this.state.isOnline ? '#10B981' : '#F59E42',
          color: 'white',
          padding: '12px',
          textAlign: 'center',
          fontWeight: 600,
          marginBottom: 8
        }}>
          {this.state.isOnline
            ? <>
                {this.state.pendingUploads.length} grabación(es) pendiente(s) de subir.{' '}
                <button onClick={this.handleUploadPending} style={{ background: 'white', color: '#10B981', border: 'none', borderRadius: 4, padding: '4px 12px', fontWeight: 600, cursor: 'pointer' }}>Subir Ahora</button>
              </>
            : <>Estás sin conexión. {this.state.pendingUploads.length} grabación(es) se subirán cuando tengas conexión.</>
          }
        </div>
      )}
      <BaseMap
        geoJson={this.state.geoJson}
        loaded={this.state.loaded}
        updateSelectedPoint={this.updateSelectedPoint}
        animate={this.state.animate}
        center={this.state.center}
        selectedPoint={this.state.selectedPoint === null ? null : this.state.selectedPoint.uniqueId}
        searchResults = {this.state.searchResults}
        userLocation={this.props.userLocation}
        onPlayAudio={this.handlePlayAudio}
        onMapCreated={this.handleMapCreated}
        currentLayer={this.state.currentLayer}
        showBreadcrumbs={this.state.showBreadcrumbs}
        breadcrumbVisualization={this.state.breadcrumbVisualization}
        currentBreadcrumbs={this.state.currentBreadcrumbs}
      />
      <DetailView
        point={this.state.selectedPoint}
        getNextRecording = {this.getNextRecording}
        getPreviousRecording = {this.getPreviousRecording}
        searchMapData = {this.searchMapData}
      />
      <SharedTopBar 
        query={this.state.query} 
        searchMapData={this.searchMapData} 
        clearSearch={this.clearSearch} 
        toggleAudioRecorder={this.toggleAudioRecorder} 
        updateQuery={this.updateQuery}
        userLocation={this.props.userLocation}
        onBackToLanding={this.props.onBackToLanding}
        onLocationRefresh={this.handleLocationRefresh.bind(this)}
        onRequestGPSAccess={this.handleLocationRefresh.bind(this)}
        isRecording={this.state.isAudioRecorderVisible}
        isMicDisabled={isMicDisabled}
        mapInstance={this.state.mapInstance}
        onLayerChange={this.handleLayerChange}
        currentLayer={this.state.currentLayer}
        showBreadcrumbs={this.state.showBreadcrumbs}
        onToggleBreadcrumbs={this.toggleBreadcrumbs}
        breadcrumbVisualization={this.state.breadcrumbVisualization}
        onSetBreadcrumbVisualization={this.setBreadcrumbVisualization}
        showMicButton={true}
        showSearch={true}
        showZoomControls={true}
        showLayerSelector={true}
        showImportButton={false}
      />
      <AudioRecorder
        isVisible={this.state.isAudioRecorderVisible}
        onSaveRecording={this.handleSaveRecording}
        onCancel={this.toggleAudioRecorder}
        userLocation={this.props.userLocation}
        locationAccuracy={this.props.userLocation?.accuracy}
      />
      {/* Removed floating mic button, now in TopBar */}
    </div>
  }
}

export default MapContainer

