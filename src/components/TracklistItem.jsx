import React from 'react';

const TracklistItem = ({ track, progress, isPlaying }) => {
  const progressPercent = (progress && progress.duration > 0)
    ? (progress.currentTime / progress.duration) * 100
    : 0;

  return (
    <div style={{
      marginBottom: '8px',
      padding: '8px',
      backgroundColor: isPlaying ? 'rgba(78, 78, 134, 0.15)' : 'transparent',
      borderRadius: '4px',
      transition: 'background-color 0.3s'
    }}>
      <div style={{
        fontSize: '14px',
        color: 'rgb(1 9 2 / 84%)',
        marginBottom: '4px',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      }}>
        {track.filename}
      </div>
      <div style={{
        height: '4px',
        backgroundColor: 'rgba(78, 78, 134, 0.22)',
        borderRadius: '2px',
        overflow: 'hidden'
      }}>
        <div style={{
          width: `${progressPercent}%`,
          height: '100%',
          backgroundColor: '#4e4e86',
          borderRadius: '2px',
          transition: 'width 0.1s linear'
        }} />
      </div>
    </div>
  );
};

export default TracklistItem;
