import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { Badge, Spinner, Toast } from './UI';
import { INDIAN_STATES, INDIAN_STATES_AND_DISTRICTS } from '../data/indianLocations';
import { useTranslation } from '../i18n/LanguageContext';
import { LanguageSelector } from './LanguageSelector';

export function CitizenComplaintPortal({ initialQrToken, onBackToHome, darkMode, onToggleTheme }) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('FILE'); // 'FILE' or 'TRACK'

  // Wizard state
  const [step, setStep] = useState(1); // 1: OTP, 2: Shop & Instrument, 3: Evidence & Description, 4: Confirmed
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState('');

  // Citizen Identity & Dual OTP
  const [citizenName, setCitizenName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [idReference, setIdReference] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [verificationToken, setVerificationToken] = useState('');
  const [isVerified, setIsVerified] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [expiryTime, setExpiryTime] = useState(0);
  const [otpError, setOtpError] = useState('');

  // Countdown timer for OTP expiration & resend cooldown
  useEffect(() => {
    let timer;
    if (cooldown > 0 || expiryTime > 0) {
      timer = setInterval(() => {
        setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
        setExpiryTime((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [cooldown, expiryTime]);

  const formatTimer = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Shop & Instrument
  const [shopQuery, setShopQuery] = useState('');
  const [shopSearchResults, setShopSearchResults] = useState([]);
  const [selectedShop, setSelectedShop] = useState(null);
  const [shopName, setShopName] = useState('');
  const [shopAddress, setShopAddress] = useState('');
  const [state, setState] = useState('Tamil Nadu');
  const [district, setDistrict] = useState('Chennai');
  const [latitude, setLatitude] = useState(null);
  const [longitude, setLongitude] = useState(null);
  const [gpsStatus, setGpsStatus] = useState('');

  // Violation & Evidence
  const [violationType, setViolationType] = useState('Short Weight / Short Measure');
  const [complaintCategory, setComplaintCategory] = useState('INCORRECT_WEIGHT');
  const [severity, setSeverity] = useState('MEDIUM');
  const [description, setDescription] = useState('');
  const [qrToken, setQrToken] = useState(initialQrToken || '');
  const [evidenceFiles, setEvidenceFiles] = useState([]);

  // Result after submission
  const [submittedComplaint, setSubmittedComplaint] = useState(null);

  // Track tab state
  const [trackNumber, setTrackNumber] = useState('');
  const [trackPhone, setTrackPhone] = useState('');
  const [trackedRecord, setTrackedRecord] = useState(null);
  const [trackingLoading, setTrackingLoading] = useState(false);

  // Districts for selected state
  const availableDistricts = INDIAN_STATES_AND_DISTRICTS[state] || [];

  // Check URL query parameters on load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const qr = params.get('qr') || initialQrToken;
    if (qr) {
      setQrToken(qr);
      // Pre-fill certificate / instrument details
      api.publicCertificate(qr).then(cert => {
        if (cert) {
          if (cert.owner_name) setShopName(cert.owner_name);
          if (cert.owner_address) setShopAddress(cert.owner_address);
          if (cert.state) setState(cert.state);
          if (cert.district) setDistrict(cert.district);
          if (cert.instrument_type || cert.certificate_number) {
            setDescription(prev => prev || `Grievance regarding verified instrument: ${cert.instrument_type || 'Commercial Instrument'} (Cert No: ${cert.certificate_number}, Serial No: ${cert.serial_number || 'N/A'}, Category: ${cert.category || 'Standard'}). Discrepancy observed in weights/measures.`);
          }
          setToast(`✓ Scanned instrument linked: ${cert.instrument_type || 'Instrument'} (${cert.certificate_number})`);
        }
      }).catch(() => {});
    }
  }, [initialQrToken]);

  // Shop search debouncing
  useEffect(() => {
    if (shopQuery.trim().length >= 2) {
      api.searchShops(shopQuery, state, district).then(res => {
        setShopSearchResults(res || []);
      }).catch(() => setShopSearchResults([]));
    } else {
      setShopSearchResults([]);
    }
  }, [shopQuery, state, district]);

  // Handle OTP Send
  const handleSendOtp = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const cleanPhone = phone.replace(/\D/g, '');
    if (!cleanPhone || cleanPhone.length < 10) {
      setToast('Please enter a valid 10-digit mobile number');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email.trim())) {
      setToast('Please enter a valid email address');
      return;
    }

    setLoading(true);
    setOtpError('');
    try {
      const res = await api.sendOtp(cleanPhone, email.trim(), citizenName);
      setVerificationToken(res.verification_token);
      setCooldown(res.cooldown_seconds || 60);
      setExpiryTime(res.expires_in_seconds || 300);
      setOtpCode('');
      setToast(res.message || 'OTP successfully sent to your Mobile and Email.');
    } catch (err) {
      setOtpError(err.message || 'Failed to send OTP.');
      setToast(err.message || 'Failed to send OTP.');
    } finally {
      setLoading(false);
    }
  };

  // Handle OTP Resend
  const handleResendOtp = async () => {
    if (cooldown > 0 || loading) return;
    await handleSendOtp();
  };

  // Handle OTP Verify
  const handleVerifyOtp = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!otpCode || otpCode.trim().length !== 6) {
      setOtpError('Please enter the complete 6-digit OTP.');
      setToast('Please enter the complete 6-digit OTP.');
      return;
    }
    setLoading(true);
    setOtpError('');
    try {
      const res = await api.verifyOtp(verificationToken, otpCode.trim());
      if (res.is_verified) {
        setIsVerified(true);
        setToast('✅ Mobile & Email Verified successfully!');
      }
    } catch (err) {
      setOtpError(err.message || 'Invalid OTP. Please try again.');
      setToast(err.message || 'Invalid OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Capture GPS Location
  const captureGps = () => {
    if (!navigator.geolocation) {
      setGpsStatus('Geolocation not supported by browser.');
      return;
    }
    setGpsStatus('Acquiring high-accuracy GPS coordinates…');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude);
        setLongitude(pos.coords.longitude);
        setGpsStatus(`GPS Captured: ${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)} (±${Math.round(pos.coords.accuracy)}m)`);
      },
      () => {
        setGpsStatus('GPS access denied or unavailable. You may proceed with address details.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Submit Final Complaint
  const handleSubmitComplaint = async () => {
    if (!description || description.length < 10) {
      setToast('Please provide a detailed description (at least 10 characters).');
      return;
    }
    setLoading(true);
    try {
      const payload = {
        citizen_name: citizenName || 'Anonymous Citizen',
        id_reference: idReference || undefined,
        verified_phone: phone.replace(/\D/g, ''),
        verified_email: email.trim(),
        verification_token: verificationToken,
        shop_name: shopName,
        shop_address: shopAddress,
        state,
        district,
        latitude: latitude || undefined,
        longitude: longitude || undefined,
        complaint_category: complaintCategory,
        violation_type: violationType,
        description,
        severity,
        entry_method: qrToken ? 'QR_SCAN' : 'PORTAL',
        qr_token_used: qrToken || undefined
      };

      const complaintRes = await api.submitComplaint(payload);

      // Upload any selected evidence files
      for (const file of evidenceFiles) {
        await api.uploadComplaintEvidence(complaintRes.complaint_number, file, 'PHOTO', latitude, longitude).catch(() => {});
      }

      setSubmittedComplaint(complaintRes);
      setStep(4);
      setToast(`Complaint registered successfully! ID: ${complaintRes.complaint_number}`);
    } catch (err) {
      setToast(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle Track Complaint
  const handleTrackComplaint = async (e) => {
    e.preventDefault();
    if (!trackNumber) return;
    setTrackingLoading(true);
    setTrackedRecord(null);
    try {
      const res = await api.trackComplaint(trackNumber, trackPhone);
      setTrackedRecord(res);
    } catch (err) {
      setToast(err.message || 'Complaint not found.');
    } finally {
      setTrackingLoading(false);
    }
  };

  return (
    <div className={`complaint-portal-page ${darkMode ? 'dark' : ''}`}>
      {toast && <Toast message={toast} onClose={() => setToast('')} />}

      <div className="complaint-portal-container">
        <header className="complaint-header">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div className="govt-header-badge" style={{ margin: 0 }}>
              {t('complaint_header_badge')}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <LanguageSelector />
              {onToggleTheme && (
                <button
                  type="button"
                  className="theme-toggle-btn"
                  aria-label="Toggle theme"
                  onClick={onToggleTheme}
                  title="Toggle Light / Dark Theme"
                >
                  {darkMode ? '☀️' : '🌙'}
                </button>
              )}
            </div>
          </div>

          <h1>{t('complaint_title')}</h1>
          <p className="complaint-subtitle">
            {t('complaint_subtitle')}
          </p>

          <div className="portal-tabs-row">
            <button
              className={`portal-tab ${activeTab === 'FILE' ? 'active' : ''}`}
              onClick={() => setActiveTab('FILE')}
            >
              {t('tab_file_complaint')}
            </button>
            <button
              className={`portal-tab ${activeTab === 'TRACK' ? 'active' : ''}`}
              onClick={() => setActiveTab('TRACK')}
            >
              {t('tab_track_complaint')}
            </button>
            {onBackToHome && (
              <button className="portal-tab outline" onClick={onBackToHome}>
                ← {t('back')}
              </button>
            )}
          </div>
        </header>

        {/* ========================================================================= */}
        {/* TAB 1: FILE NEW COMPLAINT WIZARD */}
        {/* ========================================================================= */}
        {activeTab === 'FILE' && (
          <div className="wizard-card">
            {step < 4 && (
              <div className="wizard-stepper">
                <div className={`step-item ${step >= 1 ? 'active' : ''} ${step > 1 ? 'completed' : ''}`}>
                  <span className="step-num">1</span>
                  <span className="step-title">{t('step_identity')}</span>
                </div>
                <div className={`step-item ${step >= 2 ? 'active' : ''} ${step > 2 ? 'completed' : ''}`}>
                  <span className="step-num">2</span>
                  <span className="step-title">{t('step_shop')}</span>
                </div>
                <div className={`step-item ${step >= 3 ? 'active' : ''}`}>
                  <span className="step-num">3</span>
                  <span className="step-title">{t('step_evidence')}</span>
                </div>
              </div>
            )}

            {/* STEP 1: CITIZEN IDENTITY & OTP */}
            {step === 1 && (
              <div className="wizard-step-content">
                <h2>{t('identity_title')}</h2>
                <p className="step-desc">
                  {t('identity_desc')}
                </p>

                {qrToken && (
                  <div className="qr-scanned-alert" style={{ marginBottom: '1.25rem', border: '1px solid var(--color-primary)', background: 'var(--bg-active)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 800, color: 'var(--color-primary)' }}>
                      <span>📷</span>
                      <span>Instrument Details Pre-filled from QR Code</span>
                    </div>
                    <p style={{ margin: '0.3rem 0 0', fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
                      Commercial establishment: <strong>{shopName || 'Registered Trade Name'}</strong> ({district}, {state}). Complete verified citizen OTP authentication below to file your official grievance.
                    </p>
                  </div>
                )}

                {/* STAGE A: ENTER MOBILE & EMAIL */}
                {!isVerified && !verificationToken && (
                  <form onSubmit={handleSendOtp} className="complaint-form">
                    <label>
                      <span>{t('full_name')}</span>
                      <input
                        type="text"
                        placeholder="e.g. Ramesh Kumar"
                        value={citizenName}
                        onChange={(e) => setCitizenName(e.target.value)}
                      />
                    </label>

                    <label>
                      <span>{t('phone_number')} *</span>
                      <input
                        type="tel"
                        required
                        placeholder="e.g. 9876543210"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        maxLength={10}
                      />
                      <small className="field-hint">A 6-digit OTP will be dispatched to this mobile number.</small>
                    </label>

                    <label>
                      <span>{t('email_address')} *</span>
                      <input
                        type="email"
                        required
                        placeholder="e.g. citizen@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                      <small className="field-hint">Official complaint tracking details & OTP will be sent here.</small>
                    </label>

                    <label>
                      <span>{t('gov_id_ref')}</span>
                      <input
                        type="text"
                        placeholder="e.g. XXXX-XXXX-1234 or Voter ID"
                        value={idReference}
                        onChange={(e) => setIdReference(e.target.value)}
                      />
                      <small className="field-hint">Do not enter full 12-digit Aadhaar. Enter masked 4 digits or ID number.</small>
                    </label>

                    {otpError && (
                      <div className="otp-error-banner">
                        <span>⚠️ {otpError}</span>
                      </div>
                    )}

                    <button type="submit" className="primary full-width" disabled={loading}>
                      {loading ? 'Generating & Sending OTP…' : t('send_otp_btn')}
                    </button>
                  </form>
                )}

                {/* STAGE B: ENTER & VERIFY OTP SCREEN */}
                {!isVerified && verificationToken && (
                  <form onSubmit={handleVerifyOtp} className="complaint-form otp-verify-card">
                    <div className="otp-sent-banner">
                      <div className="otp-sent-header">
                        <span className="otp-sent-icon">📬</span>
                        <div>
                          <h4>OTP Dispatched</h4>
                          <p>
                            A 6-digit verification code has been dispatched to:
                          </p>
                        </div>
                      </div>
                      <div className="otp-destination-badges">
                        <span className="dest-badge">📱 +91 {phone.length >= 10 ? `${phone.slice(0, 2)}******${phone.slice(-2)}` : phone}</span>
                        <span className="dest-badge">✉️ {email.includes('@') ? `${email.split('@')[0].slice(0, 1)}***@${email.split('@')[1]}` : email}</span>
                      </div>
                    </div>

                    <div className="otp-timer-row">
                      {expiryTime > 0 ? (
                        <span className="otp-timer-active">
                          ⏳ OTP expires in: <strong>{formatTimer(expiryTime)}</strong>
                        </span>
                      ) : (
                        <span className="otp-timer-expired">
                          ⚠️ OTP expired. Please request a new OTP.
                        </span>
                      )}
                    </div>

                    <label>
                      <span>{t('otp_code_label')} *</span>
                      <input
                        type="text"
                        required
                        placeholder="• • • • • •"
                        value={otpCode}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                          setOtpCode(val);
                        }}
                        maxLength={6}
                        className="otp-input-field large-digits"
                        autoFocus
                      />
                      <small className="field-hint">Enter the 6-digit numeric code received on your phone or email.</small>
                    </label>

                    {otpError && (
                      <div className="otp-error-banner">
                        <span>⚠️ {otpError}</span>
                      </div>
                    )}

                    <div className="form-actions-row">
                      <button
                        type="button"
                        className="outline"
                        onClick={() => {
                          setVerificationToken('');
                          setOtpError('');
                          setOtpCode('');
                        }}
                      >
                        ← Change Details
                      </button>

                      <button
                        type="button"
                        className="outline"
                        onClick={handleResendOtp}
                        disabled={cooldown > 0 || loading}
                      >
                        {cooldown > 0 ? `Resend OTP in ${cooldown}s` : `🔄 ${t('resend_otp_btn')}`}
                      </button>

                      <button
                        type="submit"
                        className="primary"
                        disabled={loading || otpCode.length !== 6}
                      >
                        {loading ? 'Verifying…' : t('verify_otp_btn')}
                      </button>
                    </div>
                  </form>
                )}

                {/* STAGE C: VERIFIED SUCCESS - PROCEED TO STEP 2 */}
                {isVerified && (
                  <div className="otp-verified-success-box">
                    <div className="verified-check-icon">✓</div>
                    <h3>Identity Verified</h3>
                    <p>{t('otp_verified_msg')}</p>
                    <div className="verified-creds-summary">
                      <div><span>Mobile:</span> <strong>+91 {phone}</strong></div>
                      <div><span>Email:</span> <strong>{email}</strong></div>
                      {citizenName && <div><span>Name:</span> <strong>{citizenName}</strong></div>}
                    </div>

                    <button
                      type="button"
                      className="primary full-width"
                      onClick={() => setStep(2)}
                      style={{ marginTop: '1.25rem' }}
                    >
                      {t('step_shop')} →
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* STEP 2: SHOP & VIOLATION */}
            {step === 2 && (
              <div className="wizard-step-content">
                <h2>{t('shop_title')}</h2>
                <p className="step-desc">{t('shop_desc')}</p>

                {qrToken && (
                  <div className="qr-scanned-alert">
                    <span>📱 Scanned QR Certificate Token: <strong>{qrToken}</strong></span>
                    <small>Establishment and instrument details have been pre-filled.</small>
                  </div>
                )}

                <div className="complaint-form">
                  <label>
                    <span>{t('search_shop_label')}</span>
                    <input
                      type="text"
                      placeholder={t('search_shop_placeholder')}
                      value={shopQuery}
                      onChange={(e) => setShopQuery(e.target.value)}
                    />
                  </label>

                  {shopSearchResults.length > 0 && (
                    <div className="shop-search-dropdown">
                      {shopSearchResults.map(s => (
                        <div
                          key={s.id}
                          className="shop-result-item"
                          onClick={() => {
                            setSelectedShop(s);
                            setShopName(s.shop_name);
                            setShopAddress(s.address || '');
                            if (s.state) setState(s.state);
                            if (s.district) setDistrict(s.district);
                            if (s.latitude) setLatitude(s.latitude);
                            if (s.longitude) setLongitude(s.longitude);
                            setShopSearchResults([]);
                            setShopQuery('');
                          }}
                        >
                          <strong>{s.shop_name}</strong>
                          <small>{s.address} · {s.district}, {s.state}</small>
                          {s.is_repeat_offender && (
                            <span className="repeat-tag">⚠️ High Risk Repeat Offender</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  <label>
                    <span>{t('shop_name')} *</span>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Sree Murugan Provision Store"
                      value={shopName}
                      onChange={(e) => setShopName(e.target.value)}
                    />
                  </label>

                  <label>
                    <span>{t('shop_address')} *</span>
                    <input
                      type="text"
                      required
                      placeholder="e.g. No 14, Gandhi Bazaar, Near Central Bus Stand"
                      value={shopAddress}
                      onChange={(e) => setShopAddress(e.target.value)}
                    />
                  </label>

                  <div className="grid-2">
                    <label>
                      <span>{t('state_label')} *</span>
                      <select value={state} onChange={(e) => { setState(e.target.value); setDistrict(''); }}>
                        {INDIAN_STATES.map(st => (
                          <option key={st} value={st}>{st}</option>
                        ))}
                      </select>
                    </label>

                    <label>
                      <span>{t('district_label')} *</span>
                      <select value={district} onChange={(e) => setDistrict(e.target.value)} required>
                        <option value="">Select District</option>
                        {availableDistricts.map(d => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <label>
                    <span>{t('violation_type')} *</span>
                    <select value={violationType} onChange={(e) => setViolationType(e.target.value)}>
                      <option value="Short Weight / Short Measure">Short Weight / Short Measure (Inaccurate Scale)</option>
                      <option value="Unverified / Unstamped Scale">Unverified / Unstamped Scale (No Verification Seal)</option>
                      <option value="Tampered Electronic Scale">Tampered Electronic Scale / Counterweight Manipulation</option>
                      <option value="Dual MRP / Overcharging Over MRP">Dual MRP / Overcharging Above Printed MRP</option>
                      <option value="Non-Standard Package / Missing Declarations">Non-Standard Package / Missing Manufacturer Declarations</option>
                      <option value="Non-Standard Weighing Instrument">Use of Unapproved Non-Standard Weighing Instrument</option>
                    </select>
                  </label>

                  <div className="grid-2">
                    <label>
                      <span>{t('violation_category')}</span>
                      <select value={complaintCategory} onChange={(e) => setComplaintCategory(e.target.value)}>
                        <option value="INCORRECT_WEIGHT">Incorrect Weight</option>
                        <option value="UNSTAMPED_INSTRUMENT">Unstamped Instrument</option>
                        <option value="TAMPERED_SEAL">Tampered Seal</option>
                        <option value="OVERCHARGING_MRP">Overcharging Above MRP</option>
                        <option value="PACKAGE_COMMODITY_VIOLATION">Package Commodity Violation</option>
                        <option value="OTHER">Other Violation</option>
                      </select>
                    </label>

                    <label>
                      <span>{t('severity_level')}</span>
                      <select value={severity} onChange={(e) => setSeverity(e.target.value)}>
                        <option value="LOW">Low (Single occurrence)</option>
                        <option value="MEDIUM">Medium (Repeated short-measure)</option>
                        <option value="HIGH">High (Active consumer fraud / deliberate tampering)</option>
                        <option value="CRITICAL">Critical (Large commercial fraud / petrol pump error)</option>
                      </select>
                    </label>
                  </div>

                  <div className="form-actions-row">
                    <button type="button" className="outline" onClick={() => setStep(1)}>
                      ← {t('back')}
                    </button>
                    <button
                      type="button"
                      className="primary"
                      disabled={!shopName || !shopAddress || !district}
                      onClick={() => setStep(3)}
                    >
                      {t('next_evidence_btn')}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3: EVIDENCE & DESCRIPTION */}
            {step === 3 && (
              <div className="wizard-step-content">
                <h2>{t('evidence_title')}</h2>
                <p className="step-desc">{t('evidence_desc')}</p>

                <div className="complaint-form">
                  <label>
                    <span>{t('detailed_desc')} *</span>
                    <textarea
                      rows={4}
                      required
                      placeholder="Describe what occurred, items weighed, discrepancy noted (e.g. 1kg sugar weighed only 850g on standard scale)..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </label>

                  {/* GPS Coordinates Capture */}
                  <div className="gps-capture-box">
                    <div>
                      <strong>📍 Geotag Shop Location (GPS Coordinates)</strong>
                      <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {gpsStatus || 'Click below to capture exact GPS coordinates of the shop for direct LMO on-site inspection.'}
                      </p>
                      {latitude && longitude && (
                        <div className="gps-coords-badge">
                          Lat: {latitude.toFixed(5)}, Lng: {longitude.toFixed(5)}
                        </div>
                      )}
                    </div>
                    <button type="button" className="outline" onClick={captureGps}>
                      {t('capture_gps_btn')}
                    </button>
                  </div>

                  {/* Photo / Video Evidence Upload */}
                  <label>
                    <span>{t('evidence_photos')} (Optional)</span>
                    <input
                      type="file"
                      multiple
                      accept="image/*,video/*"
                      onChange={(e) => {
                        if (e.target.files) {
                          setEvidenceFiles(Array.from(e.target.files));
                        }
                      }}
                    />
                    <small className="field-hint">Attach photos of the faulty balance, display panel, receipt, or packaging.</small>
                  </label>

                  {evidenceFiles.length > 0 && (
                    <div className="uploaded-files-preview">
                      <strong>Attached {evidenceFiles.length} file(s):</strong> {evidenceFiles.map(f => f.name).join(', ')}
                    </div>
                  )}

                  <div className="form-actions-row">
                    <button type="button" className="outline" onClick={() => setStep(2)}>
                      ← {t('back')}
                    </button>
                    <button
                      type="button"
                      className="primary"
                      disabled={loading || description.length < 10}
                      onClick={handleSubmitComplaint}
                    >
                      {loading ? 'Submitting Grievance…' : t('submit_complaint_btn')}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 4: CONFIRMATION & COMPLAINT TICKET */}
            {step === 4 && submittedComplaint && (
              <div className="wizard-confirmation-card">
                <div className="conf-icon">✓</div>
                <h2>{t('complaint_success_title')}</h2>
                <p>
                  Your grievance has been officially registered and auto-routed to the jurisdictional Legal Metrology Office.
                </p>

                <div className="complaint-ref-card">
                  <div className="ref-row">
                    <span>{t('complaint_ref_no')}:</span>
                    <strong style={{ color: '#2563eb', fontSize: '1.15rem' }}>{submittedComplaint.complaint_number}</strong>
                  </div>
                  <div className="ref-row">
                    <span>{t('status_label')}:</span>
                    <Badge>{submittedComplaint.status}</Badge>
                  </div>
                  <div className="ref-row">
                    <span>{t('assigned_jurisdiction')}:</span>
                    <strong>{submittedComplaint.assigned_officer_name || `${district} Legal Metrology Office`}</strong>
                  </div>
                  <div className="ref-row">
                    <span>{t('expected_response')}:</span>
                    <span>{t('within_48_hours')}</span>
                  </div>
                  {submittedComplaint.is_repeat_offender && (
                    <div className="repeat-alert-box">
                      ⚠️ <strong>Priority Investigation:</strong> This establishment has prior recorded violations. An immediate inspection warrant has been flagged.
                    </div>
                  )}
                </div>

                <div className="confirmation-actions">
                  <button
                    className="primary"
                    onClick={() => {
                      setTrackNumber(submittedComplaint.complaint_number);
                      setTrackPhone(phone);
                      setActiveTab('TRACK');
                      handleTrackComplaint({ preventDefault: () => {} });
                    }}
                  >
                    {t('tab_track_complaint')}
                  </button>
                  <button
                    className="outline"
                    onClick={() => {
                      setStep(1);
                      setIsVerified(false);
                      setVerificationToken('');
                      setOtpCode('');
                      setShopName('');
                      setShopAddress('');
                      setDescription('');
                      setEvidenceFiles([]);
                      setSubmittedComplaint(null);
                    }}
                  >
                    {t('file_another_btn')}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: TRACK COMPLAINT STATUS */}
        {/* ========================================================================= */}
        {activeTab === 'TRACK' && (
          <div className="wizard-card">
            <h2>{t('tab_track_complaint')}</h2>
            <p className="step-desc">
              Enter your official complaint reference number and registered mobile number to view live investigation progress.
            </p>

            <form onSubmit={handleTrackComplaint} className="complaint-form">
              <label>
                <span>{t('track_input_label')} *</span>
                <input
                  type="text"
                  required
                  placeholder="e.g. LM-CMP-TN-2026-000001"
                  value={trackNumber}
                  onChange={(e) => setTrackNumber(e.target.value)}
                />
              </label>

              <label>
                <span>{t('track_phone_label')} (Optional)</span>
                <input
                  type="tel"
                  placeholder="e.g. 9876543210"
                  value={trackPhone}
                  onChange={(e) => setTrackPhone(e.target.value)}
                />
              </label>

              <button type="submit" className="primary" disabled={trackingLoading || !trackNumber}>
                {trackingLoading ? 'Fetching Status…' : t('track_action_btn')}
              </button>
            </form>

            {/* TRACKED COMPLAINT RECORD DISPLAY */}
            {trackedRecord && (
              <div className="tracked-details-container">
                <div className="tracked-header-bar">
                  <div>
                    <h3>{trackedRecord.complaint_number}</h3>
                    <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      Filed on {new Date(trackedRecord.created_at).toLocaleDateString()} · {trackedRecord.shop_name} ({trackedRecord.district}, {trackedRecord.state})
                    </p>
                  </div>
                  <Badge>{trackedRecord.status}</Badge>
                </div>

                {/* Status Progress Stepper */}
                <div className="complaint-progress-timeline">
                  {['SUBMITTED', 'ASSIGNED', 'IN_INVESTIGATION', 'ACTION_TAKEN', 'RESOLVED'].map((st, idx) => {
                    const statuses = ['SUBMITTED', 'ASSIGNED', 'IN_INVESTIGATION', 'ACTION_TAKEN', 'RESOLVED'];
                    const currentIdx = statuses.indexOf(trackedRecord.status);
                    const isDone = currentIdx >= idx || (trackedRecord.status === 'DISMISSED' && idx === 0);
                    return (
                      <div key={st} className={`comp-step ${isDone ? 'done' : ''}`}>
                        <div className="comp-step-circle">{idx + 1}</div>
                        <div className="comp-step-label">{st.replace('_', ' ')}</div>
                      </div>
                    );
                  })}
                </div>

                {/* Officer Findings / Action Taken Box */}
                {trackedRecord.action_taken && (
                  <div className="official-action-box">
                    <h4>⚖️ Official Inspection Finding & Action Taken</h4>
                    <p style={{ margin: '0.35rem 0' }}>{trackedRecord.action_taken}</p>
                    {trackedRecord.resolution_notes && (
                      <small style={{ display: 'block', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                        Penalty / Legal Citation: {trackedRecord.resolution_notes}
                      </small>
                    )}
                  </div>
                )}

                {/* Timeline History Entries */}
                {trackedRecord.timeline && trackedRecord.timeline.length > 0 && (
                  <div className="timeline-history-list">
                    <h4>Official Audit & Investigation Log</h4>
                    {trackedRecord.timeline.map((entry) => (
                      <div key={entry.id} className="timeline-item-card">
                        <div className="item-meta">
                          <strong>{entry.status}</strong>
                          <span>{new Date(entry.recorded_at).toLocaleString()}</span>
                        </div>
                        <div className="actor-line">Action by: {entry.actor_name} ({entry.actor_role})</div>
                        {entry.notes && <p className="notes-line">{entry.notes}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
