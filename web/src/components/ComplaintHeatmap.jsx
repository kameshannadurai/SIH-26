import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { Badge, Spinner } from './UI';
import { INDIAN_STATES } from '../data/indianLocations';

export function ComplaintHeatmap({ token, darkMode }) {
  const [state, setState] = useState('Tamil Nadu');
  const [heatmapData, setHeatmapData] = useState(null);
  const [riskData, setRiskData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.heatmapData(token, state).catch(() => ({ districts: [], total_hotspots: 0, total_active_complaints: 0 })),
      api.riskMatrix(token).catch(() => ({ high_risk_shops: [], repeat_complaints: [] }))
    ]).then(([heat, risk]) => {
      setHeatmapData(heat);
      setRiskData(risk);
      setLoading(false);
    });
  }, [state, token]);

  const densityColors = {
    HIGH: '#ef4444',
    MEDIUM: '#f59e0b',
    LOW: '#10b981'
  };

  return (
    <div className={`analytics-heatmap-container ${darkMode ? 'dark' : ''}`}>
      <header className="heatmap-header">
        <div>
          <h2>🗺️ Geographic Complaint Heatmap & Predictive Risk Matrix</h2>
          <p className="step-desc">
            Real-time geospatial clustering of citizen complaints, repeat offender establishments, and automated multi-factor risk scoring across districts.
          </p>
        </div>

        <div className="state-filter-wrap">
          <label>Filter State:</label>
          <select value={state} onChange={(e) => setState(e.target.value)}>
            {INDIAN_STATES.map(st => <option key={st} value={st}>{st}</option>)}
          </select>
        </div>
      </header>

      {loading ? (
        <Spinner label="Calculating district risk indices and complaint density…" />
      ) : (
        <>
          {/* Top Metric Cards */}
          <div className="grid-3 stats-overview-row">
            <div className="heat-stat-card">
              <span>Active Hotspot Districts</span>
              <strong>{heatmapData?.total_hotspots || 0}</strong>
              <small>Districts with active filed complaints</small>
            </div>
            <div className="heat-stat-card yellow">
              <span>Total Active Complaints</span>
              <strong>{heatmapData?.total_active_complaints || 0}</strong>
              <small>Citizen reports under investigation</small>
            </div>
            <div className="heat-stat-card red">
              <span>Flagged High-Risk Establishments</span>
              <strong>{riskData?.high_risk_shops?.length || 0}</strong>
              <small>Score ≥ 50 / Repeat offenders</small>
            </div>
          </div>

          {/* District Density Visual Grid */}
          <div className="heatmap-visual-card">
            <h3>District-Wise Complaint Density & Risk Profile ({state})</h3>
            
            {(!heatmapData?.districts || heatmapData.districts.length === 0) ? (
              <p className="empty-slots-hint">No active citizen complaints reported in {state} at this time. All districts compliant.</p>
            ) : (
              <div className="districts-density-grid">
                {heatmapData.districts.map(dist => (
                  <div key={dist.district} className={`district-density-card ${dist.density_level.toLowerCase()}`}>
                    <div className="dist-header">
                      <h4>{dist.district}</h4>
                      <span className={`density-badge ${dist.density_level.toLowerCase()}`}>
                        {dist.density_level} DENSITY
                      </span>
                    </div>
                    <div className="dist-body">
                      <div className="dist-metric">
                        <span>Complaints:</span>
                        <strong>{dist.count}</strong>
                      </div>
                      <div className="dist-metric">
                        <span>Avg Risk Score:</span>
                        <strong>{dist.avg_risk_score} / 100</strong>
                      </div>
                      <div className="risk-bar-wrap">
                        <div
                          className="risk-bar-fill"
                          style={{
                            width: `${Math.min(100, dist.avg_risk_score)}%`,
                            backgroundColor: densityColors[dist.density_level]
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Predictive Risk Scoring Matrix */}
          <div className="risk-matrix-card">
            <h3>⚠️ Predictive Risk Matrix — High-Risk Establishments & Repeat Offenders</h3>
            <p className="step-desc">
              Establishments dynamically scored based on historical verification failure rates, repeat citizen complaints, overdue days, and missing seal reports.
            </p>

            {(!riskData?.high_risk_shops || riskData.high_risk_shops.length === 0) ? (
              <p className="empty-slots-hint">No establishments currently exceed the critical risk threshold.</p>
            ) : (
              <div className="appointments-table-wrap">
                <table className="appointments-table">
                  <thead>
                    <tr>
                      <th>Establishment / Trader</th>
                      <th>Location</th>
                      <th>Complaints</th>
                      <th>Violations</th>
                      <th>Risk Score</th>
                      <th>Priority Level</th>
                    </tr>
                  </thead>
                  <tbody>
                    {riskData.high_risk_shops.map(shop => {
                      const level = shop.risk_score >= 75 ? 'CRITICAL' : shop.risk_score >= 50 ? 'HIGH' : 'MEDIUM';
                      return (
                        <tr key={shop.id}>
                          <td>
                            <strong>{shop.shop_name}</strong>
                            {shop.is_flagged && <span className="repeat-tag" style={{ marginLeft: 6 }}>Repeat Offender</span>}
                          </td>
                          <td>{shop.district}, {shop.state}</td>
                          <td>{shop.complaint_count}</td>
                          <td>{shop.violation_count}</td>
                          <td>
                            <strong>{shop.risk_score} / 100</strong>
                          </td>
                          <td>
                            <Badge>{level}</Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
