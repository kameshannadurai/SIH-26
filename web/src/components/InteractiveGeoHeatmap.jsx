import React, { useState, useMemo } from 'react';

// Comprehensive geographical coordinates for Tamil Nadu districts and state projections
export const TAMIL_NADU_BOUNDS = {
  minLat: 7.9,
  maxLat: 13.6,
  minLng: 76.1,
  maxLng: 80.5,
};

export const DISTRICT_COORDINATES = {
  "Tamil Nadu": {
    "Chennai": { lat: 13.0827, lng: 80.2707 },
    "Tiruvallur": { lat: 13.1437, lng: 79.9083 },
    "Kanchipuram": { lat: 12.8342, lng: 79.7036 },
    "Chengalpattu": { lat: 12.6841, lng: 79.9836 },
    "Vellore": { lat: 12.9165, lng: 79.1325 },
    "Ranipet": { lat: 12.9272, lng: 79.3331 },
    "Tirupathur": { lat: 12.4939, lng: 78.5678 },
    "Tiruvannamalai": { lat: 12.2253, lng: 79.0747 },
    "Viluppuram": { lat: 11.9401, lng: 79.4861 },
    "Kallakurichi": { lat: 11.7383, lng: 78.9639 },
    "Cuddalore": { lat: 11.7480, lng: 79.7714 },
    "Salem": { lat: 11.6643, lng: 78.1460 },
    "Namakkal": { lat: 11.2189, lng: 78.1674 },
    "Dharmapuri": { lat: 12.1211, lng: 78.1582 },
    "Krishnagiri": { lat: 12.5186, lng: 78.2137 },
    "Erode": { lat: 11.3410, lng: 77.7172 },
    "Tiruppur": { lat: 11.1085, lng: 77.3411 },
    "Coimbatore": { lat: 11.0168, lng: 76.9558 },
    "Nilgiris": { lat: 11.4102, lng: 76.6950 },
    "Dindigul": { lat: 10.3673, lng: 77.9803 },
    "Karur": { lat: 10.9601, lng: 78.0766 },
    "Tiruchirappalli": { lat: 10.7905, lng: 78.7047 },
    "Perambalur": { lat: 11.2342, lng: 78.8805 },
    "Ariyalur": { lat: 11.1401, lng: 79.0786 },
    "Thanjavur": { lat: 10.7870, lng: 79.1378 },
    "Tiruvarur": { lat: 10.7725, lng: 79.6365 },
    "Nagapattinam": { lat: 10.7672, lng: 79.8449 },
    "Mayiladuthurai": { lat: 11.1075, lng: 79.6523 },
    "Pudukkottai": { lat: 10.3797, lng: 78.8208 },
    "Sivaganga": { lat: 9.8433, lng: 78.4809 },
    "Madurai": { lat: 9.9252, lng: 78.1198 },
    "Theni": { lat: 10.0104, lng: 77.4768 },
    "Virudhunagar": { lat: 9.5872, lng: 77.9514 },
    "Ramanathapuram": { lat: 9.3639, lng: 78.8395 },
    "Thoothukudi": { lat: 8.7642, lng: 78.1348 },
    "Tirunelveli": { lat: 8.7139, lng: 77.7567 },
    "Tenkasi": { lat: 8.9594, lng: 77.3152 },
    "Kanniyakumari": { lat: 8.0883, lng: 77.5385 }
  }
};

// Simplified SVG state contour polygon for Tamil Nadu
const TN_OUTLINE_POINTS = [
  [80.15, 13.45], [80.32, 13.08], [80.20, 12.55], [79.85, 11.85],
  [79.85, 11.20], [79.88, 10.75], [79.35, 10.30], [79.15, 9.45],
  [78.75, 9.25], [78.25, 8.80], [77.75, 8.35], [77.55, 8.08],
  [77.30, 8.25], [77.20, 8.75], [77.35, 9.45], [77.05, 10.15],
  [76.85, 10.85], [76.60, 11.45], [77.10, 11.85], [77.55, 12.15],
  [77.95, 12.65], [78.45, 12.85], [79.15, 13.15], [79.85, 13.55],
  [80.15, 13.45]
];

export function InteractiveGeoHeatmap({
  state = 'Tamil Nadu',
  districtData = [],
  selectedDistrict,
  onSelectDistrict,
  darkMode = true
}) {
  const [hoveredDistrict, setHoveredDistrict] = useState(null);
  const [mapMode, setMapMode] = useState('HEATMAP'); // 'HEATMAP' or 'CLUSTERS'
  const [showRadar, setShowRadar] = useState(true);

  const width = 640;
  const height = 520;
  const padding = 45;

  // Convert lat/lng to SVG x,y coordinates
  const bounds = useMemo(() => {
    if (state === 'Tamil Nadu') return TAMIL_NADU_BOUNDS;
    if (districtData.length === 0) return TAMIL_NADU_BOUNDS;
    
    let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
    districtData.forEach(d => {
      if (d.center_lat) {
        minLat = Math.min(minLat, d.center_lat);
        maxLat = Math.max(maxLat, d.center_lat);
      }
      if (d.center_lng) {
        minLng = Math.min(minLng, d.center_lng);
        maxLng = Math.max(maxLng, d.center_lng);
      }
    });
    return {
      minLat: minLat - 0.5,
      maxLat: maxLat + 0.5,
      minLng: minLng - 0.5,
      maxLng: maxLng + 0.5
    };
  }, [state, districtData]);

  const project = (lat, lng) => {
    const x = padding + ((lng - bounds.minLng) / (bounds.maxLng - bounds.minLng)) * (width - padding * 2);
    // Invert Y because SVG coordinates increase downwards
    const y = height - (padding + ((lat - bounds.minLat) / (bounds.maxLat - bounds.minLat)) * (height - padding * 2));
    return { x, y };
  };

  // Build points with coordinates
  const mappedDistricts = useMemo(() => {
    const coordsMap = DISTRICT_COORDINATES[state] || {};
    return districtData.map(d => {
      const known = coordsMap[d.district] || {};
      const lat = d.center_lat || known.lat || 11.5;
      const lng = d.center_lng || known.lng || 78.5;
      const { x, y } = project(lat, lng);
      
      // Calculate heat radius & intensity
      const count = d.count || 0;
      const risk = d.avg_risk_score || 0;
      const radius = Math.min(75, Math.max(32, 28 + count * 9 + (risk / 100) * 18));
      
      let heatColor = '#10b981'; // green
      let glowColor = 'rgba(16, 185, 129, 0.4)';
      let pulseColor = '#10b981';

      if (count >= 4 || risk >= 75) {
        heatColor = '#ef4444'; // red critical
        glowColor = 'rgba(239, 68, 68, 0.55)';
        pulseColor = '#ef4444';
      } else if (count >= 2 || risk >= 50) {
        heatColor = '#f59e0b'; // amber/orange
        glowColor = 'rgba(245, 158, 11, 0.5)';
        pulseColor = '#f59e0b';
      }

      return {
        ...d,
        lat,
        lng,
        x,
        y,
        radius,
        heatColor,
        glowColor,
        pulseColor
      };
    });
  }, [state, districtData, bounds]);

  // Convert outline points to SVG path
  const statePath = useMemo(() => {
    if (state !== 'Tamil Nadu') return null;
    return TN_OUTLINE_POINTS.map((pt, i) => {
      const { x, y } = project(pt[1], pt[0]);
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ') + ' Z';
  }, [state, bounds]);

  const totalComplaintsInState = districtData.reduce((acc, curr) => acc + (curr.count || 0), 0);

  return (
    <div className={`interactive-heatmap-widget ${darkMode ? 'dark' : ''}`}>
      {/* Heatmap Top Toolbar */}
      <div className="heatmap-widget-header">
        <div className="heatmap-widget-title">
          <span className="live-radar-dot"></span>
          <h4>Live Geospatial Thermal Heatmap</h4>
          <span className="state-tag">{state}</span>
        </div>

        <div className="heatmap-widget-actions">
          <div className="mode-toggle-group">
            <button
              type="button"
              className={`mode-btn ${mapMode === 'HEATMAP' ? 'active' : ''}`}
              onClick={() => setMapMode('HEATMAP')}
              title="View Continuous Thermal Heat Blurs"
            >
              🔥 Thermal
            </button>
            <button
              type="button"
              className={`mode-btn ${mapMode === 'CLUSTERS' ? 'active' : ''}`}
              onClick={() => setMapMode('CLUSTERS')}
              title="View District Hotspot Clusters"
            >
              📍 Hotspots
            </button>
          </div>

          <button
            type="button"
            className={`radar-btn ${showRadar ? 'active' : ''}`}
            onClick={() => setShowRadar(!showRadar)}
            title="Toggle Live Surveillance Radar Scan"
          >
            📡 Radar
          </button>

          {selectedDistrict && (
            <button
              type="button"
              className="clear-filter-btn"
              onClick={() => onSelectDistrict && onSelectDistrict(null)}
              title="Reset district filter"
            >
              Clear Filter ✕
            </button>
          )}
        </div>
      </div>

      {/* SVG Canvas Map Display */}
      <div className="heatmap-canvas-container">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="heatmap-svg"
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            {/* Gaussian Blur for Thermal Glow */}
            <filter id="thermalBlur" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="16" result="blur" />
              <feColorMatrix
                in="blur"
                type="matrix"
                values="
                  1 0 0 0 0
                  0 1 0 0 0
                  0 0 1 0 0
                  0 0 0 18 -5"
                result="contrast"
              />
              <feBlend in="SourceGraphic" in2="contrast" />
            </filter>

            <filter id="softGlow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="8" result="glow" />
              <feComposite in="SourceGraphic" in2="glow" operator="over" />
            </filter>

            {/* Heat Gradients for Nodes */}
            {mappedDistricts.map((d, i) => (
              <radialGradient key={`grad-${i}`} id={`heat-grad-${i}`} cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor={d.heatColor} stopOpacity="0.85" />
                <stop offset="45%" stopColor={d.heatColor} stopOpacity="0.5" />
                <stop offset="75%" stopColor={d.heatColor} stopOpacity="0.2" />
                <stop offset="100%" stopColor={d.heatColor} stopOpacity="0" />
              </radialGradient>
            ))}

            {/* Grid Pattern for High-tech Geo Grid */}
            <pattern id="geoGrid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.5" strokeOpacity="0.08" />
            </pattern>
          </defs>

          {/* Background Grid */}
          <rect width={width} height={height} fill="url(#geoGrid)" />

          {/* Coordinate Guides */}
          <g className="geo-guides" opacity="0.4" fontSize="10" fontFamily="monospace">
            <text x="15" y="25">13.5°N</text>
            <text x="15" y={height / 2}>11.0°N</text>
            <text x="15" y={height - 15}>8.5°N</text>
            <text x={width - 55} y={height - 15}>80.0°E</text>
            <text x={width / 2 - 20} y={height - 15}>78.5°E</text>
            <text x="70" y={height - 15}>77.0°E</text>
          </g>

          {/* State Outline Silhouette */}
          {statePath && (
            <path
              d={statePath}
              className="state-boundary-contour"
              fill={darkMode ? 'rgba(30, 27, 75, 0.45)' : 'rgba(238, 242, 255, 0.65)'}
              stroke="var(--color-primary)"
              strokeWidth="1.8"
              strokeDasharray="4 2"
              opacity="0.85"
            />
          )}

          {/* Radar Surveillance Scan Effect */}
          {showRadar && (
            <g className="radar-sweep-group" pointerEvents="none">
              <circle
                cx={width / 2}
                cy={height / 2}
                r={height * 0.46}
                fill="none"
                stroke="var(--color-primary)"
                strokeWidth="1"
                strokeOpacity="0.2"
                strokeDasharray="6 4"
              />
              <circle
                cx={width / 2}
                cy={height / 2}
                r={height * 0.28}
                fill="none"
                stroke="var(--color-primary)"
                strokeWidth="1"
                strokeOpacity="0.15"
              />
              <line
                x1={width / 2}
                y1={height / 2}
                x2={width / 2}
                y2={height * 0.04}
                stroke="var(--color-primary)"
                strokeWidth="2"
                strokeOpacity="0.6"
                className="radar-beam"
              />
            </g>
          )}

          {/* LAYER 1: THERMAL HEATMAP EMITTERS (Active in HEATMAP mode) */}
          {mapMode === 'HEATMAP' && (
            <g className="thermal-emitters-layer" filter="url(#thermalBlur)">
              {mappedDistricts.map((d, i) => (
                <circle
                  key={`emitter-${d.district}`}
                  cx={d.x}
                  cy={d.y}
                  r={d.radius * 1.3}
                  fill={`url(#heat-grad-${i})`}
                />
              ))}
            </g>
          )}

          {/* LAYER 2: INTERACTIVE DISTRICT HOTSPOT NODES */}
          <g className="hotspot-nodes-layer">
            {mappedDistricts.map((d) => {
              const isSelected = selectedDistrict === d.district;
              const isHovered = hoveredDistrict?.district === d.district;

              return (
                <g
                  key={`node-${d.district}`}
                  className={`hotspot-node ${isSelected ? 'selected' : ''} ${isHovered ? 'hovered' : ''}`}
                  transform={`translate(${d.x}, ${d.y})`}
                  onClick={() => onSelectDistrict && onSelectDistrict(isSelected ? null : d.district)}
                  onMouseEnter={() => setHoveredDistrict(d)}
                  onMouseLeave={() => setHoveredDistrict(null)}
                  style={{ cursor: 'pointer' }}
                >
                  {/* Outer Pulsing Wave Ring */}
                  <circle
                    r={isSelected ? 26 : 18}
                    fill="none"
                    stroke={d.pulseColor}
                    strokeWidth={isSelected ? '2.5' : '1.8'}
                    className="pulse-ring"
                    opacity="0.8"
                  />

                  {/* Node Background Glow */}
                  <circle
                    r={isSelected ? 16 : 13}
                    fill={d.heatColor}
                    filter="url(#softGlow)"
                    opacity="0.9"
                  />

                  {/* Core Pin Center */}
                  <circle
                    r={isSelected ? 9 : 7}
                    fill="#ffffff"
                    stroke={d.heatColor}
                    strokeWidth="2"
                  />

                  {/* Number of Active Complaints inside pin */}
                  <text
                    y="3.5"
                    textAnchor="middle"
                    fill="#0f172a"
                    fontSize={isSelected ? '10' : '8.5'}
                    fontWeight="900"
                    fontFamily="sans-serif"
                  >
                    {d.count}
                  </text>

                  {/* District Label Text */}
                  <g transform="translate(0, 22)">
                    <rect
                      x={- (d.district.length * 3.6 + 8)}
                      y="-11"
                      width={d.district.length * 7.2 + 16}
                      height="16"
                      rx="8"
                      fill={darkMode ? 'rgba(15, 23, 42, 0.85)' : 'rgba(255, 255, 255, 0.9)'}
                      stroke={isSelected ? d.heatColor : 'var(--border-color)'}
                      strokeWidth={isSelected ? '1.5' : '0.8'}
                    />
                    <text
                      y="1"
                      textAnchor="middle"
                      fill={isSelected ? d.heatColor : 'var(--text-primary)'}
                      fontSize="9"
                      fontWeight={isSelected ? '800' : '700'}
                      fontFamily="sans-serif"
                    >
                      {d.district}
                    </text>
                  </g>
                </g>
              );
            })}
          </g>
        </svg>

        {/* Floating Tooltip Card on Hover */}
        {hoveredDistrict && (
          <div
            className="heatmap-hover-tooltip"
            style={{
              left: `${Math.min(width - 220, Math.max(20, hoveredDistrict.x + 15))}px`,
              top: `${Math.min(height - 180, Math.max(20, hoveredDistrict.y - 40))}px`,
            }}
          >
            <div className="tooltip-header">
              <strong>{hoveredDistrict.district}</strong>
              <span className={`tooltip-badge ${hoveredDistrict.density_level.toLowerCase()}`}>
                {hoveredDistrict.density_level}
              </span>
            </div>
            <div className="tooltip-body">
              <div className="tooltip-row">
                <span>Active Complaints:</span>
                <strong>{hoveredDistrict.count} ({totalComplaintsInState > 0 ? Math.round((hoveredDistrict.count / totalComplaintsInState) * 100) : 0}%)</strong>
              </div>
              <div className="tooltip-row">
                <span>Avg Risk Score:</span>
                <strong style={{ color: hoveredDistrict.heatColor }}>
                  {hoveredDistrict.avg_risk_score} / 100
                </strong>
              </div>
              <div className="tooltip-row">
                <span>Coordinates:</span>
                <code>{hoveredDistrict.lat.toFixed(2)}°N, {hoveredDistrict.lng.toFixed(2)}°E</code>
              </div>
              <div className="tooltip-progress-wrap">
                <div
                  className="tooltip-progress-bar"
                  style={{
                    width: `${hoveredDistrict.avg_risk_score}%`,
                    backgroundColor: hoveredDistrict.heatColor
                  }}
                />
              </div>
              <p className="tooltip-hint">Click to filter dashboard by this district</p>
            </div>
          </div>
        )}
      </div>

      {/* Heatmap Footer Legend & Metrics */}
      <div className="heatmap-widget-footer">
        <div className="heatmap-legend">
          <span className="legend-title">Heat Intensity:</span>
          <div className="legend-item">
            <span className="legend-dot critical"></span>
            <span>Critical Hotspot (&ge;4)</span>
          </div>
          <div className="legend-item">
            <span className="legend-dot elevated"></span>
            <span>Elevated (2-3)</span>
          </div>
          <div className="legend-item">
            <span className="legend-dot low"></span>
            <span>Monitored (1)</span>
          </div>
        </div>

        <div className="heatmap-coverage-stat">
          <span>Total Hotspots: <strong>{districtData.length} Districts</strong></span>
          <span>Active Complaints: <strong>{totalComplaintsInState} Cases</strong></span>
        </div>
      </div>
    </div>
  );
}
