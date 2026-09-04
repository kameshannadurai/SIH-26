const API_URL = import.meta.env.VITE_API_URL || '';

export async function request(path, { token, method = 'GET', body, headers = {} } = {}) {
  const form = body instanceof FormData || body instanceof URLSearchParams;
  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      ...(form || !body ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers
    },
    body: form ? body : body ? JSON.stringify(body) : undefined
  });
  
  if (response.status === 401 && token) {
    // Expired or invalid token
    localStorage.removeItem('lm_auth_token');
    localStorage.removeItem('lm_user_profile');
    if (!window.location.pathname.startsWith('/verify/') && window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
  }

  const data = response.status === 204 ? null : await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || data.message || 'Request failed. Please try again.');
  }
  return data;
}

export const api = {
  // Auth & Profile
  register: (body) => request('/auth/register', { method: 'POST', body }),
  simulatePayment: (body) => request('/auth/simulate-payment', { method: 'POST', body }),
  login: (email, password) => request('/auth/login', {
    method: 'POST',
    body: new URLSearchParams({ username: email, password }),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  }),
  me: (t) => request('/auth/me', { token: t }),
  profile: (t) => request('/auth/profile', { token: t }),
  updateProfile: (b, t) => request('/auth/profile', { method: 'PUT', body: b, token: t }),
  dashboard: (t) => request('/auth/dashboard', { token: t }),

  // Instruments
  instruments: (t, params = {}) => request(`/instruments?${new URLSearchParams(params)}`, { token: t }),
  instrument: (id, t) => request(`/instruments/${encodeURIComponent(id)}`, { token: t }),
  passport: (id, t) => request(`/instruments/${encodeURIComponent(id)}/passport`, { token: t }),
  createInstrument: (b, t) => request('/instruments', { method: 'POST', body: b, token: t }),
  updateInstrument: (id, b, t) => request(`/instruments/${encodeURIComponent(id)}`, { method: 'PUT', body: b, token: t }),
  searchInstruments: (params, t) => request(`/instruments/search?${new URLSearchParams(params)}`, { token: t }),
  dueTracking: (t) => request('/instruments/due-tracking', { token: t }),
  uploadInstrumentDocument: (id, file, t) => {
    const f = new FormData();
    f.append('file', file);
    return request(`/instruments/${encodeURIComponent(id)}/documents`, { method: 'POST', body: f, token: t });
  },

  // Applications
  applications: (t, params = {}) => request(`/applications?${new URLSearchParams(params)}`, { token: t }),
  createApplication: (b, t) => request('/applications', { method: 'POST', body: b, token: t }),
  submitApplication: (num, t) => request(`/applications/${encodeURIComponent(num)}/submit`, { method: 'POST', token: t }),
  cancelApplication: (num, t) => request(`/applications/${encodeURIComponent(num)}/cancel`, { method: 'POST', token: t }),
  uploadApplicationDocument: (num, file, t) => {
    const f = new FormData();
    f.append('file', file);
    return request(`/applications/${encodeURIComponent(num)}/documents`, { method: 'POST', body: f, token: t });
  },

  // Assignments
  assignments: (t, params = {}) => request(`/assignments?${new URLSearchParams(params)}`, { token: t }),
  createAssignment: (b, t) => request('/assignments', { method: 'POST', body: b, token: t }),
  updateAssignment: (id, b, t) => request(`/assignments/${id}`, { method: 'PUT', body: b, token: t }),
  completeAssignment: (id, t) => request(`/assignments/${id}/complete`, { method: 'POST', token: t }),

  // Field Verifications
  createVerification: (b, t) => request('/verifications', { method: 'POST', body: b, token: t }),
  verification: (id, t) => request(`/verifications/${id}`, { token: t }),
  updateVerification: (id, b, t) => request(`/verifications/${id}`, { method: 'PUT', body: b, token: t }),
  finaliseVerification: (id, decision, t) => request(`/verifications/${id}/${decision}`, { method: 'POST', token: t }),
  uploadVerificationEvidence: (id, file, meta = {}, t) => {
    const f = new FormData();
    f.append('file', file);
    if (meta.latitude !== undefined && meta.latitude !== null && meta.latitude !== '') {
      f.append('latitude', meta.latitude);
    }
    if (meta.longitude !== undefined && meta.longitude !== null && meta.longitude !== '') {
      f.append('longitude', meta.longitude);
    }
    if (meta.captured_at) {
      f.append('captured_at', meta.captured_at);
    }
    return request(`/verifications/${id}/evidence`, { method: 'POST', body: f, token: t });
  },

  // Certificates & Public Verification
  certificates: (t, params = {}) => request(`/certificates?${new URLSearchParams(params)}`, { token: t }),
  revokeCertificate: (certNum, reason, t) => request(`/certificates/${encodeURIComponent(certNum)}/revoke`, {
    method: 'POST',
    body: { reason },
    token: t
  }),
  publicCertificate: (identifier) => request(`/public/verify/${encodeURIComponent(identifier)}`),

  // Reference Rules & Assistive AI
  gatcRules: () => request('/gatc-rules'),
  calculateGatcFee: (b) => request('/gatc-rules/calculate-fee', { method: 'POST', body: b }),
  aiExtract: (file, t) => {
    const f = new FormData();
    f.append('image', file);
    return request('/ai/instrument-extract', { method: 'POST', body: f, token: t });
  },
  aiChat: (query, t, contextData = {}) => request('/ai/chat', { method: 'POST', body: { query, context_data: contextData }, token: t }),

  // Citizen Complaints Portal & OTP
  sendOtp: (phone, name) => request('/complaints/otp/send', { method: 'POST', body: { phone_number: phone, citizen_name: name } }),
  verifyOtp: (token, code) => request('/complaints/otp/verify', { method: 'POST', body: { verification_token: token, otp_code: code } }),
  submitComplaint: (b) => request('/complaints', { method: 'POST', body: b }),
  uploadComplaintEvidence: (complaintNum, file, evidenceType = 'PHOTO', lat, lng) => {
    const f = new FormData();
    f.append('file', file);
    f.append('evidence_type', evidenceType);
    if (lat) f.append('latitude', lat);
    if (lng) f.append('longitude', lng);
    return request(`/complaints/${encodeURIComponent(complaintNum)}/evidence`, { method: 'POST', body: f });
  },
  trackComplaint: (complaintNum, phone) => request(`/complaints/track/${encodeURIComponent(complaintNum)}${phone ? `?phone=${encodeURIComponent(phone)}` : ''}`),
  complaints: (t, params = {}) => request(`/complaints?${new URLSearchParams(params)}`, { token: t }),
  complaintDetail: (num, t) => request(`/complaints/${encodeURIComponent(num)}`, { token: t }),
  recordComplaintAction: (num, b, t) => request(`/complaints/${encodeURIComponent(num)}/action`, { method: 'POST', body: b, token: t }),
  assignComplaint: (num, b, t) => request(`/complaints/${encodeURIComponent(num)}/assign`, { method: 'POST', body: b, token: t }),
  searchShops: (q, state, district) => {
    const params = { q };
    if (state) params.state = state;
    if (district) params.district = district;
    return request(`/complaints/shops/search?${new URLSearchParams(params)}`);
  },
  heatmapData: (t, state) => request(`/complaints/analytics/heatmap${state ? `?state=${encodeURIComponent(state)}` : ''}`, { token: t }),
  riskMatrix: (t) => request('/complaints/analytics/risk-matrix', { token: t }),

  // Smart Scheduling & Officer Availability
  setAvailability: (b, t) => request('/scheduling/availability', { method: 'POST', body: b, token: t }),
  getAvailability: (officerId, t) => request(`/scheduling/availability${officerId ? `?officer_id=${officerId}` : ''}`, { token: t }),
  getAvailableSlots: (officerId, targetDate, t) => request(`/scheduling/slots/available?officer_id=${officerId}&target_date=${targetDate}`, { token: t }),
  bookSlot: (b, t) => request('/scheduling/book', { method: 'POST', body: b, token: t }),
  rescheduleSlot: (slotId, b, t) => request(`/scheduling/slots/${slotId}/reschedule`, { method: 'POST', body: b, token: t }),
  cancelSlot: (slotId, reason, t) => request(`/scheduling/slots/${slotId}/cancel${reason ? `?reason=${encodeURIComponent(reason)}` : ''}`, { method: 'POST', token: t }),
  myAppointments: (t) => request('/scheduling/my-appointments', { token: t }),

  // Admin Overrides & Workforce
  adminDashboard: (t) => request('/admin/dashboard', { token: t }),
  adminOfficers: (t) => request('/admin/officers', { token: t }),
  adminOverrideRouting: (appNum, officerId, reason, t) => request('/admin/override-routing', {
    method: 'POST',
    body: { application_number: appNum, target_officer_id: officerId, reason },
    token: t
  }),

  // Notifications, Audit, Enforcement
  notifications: (t) => request('/notifications', { token: t }),
  readNotification: (id, t) => request(`/notifications/${id}/read`, { method: 'POST', token: t }),
  auditLogs: (t) => request('/admin/audit-logs', { token: t }),
  enforcement: (t) => request('/enforcement', { token: t }),
};

