import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { Badge, Spinner, Toast } from './UI';
import { INDIAN_STATES, INDIAN_STATES_AND_DISTRICTS } from '../data/indianLocations';

export function CitizenComplaintPortal({ initialQrToken, onBackToHome, darkMode }) {
  const [activeTab, setActiveTab] = useState('FILE'); // 'FILE' or 'TRACK'

  // Wizard state
  const [step, setStep] = useState(1); // 1: OTP, 2: Shop & Instrument, 3: Evidence & Description, 4: Confirmed
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState('');

  // Citizen Identity & OTP
  const [citizenName, setCitizenName] = useState('');
  const [phone, setPhone] = useState('');
  const [idReference, setIdReference] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [verificationToken, setVerificationToken] = useState('');
  const [isPhoneVerified, setIsPhoneVerified] = useState(false);
  const [demoOtpNotice, setDemoOtpNotice] = useState('');

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
      // Attempt to prefill certificate / instrument details
      api.publicCertificate(qr).then(cert => {
        if (cert) {
          setShopName(cert.owner_name || 'Registered Establishment');
          setState(cert.state || 'Tamil Nadu');
          setDistrict(cert.district || 'Chennai');
          setToast('Instrument details auto-filled from scanned QR code.');
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
    e.preventDefault();
    if (!phone || phone.length < 10) {
      setToast('Please enter a valid 10-digit mobile number');
      return;
    }
    setLoading(true);
    try {
      const res = await api.sendOtp(phone, citizenName);
      setVerificationToken(res.verification_token);
      if (res.demo_otp_code) {
        setDemoOtpNotice(`Demo OTP: ${res.demo_otp_code} (auto-filled for quick testing)`);
        setOtpCode(res.demo_otp_code);
      }
      setToast(res.message);
    } catch (err) {
      setToast(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle OTP Verify
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!otpCode) {
      setToast('Please enter the OTP');
      return;
    }
    setLoading(true);
    try {
      const res = await api.verifyOtp(verificationToken, otpCode);
      if (res.is_verified) {
        setIsPhoneVerified(true);
        setToast('Mobile number verified! Proceeding to shop details.');
        setStep(2);
      }
    } catch (err) {
      setToast(err.message);
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
        verified_phone: phone,
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
          <div className="govt-header-badge">Government of India • Legal Metrology Division</div>
          <h1>Public Citizen Complaint & Redressal Portal</h1>
          <p className="complaint-subtitle">
            Report inaccurate weighing balances, short measures, non-standard weights, missing verification seals, or dual MRP overcharging under the Legal Metrology Act, 2009.
          </p>

          <div className="portal-tabs-row">
            <button
              className={`portal-tab ${activeTab === 'FILE' ? 'active' : ''}`}
              onClick={() => setActiveTab('FILE')}
            >
              📝 File New Complaint
            </button>
            <button
              className={`portal-tab ${activeTab === 'TRACK' ? 'active' : ''}`}
              onClick={() => setActiveTab('TRACK')}
            >
              🔍 Track Complaint Status
            </button>
            {onBackToHome && (
              <button className="portal-tab outline" onClick={onBackToHome}>
                ← Back to Portal Home
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
                  <span className="step-title">Citizen Verification</span>
                </div>
                <div className={`step-item ${step >= 2 ? 'active' : ''} ${step > 2 ? 'completed' : ''}`}>
                  <span className="step-num">2</span>
                  <span className="step-title">Shop & Location</span>
                </div>
                <div className={`step-item ${step >= 3 ? 'active' : ''}`}>
                  <span className="step-num">3</span>
                  <span className="step-title">Violation & Evidence</span>
                </div>
              </div>
            )}

            {/* STEP 1: CITIZEN IDENTITY & OTP */}
            {step === 1 && (
              <div className="wizard-step-content">
                <h2>Step 1: Mobile OTP Verification</h2>
                <p className="step-desc">
                  To prevent fraudulent filings and facilitate status updates via SMS, please verify your mobile number. Your identity details are securely stored.
                </p>

                {!verificationToken ? (
                  <form onSubmit={handleSendOtp} className="complaint-form">
                    <label>
                      <span>Your Full Name (Optional)</span>
                      <input
                        type="text"
                        placeholder="e.g. Ramesh Kumar"
                        value={citizenName}
                        onChange={(e) => setCitizenName(e.target.value)}
                      />
                    </label>

                    <label>
                      <span>10-Digit Mobile Number *</span>
                      <input
                        type="tel"
                        required
                        placeholder="e.g. 9876543210"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        maxLength={10}
                      />
                    </label>

                    <label>
                      <span>Masked Aadhaar / ID Reference (Optional)</span>
                      <input
                        type="text"
                        placeholder="e.g. XXXX-XXXX-1234 or Voter ID"
                        value={idReference}
                        onChange={(e) => setIdReference(e.target.value)}
                      />
                      <small className="field-hint">Do not enter full 12-digit Aadhaar. Enter masked 4 digits or ID number.</small>
                    </label>

                    <button type="submit" className="primary full-width" disabled={loading}>
                      {loading ? 'Sending OTP…' : 'Send Verification OTP →'}
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleVerifyOtp} className="complaint-form">
                    <div className="otp-sent-banner">
                      <p>An OTP code has been dispatched to <strong>+91 {phone}</strong></p>
                      {demoOtpNotice && <p className="demo-otp-badge">{demoOtpNotice}</p>}
                    </div>

                    <label>
                      <span>Enter 6-Digit OTP Code *</span>
                      <input
                        type="text"
                        required
                        placeholder="e.g. 123456"
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value)}
                        maxLength={6}
                        className="otp-input-field"
                      />
                    </label>

                    <div className="form-actions-row">
                      <button
                        type="button"
                        className="outline"
                        onClick={() => setVerificationToken('')}
                      >
                        Change Number
                      </button>
                      <button type="submit" className="primary" disabled={loading}>
                        {loading ? 'Verifying…' : 'Verify & Continue →'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}

            {/* STEP 2: SHOP & LOCATION DETAILS */}
            {step === 2 && (
              <div className="wizard-step-content">
                <h2>Step 2: Establishment & Geolocation</h2>
                <p className="step-desc">
                  Identify the shop or merchant. You can search registered establishments or enter unlisted shop details manually.
                </p>

                {qrToken && (
                  <div className="qr-scanned-alert">
                    <span>📱 QR Code Linked: <code>{qrToken.slice(0, 16)}...</code></span>
                    <small>Pre-filled from instrument digital certificate.</small>
                  </div>
                )}

                <div className="complaint-form">
                  <label>
                    <span>Search Registered Shops / Establishments</span>
                    <input
                      type="text"
                      placeholder="Type shop name to search registry..."
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
                            setState(s.state);
                            setDistrict(s.district);
                            if (s.latitude) setLatitude(s.latitude);
                            if (s.longitude) setLongitude(s.longitude);
                            setShopSearchResults([]);
                            setToast(`Selected: ${s.shop_name}`);
                          }}
                        >
                          <strong>{s.shop_name}</strong>
                          <small>{s.address ? `${s.address}, ` : ''}{s.district}, {s.state}</small>
                          {s.is_flagged && <span className="repeat-tag">⚠️ High Risk / Flagged</span>}
                        </div>
                      ))}
                    </div>
                  )}

                  <label>
                    <span>Shop / Trader Name *</span>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Sree Murugan Sweets & Groceries"
                      value={shopName}
                      onChange={(e) => setShopName(e.target.value)}
                    />
                  </label>

                  <div className="grid-2">
                    <label>
                      <span>State *</span>
                      <select value={state} onChange={(e) => {
                        setState(e.target.value);
                        const firstDist = INDIAN_STATES_AND_DISTRICTS[e.target.value]?.[0] || '';
                        setDistrict(firstDist);
                      }}>
                        {INDIAN_STATES.map(st => <option key={st} value={st}>{st}</option>)}
                      </select>
                    </label>

                    <label>
                      <span>District *</span>
                      <select value={district} onChange={(e) => setDistrict(e.target.value)}>
                        {availableDistricts.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </label>
                  </div>

                  <label>
                    <span>Full Address / Landmark</span>
                    <textarea
                      rows={2}
                      placeholder="e.g. No. 14, Main Market Road, Opp. Bus Stand"
                      value={shopAddress}
                      onChange={(e) => setShopAddress(e.target.value)}
                    />
                  </label>

                  {/* GPS Coordinates Capture */}
                  <div className="gps-capture-box">
                    <div className="gps-info">
                      <strong>📍 Geotagged Location</strong>
                      <p>{gpsStatus || 'Capture current GPS coordinates to assist the LMO inspection squad.'}</p>
                      {latitude && (
                        <div className="gps-coords-badge">
                          LAT: {latitude.toFixed(6)} | LNG: {longitude.toFixed(6)} ✓
                        </div>
                      )}
                    </div>
                    <button type="button" className="outline" onClick={captureGps}>
                      {latitude ? 'Recapture GPS' : '📍 Auto-Capture GPS'}
                    </button>
                  </div>

                  <div className="form-actions-row">
                    <button type="button" className="outline" onClick={() => setStep(1)}>
                      ← Back
                    </button>
                    <button
                      type="button"
                      className="primary"
                      disabled={!shopName.trim()}
                      onClick={() => setStep(3)}
                    >
                      Continue to Violation Details →
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3: VIOLATION & EVIDENCE UPLOAD */}
            {step === 3 && (
              <div className="wizard-step-content">
                <h2>Step 3: Violation Description & Photo Evidence</h2>
                <p className="step-desc">
                  Provide details of the non-compliance and upload photos of the scale display, broken seals, or receipts.
                </p>

                <div className="complaint-form">
                  <div className="grid-2">
                    <label>
                      <span>Violation Category *</span>
                      <select
                        value={violationType}
                        onChange={(e) => {
                          setViolationType(e.target.value);
                          if (e.target.value.includes('Seal')) setComplaintCategory('TAMPERED_SEAL');
                          else if (e.target.value.includes('MRP')) setComplaintCategory('OVERCHARGING_MRP');
                          else setComplaintCategory('INCORRECT_WEIGHT');
                        }}
                      >
                        <option value="Short Weight in Retail Goods">Short Weight in Retail Goods (Delivering less quantity)</option>
                        <option value="Unverified / Unstamped Weighing Scale">Unverified / Unstamped Weighing Scale (No LM Stamp)</option>
                        <option value="Tampered Weights or Measurement Device">Tampered Weights or Measurement Device (Modified/Magnetized)</option>
                        <option value="Dual MRP or Overcharging Above MRP">Dual MRP or Overcharging Above MRP (Packaged Commodity)</option>
                        <option value="Inaccurate Petrol / Fuel Dispenser">Inaccurate Petrol / Fuel Dispenser Delivery</option>
                        <option value="Medical Instrument Inaccuracy">Medical Instrument Inaccuracy (Sphygmomanometer/Thermometer)</option>
                        <option value="Non-Standard Units Used">Non-Standard Units Used (e.g. Tola, Seer, Foot)</option>
                      </select>
                    </label>

                    <label>
                      <span>Urgency / Severity</span>
                      <select value={severity} onChange={(e) => setSeverity(e.target.value)}>
                        <option value="LOW">Low (Minor discrepancy)</option>
                        <option value="MEDIUM">Medium (Regular commercial trade violation)</option>
                        <option value="HIGH">High (Widespread consumer fraud)</option>
                        <option value="CRITICAL">Critical (Deliberate tampering / Safety hazard)</option>
                      </select>
                    </label>
                  </div>

                  <label>
                    <span>Detailed Description of Violation *</span>
                    <textarea
                      rows={4}
                      required
                      placeholder="Describe what occurred, what was weighed/measured, expected vs delivered quantity, and trader response..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </label>

                  {/* Multi-Photo Evidence Upload */}
                  <label>
                    <span>Upload Supporting Photos / Evidence (Optional)</span>
                    <input
                      type="file"
                      multiple
                      accept="image/jpeg,image/png,application/pdf,video/mp4"
                      onChange={(e) => {
                        if (e.target.files) {
                          setEvidenceFiles(Array.from(e.target.files));
                        }
                      }}
                    />
                    <small className="field-hint">Upload photos of the weighing machine, display readings, or bill receipt (JPEG, PNG, PDF up to 15MB).</small>
                  </label>

                  {evidenceFiles.length > 0 && (
                    <div className="uploaded-files-preview">
                      <strong>Selected Evidence Files ({evidenceFiles.length}):</strong>
                      <ul>
                        {evidenceFiles.map((f, i) => (
                          <li key={i}>📁 {f.name} ({(f.size / 1024).toFixed(1)} KB)</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="form-actions-row">
                    <button type="button" className="outline" onClick={() => setStep(2)}>
                      ← Back
                    </button>
                    <button
                      type="button"
                      className="primary"
                      disabled={loading || description.length < 10}
                      onClick={handleSubmitComplaint}
                    >
                      {loading ? 'Submitting Complaint…' : '⚖️ Submit Official Complaint'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 4: SUBMITTED CONFIRMATION CARD */}
            {step === 4 && submittedComplaint && (
              <div className="wizard-confirmation-card">
                <div className="conf-icon">✓</div>
                <h2>Complaint Registered Successfully</h2>
                <p className="conf-sub">
                  Your complaint has been logged and assigned to the Regional Legal Metrology Officer for immediate inspection.
                </p>

                <div className="complaint-ref-card">
                  <div className="ref-row">
                    <span>Complaint ID:</span>
                    <strong>{submittedComplaint.complaint_number}</strong>
                  </div>
                  <div className="ref-row">
                    <span>Establishment:</span>
                    <span>{submittedComplaint.shop_name}</span>
                  </div>
                  <div className="ref-row">
                    <span>Jurisdiction:</span>
                    <span>{submittedComplaint.district}, {submittedComplaint.state}</span>
                  </div>
                  <div className="ref-row">
                    <span>Violation Type:</span>
                    <span>{submittedComplaint.violation_type}</span>
                  </div>
                  <div className="ref-row">
                    <span>Initial Status:</span>
                    <Badge>{submittedComplaint.status}</Badge>
                  </div>
                  {submittedComplaint.is_repeat_offender && (
                    <div className="repeat-alert-box">
                      ⚠️ <strong>Repeat Offender Flagged:</strong> High priority inspection assigned to the regional enforcement squad.
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
                    Track Progress in Real-Time →
                  </button>
                  <button
                    className="outline"
                    onClick={() => {
                      setStep(1);
                      setSubmittedComplaint(null);
                      setVerificationToken('');
                      setIsPhoneVerified(false);
                      setEvidenceFiles([]);
                      setDescription('');
                    }}
                  >
                    File Another Complaint
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: TRACK EXISTING COMPLAINT */}
        {/* ========================================================================= */}
        {activeTab === 'TRACK' && (
          <div className="wizard-card">
            <h2>Track Redressal Status</h2>
            <p className="step-desc">
              Enter your Complaint ID (e.g. <code>COMP-TN-2026-000001</code>) and verified phone number to inspect the inspection timeline and officer findings.
            </p>

            <form onSubmit={handleTrackComplaint} className="complaint-track-form">
              <div className="grid-2">
                <label>
                  <span>Complaint Number *</span>
                  <input
                    type="text"
                    required
                    placeholder="e.g. COMP-TN-2026-000001"
                    value={trackNumber}
                    onChange={(e) => setTrackNumber(e.target.value)}
                  />
                </label>
                <label>
                  <span>Registered Mobile (Last 4 Digits or Full)</span>
                  <input
                    type="tel"
                    placeholder="e.g. 9876543210"
                    value={trackPhone}
                    onChange={(e) => setTrackPhone(e.target.value)}
                  />
                </label>
              </div>
              <button type="submit" className="primary" disabled={trackingLoading || !trackNumber.trim()}>
                {trackingLoading ? 'Searching…' : '🔍 Track Status'}
              </button>
            </form>

            {trackingLoading && <Spinner label="Retrieving official complaint record…" />}

            {trackedRecord && (
              <div className="tracked-details-container">
                <div className="tracked-header-bar">
                  <div>
                    <h3>{trackedRecord.shop_name}</h3>
                    <p>{trackedRecord.district}, {trackedRecord.state} • Violation: {trackedRecord.violation_type}</p>
                  </div>
                  <Badge>{trackedRecord.status}</Badge>
                </div>

                {/* Progress Steps Timeline */}
                <div className="complaint-progress-timeline">
                  {['SUBMITTED', 'ASSIGNED', 'IN_INVESTIGATION', 'ACTION_TAKEN', 'RESOLVED'].map((st, idx) => {
                    const statusOrder = ['SUBMITTED', 'ASSIGNED', 'IN_INVESTIGATION', 'ACTION_TAKEN', 'RESOLVED'];
                    const currentIdx = statusOrder.indexOf(trackedRecord.status);
                    const isDone = idx <= currentIdx;
                    return (
                      <div key={st} className={`comp-step ${isDone ? 'done' : ''}`}>
                        <div className="comp-step-circle">{idx + 1}</div>
                        <div className="comp-step-label">{st.replace('_', ' ')}</div>
                      </div>
                    );
                  })}
                </div>

                {/* Official Action & Notes */}
                {trackedRecord.action_taken && (
                  <div className="official-action-box">
                    <strong>⚖️ Officer Action & Findings:</strong>
                    <p>{trackedRecord.action_taken}</p>
                    {trackedRecord.resolution_notes && (
                      <small>Resolution Notes: {trackedRecord.resolution_notes}</small>
                    )}
                  </div>
                )}

                {/* Timeline History */}
                {trackedRecord.timeline && trackedRecord.timeline.length > 0 && (
                  <div className="timeline-history-list">
                    <h4>Investigation Log</h4>
                    {trackedRecord.timeline.map(item => (
                      <div key={item.id} className="timeline-item-card">
                        <div className="item-meta">
                          <strong>{item.action.replace('_', ' ')}</strong>
                          <small>{new Date(item.created_at).toLocaleString()}</small>
                        </div>
                        {item.actor_name && <p className="actor-line">Officer: {item.actor_name} ({item.actor_role})</p>}
                        {item.notes && <p className="notes-line">{item.notes}</p>}
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
