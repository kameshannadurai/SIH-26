const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
export async function request(path, { token, method = 'GET', body, headers = {} } = {}) {
  const form = body instanceof FormData || body instanceof URLSearchParams;
  const response = await fetch(`${API_URL}${path}`, { method, headers: { ...(form || !body ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers }, body: form ? body : body ? JSON.stringify(body) : undefined });
  const data = response.status === 204 ? null : await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || data.message || 'Request failed. Please try again.');
  return data;
}
export const api = {
  login: (email,password) => request('/auth/login',{method:'POST',body:new URLSearchParams({username:email,password}),headers:{'Content-Type':'application/x-www-form-urlencoded'}}), me:t=>request('/auth/me',{token:t}),
  register: (body) => request('/auth/register',{method:'POST',body}),
  instruments:t=>request('/instruments',{token:t}), instrument:(id,t)=>request(`/instruments/${encodeURIComponent(id)}`,{token:t}), passport:(id,t)=>request(`/instruments/${encodeURIComponent(id)}/passport`,{token:t}), createInstrument:(b,t)=>request('/instruments',{method:'POST',body:b,token:t}), uploadInstrumentDocument:(id,file,t)=>{const f=new FormData();f.append('file',file);return request(`/instruments/${encodeURIComponent(id)}/documents`,{method:'POST',body:f,token:t})},
  applications:t=>request('/applications',{token:t}), createApplication:(b,t)=>request('/applications',{method:'POST',body:b,token:t}), submitApplication:(n,t)=>request(`/applications/${encodeURIComponent(n)}/submit`,{method:'POST',token:t}),
  assignments:t=>request('/assignments',{token:t}), createAssignment:(b,t)=>request('/assignments',{method:'POST',body:b,token:t}), updateAssignment:(id,b,t)=>request(`/assignments/${id}`,{method:'PUT',body:b,token:t}), completeAssignment:(id,t)=>request(`/assignments/${id}/complete`,{method:'POST',token:t}), createVerification:(b,t)=>request('/verifications',{method:'POST',body:b,token:t}), verification:(id,t)=>request(`/verifications/${id}`,{token:t}), updateVerification:(id,b,t)=>request(`/verifications/${id}`,{method:'PUT',body:b,token:t}), finaliseVerification:(id,decision,t)=>request(`/verifications/${id}/${decision}`,{method:'POST',token:t}), certificates:t=>request('/certificates',{token:t}),
  notifications:t=>request('/notifications',{token:t}), readNotification:(id,t)=>request(`/notifications/${id}/read`,{method:'POST',token:t}), publicCertificate:n=>request(`/public/verify/${encodeURIComponent(n)}`), dashboard:t=>request('/auth/dashboard',{token:t}), auditLogs:t=>request('/admin/audit-logs',{token:t}), enforcement:t=>request('/enforcement',{token:t}),
  aiExtract:(file,t)=>{const f=new FormData();f.append('image',file);return request('/ai/instrument-extract',{method:'POST',body:f,token:t});}
};
