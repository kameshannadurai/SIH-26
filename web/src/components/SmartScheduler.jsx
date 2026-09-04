import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { Badge, Spinner, Toast } from './UI';

export function SmartScheduler({ user, token, preselectedAppNumber, onSlotBooked }) {
  const isOfficer = user?.role === 'LMO' || user?.role === 'GATC';
  const [activeTab, setActiveTab] = useState(isOfficer ? 'AVAILABILITY' : 'BOOK');
  const [toast, setToast] = useState('');
  const [loading, setLoading] = useState(false);

  // Officer Availability State
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
  const [officerId, setOfficerId] = useState(null);
  const [officerName, setOfficerName] = useState('');
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
  const loadData = async () => {
    setLoading(true);
    try {
      if (isOfficer) {
        const avails = await api.getAvailability(user.id, token);
        setSavedAvailabilities(avails || []);
      } else {
        const apps = await api.applications(token, { status: 'ASSIGNED' });
        setApplications(apps || []);
        if (apps?.length > 0 && !selectedApp) {
          setSelectedApp(apps[0].application_number);
        }
      }
      const appts = await api.myAppointments(token);
      setMyAppointments(appts || []);
    } catch (err) {
      setToast(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user, token]);

  // When selected application changes for Business, determine assigned officer
  useEffect(() => {
    if (!isOfficer && selectedApp) {
      api.applications(token).then(allApps => {
        const app = allApps?.find(a => a.application_number === selectedApp);
        if (app?.assignments?.length > 0) {
          const assign = app.assignments[0];
          setOfficerId(assign.assigned_officer_id);
          setOfficerName(assign.officer_name || 'Assigned Officer');
        } else {
          // Default to demo LMO if unassigned
          setOfficerId(1);
          setOfficerName('Regional Legal Metrology Officer');
        }
      }).catch(() => {});
    }
  }, [selectedApp, isOfficer, token]);

  // Query available slots when officerId or targetDate changes
  useEffect(() => {
    if (officerId && targetDate) {
      api.getAvailableSlots(officerId, targetDate, token).then(slots => {
        setAvailableSlots(slots || []);
      }).catch(() => setAvailableSlots([]));
    }
  }, [officerId, targetDate, token]);

  // Save Officer Availability
  const handleSaveAvailability = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.setAvailability({
        day_of_week: dayOfWeek,
        start_time: startTime,
        end_time: endTime,
        slot_duration_minutes: durationMin,
        max_daily_inspections: maxDaily,
        break_start: breakStart,
        break_end: breakEnd,
      }, token);
      setToast('Working hours & capacity saved successfully!');
      loadData();
    } catch (err) {
      setToast(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Book Selected Slot
  const handleBookSlot = async () => {
    if (!selectedApp || !selectedSlot) {
      setToast('Please select an application and available time slot.');
      return;
    }
    setLoading(true);
    try {
      const res = await api.bookSlot({
        application_number: selectedApp,
        officer_id: officerId,
        slot_date: targetDate,
        start_time: selectedSlot.start_time,
        end_time: selectedSlot.end_time,
        location: locationNote || undefined
      }, token);
      setToast(`Appointment booked successfully! Date: ${targetDate} (${selectedSlot.start_time}-${selectedSlot.end_time})`);
      setSelectedSlot(null);
      loadData();
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
      loadData();
    } catch (err) {
      setToast(err.message);
    }
  };

  return (
    <div className="scheduler-component-container">
      {toast && <Toast message={toast} onClose={() => setToast('')} />}

      <div className="scheduler-nav-tabs">
        {isOfficer ? (
          <>
            <button
              className={`portal-tab ${activeTab === 'AVAILABILITY' ? 'active' : ''}`}
              onClick={() => setActiveTab('AVAILABILITY')}
            >
              ⚙️ Availability & Hours
            </button>
            <button
              className={`portal-tab ${activeTab === 'AGENDA' ? 'active' : ''}`}
              onClick={() => setActiveTab('AGENDA')}
            >
              📅 Confirmed Field Agenda ({myAppointments.length})
            </button>
          </>
        ) : (
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
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: OFFICER AVAILABILITY CONFIGURATION */}
      {/* ========================================================================= */}
      {isOfficer && activeTab === 'AVAILABILITY' && (
        <div className="scheduler-card">
          <h2>Configure Inspection Working Windows</h2>
          <p className="step-desc">
            Define your active field hours, slot duration, and lunch breaks. Businesses in your jurisdiction will only be permitted to book open, non-conflicting slots.
          </p>

          <form onSubmit={handleSaveAvailability} className="complaint-form">
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
              <span>Max Daily Inspections Quota</span>
              <input type="number" min={1} max={20} value={maxDaily} onChange={(e) => setMaxDaily(parseInt(e.target.value))} />
            </label>

            <button type="submit" className="primary" disabled={loading}>
              {loading ? 'Saving…' : '💾 Save Availability Schedule'}
            </button>
          </form>

          {savedAvailabilities.length > 0 && (
            <div className="saved-schedule-summary">
              <h3>Configured Weekly Windows</h3>
              <div className="schedule-pills-row">
                {savedAvailabilities.map(av => {
                  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
                  return (
                    <div key={av.id} className="schedule-pill">
                      <strong>{days[av.day_of_week ?? 0]}:</strong> {av.start_time} - {av.end_time} ({av.slot_duration_minutes}m)
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: BUSINESS SLOT BOOKING */}
      {/* ========================================================================= */}
      {!isOfficer && activeTab === 'BOOK' && (
        <div className="scheduler-card">
          <h2>Select Suitable Verification Time Slot</h2>
          <p className="step-desc">
            Pick a date and choose from the real-time available slots of your assigned Legal Metrology Officer. The slot is automatically reserved upon confirmation.
          </p>

          <div className="complaint-form">
            <div className="grid-2">
              <label>
                <span>Select Application *</span>
                <select value={selectedApp} onChange={(e) => setSelectedApp(e.target.value)}>
                  {applications.map(a => (
                    <option key={a.id} value={a.application_number}>
                      {a.application_number} ({a.application_type}) - Status: {a.status}
                    </option>
                  ))}
                  {applications.length === 0 && <option value="">No applications ready for scheduling</option>}
                </select>
              </label>

              <label>
                <span>Select Inspection Date *</span>
                <input
                  type="date"
                  min={new Date().toISOString().split('T')[0]}
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  required
                />
              </label>
            </div>

            {officerName && (
              <div className="officer-assigned-badge">
                <span>👮 Assigned Officer: <strong>{officerName}</strong></span>
              </div>
            )}

            {/* Available Slots Grid */}
            <div className="slots-grid-section">
              <h3>Available Slots on {new Date(targetDate).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}:</h3>
              
              {availableSlots.length === 0 ? (
                <p className="empty-slots-hint">No open slots available on this date. Officer may be unavailable or slots are fully booked. Please select another date.</p>
              ) : (
                <div className="slots-grid">
                  {availableSlots.map((slot, idx) => (
                    <button
                      key={idx}
                      type="button"
                      disabled={!slot.is_available}
                      className={`slot-chip ${!slot.is_available ? 'booked' : ''} ${selectedSlot?.start_time === slot.start_time ? 'selected' : ''}`}
                      onClick={() => setSelectedSlot(slot)}
                    >
                      <span className="slot-time">{slot.start_time} - {slot.end_time}</span>
                      <span className="slot-tag">{slot.is_available ? 'Available' : 'Booked'}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {selectedSlot && (
              <div className="slot-confirm-preview">
                <p>Selected Slot: <strong>{targetDate} from {selectedSlot.start_time} to {selectedSlot.end_time}</strong></p>
                <label>
                  <span>Premises Notes / Landmark</span>
                  <input
                    type="text"
                    placeholder="e.g. Weighbridge located at Gate 2 entrance"
                    value={locationNote}
                    onChange={(e) => setLocationNote(e.target.value)}
                  />
                </label>
                <button type="button" className="primary" onClick={handleBookSlot} disabled={loading}>
                  {loading ? 'Booking…' : 'Confirm & Reserve Slot →'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: CONFIRMED APPOINTMENTS AGENDA */}
      {/* ========================================================================= */}
      {activeTab === 'AGENDA' && (
        <div className="scheduler-card">
          <h2>{isOfficer ? 'Inspection Schedule Agenda' : 'Your Confirmed Appointments'}</h2>
          
          {myAppointments.length === 0 ? (
            <p className="empty-slots-hint">No confirmed inspection appointments found.</p>
          ) : (
            <div className="appointments-table-wrap">
              <table className="appointments-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Time</th>
                    <th>Application</th>
                    <th>Instrument</th>
                    <th>{isOfficer ? 'Location' : 'Officer'}</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {myAppointments.map(appt => (
                    <tr key={appt.slot_id}>
                      <td><strong>{appt.slot_date}</strong></td>
                      <td>{appt.start_time} - {appt.end_time}</td>
                      <td><code>{appt.application_number || 'N/A'}</code></td>
                      <td>{appt.instrument_type || 'Standard Instrument'}</td>
                      <td>{isOfficer ? (appt.location || 'Field Site') : appt.officer_name}</td>
                      <td><Badge>{appt.status}</Badge></td>
                      <td>
                        <button className="small-danger-btn" onClick={() => handleCancel(appt.slot_id)}>
                          Cancel
                        </button>
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
