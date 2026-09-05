import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { Badge, Modal, Spinner, Toast } from './UI';

export function OfficerComplaintWorkbench({ token, user }) {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected complaint for action
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [actionStatus, setActionStatus] = useState('ACTION_TAKEN');
  const [actionNotes, setActionNotes] = useState('');
  const [fineAmount, setFineAmount] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);

  const loadComplaints = async () => {
    setLoading(true);
    try {
      const params = {};
      if (statusFilter) params.status = statusFilter;
      if (searchQuery) params.q = searchQuery;
      const data = await api.complaints(token, params);
      setComplaints(data || []);
    } catch (err) {
      setToast(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handler = setTimeout(() => {
      loadComplaints();
    }, 200);
    return () => clearTimeout(handler);
  }, [statusFilter, searchQuery, token]);

  const handleRecordAction = async (e) => {
    e.preventDefault();
    if (!actionNotes.trim()) {
      setToast('Please describe the inspection findings and action taken.');
      return;
    }
    setSubmittingAction(true);
    try {
      await api.recordComplaintAction(selectedComplaint.complaint_number, {
        status: actionStatus,
        action_taken: actionNotes,
        resolution_notes: fineAmount ? `Penalty assessed: ₹${fineAmount}` : undefined,
      }, token);
      setToast(`Investigation action recorded for ${selectedComplaint.complaint_number}!`);
      setSelectedComplaint(null);
      setActionNotes('');
      setFineAmount('');
      loadComplaints();
    } catch (err) {
      setToast(err.message);
    } finally {
      setSubmittingAction(false);
    }
  };

  return (
    <div className="complaint-workbench-container">
      {toast && <Toast message={toast} onClose={() => setToast('')} />}

      <header className="workforce-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.35rem' }}>
            <h2 style={{ margin: 0 }}>⚖️ Citizen Complaint Investigation Workbench</h2>
            {user?.district && (
              <span className="state-tag" style={{ fontSize: '0.78rem' }}>
                📍 {user.district} District Jurisdiction
              </span>
            )}
          </div>
          <p className="step-desc" style={{ margin: 0 }}>
            Investigate reported consumer violations, unverified scales, short measures, and tampered weights in your jurisdiction ({user?.district || 'All Districts'}, {user?.state || 'State'}).
          </p>
        </div>

        <div className="filter-controls-row" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Search shop, complaint ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ padding: '0.45rem 0.85rem', fontSize: '0.85rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', width: '220px' }}
          />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All Statuses</option>
            <option value="ASSIGNED">Assigned (New)</option>
            <option value="IN_INVESTIGATION">Under Investigation</option>
            <option value="ACTION_TAKEN">Action Taken</option>
            <option value="RESOLVED">Resolved</option>
            <option value="DISMISSED">Dismissed</option>
          </select>
        </div>
      </header>

      {loading ? (
        <Spinner label="Loading assigned complaints and evidence…" />
      ) : complaints.length === 0 ? (
        <p className="empty-slots-hint">No active complaints found matching the filter criteria.</p>
      ) : (
        <div className="appointments-table-wrap">
          <table className="appointments-table">
            <thead>
              <tr>
                <th>Complaint ID</th>
                <th>Shop / Establishment</th>
                <th>Violation</th>
                <th>Severity</th>
                <th>Risk Score</th>
                <th>Status</th>
                <th>Filed On</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {complaints.map(c => (
                <tr key={c.id}>
                  <td><strong>{c.complaint_number}</strong></td>
                  <td>
                    <strong>{c.shop_name}</strong>
                    <small style={{ display: 'block', color: 'var(--text-muted)' }}>{c.district}, {c.state}</small>
                    {c.is_repeat_offender && <span className="repeat-tag">⚠️ Repeat Offender</span>}
                  </td>
                  <td>{c.violation_type}</td>
                  <td>
                    <span className={`severity-badge ${c.severity.toLowerCase()}`}>
                      {c.severity}
                    </span>
                  </td>
                  <td>
                    <strong>{c.risk_score} / 100</strong>
                  </td>
                  <td><Badge>{c.status}</Badge></td>
                  <td>{new Date(c.created_at).toLocaleDateString()}</td>
                  <td>
                    <button
                      className="primary small-btn"
                      onClick={() => {
                        setSelectedComplaint(c);
                        setActionStatus(c.status === 'ASSIGNED' ? 'IN_INVESTIGATION' : 'ACTION_TAKEN');
                      }}
                    >
                      Investigate
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Investigation Action Modal */}
      {selectedComplaint && (
        <Modal
          title={`Investigation: ${selectedComplaint.complaint_number}`}
          onClose={() => setSelectedComplaint(null)}
        >
          <div className="complaint-details-summary">
            <p><strong>Establishment:</strong> {selectedComplaint.shop_name} ({selectedComplaint.district}, {selectedComplaint.state})</p>
            <p><strong>Violation:</strong> {selectedComplaint.violation_type}</p>
            <p><strong>Citizen Statement:</strong> {selectedComplaint.description}</p>
            {selectedComplaint.latitude && (
              <p><strong>📍 Geotagged Site GPS:</strong> {selectedComplaint.latitude.toFixed(5)}, {selectedComplaint.longitude.toFixed(5)}</p>
            )}
          </div>

          <form onSubmit={handleRecordAction} className="complaint-form" style={{ marginTop: 16 }}>
            <label>
              <span>Investigation Status *</span>
              <select value={actionStatus} onChange={(e) => setActionStatus(e.target.value)}>
                <option value="IN_INVESTIGATION">In Investigation (Field Visit Scheduled)</option>
                <option value="ACTION_TAKEN">Action Taken (Seizure / Stamping Notice Issued)</option>
                <option value="RESOLVED">Resolved (Merchant Rectified & Compliant)</option>
                <option value="DISMISSED">Dismissed (False Report / No Discrepancy Found)</option>
              </select>
            </label>

            <label>
              <span>Officer Findings & Action Taken *</span>
              <textarea
                rows={3}
                required
                placeholder="Detail on-site test results, working standard comparison, seized weights, or notice issued under Section 15 / Section 24..."
                value={actionNotes}
                onChange={(e) => setActionNotes(e.target.value)}
              />
            </label>

            <label>
              <span>Compounding Fine / Penalty Assessed (₹) (Optional)</span>
              <input
                type="number"
                placeholder="e.g. 5000"
                value={fineAmount}
                onChange={(e) => setFineAmount(e.target.value)}
              />
            </label>

            <div className="form-actions-row">
              <button type="button" className="outline" onClick={() => setSelectedComplaint(null)}>
                Cancel
              </button>
              <button type="submit" className="primary" disabled={submittingAction}>
                {submittingAction ? 'Saving…' : 'Record Official Finding →'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
