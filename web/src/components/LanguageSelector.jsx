import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from '../i18n/LanguageContext';

export function LanguageSelector({ compact = false, darkMode = false }) {
  const { lang, setLang, languages, currentLanguageName } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentLangObj = languages.find((l) => l.code === lang) || languages[0];

  return (
    <div
      ref={dropdownRef}
      style={{
        position: 'relative',
        display: 'inline-block',
        zIndex: 50,
      }}
    >
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.45rem',
          padding: compact ? '0.35rem 0.65rem' : '0.45rem 0.85rem',
          borderRadius: '999px',
          border: '1px solid var(--border-color)',
          background: 'var(--bg-secondary)',
          color: 'var(--text-primary)',
          fontSize: compact ? '0.8rem' : '0.86rem',
          fontWeight: 700,
          cursor: 'pointer',
          boxShadow: '0 2px 6px var(--shadow-default)',
          transition: 'all 0.2s ease',
        }}
        title="Switch Interface Language / மொழியை மாற்றுக / भाषा बदलें"
        aria-label="Language selector"
      >
        <span style={{ fontSize: '1rem', lineHeight: 1 }}>🌐</span>
        <span>{compact ? currentLangObj.code.toUpperCase() : currentLangObj.nativeName}</span>
        <span style={{ fontSize: '0.65rem', opacity: 0.6 }}>▼</span>
      </button>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            boxShadow: '0 12px 32px rgba(0, 0, 0, 0.25)',
            padding: '0.4rem',
            minWidth: '170px',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.2rem',
            zIndex: 1000,
            backdropFilter: 'blur(10px)',
          }}
        >
          <div
            style={{
              padding: '0.35rem 0.65rem',
              fontSize: '0.7rem',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'var(--text-muted)',
              borderBottom: '1px solid var(--border-color)',
              marginBottom: '0.2rem',
            }}
          >
            Select Language
          </div>

          {languages.map((l) => {
            const isSelected = l.code === lang;
            return (
              <button
                key={l.code}
                type="button"
                onClick={() => {
                  setLang(l.code);
                  setIsOpen(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '8px',
                  border: 'none',
                  background: isSelected ? 'var(--bg-active)' : 'transparent',
                  color: isSelected ? 'var(--color-primary)' : 'var(--text-primary)',
                  fontWeight: isSelected ? 800 : 500,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) e.currentTarget.style.background = 'var(--bg-hover)';
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) e.currentTarget.style.background = 'transparent';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>{l.flag}</span>
                  <span>{l.nativeName}</span>
                </div>
                {isSelected && <span style={{ color: 'var(--color-primary)', fontSize: '0.85rem', fontWeight: 900 }}>✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
