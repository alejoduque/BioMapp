// SharedMarkerUtils.js
// Utility for creating duration-based marker icons (used in both collector and SoundWalk interfaces)
import L from 'leaflet';

export function createDurationCircleIcon(duration) {
  const minDuration = 5, maxDuration = 120;
  const minRadius = 20, maxRadius = 80;
  const normalizedDuration = Math.max(minDuration, Math.min(maxDuration, duration || 10));
  const radius = minRadius + ((normalizedDuration - minDuration) / (maxDuration - minDuration)) * (maxRadius - minRadius);

  let color = '#3B82F6'; // blue
  if (normalizedDuration < 30) color = '#3B82F6';
  else if (normalizedDuration < 60) color = '#10B981';
  else color = '#EF4444';

  return L.divIcon({
    className: 'duration-circle-marker',
    html: `<div style="
      width: ${radius * 2}px; 
      height: ${radius * 2}px; 
      background-color: ${color}33; 
      border: 3px solid ${color}; 
      border-radius: 50%; 
      display: flex; 
      align-items: center; 
      justify-content: center;
      cursor: pointer;
      transition: all 0.2s ease;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      position: relative;
    ">
      <img src='/ultrared.png' style="
        width: 60%;
        height: 60%;
        object-fit: contain;
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: none;
        pointer-events: none;
        opacity: 0.85;
      " alt='mic' />
      <div style="
        position: absolute;
        bottom: -20px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0,0,0,0.8);
        color: white;
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 10px;
        white-space: nowrap;
      ">${Math.round(duration || 0)}s</div>
    </div>`,
    iconSize: [radius * 2, radius * 2 + 20],
    iconAnchor: [radius, radius],
  });
} 