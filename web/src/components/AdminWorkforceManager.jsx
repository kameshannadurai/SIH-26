import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { Badge, Modal, Spinner, Toast } from './UI';

export function AdminWorkforceManager({ token }) {
  const [officers, setOfficers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');

  // Override Modal
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overrideAppNum, setOverrideAppNum] = useState('');
  const [overrideOfficerId, setOverrideOfficerId] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [submittingOverride, setSubmittingOverride] = useState(false);

  const loadOfficers = async () => {
    setLoading(true);
    try {
      const data = await api.adminOfficers(token);
      setOfficers(data || []);
      if (data?.length > 0 && !overrideOfficerId) {
        setOverrideOfficerId(data[0].id);
      }
    } catch (err) {
      setToast(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOfficers();
  }, [token]);

  const handleOverrideSubmit = async (e) => {
    e.preventDefault();
    if (!overrideAppNum.trim() || !overrideOfficerId || !overrideReason.trim()) {
      setToast('Please fill in all required fields.');
      return;
    }
    if (overrideReason.trim().length < 3) {
      setToast('Justification / Reason must be at least 3 characters.');
      return;
    }
    setSubmittingOverride(true);
    try {
      const res = await api.adminOverrideRouting(overrideAppNum, parseInt(overrideOfficerId), overrideReason, token);
      setToast(`Application ${overrideAppNum} successfully reassigned to ${res.assigned_entity?.full_name || 'Officer'}.`);
      setShowOverrideModal(false);
      setOverrideAppNum('');
      setOverrideReason('');
      loadOfficers();
    } catch (err) {
      setToast(err.message);
    } finally {
      setSubmittingOverride(false);
    }
  };

  return (
    <div className="workforce-manager-card">
      {toast && <Toast message={toast} onClose={() => setToast('')} />}

      <header className="workforce-header">
        <div>
          <h2>👥 Field Workforce & Intelligent Assignment Governance</h2>
          <p className="step-desc">
            Monitor real-time verification and citizen complaint workloads across regional LMOs and accredited GATC centres. Automatic routing operates continuously, with administrative override control.
          </p>
        </div>

        <button className="primary" onClick={() => setShowOverrideModal(true)}>
          ⚡ Manual Assignment Override
        </button>
      </header>

      {loading ? (
        <Spinner label="Loading workforce statistics and jurisdiction distribution…" />
      ) : (
        <div className="appointments-table-wrap">
          <table className="appointments-table">
            <thead>
              <tr>
                <th>Officer / Centre Name</th>
                <th>Role</th>
                <th>Jurisdiction</th>
                <th>Email</th>
                <th>Pending Verifications</th>
                <th>Active Complaints</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {officers.map(off => (
                <tr key={off.id}>
                  <td><strong>{off.full_name}</strong></td>
                  <td><Badge>{off.role}</Badge></td>
                  <td>{off.district || 'All Districts'}, {off.state || 'State'}</td>
                  <td>{off.email}</td>
                  <td>
                    <span className={`workload-count ${off.pending_verifications > 5 ? 'high' : ''}`}>
                      {off.pending_verifications}
                    </span>
                  </td>
                  <td>
                    <span className={`workload-count ${off.pending_complaints > 3 ? 'high' : ''}`}>
                      {off.pending_complaints}
                    </span>
                  </td>
                  <td>
                    <button
                      className="outline small-btn"
                      onClick={() => {
                        setOverrideOfficerId(off.id);
                        setShowOverrideModal(true);
                      }}
                    >
                      Assign Task
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Manual Routing Override Modal */}
      {showOverrideModal && (
        <Modal title="Administrative Routing Override" onClose={() => setShowOverrideModal(false)}>
          <form onSubmit={handleOverrideSubmit} className="complaint-form">
            <p className="modal-desc">
              Reassign any verification application to a designated LMO or GATC Centre. All manual interventions are logged into the immutable audit trail.
            </p>

            <label>
              <span>Application Number *</span>
              <input
                type="text"
                required
                placeholder="e.g. LM-APP-TN-2026-000001"
                value={overrideAppNum}
                onChange={(e) => setOverrideAppNum(e.target.value)}
              />
            </label>

            <label>
              <span>Assign To Officer / Centre *</span>
              <select value={overrideOfficerId} onChange={(e) => setOverrideOfficerId(e.target.value)} required>
                {officers.map(off => (
                  <option key={off.id} value={off.id}>
                    {off.full_name} ({off.role} - {off.district || 'All'}, {off.state})
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Justification / Reason *</span>
              <textarea
                rows={3}
                required
                placeholder="e.g. Workload balancing / Specialized testing required at GATC centre"
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
              />
            </label>

            <div className="form-actions-row">
              <button type="button" className="outline" onClick={() => setShowOverrideModal(false)}>
                Cancel
              </button>
              <button type="submit" className="primary" disabled={submittingOverride}>
                {submittingOverride ? 'Reassigning…' : 'Execute Override →'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
