import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { Badge, Spinner, Toast } from './UI';

const DISTRICT_LMO_MAP = {
  chennai: { id: 2, name: 'S. Murugan', role: 'LMO', district: 'Chennai' },
  coimbatore: { id: 3, name: 'K. Balasubramanian', role: 'LMO', district: 'Coimbatore' },
  madurai: { id: 4, name: 'R. Meenakshi Sundaram', role: 'LMO', district: 'Madurai' },
  tiruchirappalli: { id: 5, name: 'V. Soundararajan', role: 'LMO', district: 'Tiruchirappalli' },
  trichy: { id: 5, name: 'V. Soundararajan', role: 'LMO', district: 'Tiruchirappalli' },
  salem: { id: 6, name: 'P. Ramanathan', role: 'LMO', district: 'Salem' },
  tirunelveli: { id: 7, name: 'M. Chelliah', role: 'LMO', district: 'Tirunelveli' },
  vellore: { id: 8, name: 'S. Gomathi', role: 'LMO', district: 'Vellore' },
  erode: { id: 9, name: 'T. Vijayaraghavan', role: 'LMO', district: 'Erode' },
  kanchipuram: { id: 10, name: 'A. Chandrasekhar', role: 'LMO', district: 'Kanchipuram' },
  thanjavur: { id: 11, name: 'N. Vijayalakshmi', role: 'LMO', district: 'Thanjavur' },
};

function getLmoByDistrict(district) {
  if (!district) return DISTRICT_LMO_MAP.chennai;
  const key = String(district).trim().toLowerCase();
  return DISTRICT_LMO_MAP[key] || DISTRICT_LMO_MAP.chennai;
}

function isTestCentreName(name) {
  if (!name) return true;
  const lower = name.toLowerCase();
  return lower.includes('laboratory') || lower.includes('test centre') || lower.includes('testing') || lower.includes('facility') || lower.includes('gatc') || lower.includes('apex');
}

export function SmartScheduler({ user, token, preselectedAppNumber, onSlotBooked }) {
  const isAdmin = user?.role === 'ADMIN';
  const isOfficer = user?.role === 'LMO' || user?.role === 'GATC';
  const isBusiness = user?.role === 'BUSINESS';

  const [activeTab, setActiveTab] = useState(() => {
    if (isAdmin) return 'CONFIG';
    if (isBusiness) return 'BOOK';
    return 'AGENDA';
  });

  const [toast, setToast] = useState('');
  const [loading, setLoading] = useState(false);

  // Admin Officer Selection & Availability State
  const [officersList, setOfficersList] = useState([]);
  const [selectedOfficerId, setSelectedOfficerId] = useState('');
  const [dayOfWeek, setDayOfWeek] = useState(0); // 0=Mon
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [durationMin, setDurationMin] = useState(60);
  const [breakStart, setBreakStart] = useState('13:00');
  const [breakEnd, setBreakEnd] = useState('14:00');
  const [maxDaily, setMaxDaily] = useState(8);
  const [savedAvailabilities, setSavedAvailabilities] = useState([]);

  // Business Booking State
  const [applications, setApplications] = useState([]);
  const [selectedApp, setSelectedApp] = useState(preselectedAppNumber || '');
  const [bookingOfficerId, setBookingOfficerId] = useState(null);
  const [bookingOfficerName, setBookingOfficerName] = useState('');
  const [bookingOfficerDistrict, setBookingOfficerDistrict] = useState('');
  const [bookingOfficerRole, setBookingOfficerRole] = useState('LMO');
  const [targetDate, setTargetDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  });
  const [availableSlots, setAvailableSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [locationNote, setLocationNote] = useState('');

  // Booked Appointments State
  const [myAppointments, setMyAppointments] = useState([]);

  // Load initial data
  const loadInitialData = async () => {
    setLoading(true);
    try {
      if (isAdmin) {
        const officers = await api.adminOfficers(token).catch(() => []);
        setOfficersList(officers || []);
        if (officers?.length > 0 && !selectedOfficerId) {
          setSelectedOfficerId(officers[0].id);
        }
      } else if (isBusiness) {
        const apps = await api.applications(token).catch(() => []);
        const validApps = (apps || []).filter(a => !['CANCELLED', 'REJECTED', 'CERTIFICATE_ISSUED'].includes(a.status));
        setApplications(validApps.length > 0 ? validApps : apps || []);
        if (validApps?.length > 0 && !selectedApp) {
          setSelectedApp(validApps[0].application_number);
        } else if (apps?.length > 0 && !selectedApp) {
          setSelectedApp(apps[0].application_number);
        }
      }
      const appts = await api.myAppointments(token).catch(() => []);
      setMyAppointments(appts || []);
    } catch (err) {
      setToast(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, [user, token]);

  // Load availability when selectedOfficerId changes for Admin
  const loadOfficerAvailability = async (offId) => {
    if (!offId) return;
    try {
      const avails = await api.getAvailability(offId, token);
      setSavedAvailabilities(avails || []);
    } catch (err) {
      setSavedAvailabilities([]);
    }
  };

  useEffect(() => {
    if (isAdmin && selectedOfficerId) {
      loadOfficerAvailability(selectedOfficerId);
    }
  }, [isAdmin, selectedOfficerId, token]);

  // When selected application changes for Business, determine assigned officer
  useEffect(() => {
    if (isBusiness && selectedApp) {
      let isMounted = true;

      const resolveOfficer = async () => {
        try {
          const currentApp = applications.find(a => a.application_number === selectedApp);
          const rawDistrict = currentApp?.district || currentApp?.preferred_location || currentApp?.instrument?.district || 'Chennai';
          const defaultLmo = getLmoByDistrict(rawDistrict);

          // 1. Check existing assignments
          const assignList = await api.assignments(token).catch(() => []);
          const matchAssign = assignList?.find(a => a.application_number === selectedApp);
          if (matchAssign && matchAssign.officer_name && !isTestCentreName(matchAssign.officer_name)) {
            if (isMounted) {
              setBookingOfficerId(matchAssign.officer_id || defaultLmo.id);
              setBookingOfficerName(matchAssign.officer_name);
              setBookingOfficerRole('LMO');
              setBookingOfficerDistrict(matchAssign.officer_district || defaultLmo.district);
            }
            return;
          }

          // 2. Query routing decision for the application
          const routing = await api.routingDecision(selectedApp, token).catch(() => null);
          if (routing?.assigned_entity?.full_name && !isTestCentreName(routing.assigned_entity.full_name)) {
            if (isMounted) {
              setBookingOfficerId(routing.assigned_entity.id || defaultLmo.id);
              setBookingOfficerName(routing.assigned_entity.full_name);
              setBookingOfficerRole('LMO');
              setBookingOfficerDistrict(routing.jurisdiction?.district || defaultLmo.district);
            }
            return;
          }

          // 3. Match from application / district metadata
          const targetDistrict = routing?.jurisdiction?.district || rawDistrict;
          const lmo = getLmoByDistrict(targetDistrict);
          if (isMounted) {
            setBookingOfficerId(lmo.id);
            setBookingOfficerName(lmo.name);
            setBookingOfficerRole('LMO');
            setBookingOfficerDistrict(lmo.district);
          }
        } catch (err) {
          if (isMounted) {
            const fallback = DISTRICT_LMO_MAP.chennai;
            setBookingOfficerId(fallback.id);
            setBookingOfficerName(fallback.name);
            setBookingOfficerRole('LMO');
            setBookingOfficerDistrict(fallback.district);
          }
        }
      };

      resolveOfficer();
      return () => { isMounted = false; };
    }
  }, [selectedApp, isBusiness, token, applications]);

  // Query available slots when bookingOfficerId or targetDate changes for Business
  useEffect(() => {
    if (bookingOfficerId && targetDate) {
      api.getAvailableSlots(bookingOfficerId, targetDate, token).then(slots => {
        setAvailableSlots(slots || []);
      }).catch(() => setAvailableSlots([]));
    }
  }, [bookingOfficerId, targetDate, token]);

  // Save Officer Availability (ADMIN ONLY)
  const handleSaveAvailability = async (e) => {
    e.preventDefault();
    if (!selectedOfficerId) {
      setToast('Please select a target officer.');
      return;
    }
    setLoading(true);
    try {
      await api.setAvailability({
        officer_id: parseInt(selectedOfficerId),
        day_of_week: dayOfWeek,
        start_time: startTime,
        end_time: endTime,
        slot_duration_minutes: durationMin,
        max_daily_inspections: maxDaily,
        break_start: breakStart,
        break_end: breakEnd,
      }, token);
      setToast('Officer working hours & inspection capacity saved successfully!');
      loadOfficerAvailability(selectedOfficerId);
    } catch (err) {
      setToast(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Book Selected Slot (BUSINESS)
  const handleBookSlot = async () => {
    if (!selectedApp || !selectedSlot) {
      setToast('Please select an application and available time slot.');
      return;
    }
    setLoading(true);
    try {
      const res = await api.bookSlot({
        application_number: selectedApp,
        officer_id: bookingOfficerId,
        slot_date: targetDate,
        start_time: selectedSlot.start_time,
        end_time: selectedSlot.end_time,
        location: locationNote || undefined
      }, token);
      setToast(`Appointment booked successfully! Date: ${targetDate} (${selectedSlot.start_time}-${selectedSlot.end_time})`);
      setSelectedSlot(null);
      loadInitialData();
      if (onSlotBooked) onSlotBooked(res);
    } catch (err) {
      setToast(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Cancel Appointment
  const handleCancel = async (slotId) => {
    if (!window.confirm('Are you sure you want to cancel this inspection appointment?')) return;
    try {
      await api.cancelSlot(slotId, 'User requested cancellation', token);
      setToast('Appointment cancelled.');
      loadInitialData();
    } catch (err) {
      setToast(err.message);
    }
  };

  const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  return (
    <div className="scheduler-component-container">
      {toast && <Toast message={toast} onClose={() => setToast('')} />}

      <div className="scheduler-nav-tabs">
        {isAdmin && (
          <>
            <button
              className={`portal-tab ${activeTab === 'CONFIG' ? 'active' : ''}`}
              onClick={() => setActiveTab('CONFIG')}
            >
              ⚙️ Manage Officer Schedules
            </button>
            <button
              className={`portal-tab ${activeTab === 'AGENDA' ? 'active' : ''}`}
              onClick={() => setActiveTab('AGENDA')}
            >
              📅 Master Field Agenda ({myAppointments.length})
            </button>
          </>
        )}

        {isBusiness && (
          <>
            <button
              className={`portal-tab ${activeTab === 'BOOK' ? 'active' : ''}`}
              onClick={() => setActiveTab('BOOK')}
            >
              🗓️ Book Inspection Slot
            </button>
            <button
              className={`portal-tab ${activeTab === 'AGENDA' ? 'active' : ''}`}
              onClick={() => setActiveTab('AGENDA')}
            >
              ✅ My Booked Appointments ({myAppointments.length})
            </button>
          </>
        )}

        {isOfficer && (
          <button
            className={`portal-tab active`}
            onClick={() => setActiveTab('AGENDA')}
          >
            📅 Confirmed Field Agenda ({myAppointments.length})
          </button>
        )}
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: ADMIN SCHEDULE CONFIGURATION (ADMIN ONLY)                          */}
      {/* ========================================================================= */}
      {isAdmin && activeTab === 'CONFIG' && (
        <div className="scheduler-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h2 style={{ margin: 0 }}>⚙️ Centralized Officer Schedule Management</h2>
            <span className="state-tag">Admin Authorization Required</span>
          </div>
          <p className="step-desc">
            Configure working hours, inspection time limits, and shift breaks for jurisdictional LMO and GATC officers. Businesses are only permitted to book within these configured windows.
          </p>

          <form onSubmit={handleSaveAvailability} className="complaint-form">
            <label>
              <span>Select Target Officer (LMO / GATC) *</span>
              <select
                value={selectedOfficerId}
                onChange={(e) => setSelectedOfficerId(e.target.value)}
                required
                style={{ fontWeight: 700, fontSize: '0.95rem' }}
              >
                {officersList.length === 0 && <option value="">Loading active officers...</option>}
                {officersList.map(off => (
                  <option key={off.id} value={off.id}>
                    {off.full_name} ({off.role} · {off.district || off.state}) — {off.email}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid-2">
              <label>
                <span>Working Day *</span>
                <select value={dayOfWeek} onChange={(e) => setDayOfWeek(parseInt(e.target.value))}>
                  <option value={0}>Monday</option>
                  <option value={1}>Tuesday</option>
                  <option value={2}>Wednesday</option>
                  <option value={3}>Thursday</option>
                  <option value={4}>Friday</option>
                  <option value={5}>Saturday (Half Day)</option>
                </select>
              </label>

              <label>
                <span>Slot Duration *</span>
                <select value={durationMin} onChange={(e) => setDurationMin(parseInt(e.target.value))}>
                  <option value={30}>30 Minutes</option>
                  <option value={45}>45 Minutes</option>
                  <option value={60}>60 Minutes (Standard)</option>
                  <option value={90}>90 Minutes (Heavy Instruments)</option>
                </select>
              </label>
            </div>

            <div className="grid-2">
              <label>
                <span>Shift Start Time</span>
                <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
              </label>
              <label>
                <span>Shift End Time</span>
                <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} required />
              </label>
            </div>

            <div className="grid-2">
              <label>
                <span>Break Start Time</span>
                <input type="time" value={breakStart} onChange={(e) => setBreakStart(e.target.value)} />
              </label>
              <label>
                <span>Break End Time</span>
                <input type="time" value={breakEnd} onChange={(e) => setBreakEnd(e.target.value)} />
              </label>
            </div>

            <label>
              <span>Maximum Daily Inspections Allowed</span>
              <input
                type="number"
                min={1}
                max={20}
                value={maxDaily}
                onChange={(e) => setMaxDaily(parseInt(e.target.value))}
              />
            </label>

            <button type="submit" className="primary" disabled={loading || !selectedOfficerId}>
              {loading ? 'Saving Schedule…' : 'Save Officer Working Windows →'}
            </button>
          </form>

          {/* List of Configured Hours for Selected Officer */}
          <div style={{ marginTop: '2rem' }}>
            <h4>Configured Working Windows for Selected Officer:</h4>
            {savedAvailabilities.length === 0 ? (
              <p className="empty-slots-hint">No specific schedule saved for this officer yet. Standard default 09:00 - 17:00 applies.</p>
            ) : (
              <div className="schedule-pills-row">
                {savedAvailabilities.map(av => (
                  <div key={av.id} className="schedule-pill">
                    <strong>{dayNames[av.day_of_week] || 'Custom'}:</strong> {av.start_time} - {av.end_time} ({av.slot_duration_minutes}m slots)
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: BUSINESS APPOINTMENT BOOKING                                       */}
      {/* ========================================================================= */}
      {isBusiness && activeTab === 'BOOK' && (
        <div className="scheduler-card">
          <h2>Book Inspection Appointment Window</h2>
          <p className="step-desc">
            Select an active verification application, pick a date, and select an available, collision-free slot with your assigned jurisdictional officer.
          </p>

          {applications.length === 0 ? (
            <div className="empty-slots-hint" style={{ padding: '2rem', textAlign: 'center' }}>
              <p>You have no pending applications awaiting inspection scheduling.</p>
              <p>Submit an instrument verification application first to unlock appointment booking.</p>
            </div>
          ) : (
            <div className="booking-flow-grid">
              {/* Step 1: Select Application */}
              <label>
                <span>Select Application *</span>
                <select value={selectedApp} onChange={(e) => setSelectedApp(e.target.value)}>
                  {applications.map(a => (
                    <option key={a.application_number} value={a.application_number}>
                      {a.application_number} — {a.instrument_type} ({a.category || 'General'})
                    </option>
                  ))}
                </select>
              </label>

              {/* Step 2: Pick Inspection Date */}
              <label>
                <span>Select Inspection Date *</span>
                <input
                  type="date"
                  value={targetDate}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setTargetDate(e.target.value)}
                />
              </label>

              {/* Officer Badge */}
              <div className="officer-assigned-badge" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', padding: '0.85rem 1.25rem', background: 'rgba(99, 102, 241, 0.08)', borderRadius: '10px', border: '1px solid rgba(99, 102, 241, 0.25)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Assigned Inspector:</span>
                  <strong style={{ color: '#818cf8', fontSize: '1.05rem', fontWeight: '600' }}>
                    {bookingOfficerName || 'S. Murugan'}
                  </strong>
                  {bookingOfficerDistrict && (
                    <span style={{ fontSize: '0.8rem', background: 'rgba(99, 102, 241, 0.2)', color: '#c7d2fe', padding: '2px 8px', borderRadius: '6px', fontWeight: '500' }}>
                      📍 {bookingOfficerDistrict} Legal Metrology Division
                    </span>
                  )}
                </div>
                <span style={{ fontSize: '0.8rem', color: '#a5b4fc', fontWeight: '500', background: 'rgba(255,255,255,0.05)', padding: '3px 10px', borderRadius: '6px' }}>
                  ⚖️ Regional Legal Metrology Officer
                </span>
              </div>

              {/* Available Slots Grid */}
              <div className="slots-grid-section">
                <h4>Available Time Slots for {targetDate}:</h4>
                {availableSlots.length === 0 ? (
                  <p className="empty-slots-hint">No open slots available on this date. Please select another working day.</p>
                ) : (
                  <div className="slots-grid">
                    {availableSlots.map((slot, sIdx) => {
                      const isSelected = selectedSlot?.start_time === slot.start_time;
                      return (
                        <button
                          type="button"
                          key={sIdx}
                          className={`slot-chip ${isSelected ? 'selected' : ''} ${!slot.is_available ? 'booked' : ''}`}
                          disabled={!slot.is_available}
                          onClick={() => setSelectedSlot(slot)}
                        >
                          <span className="slot-time">{slot.start_time} - {slot.end_time}</span>
                          <span className="slot-tag">{slot.is_available ? 'AVAILABLE' : 'BOOKED'}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Location notes */}
              <label style={{ marginTop: '1rem' }}>
                <span>Establishment Inspection Location / Access Notes (Optional)</span>
                <input
                  type="text"
                  placeholder="e.g. Counter 2, Ground Floor, Behind Main Bus Stand"
                  value={locationNote}
                  onChange={(e) => setLocationNote(e.target.value)}
                />
              </label>

              {/* Confirmation Button */}
              {selectedSlot && (
                <div className="slot-confirm-preview">
                  <p>
                    Ready to confirm inspection on <strong>{targetDate}</strong> at <strong>{selectedSlot.start_time} - {selectedSlot.end_time}</strong> with <strong>{bookingOfficerName} ({bookingOfficerDistrict ? `${bookingOfficerDistrict} ` : ''}{bookingOfficerRole || 'LMO'})</strong>.
                  </p>
                  <button type="button" className="primary" onClick={handleBookSlot} disabled={loading}>
                    {loading ? 'Confirming Appointment…' : 'Confirm & Schedule Inspection →'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: CONFIRMED FIELD AGENDA / APPOINTMENTS                              */}
      {/* ========================================================================= */}
      {activeTab === 'AGENDA' && (
        <div className="scheduler-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h2 style={{ margin: 0 }}>
              {isOfficer ? '📅 Confirmed Field Inspection Agenda' : '✅ Scheduled Appointments'}
            </h2>
            {isOfficer && (
              <span className="state-tag" style={{ fontSize: '0.75rem' }}>
                Managed Centrally by Admin
              </span>
            )}
          </div>
          
          {isOfficer && (
            <p className="step-desc">
              Your confirmed verification schedule for scheduled business visits. Working hours and capacity windows are configured by the State Administration.
            </p>
          )}

          {myAppointments.length === 0 ? (
            <p className="empty-slots-hint">No confirmed appointments found.</p>
          ) : (
            <div className="appointments-table-wrap">
              <table className="appointments-table">
                <thead>
                  <tr>
                    <th>Date & Time</th>
                    <th>Application</th>
                    <th>Establishment</th>
                    <th>Inspector / Officer</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {myAppointments.map(appt => (
                    <tr key={appt.id}>
                      <td>
                        <strong>{appt.slot_date}</strong>
                        <small style={{ display: 'block', color: 'var(--text-muted)' }}>{appt.start_time} - {appt.end_time}</small>
                      </td>
                      <td>
                        <strong>{appt.application_number}</strong>
                        <small style={{ display: 'block', color: 'var(--text-muted)' }}>{appt.instrument_type || 'Instrument'}</small>
                      </td>
                      <td>
                        {appt.business_name || 'Business Establishment'}
                        {appt.location && <small style={{ display: 'block', color: 'var(--text-muted)' }}>📍 {appt.location}</small>}
                      </td>
                      <td>{appt.officer_name || 'Assigned Officer'}</td>
                      <td><Badge>{appt.status}</Badge></td>
                      <td>
                        {appt.status === 'BOOKED' && (
                          <button
                            type="button"
                            className="small-danger-btn"
                            onClick={() => handleCancel(appt.id)}
                          >
                            Cancel
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
