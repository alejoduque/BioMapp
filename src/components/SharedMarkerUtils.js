/**
 * SharedMarkerUtils.js
 * Unified marker creation utilities for all BioMapp components
 * Consolidates marker logic to eliminate duplication across components
 */
import L from 'leaflet';

/**
 * Create duration-based circle icon for audio recordings
 * @param {number} duration - Recording duration in seconds
 * @param {Object} options - Customization options
 * @returns {L.DivIcon} Leaflet div icon
 */
export function createDurationCircleIcon(duration, options = {}) {
  const {
    minDuration = 5,
    maxDuration = 120,
    minRadius = 20,
    maxRadius = 80,
    showDuration = true,
    iconImage = '/ultrared.png',
    hoverEffect = true
  } = options;

  const normalizedDuration = Math.max(minDuration, Math.min(maxDuration, duration || 10));
  const radius = minRadius + ((normalizedDuration - minDuration) / (maxDuration - minDuration)) * (maxRadius - minRadius);

  // Color gradient based on duration
  let color = '#3B82F6'; // blue (default)
  if (normalizedDuration < 30) color = '#3B82F6'; // blue (short)
  else if (normalizedDuration < 60) color = '#10B981'; // green (medium)
  else color = '#EF4444'; // red (long)

  const hoverStyles = hoverEffect ?
    `onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'"` : '';

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
    " ${hoverStyles}>
      <img src='${iconImage}' style="
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
      " alt='recording' />
      ${showDuration ? `<div style="
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
      ">${Math.round(duration || 0)}s</div>` : ''}
    </div>`,
    iconSize: [radius * 2, radius * 2 + (showDuration ? 20 : 0)],
    iconAnchor: [radius, radius],
    popupAnchor: [0, -radius - (showDuration ? 10 : 0)]
  });
}

/**
 * Create user location icon
 * @param {Object} options - Customization options
 * @returns {L.DivIcon} Leaflet div icon
 */
export function createUserLocationIcon(options = {}) {
  const {
    size = 24,
    color = '#3B82F6',
    accuracy = null,
    pulsing = true
  } = options;

  const pulseAnimation = pulsing ? 'animation: user-location-pulse 2s infinite;' : '';

  return L.divIcon({
    className: 'user-location-marker',
    html: `<div style="
      background-color: ${color};
      width: ${size}px;
      height: ${size}px;
      border-radius: 50%;
      border: 4px solid white;
      box-shadow: 0 0 0 3px ${color}, 0 4px 8px rgba(0,0,0,0.3);
      position: relative;
      ${pulseAnimation}
    ">
      <div style="
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: ${size * 0.33}px;
        height: ${size * 0.33}px;
        background-color: white;
        border-radius: 50%;
      "></div>
      ${accuracy ? `<div style="
        position: absolute;
        bottom: -18px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0,0,0,0.8);
        color: white;
        padding: 1px 4px;
        border-radius: 3px;
        font-size: 9px;
        white-space: nowrap;
      ">±${Math.round(accuracy)}m</div>` : ''}
    </div>`,
    iconSize: [size, size + (accuracy ? 18 : 0)],
    iconAnchor: [size / 2, size / 2]
  });
}

/**
 * Create breadcrumb marker icon
 * @param {boolean} isMoving - Whether the user was moving
 * @param {number} audioLevel - Audio level (0-1)
 * @param {Object} options - Customization options
 * @returns {L.DivIcon} Leaflet div icon
 */
export function createBreadcrumbIcon(isMoving, audioLevel = 0, options = {}) {
  const {
    size = 8,
    showPulse = true
  } = options;

  // Color based on movement and audio level
  let color = '#3B82F6'; // blue (default)
  
  if (isMoving) {
    if (audioLevel > 0.7) color = '#EF4444'; // red (high audio, moving)
    else if (audioLevel > 0.4) color = '#F59E0B'; // amber (medium audio, moving)
    else color = '#10B981'; // green (low audio, moving)
  } else {
    if (audioLevel > 0.7) color = '#8B5CF6'; // purple (high audio, stationary)
    else if (audioLevel > 0.4) color = '#EC4899'; // pink (medium audio, stationary)
    else color = '#6B7280'; // gray (low audio, stationary)
  }

  const pulseStyle = (isMoving && showPulse) ? 'animation: breadcrumb-pulse 2s infinite;' : '';

  return L.divIcon({
    className: 'breadcrumb-marker',
    html: `<div style="
      width: ${size}px;
      height: ${size}px;
      background-color: ${color};
      border: 2px solid white;
      border-radius: 50%;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      ${pulseStyle}
    "></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2]
  });
}

/**
 * Create direction arrow icon for breadcrumbs
 * @param {number} direction - Direction in degrees (0-360)
 * @param {Object} options - Customization options
 * @returns {L.DivIcon} Leaflet div icon
 */
export function createDirectionIcon(direction, options = {}) {
  const {
    size = 16,
    color = '#1F2937'
  } = options;

  return L.divIcon({
    className: 'direction-arrow',
    html: `<div style="
      width: ${size}px;
      height: ${size}px;
      background-color: ${color};
      border: 2px solid white;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      transform: rotate(${direction}deg);
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    ">
      <div style="
        width: 0;
        height: 0;
        border-left: 4px solid transparent;
        border-right: 4px solid transparent;
        border-bottom: 8px solid white;
        margin-top: -2px;
      "></div>
    </div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2]
  });
}

/**
 * Create custom pin icon (for selected recordings, etc.)
 * @param {string} iconUrl - URL to icon image
 * @param {Object} options - Customization options
 * @returns {L.Icon} Leaflet icon
 */
export function createCustomIcon(iconUrl, options = {}) {
  const {
    size = [32, 32],
    anchor = [16, 32],
    popupAnchor = [0, -32]
  } = options;

  return L.icon({
    iconUrl,
    iconSize: size,
    iconAnchor: anchor,
    popupAnchor: popupAnchor,
  });
}

/**
 * Get marker color based on audio properties
 * @param {number} duration - Recording duration
 * @param {number} audioLevel - Audio level (0-1)
 * @param {string} quality - Recording quality
 * @returns {string} Hex color code
 */
export function getMarkerColor(duration, audioLevel = 0, quality = 'medium') {
  // Primary color based on duration
  let baseColor;
  if (duration < 30) baseColor = '#3B82F6'; // blue (short)
  else if (duration < 60) baseColor = '#10B981'; // green (medium)
  else baseColor = '#EF4444'; // red (long)

  // Modify based on quality
  if (quality === 'high') {
    // Slightly brighter
    return baseColor;
  } else if (quality === 'low') {
    // Slightly darker
    return baseColor + '80'; // Add transparency
  }

  return baseColor;
}

// CSS animations (to be added to global styles)
export const markerAnimations = `
@keyframes user-location-pulse {
  0% { box-shadow: 0 0 0 3px #3B82F6, 0 4px 8px rgba(0,0,0,0.3); }
  50% { box-shadow: 0 0 0 6px #3B82F680, 0 4px 8px rgba(0,0,0,0.3); }
  100% { box-shadow: 0 0 0 3px #3B82F6, 0 4px 8px rgba(0,0,0,0.3); }
}

@keyframes breadcrumb-pulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.2); }
  100% { transform: scale(1); }
}

.duration-circle-marker:hover {
  z-index: 1000;
}

.user-location-marker {
  z-index: 999;
}

.breadcrumb-marker {
  z-index: 500;
}

.direction-arrow {
  z-index: 501;
}
`;