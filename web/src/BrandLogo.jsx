export function BrandLogo({ darkMode, height = 42, style = {} }) {
  const textColor = darkMode ? '#f8fafc' : '#111827';
  const purpleColor = '#a78bfa';
  const qrPurple = '#c084fc';

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', height: `${height}px`, userSelect: 'none', ...style }}>
      <svg
        viewBox="0 0 320 80"
        height={height}
        width={height * 4}
        style={{ display: 'block', height: '100%', width: 'auto', overflow: 'visible' }}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* QR Code Matrix Elements */}
        <g stroke={qrPurple} strokeWidth="3" fill="none">
          {/* Top-Left QR Corner */}
          <rect x="6" y="8" width="22" height="22" rx="3" />
          <rect x="12" y="14" width="10" height="10" fill={qrPurple} />

          {/* Top-Right QR Corner */}
          <rect x="52" y="8" width="22" height="22" rx="3" />
          <rect x="58" y="14" width="10" height="10" fill={qrPurple} />

          {/* Bottom-Left QR Corner */}
          <rect x="6" y="50" width="22" height="22" rx="3" />
          <rect x="12" y="56" width="10" height="10" fill={qrPurple} />

          {/* Corner / Matrix Data Bits */}
          <rect x="34" y="8" width="5" height="5" fill={qrPurple} stroke="none" />
          <rect x="42" y="8" width="5" height="5" fill={qrPurple} stroke="none" />
          <rect x="6" y="36" width="5" height="5" fill={qrPurple} stroke="none" />
          <rect x="69" y="36" width="5" height="5" fill={qrPurple} stroke="none" />
          <rect x="46" y="52" width="6" height="6" fill={qrPurple} stroke="none" />
          <rect x="62" y="60" width="6" height="6" fill={qrPurple} stroke="none" />
          <rect x="54" y="68" width="6" height="6" fill={qrPurple} stroke="none" />
        </g>

        {/* Center 3D Isometric Metrology Scale */}
        <g transform="translate(40, 40)">
          {/* Central Stem & Fulcrum */}
          <path d="M 0 -16 L 0 16" stroke={qrPurple} strokeWidth="3.5" strokeLinecap="round" />
          <polygon points="-9,16 9,16 0,8" fill={qrPurple} />
          <circle cx="0" cy="-16" r="3.5" fill={qrPurple} />
          
          {/* Beam */}
          <path d="M -18 -8 L 0 -16 L 18 -8" stroke={qrPurple} strokeWidth="2.5" fill="none" strokeLinecap="round" />
          
          {/* Left Pan */}
          <path d="M -18 -8 L -24 3 L -12 3 Z" stroke={qrPurple} strokeWidth="1.5" fill="none" />
          <ellipse cx="-18" cy="4" rx="8" ry="3" fill={qrPurple} opacity="0.6" />
          <ellipse cx="-18" cy="3" rx="8" ry="3" stroke={qrPurple} strokeWidth="1.5" fill={darkMode ? '#1e1b4b' : '#ede9fe'} />

          {/* Right Pan */}
          <path d="M 18 -8 L 12 3 L 24 3 Z" stroke={qrPurple} strokeWidth="1.5" fill="none" />
          <ellipse cx="18" cy="4" rx="8" ry="3" fill={qrPurple} opacity="0.6" />
          <ellipse cx="18" cy="3" rx="8" ry="3" stroke={qrPurple} strokeWidth="1.5" fill={darkMode ? '#1e1b4b' : '#ede9fe'} />
        </g>

        {/* Vertical Divider with Center Node */}
        <line x1="96" y1="10" x2="96" y2="70" stroke={qrPurple} strokeWidth="2.5" strokeLinecap="round" opacity="0.75" />
        <circle cx="96" cy="40" r="5" fill={qrPurple} />

        {/* Typography: SCALE */}
        <text
          x="112"
          y="37"
          fill={textColor}
          fontSize="33"
          fontWeight="900"
          fontFamily="'Plus Jakarta Sans', system-ui, -apple-system, sans-serif"
          letterSpacing="0.04em"
        >
          SCALE
        </text>

        {/* Typography: SYNC */}
        <text
          x="112"
          y="71"
          fill={purpleColor}
          fontSize="33"
          fontWeight="800"
          fontFamily="'Plus Jakarta Sans', system-ui, -apple-system, sans-serif"
          letterSpacing="0.04em"
        >
          SYNC
        </text>
      </svg>
    </div>
  );
}
