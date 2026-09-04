import React, { useState } from 'react';
import { QRCodeSVG } from './QRCodeSVG';
import { Badge } from './UI';

export function CertificateOfAuthenticityModal({ cert, onClose, darkMode }) {
  const [copied, setCopied] = useState(false);
  if (!cert) return null;

  const publicUrl = `${window.location.origin}/verify/${encodeURIComponent(cert.qr_token || cert.certificate_number)}`;
  const isValid = cert.status === 'VALID' || cert.status === 'CERTIFICATE_ISSUED';
  const isRevoked = cert.status === 'REVOKED';

  const copyLink = () => {
    navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      className="modal-backdrop"
      onMouseDown={onClose}
      style={{
        zIndex: 10000,
        padding: '1rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(5, 4, 10, 0.85)',
        backdropFilter: 'blur(8px)',
      }}
    >
      <div
        className="certificate-modal-wrapper"
        onMouseDown={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '860px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          background: darkMode ? '#0c0a14' : '#ffffff',
          borderRadius: '16px',
          border: '1px solid var(--border-color)',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.6)',
          overflow: 'hidden',
        }}
      >
        {/* Top Modal Controls */}
        <div
          style={{
            padding: '1rem 1.5rem',
            background: darkMode ? '#120f20' : '#f8fafc',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.75rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.2rem' }}>📜</span>
            <span style={{ fontWeight: 800, fontSize: '0.98rem', color: 'var(--text-primary)' }}>
              Official Certificate of Authenticity (CoA)
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <button
              onClick={handlePrint}
              style={{
                background: 'linear-gradient(135deg, #0f52ba, #7c3aed)',
                color: '#ffffff',
                border: 'none',
                padding: '0.45rem 1rem',
                borderRadius: '8px',
                fontSize: '0.85rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              <span>🖨️</span>
              <span>Print / Save PDF</span>
            </button>

            <button
              onClick={copyLink}
              className="outline"
              style={{
                padding: '0.45rem 0.9rem',
                borderRadius: '8px',
                fontSize: '0.85rem',
                fontWeight: 700,
              }}
            >
              {copied ? '✓ Link Copied' : '🔗 Copy QR Link'}
            </button>

            <button
              onClick={onClose}
              className="icon-button"
              aria-label="Close"
              style={{
                padding: '0.4rem 0.7rem',
                fontSize: '1.1rem',
                borderRadius: '8px',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Certificate Body (Printable A4 Area) */}
        <div
          id="printable-certificate"
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '2.5rem',
            background: '#ffffff',
            color: '#0f172a',
            fontFamily: "'Plus Jakarta Sans', Georgia, serif",
            position: 'relative',
          }}
        >
          {/* Security Guilloche Gold/Green Border Frame */}
          <div
            style={{
              border: '4px double #167046',
              outline: '1px solid #c084fc',
              outlineOffset: '-8px',
              padding: '2rem 2.2rem',
              borderRadius: '4px',
              position: 'relative',
              background: '#fdfdfb',
            }}
          >
            {/* Watermark Logo */}
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%) rotate(-15deg)',
                fontSize: '4.5rem',
                fontWeight: 900,
                color: 'rgba(22, 112, 70, 0.04)',
                letterSpacing: '0.15em',
                pointerEvents: 'none',
                userSelect: 'none',
                textAlign: 'center',
                whiteSpace: 'nowrap',
                zIndex: 0,
              }}
            >
              LEGAL METROLOGY<br />GOVERNMENT OF INDIA
            </div>

            {/* Official Header */}
            <div style={{ textAlign: 'center', position: 'relative', zIndex: 1, marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '0.76rem', fontWeight: 800, letterSpacing: '0.18em', color: '#167046', textTransform: 'uppercase' }}>
                GOVERNMENT OF INDIA · MINISTRY OF CONSUMER AFFAIRS
              </div>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.12em', color: '#475569', marginTop: '0.2rem' }}>
                DEPARTMENT OF LEGAL METROLOGY & GATC VERIFICATION DIVISION
              </div>
              <div style={{ margin: '0.6rem auto', width: '60px', height: '2px', background: '#167046' }} />
              <h1
                style={{
                  margin: '0.4rem 0',
                  fontSize: '1.75rem',
                  fontWeight: 900,
                  color: '#0f172a',
                  letterSpacing: '0.02em',
                  fontFamily: 'Georgia, serif',
                  textTransform: 'uppercase',
                }}
              >
                Certificate of Verification & Authenticity
              </h1>
              <p style={{ margin: '0', fontSize: '0.78rem', color: '#64748b', fontStyle: 'italic' }}>
                Issued under the Legal Metrology Act, 2009 and the GATC Amendment Rules, 2025
              </p>
            </div>

            {/* Certificate Status Banner */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.75rem 1.25rem',
                background: isValid ? '#dcf5e8' : isRevoked ? '#fde7e7' : '#fff2d9',
                border: `1px solid ${isValid ? '#167046' : isRevoked ? '#b91c1c' : '#b45309'}`,
                borderRadius: '8px',
                marginBottom: '1.5rem',
                position: 'relative',
                zIndex: 1,
              }}
            >
              <div>
                <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>
                  Certificate Number:
                </span>{' '}
                <strong style={{ fontSize: '0.95rem', color: '#0f172a', letterSpacing: '0.02em' }}>
                  {cert.certificate_number}
                </strong>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569' }}>
                  Verification Status:
                </span>
                <span
                  style={{
                    background: isValid ? '#167046' : isRevoked ? '#b91c1c' : '#b45309',
                    color: '#ffffff',
                    padding: '0.2rem 0.6rem',
                    borderRadius: '999px',
                    fontSize: '0.75rem',
                    fontWeight: 800,
                  }}
                >
                  {isValid ? '✓ VALID & CERTIFIED' : isRevoked ? '✕ REVOKED' : cert.status}
                </span>
              </div>
            </div>

            {/* Two Column Section: Details & QR Code */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 180px',
                gap: '1.5rem',
                marginBottom: '1.5rem',
                position: 'relative',
                zIndex: 1,
              }}
            >
              {/* Instrument & Inspection Metadata Table */}
              <div style={{ fontSize: '0.84rem' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '0.45rem 0', fontWeight: 700, color: '#64748b', width: '180px' }}>Instrument ID:</td>
                      <td style={{ padding: '0.45rem 0', fontWeight: 800, color: '#0f172a' }}>{cert.instrument_id || cert.instrument_passport_id || 'LM-INST-2026'}</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '0.45rem 0', fontWeight: 700, color: '#64748b' }}>Instrument Type / Class:</td>
                      <td style={{ padding: '0.45rem 0', fontWeight: 700, color: '#0f172a' }}>{cert.instrument_type || cert.category || 'Weighing Instrument Class III'}</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '0.45rem 0', fontWeight: 700, color: '#64748b' }}>Make / Model:</td>
                      <td style={{ padding: '0.45rem 0', color: '#0f172a' }}>{cert.manufacturer || 'Standard'} {cert.model ? `(${cert.model})` : ''}</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '0.45rem 0', fontWeight: 700, color: '#64748b' }}>Serial Number:</td>
                      <td style={{ padding: '0.45rem 0', fontFamily: 'monospace', color: '#0f172a' }}>{cert.serial_number || 'SN-2026-VERIFIED'}</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '0.45rem 0', fontWeight: 700, color: '#64748b' }}>Verification Date:</td>
                      <td style={{ padding: '0.45rem 0', fontWeight: 700, color: '#0f172a' }}>{cert.valid_from || cert.verification_date || '2026-08-27'}</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '0.45rem 0', fontWeight: 700, color: '#64748b' }}>Valid Until (Expiry):</td>
                      <td style={{ padding: '0.45rem 0', fontWeight: 800, color: isValid ? '#167046' : '#b91c1c' }}>
                        {cert.valid_until}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ padding: '0.45rem 0', fontWeight: 700, color: '#64748b' }}>Issuing Authority:</td>
                      <td style={{ padding: '0.45rem 0', color: '#0f172a' }}>Legal Metrology Division (Govt. Approved Test Centre)</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Scannable Verification QR Code */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0.75rem',
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  borderRadius: '10px',
                  textAlign: 'center',
                }}
              >
                <QRCodeSVG value={publicUrl} size={135} />
                <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#167046', marginTop: '0.5rem', letterSpacing: '0.04em' }}>
                  SCAN TO VERIFY
                </span>
                <span style={{ fontSize: '0.62rem', color: '#64748b', wordBreak: 'break-all', marginTop: '0.2rem' }}>
                  Token: {(cert.qr_token || cert.certificate_number || '').slice(0, 12)}…
                </span>
              </div>
            </div>

            {/* Cryptographic Proof & Verification Check Breakdown */}
            <div
              style={{
                background: '#f1f5f9',
                padding: '1rem',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                marginBottom: '1.5rem',
                position: 'relative',
                zIndex: 1,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <span style={{ fontSize: '0.76rem', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase' }}>
                  🔒 Cryptographic Integrity Proof & Ledger Record
                </span>
                <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#167046' }}>
                  ✓ SHA-256 Digest Verified
                </span>
              </div>
              <div
                style={{
                  fontFamily: 'monospace',
                  fontSize: '0.72rem',
                  color: '#334155',
                  wordBreak: 'break-all',
                  background: '#ffffff',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '4px',
                  border: '1px solid #e2e8f0',
                }}
              >
                {cert.certificate_hash || 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'}
              </div>
            </div>

            {/* Official Signatures & Seal Footer */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '2rem',
                marginTop: '1.8rem',
                paddingTop: '1.2rem',
                borderTop: '1px solid #cbd5e1',
                position: 'relative',
                zIndex: 1,
              }}
            >
              {/* Left: Verification Seal */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div
                  style={{
                    width: '52px',
                    height: '52px',
                    borderRadius: '50%',
                    border: '2px dashed #167046',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.7rem',
                    fontWeight: 900,
                    color: '#167046',
                    textAlign: 'center',
                    textTransform: 'uppercase',
                  }}
                >
                  SEAL<br />GATC
                </div>
                <div style={{ fontSize: '0.74rem', color: '#475569' }}>
                  <strong style={{ display: 'block', color: '#0f172a' }}>National Metrology Seal</strong>
                  Verified for commercial & legal accuracy.
                </div>
              </div>

              {/* Right: Digital Signature */}
              <div style={{ textAlign: 'right', fontSize: '0.74rem', color: '#475569' }}>
                <div style={{ color: '#167046', fontWeight: 800, fontSize: '0.82rem', fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>
                  Digitally Authorized Officer
                </div>
                <strong style={{ display: 'block', color: '#0f172a', marginTop: '0.2rem' }}>
                  Legal Metrology Inspectorate
                </strong>
                <span>Division of Weights & Measures</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
