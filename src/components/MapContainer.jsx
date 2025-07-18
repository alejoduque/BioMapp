import React from 'react';
import MapData from './MapData.js'
import BaseMap from './BaseMap.jsx'
import DetailView from './DetailView.jsx'
import TopBar from './TopBar.jsx'
import LocationPermission from './LocationPermission.jsx'
import config from '../config.json'
import localStorageService from '../services/localStorageService.js';
import AudioRecorder from '../services/AudioRecorder.tsx';
import locationService from '../services/locationService.js';

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
    }
    
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
      // Save to localStorage
      const recordingId = await localStorageService.saveRecording(recordingData.metadata, recordingData.audioBlob);
      
      // Reload recordings and update map state
      this.loadExistingRecordings();
      const geoJson = this.mapData.getAudioRecordingsGeoJson();
      this.setState({ 
        geoJson: geoJson, 
        isAudioRecorderVisible: false 
      });
      
      // Show success message
      alert(`Recording "${recordingData.metadata.displayName}" saved successfully!`);
    } catch (error) {
      alert('Failed to save recording. Please try again.');
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

  handleLocationGranted(position) {
    this.props.setUserLocation(position);
    this.props.setLocationPermission('granted');
    this.setState({
      center: { lat: position.lat, lng: position.lng },
      locationError: null,
      showLocationPermission: false,
    });
    this.props.setHasRequestedPermission(true);
    this.addTracklogPoint(position); // <-- Add to tracklog
    locationService.startLocationWatch(
      (newPosition) => {
        this.props.setUserLocation(newPosition);
        this.setState({
          center: { lat: newPosition.lat, lng: newPosition.lng }
        });
        this.addTracklogPoint(newPosition); // <-- Add to tracklog on every update
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
        // Get audio blob from localStorage
        const audioBlob = await localStorageService.getAudioBlob(recordingId);
        if (audioBlob) {
          // Create audio element and play
          const audio = new Audio(URL.createObjectURL(audioBlob));
          audio.play().catch(error => {
            console.error('Error playing audio:', error);
            alert('Could not play audio file');
          });
        } else {
          console.log('Audio blob not found for recording:', recordingId);
          alert('Audio file not available');
        }
      } else {
        console.log('Recording not found:', recordingId);
        alert('Recording not found');
      }
    } catch (error) {
      console.error('Error playing audio:', error);
      alert('Error playing audio file');
    }
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

  componentWillUnmount() {
    locationService.stopLocationWatch();
    window.removeEventListener('online', this.handleOnlineStatus);
    window.removeEventListener('offline', this.handleOnlineStatus);
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
    alert('Pending recordings marked as uploaded!');
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
                {this.state.pendingUploads.length} recording(s) pending upload.{' '}
                <button onClick={this.handleUploadPending} style={{ background: 'white', color: '#10B981', border: 'none', borderRadius: 4, padding: '4px 12px', fontWeight: 600, cursor: 'pointer' }}>Upload Now</button>
              </>
            : <>You are offline. {this.state.pendingUploads.length} recording(s) will upload when online.</>
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
      />
      <DetailView
        point={this.state.selectedPoint}
        getNextRecording = {this.getNextRecording}
        getPreviousRecording = {this.getPreviousRecording}
        searchMapData = {this.searchMapData}
      />
      <TopBar 
        query={this.state.query} 
        searchMapData={this.searchMapData} 
        clearSearch={this.clearSearch} 
        toggleAudioRecorder={this.toggleAudioRecorder} 
        updateQuery={this.updateQuery}
        userLocation={this.props.userLocation}
        onBackToLanding={this.props.onBackToLanding}
        onLocationRefresh={this.handleLocationRefresh.bind(this)}
        isRecording={this.state.isAudioRecorderVisible}
        isMicDisabled={isMicDisabled}
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

