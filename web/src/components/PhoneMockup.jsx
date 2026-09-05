import React, { useState, useEffect } from 'react';

export function PhoneMockupWrapper({ children, active, onToggle, darkMode }) {
  const [time, setTime] = useState('14:30');
  const [device, setDevice] = useState('iphone'); // 'iphone' | 'pixel'
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }));
    };
    update();
    const interval = setInterval(update, 10000);
    return () => clearInterval(interval);
  }, []);

  if (!active) {
    return (
      <>
        {children}
        <button
          onClick={onToggle}
          title="Switch to Mobile Phone Mockup View"
          style={{
            position: 'fixed',
            bottom: '4.85rem',
            right: '1.5rem',
            zIndex: 9980,
            background: 'linear-gradient(135deg, #0f52ba 0%, #7c3aed 100%)',
            color: '#fff',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '999px',
            padding: '0.75rem 1.4rem',
            fontWeight: 700,
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            boxShadow: '0 10px 30px rgba(124, 58, 237, 0.4), 0 2px 8px rgba(0, 0, 0, 0.2)',
            cursor: 'pointer',
            transition: 'all 0.25s cubic-bezier(0.165, 0.84, 0.44, 1)',
            backdropFilter: 'blur(8px)',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = 'translateY(-3px) scale(1.04)';
            e.currentTarget.style.boxShadow = '0 14px 36px rgba(124, 58, 237, 0.5), 0 4px 12px rgba(0, 0, 0, 0.25)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'translateY(0) scale(1)';
            e.currentTarget.style.boxShadow = '0 10px 30px rgba(124, 58, 237, 0.4), 0 2px 8px rgba(0, 0, 0, 0.2)';
          }}
        >
          <span style={{ fontSize: '1.15rem' }}>📱</span>
          <span>Mobile Mockup</span>
          <span
            style={{
              background: 'rgba(255, 255, 255, 0.25)',
              padding: '0.15rem 0.45rem',
              borderRadius: '999px',
              fontSize: '0.72rem',
              fontWeight: 800,
              letterSpacing: '0.04em',
            }}
          >
            LIVE
          </span>
        </button>
      </>
    );
  }

  const frameWidth = device === 'iphone' ? 393 : 412;
  const frameHeight = device === 'iphone' ? 852 : 860;
  const cornerRadius = device === 'iphone' ? '54px' : '44px';

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100vw',
        background: darkMode
          ? 'radial-gradient(ellipse at center, #131022 0%, #030207 100%)'
          : 'radial-gradient(ellipse at center, #e2e8f0 0%, #cbd5e1 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem 1rem',
        boxSizing: 'border-box',
        overflow: 'auto',
        position: 'relative',
      }}
    >
      {/* Top Controls Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          marginBottom: '1.25rem',
          background: darkMode ? 'rgba(16, 13, 26, 0.85)' : 'rgba(255, 255, 255, 0.9)',
          padding: '0.45rem 1rem',
          borderRadius: '999px',
          border: '1px solid var(--border-color)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.18)',
          backdropFilter: 'blur(12px)',
          zIndex: 50,
          flexWrap: 'wrap',
          justifyContent: 'center',
        }}
      >
        <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          📱 <span>Mobile Device Preview</span>
        </span>

        {/* Device Switcher */}
        <div style={{ display: 'flex', background: darkMode ? '#0c0a14' : '#f1f5f9', borderRadius: '999px', padding: '2px', border: '1px solid var(--border-color)' }}>
          <button
            onClick={() => setDevice('iphone')}
            style={{
              padding: '0.25rem 0.65rem',
              fontSize: '0.76rem',
              fontWeight: 700,
              borderRadius: '999px',
              border: 'none',
              background: device === 'iphone' ? 'var(--color-primary)' : 'transparent',
              color: device === 'iphone' ? '#fff' : 'var(--text-muted)',
              cursor: 'pointer',
            }}
          >
            iPhone 16 Pro
          </button>
          <button
            onClick={() => setDevice('pixel')}
            style={{
              padding: '0.25rem 0.65rem',
              fontSize: '0.76rem',
              fontWeight: 700,
              borderRadius: '999px',
              border: 'none',
              background: device === 'pixel' ? 'var(--color-primary)' : 'transparent',
              color: device === 'pixel' ? '#fff' : 'var(--text-muted)',
              cursor: 'pointer',
            }}
          >
            Pixel 9 Pro
          </button>
        </div>

        {/* Zoom Controls */}
        <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
          <button
            onClick={() => setZoom(zoom === 1 ? 0.9 : zoom === 0.9 ? 0.85 : 1)}
            style={{
              padding: '0.25rem 0.55rem',
              fontSize: '0.75rem',
              fontWeight: 700,
              borderRadius: '999px',
              background: 'transparent',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-color)',
            }}
          >
            {Math.round(zoom * 100)}%
          </button>
        </div>

        {/* Exit Button */}
        <button
          onClick={onToggle}
          style={{
            padding: '0.35rem 0.95rem',
            fontSize: '0.78rem',
            fontWeight: 700,
            borderRadius: '999px',
            background: 'rgba(239, 68, 68, 0.15)',
            color: '#ef4444',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = '#ef4444';
            e.currentTarget.style.color = '#fff';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)';
            e.currentTarget.style.color = '#ef4444';
          }}
        >
          Exit Mockup ✕
        </button>
      </div>

      {/* Realistic Mobile Device Frame */}
      <div
        style={{
          width: `${frameWidth}px`,
          height: `${frameHeight}px`,
          transform: `scale(${zoom})`,
          transformOrigin: 'top center',
          background: '#000000',
          borderRadius: cornerRadius,
          border: '12px solid #1e1a2f',
          outline: '3px solid #3b3356',
          boxShadow: darkMode
            ? '0 40px 100px rgba(0, 0, 0, 0.9), 0 0 0 1px rgba(255, 255, 255, 0.12) inset'
            : '0 30px 80px rgba(15, 23, 42, 0.28), 0 0 0 1px rgba(255, 255, 255, 0.2) inset',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          overflow: 'hidden',
          transition: 'width 0.3s ease, height 0.3s ease, border-radius 0.3s ease',
        }}
      >
        {/* Device Status Bar */}
        <div
          style={{
            height: device === 'iphone' ? '44px' : '38px',
            background: darkMode ? '#050409' : '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 1.5rem',
            fontSize: '0.82rem',
            fontWeight: 800,
            color: darkMode ? '#f8fafc' : '#0f172a',
            zIndex: 30,
            borderBottom: '1px solid var(--border-color)',
            userSelect: 'none',
            flexShrink: 0,
          }}
        >
          {/* Status Left: Clock */}
          <span style={{ letterSpacing: '-0.02em', minWidth: '40px' }}>{time}</span>

          {/* Dynamic Island / Punch Hole */}
          {device === 'iphone' ? (
            <div
              style={{
                width: '110px',
                height: '26px',
                borderRadius: '999px',
                background: '#000000',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 8px',
                boxShadow: '0 0 2px rgba(255, 255, 255, 0.15)',
              }}
            >
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#0a0914', border: '1px solid #1f1b2c' }} />
              <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#064e3b', opacity: 0.8 }} />
            </div>
          ) : (
            <div
              style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                background: '#000000',
                border: '2px solid #1c1829',
              }}
            />
          )}

          {/* Status Right: Network & Battery */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.74rem' }}>
            <span style={{ fontWeight: 700 }}>5G</span>
            <span>📶</span>
            <span>🔋 96%</span>
          </div>
        </div>

        {/* Scrollable Mobile Screen Content */}
        <div
          className="phone-mockup-screen"
          style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            background: 'var(--bg-primary)',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {children}
        </div>

        {/* Bottom Gesture Bar */}
        <div
          style={{
            height: '20px',
            background: darkMode ? '#050409' : '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 30,
            userSelect: 'none',
            flexShrink: 0,
            borderTop: '1px solid var(--border-color)',
          }}
        >
          <div
            style={{
              width: '128px',
              height: '4.5px',
              borderRadius: '999px',
              background: darkMode ? '#64748b' : '#94a3b8',
            }}
          />
        </div>
      </div>
    </div>
  );
}

