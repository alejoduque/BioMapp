// load all data, methods to get nearest
import config from './../config.json';
import lunr from 'lunr';
import lunrStemmerSupport from 'lunr-languages/lunr.stemmer.support';
import lunrEs from 'lunr-languages/lunr.es';

lunrStemmerSupport(lunr);
lunrEs(lunr);

class MapData  {
  constructor (props) {
    this.Puntos = {
      all: [],
      byId: {}
    }
    this.AudioRecordings = {
      all: [],
      byId: {}
    }
    this.features = []
    this.lunr = null
  }

  getAudioRecordingsGeoJson() {
    let features = []

    this.AudioRecordings.all.forEach((id) => {
      var recording = this.AudioRecordings.byId[id]
      
      // Handle new recording format with direct location data
      if (recording.location && recording.location.lat && recording.location.lng) {
        var recordingObj = Object.assign({}, {
          filename: recording.displayName || recording.filename,
          notes: recording.notes,
          speciesTags: recording.speciesTags || [],
          weather: recording.weather,
          temperature: recording.temperature,
          quality: recording.quality,
          duration: recording.duration,
          timestamp: recording.timestamp,
          uniqueId: recording.uniqueId,
          fileSize: recording.fileSize,
          mimeType: recording.mimeType
        })

        features.push({
          type: 'Feature',
          uniqueId: recording.uniqueId,
          properties: recordingObj,
          index: features.length,
          geometry: {
            type: 'Point',
            coordinates: [recording.location.lng, recording.location.lat]
          }
        })
      }
      // Handle legacy format with Puntos reference (for backward compatibility)
      else if(recording.fields && recording.fields.Puntos) {
        recording.fields.Puntos.forEach((puntoId) => {
          var punto = this.Puntos.byId[puntoId]
          if (punto && punto.fields.Longitude && punto.fields.Latitude) {
            
            var recordingObj = Object.assign({}, {
              filename: recording.fields.filename,
              notes: recording.fields.notes,
              speciesTags: recording.fields.speciesTags,
              weather: recording.fields.weather,
              temperature: recording.fields.temperature,
              quality: recording.fields.quality,
              duration: recording.fields.duration,
              timestamp: recording.fields.timestamp,
              punto: punto.fields.Nombre,
              createdTime: recording.createdTime,
              uniqueId: recording.id + punto.id
            })

            features.push({
              type: 'Feature',
              uniqueId: recording.id + punto.id,
              properties: recordingObj,
              index: features.length,
              geometry: {
                type: 'Point',
                coordinates: [punto.fields.Longitude, punto.fields.Latitude]
              }
            })
          }
        })
      }
    })
    
    this.features = features

    this.lunr = lunr( function() {
      this.use(lunr.es)
      this.ref('uniqueId')
      this.field('filename')
      this.field('notes')
      this.field('speciesTags')

      features.forEach((feature) => {
        this.add(feature.properties)
      })
    })

    return {
      type: 'FeatureCollection',
      features: features
    }
  }

  searchData(query) {
    console.log('query', query)
    return this.lunr.search(query)
  }

  loadData() {
    // Load audio recordings data
    return Promise.resolve();
  }

  getCoordinatesFromRecordingArray (recordings) {
    let puntos = []
    recordings.forEach((recording) => {
       if(recording.item.fields.Puntos && recording.item.fields.Puntos.length > 0) puntos.push(recording.item.fields.Puntos[0])
    })
      if (puntos.length > 0) {
        let p = this.Puntos.byId[puntos[0]]
        console.log('p', p)
        return [p.fields.Longitude, p.fields.Latitude]
      }
      return null
  }

  getPuntoFromRecordingArray (recordings) {
    let puntos = []
    recordings.forEach((recording) => {
       if(recording.item.fields.Puntos && recording.item.fields.Puntos.length > 0) puntos.push(recording.item.fields.Puntos[0])
    })
      if (puntos.length > 0) {
        return this.Puntos.byId[puntos[0]]
      }
      return null
  }

  sortByDistance(point) {
    // Sort recordings by distance from given point
    return this.features.sort((a, b) => {
      const distA = this.getDistance(point, a.geometry.coordinates)
      const distB = this.getDistance(point, b.geometry.coordinates)
      return distA - distB
    })
  }

  getDistance(point1, point2) {
    const R = 6371 // Earth's radius in km
    const dLat = (point2[1] - point1[1]) * Math.PI / 180
    const dLon = (point2[0] - point1[0]) * Math.PI / 180
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(point1[1] * Math.PI / 180) * Math.cos(point2[1] * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
    return R * c
  }

  getRecordingsInBounds(bounds) {
    return this.features.filter(feature => {
      const coords = feature.geometry.coordinates
      return coords[0] >= bounds[0] && coords[0] <= bounds[2] &&
             coords[1] >= bounds[1] && coords[1] <= bounds[3]
    })
  }
}

export default MapData
