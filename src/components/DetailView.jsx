import React from 'react';

class DetailView extends React.Component {

  render () {
    var innerInfo = null
    if(this.props.point && this.props.point!== null) {
      var point = this.props.point.properties

      innerInfo =
      <div className="absolute w-full p-2 pt-4 md:pt-16 pin-b pin-l gradient flex items-center justify-center" style={{ height: "50%", backgroundColor: "rgba(0, 0, 0, 0.85)"}}>
        <i onClick={() => this.props.getPreviousRecording(this.props.point)} className="fas fa-chevron-left text-4xl text-white hover:text-black cursor-pointer m-2 md:m-12"></i>
        <div className="max-w-xl flex flex-col sm:flex-row flex items-start md:items-center h-full">
          <div className="h-1/2 p-4 text-black leading-normal pb-3 font-sans overflow-auto" style={{ flex:2 }}>
            <div className="text-lg font-semibold mb-2">🔊 {point.filename}</div>
            <div className="text-sm mb-3">
              <span className="font-medium">Duration:</span> {point.duration}s | 
              <span className="font-medium ml-2">Quality:</span> {point.quality} |
              <span className="font-medium ml-2">Date:</span> {new Date(point.timestamp).toLocaleDateString()}
            </div>
            {point.notes && (
              <div className="mb-3">
                <span className="font-medium">Description:</span> {point.notes}
              </div>
            )}
            {point.speciesTags && point.speciesTags.length > 0 && (
              <div className="mb-3">
                <span className="font-medium">Species:</span> {point.speciesTags.join(', ')}
              </div>
            )}
            {(point.weather || point.temperature) && (
              <div className="mb-3">
                {point.weather && <><span className="font-medium">Weather:</span> {point.weather}</>}
                {point.temperature && <><span className="font-medium ml-2">Temperature:</span> {point.temperature}</>}
              </div>
            )}
          </div>
          <div className="p-4 text-large font-sans text-white flex-1">
              <div className="text-lg md:text-4xl mb-6">
                📍 GPS Location
              </div>
              <div className="text-sm opacity-75">
                {this.props.point.geometry.coordinates[1].toFixed(6)}, {this.props.point.geometry.coordinates[0].toFixed(6)}
              </div>
              {/* Removed location name - will show actual GPS coordinates instead */}
              {point.timestamp && (
                <div className="text-xs opacity-75 mt-2">
                  {new Date(point.timestamp).toLocaleString()}
                </div>
              )}
          </div>
        </div>
        <i onClick={() => this.props.getNextRecording(this.props.point)} className="fas fa-chevron-right text-4xl text-white hover:text-black cursor-pointer m-2 md:m-12"></i>
      </div>
    }
    return innerInfo

  }
}

export default DetailView
