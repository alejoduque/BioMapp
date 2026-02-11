import React, { useEffect, useRef, useState } from 'react';
import { Polyline, Circle, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';

// Add CSS for breadcrumb animations
const breadcrumbStyles = `
  @keyframes pulse {
    0% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.2); opacity: 0.7; }
    100% { transform: scale(1); opacity: 1; }
  }
  
  .breadcrumb-marker {
    animation: pulse 2s infinite;
  }
  
  .breadcrumb-marker div {
    transition: all 0.3s ease;
  }
`;

// Inject styles if not already present
if (!document.getElementById('breadcrumb-styles')) {
  const styleSheet = document.createElement('style');
  styleSheet.id = 'breadcrumb-styles';
  styleSheet.textContent = breadcrumbStyles;
  document.head.appendChild(styleSheet);
}

// Create custom icons for breadcrumb markers
const createBreadcrumbIcon = (isMoving, audioLevel, size = 12) => {
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

  return L.divIcon({
    className: 'breadcrumb-marker',
    html: `<div style="
      width: ${size}px;
      height: ${size}px;
      background-color: ${color};
      border: 3px solid white;
      border-radius: 50%;
      box-shadow: 0 3px 8px rgba(0,0,0,0.4);
      ${isMoving ? 'animation: pulse 2s infinite;' : ''}
    "></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2]
  });
};

// Create direction arrow icon
const createDirectionIcon = (direction, size = 16) => {
  return L.divIcon({
    className: 'direction-arrow',
    html: `<div style="
      width: ${size}px;
      height: ${size}px;
      background-color: #1F2937;
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
};

const BreadcrumbVisualization = ({ 
  breadcrumbs = [], 
  sessionData = null,
  visualizationMode = 'line', // 'line', 'heatmap', 'markers', 'animated'
  showMarkers = true,
  showDirectionArrows = false,
  lineColor = 'auto', // 'auto', 'time', 'audio', 'speed'
  lineWidth = 3,
  opacity = 0.8,
  onMarkerClick = null
}) => {
  const [animatedBreadcrumbs, setAnimatedBreadcrumbs] = useState([]);
  const animationRef = useRef(null);
  const animationSpeed = 100; // ms per breadcrumb

  // Generate line color based on mode
  const getLineColor = (breadcrumbs, mode) => {
    switch (mode) {
      case 'time':
        return (index) => {
          const elapsed = breadcrumbs[index].timestamp - breadcrumbs[0].timestamp;
          const total = breadcrumbs[breadcrumbs.length - 1].timestamp - breadcrumbs[0].timestamp;
          const ratio = elapsed / total;
          return `hsl(${ratio * 360}, 70%, 50%)`;
        };
      
      case 'audio':
        return (index) => {
          const audioLevel = breadcrumbs[index].audioLevel || 0;
          return `hsl(${audioLevel * 120}, 70%, ${50 + audioLevel * 20}%)`;
        };
      
      case 'speed':
        return (index) => {
          const speed = breadcrumbs[index].movementSpeed || 0;
          const maxSpeed = Math.max(...breadcrumbs.map(b => b.movementSpeed || 0));
          const ratio = maxSpeed > 0 ? speed / maxSpeed : 0;
          return `hsl(${ratio * 120}, 70%, 50%)`;
        };
      
      case 'auto':
      default:
        return (index) => {
          const isMoving = breadcrumbs[index].isMoving;
          const audioLevel = breadcrumbs[index].audioLevel || 0;
          
          if (isMoving) {
            if (audioLevel > 0.7) return '#EF4444'; // red
            if (audioLevel > 0.4) return '#F59E0B'; // amber
            return '#10B981'; // green
          } else {
            if (audioLevel > 0.7) return '#8B5CF6'; // purple
            if (audioLevel > 0.4) return '#EC4899'; // pink
            return '#6B7280'; // gray
          }
        };
    }
  };

  // Generate line width based on audio level
  const getLineWidth = (breadcrumbs, index) => {
    const audioLevel = breadcrumbs[index].audioLevel || 0;
    return Math.max(1, lineWidth * (0.5 + audioLevel * 0.5));
  };

  // Animated playback
  useEffect(() => {
    if (visualizationMode === 'animated' && breadcrumbs.length > 0) {
      let currentIndex = 0;
      
      const animate = () => {
        if (currentIndex < breadcrumbs.length) {
          setAnimatedBreadcrumbs(breadcrumbs.slice(0, currentIndex + 1));
          currentIndex++;
          animationRef.current = setTimeout(animate, animationSpeed);
        }
      };
      
      animate();
      
      return () => {
        if (animationRef.current) {
          clearTimeout(animationRef.current);
        }
      };
    } else {
      setAnimatedBreadcrumbs(breadcrumbs);
    }
  }, [breadcrumbs, visualizationMode]);

  // Cleanup animation on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        clearTimeout(animationRef.current);
      }
    };
  }, []);

  if (!breadcrumbs || breadcrumbs.length === 0) {
    return null;
  }

  const displayBreadcrumbs = visualizationMode === 'animated' ? animatedBreadcrumbs : breadcrumbs;
  const colorFunction = getLineColor(displayBreadcrumbs, lineColor);

  // Generate line segments with different colors/widths
  const generateLineSegments = () => {
    if (displayBreadcrumbs.length < 2) return [];

    const segments = [];
    for (let i = 0; i < displayBreadcrumbs.length - 1; i++) {
      const start = displayBreadcrumbs[i];
      const end = displayBreadcrumbs[i + 1];
      
      segments.push({
        positions: [[start.lat, start.lng], [end.lat, end.lng]],
        color: colorFunction(i),
        weight: getLineWidth(displayBreadcrumbs, i),
        opacity: opacity,
        index: i
      });
    }
    
    return segments;
  };

  // Generate heat map data
  const generateHeatMapData = () => {
    return displayBreadcrumbs.map(crumb => ({
      lat: crumb.lat,
      lng: crumb.lng,
      intensity: crumb.audioLevel || 0
    }));
  };

  // Render breadcrumb markers
  const renderMarkers = () => {
    if (!showMarkers || visualizationMode === 'heatmap') return null;

    return displayBreadcrumbs.map((crumb, index) => {
      const icon = createBreadcrumbIcon(
        crumb.isMoving, 
        crumb.audioLevel || 0,
        crumb.audioLevel > 0.7 ? 16 : 12
      );

      return (
        <Marker
          key={`breadcrumb-${index}`}
          position={[crumb.lat, crumb.lng]}
          icon={icon}
          eventHandlers={{
            click: () => onMarkerClick && onMarkerClick(crumb, index)
          }}
        >
          <Popup>
            <div style={{ minWidth: '200px' }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: 'bold' }}>
                Miga de pan #{index + 1}
              </h3>
              <p style={{ margin: '4px 0', fontSize: '12px' }}>
                <strong>Hora:</strong> {new Date(crumb.timestamp).toLocaleTimeString()}
              </p>
              <p style={{ margin: '4px 0', fontSize: '12px' }}>
                <strong>Nivel de audio:</strong> {Math.round((crumb.audioLevel || 0) * 100)}%
              </p>
              <p style={{ margin: '4px 0', fontSize: '12px' }}>
                <strong>En movimiento:</strong> {crumb.isMoving ? 'Sí' : 'No'}
              </p>
              {crumb.movementSpeed > 0 && (
                <p style={{ margin: '4px 0', fontSize: '12px' }}>
                  <strong>Velocidad:</strong> {Math.round(crumb.movementSpeed * 100) / 100} m/s
                </p>
              )}
              {crumb.direction !== null && (
                <p style={{ margin: '4px 0', fontSize: '12px' }}>
                  <strong>Dirección:</strong> {Math.round(crumb.direction)}°
                </p>
              )}
              {crumb.accuracy && (
                <p style={{ margin: '4px 0', fontSize: '12px' }}>
                  <strong>Precisión:</strong> ±{Math.round(crumb.accuracy)}m
                </p>
              )}
            </div>
          </Popup>
        </Marker>
      );
    });
  };

  // Render direction arrows
  const renderDirectionArrows = () => {
    if (!showDirectionArrows || displayBreadcrumbs.length < 2) return null;

    return displayBreadcrumbs.map((crumb, index) => {
      if (!crumb.direction || !crumb.isMoving) return null;

      const icon = createDirectionIcon(crumb.direction);

      return (
        <Marker
          key={`direction-${index}`}
          position={[crumb.lat, crumb.lng]}
          icon={icon}
        />
      );
    });
  };

  // Render line visualization
  const renderLines = () => {
    if (visualizationMode === 'markers' || visualizationMode === 'heatmap') return null;

    const segments = generateLineSegments();
    
    return segments.map((segment, index) => (
      <Polyline
        key={`line-${index}`}
        positions={segment.positions}
        color={segment.color}
        weight={segment.weight}
        opacity={segment.opacity}
        smoothFactor={1}
      />
    ));
  };

  // Render heat map circles
  const renderHeatMap = () => {
    if (visualizationMode !== 'heatmap') return null;

    const heatMapData = generateHeatMapData();
    
    return heatMapData.map((point, index) => {
      const radius = Math.max(5, 20 * point.intensity);
      const color = `hsl(${point.intensity * 120}, 70%, 50%)`;
      
      return (
        <Circle
          key={`heat-${index}`}
          center={[point.lat, point.lng]}
          radius={radius}
          pathOptions={{
            color: color,
            fillColor: color,
            fillOpacity: 0.3,
            weight: 1
          }}
        />
      );
    });
  };

  return (
    <>
      {renderLines()}
      {renderHeatMap()}
      {renderMarkers()}
      {renderDirectionArrows()}
    </>
  );
};

export default BreadcrumbVisualization; 