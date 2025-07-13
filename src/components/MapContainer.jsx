import React from 'react';
import MapData from './MapData.js'
import BaseMap from './BaseMap.jsx'
import DetailView from './DetailView.jsx'
import TopBar from './TopBar.jsx'
import LocationPermission from './LocationPermission.jsx'
import MicrophonePermissionModal from './MicrophonePermissionModal.jsx'
import config from '../config.json'
import localStorageService from '../services/localStorageService.js';
import AudioRecorder from '../services/AudioRecorder.tsx';
import locationService from '../services/locationService.js';
import microphonePermissionService from '../services/microphonePermissionService.js';

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
      locationPermission: 'unknown',
      userLocation: null,
      locationError: null,
      showLocationPermission: true,
      showMicrophonePermission: false,
      microphonePermission: 'unknown',
      pendingUploads: localStorageService.getPendingUploads(),
      isOnline: navigator.onLine,
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
    this.handleMicrophonePermissionGranted = this.handleMicrophonePermissionGranted.bind(this)
    this.handleMicrophonePermissionDenied = this.handleMicrophonePermissionDenied.bind(this)
    this.handleMicrophonePermissionClose = this.handleMicrophonePermissionClose.bind(this)
  }

  updateQuery(query) {
    this.setState({ query: query })
  }

  async toggleAudioRecorder() {
    // Check microphone permission before showing recorder
    const micStatus = await microphonePermissionService.getMicrophoneStatus();
    
    if (!micStatus.canRecord) {
      // Show microphone permission modal
      this.setState({ 
        showMicrophonePermission: true,
        microphonePermission: micStatus.hasPermission ? 'denied' : 'unknown'
      });
      return;
    }
    
    // Permission is good, show recorder
    this.setState({ isAudioRecorderVisible: !this.state.isAudioRecorderVisible });
  }

  async handleSaveRecording(recordingData) {
    try {
      console.log('Saving recording:', recordingData);
      
      // Save to localStorage
      const recordingId = await localStorageService.saveRecording(recordingData.metadata, recordingData.audioBlob);
      
      // Update the map data with the complete recording object
      this.mapData.AudioRecordings.all.push(recordingId);
      this.mapData.AudioRecordings.byId[recordingId] = recordingData.metadata;
      
      // Force a complete refresh of the map data
      const newGeoJson = this.mapData.getAudioRecordingsGeoJson();
      console.log('Updated GeoJSON features:', newGeoJson.features.length);
      
      // Update state to trigger re-render
      this.setState({ 
        geoJson: newGeoJson, 
        loaded: true 
      }, () => {
        console.log('Map state updated, features count:', this.state.geoJson.features.length);
      });
      
      console.log('Recording saved successfully:', recordingId);
      this.toggleAudioRecorder();
      
      // Show success message
      alert(`Recording "${recordingData.metadata.displayName}" saved successfully!`);
    } catch (error) {
      console.error('Error saving recording:', error);
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
    console.log('MapContainer: Location granted:', position);
    this.setState({
      center: { lat: position.lat, lng: position.lng },
      userLocation: position,
      locationPermission: 'granted',
      showLocationPermission: false,
      locationError: null
    }, () => {
      console.log('MapContainer: State updated with location:', this.state.userLocation);
    });

    // Start watching location updates
    locationService.startLocationWatch(
      (newPosition) => {
        console.log('MapContainer: Location update:', newPosition);
        this.setState({
          userLocation: newPosition,
          center: { lat: newPosition.lat, lng: newPosition.lng }
        }, () => {
          console.log('MapContainer: Location watch state updated:', this.state.userLocation);
        });
      },
      (error) => {
        console.error('MapContainer: Location watch error:', error);
        this.setState({ locationError: error.message });
      }
    );
  }

  handleLocationDenied(errorMessage) {
    console.log('Location denied:', errorMessage);
    this.setState({
      locationPermission: 'denied',
      showLocationPermission: false,
      locationError: errorMessage
    });
    
    // If user denied permission, we can still use the app with default location
    console.log('Using default location from config');
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
          userLocation: null
        });
      });
  }

  handleMicrophonePermissionGranted() {
    console.log('MapContainer: Microphone permission granted');
    this.setState({
      showMicrophonePermission: false,
      microphonePermission: 'granted',
      isAudioRecorderVisible: true
    });
  }

  handleMicrophonePermissionDenied(errorMessage) {
    console.log('MapContainer: Microphone permission denied:', errorMessage);
    this.setState({
      showMicrophonePermission: false,
      microphonePermission: 'denied'
    });
    alert('Microphone permission is required to record audio. You can enable it in your device settings.');
  }

  handleMicrophonePermissionClose() {
    console.log('MapContainer: Microphone permission modal closed');
    this.setState({
      showMicrophonePermission: false
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
    this.loadExistingRecordings();
    this.mapData.loadData().then(()=>{
      this.setState({ geoJson : this.mapData.getAudioRecordingsGeoJson(), loaded: true})
    })
    
    // Add global playAudio function for popup buttons
    window.playAudio = this.handlePlayAudio;
    
    // Request location on mount with better error handling
    console.log('MapContainer: Requesting location on mount...');
    locationService.requestLocation()
      .then((position) => {
        console.log('MapContainer: Location obtained on mount:', position);
        this.handleLocationGranted(position);
      })
      .catch((error) => {
        console.log('MapContainer: Location request failed on mount:', error.message);
        // Don't show error modal, just use default location
        this.setState({
          locationPermission: 'denied',
          showLocationPermission: false,
          locationError: error.message,
          userLocation: null // Explicitly set to null
        });
      });

    window.addEventListener('online', this.handleOnlineStatus);
    window.addEventListener('offline', this.handleOnlineStatus);
  }

  loadExistingRecordings() {
    try {
      const recordings = localStorageService.getAllRecordings();
      console.log('Found recordings in localStorage:', recordings.length);
      
      // Clear existing data first
      this.mapData.AudioRecordings.all = [];
      this.mapData.AudioRecordings.byId = {};
      
      recordings.forEach(recording => {
        if (recording.uniqueId && recording.location) {
          this.mapData.AudioRecordings.all.push(recording.uniqueId);
          this.mapData.AudioRecordings.byId[recording.uniqueId] = recording;
          console.log('Loaded recording:', recording.uniqueId, recording.displayName || recording.filename);
        } else {
          console.warn('Skipping recording without uniqueId or location:', recording);
        }
      });
      
      console.log('Successfully loaded recordings:', this.mapData.AudioRecordings.all.length);
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
        userLocation={this.state.userLocation}
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
        userLocation={this.state.userLocation}
        onBackToLanding={this.props.onBackToLanding}
        onLocationRefresh={this.handleLocationRefresh}
      />
      <AudioRecorder
        isVisible={this.state.isAudioRecorderVisible}
        onSaveRecording={this.handleSaveRecording}
        onCancel={this.toggleAudioRecorder}
        userLocation={this.state.userLocation}
        locationAccuracy={this.state.userLocation?.accuracy}
      />

      <MicrophonePermissionModal
        isVisible={this.state.showMicrophonePermission}
        onPermissionGranted={this.handleMicrophonePermissionGranted}
        onPermissionDenied={this.handleMicrophonePermissionDenied}
        onClose={this.handleMicrophonePermissionClose}
      />
    </div>
  }
}

export default MapContainer

