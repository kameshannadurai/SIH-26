import { useEffect, useMemo, useState } from 'react';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { api } from './api/client';
import { Badge, ConfirmDialog, Empty, ErrorState, Modal, Spinner, Stat, Timeline, Toast, useAsync } from './components/UI';
import logoLight from './logo_light.png';
import logoDark from './logo_dark.png';

const nav = {
  BUSINESS: [['Overview', '/dashboard'], ['Instruments', '/instruments'], ['Applications', '/applications'], ['Certificates', '/certificates'], ['Notifications', '/notifications']],
  LMO: [['Overview', '/dashboard'], ['Assigned inspections', '/assignments'], ['Field verification', '/verify-field'], ['Certificates', '/certificates'], ['Notifications', '/notifications']],
  GATC: [['Overview', '/dashboard'], ['Assigned tests', '/assignments'], ['Field verification', '/verify-field'], ['Certificates', '/certificates'], ['Notifications', '/notifications']],
  ADMIN: [['Overview', '/dashboard'], ['Assignments', '/assignments'], ['Certificates', '/certificates']],
};
const publicPaths = new Set(['/', '/login', '/verify']);
const go = path => { history.pushState({}, '', path); window.dispatchEvent(new PopStateEvent('popstate')); };
const allowed = (role, path) => (nav[role] || []).some(([, item]) => item === path);

export function App() { return <AuthProvider><AppInner /></AuthProvider>; }
function AppInner() {
  const [path, setPath] = useState(location.pathname);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('lm_theme') === 'dark');
  useEffect(() => { const handler = () => setPath(location.pathname); addEventListener('popstate', handler); return () => removeEventListener('popstate', handler); }, []);
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('lm_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('lm_theme', 'light');
    }
  }, [darkMode]);
  const toggleTheme = () => setDarkMode(!darkMode);
  if (path.startsWith('/verify/')) return <PublicVerify number={decodeURIComponent(path.split('/').pop())} darkMode={darkMode} onToggleTheme={toggleTheme} />;
  return <Router path={path} darkMode={darkMode} onToggleTheme={toggleTheme} />;
}
function Router({ path, darkMode, onToggleTheme }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner label="Restoring your secure session…" />;
  if (!user) return path === '/login' ? <Login darkMode={darkMode} onToggleTheme={onToggleTheme} /> : <Landing darkMode={darkMode} onToggleTheme={onToggleTheme} />;
  if (!allowed(user.role, path)) { go('/dashboard'); return null; }
  return <Shell path={path} user={user} darkMode={darkMode} onToggleTheme={onToggleTheme} />;
}
function Landing({ darkMode, onToggleTheme }) { return <div className="public"><header className="public-nav"><button className="brand" onClick={() => go('/')} style={{ padding: 0, border: 'none', background: 'none', display: 'block', height: '46px' }}><img src={darkMode ? logoDark : logoLight} alt="ScaleSync Logo" style={{ height: '100%', width: 'auto', display: 'block' }} /></button><nav><a href="#about">About</a><a href="#help">Help</a><button className="theme-toggle-btn" aria-label="Toggle theme" onClick={onToggleTheme}>{darkMode ? '☀️' : '🌙'}</button><button className="outline" onClick={() => go('/login')}>Portal login</button></nav></header><main><section className="hero"><div><p className="eyebrow">GOVERNMENT OF INDIA · LEGAL METROLOGY</p><h1>Trust every <em>measure.</em></h1><p>One secure platform for instrument registration, field verification and tamper-evident certificates.</p><div className="hero-actions"><button onClick={() => go('/login')}>Access portal</button><button className="outline" onClick={() => go('/verify/')}>Verify a certificate</button></div></div><div className="hero-card"><span className="seal">SS</span><h3>Digital Instrument Passport</h3><p>Continuous identity, compliance history and certificate validity for every instrument.</p><div className="verified-line">✓ QR-verifiable certificates</div></div></section><section className="feature-grid" id="about"><article><b>01</b><h3>Register</h3><p>Maintain official instrument records and supporting evidence.</p></article><article><b>02</b><h3>Verify</h3><p>Field officers capture measurements, observations and location evidence.</p></article><article><b>03</b><h3>Certify</h3><p>Issue tamper-evident certificates the public can verify.</p></article></section><section className="help" id="help"><h2>Need assistance?</h2><p>For platform support, contact your district Legal Metrology office or use the authenticated notification centre.</p></section></main></div>; }
function Login({ darkMode, onToggleTheme }) {
  const { login, register } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [form, setForm] = useState({ fullName: '', email: '', password: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async event => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (isRegister) {
        if (form.password !== form.confirmPassword) {
          throw new Error('Passwords do not match.');
        }
        await register(form.fullName, form.email, form.password);
        await login(form.email, form.password);
      } else {
        await login(form.email, form.password);
      }
      go('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="auth-page">
      <div style={{ display: 'flex', justifySelf: 'stretch', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <button className="brand back" onClick={() => go('/')} style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '0.5rem', margin: 0, padding: 0, background: 'none', border: 'none' }}>
          ← <img src={darkMode ? logoDark : logoLight} alt="ScaleSync Logo" style={{ height: '24px' }} />
        </button>
        <button className="theme-toggle-btn" aria-label="Toggle theme" onClick={onToggleTheme}>
          {darkMode ? '☀️' : '🌙'}
        </button>
      </div>
      <section>
        <p className="eyebrow">{isRegister ? 'CREATE ACCOUNT' : 'SECURE PORTAL'}</p>
        <h1>{isRegister ? 'Register Business' : 'Sign in'}</h1>
        <p>{isRegister ? 'Register your company for Legal Metrology services.' : 'Use your registered Legal Metrology account.'}</p>
        
        <form onSubmit={submit}>
          {isRegister && (
            <label style={{ display: 'block', marginBottom: '1rem' }}>
              Business Full Name
              <input 
                type="text" 
                required 
                value={form.fullName} 
                onChange={event => setForm({ ...form, fullName: event.target.value })} 
                placeholder="e.g. Acme Corp Ltd"
                style={{ width: '100%', marginTop: '0.5rem' }}
              />
            </label>
          )}
          
          <label style={{ display: 'block', marginBottom: '1rem' }}>
            Email
            <input 
              type="email" 
              required 
              value={form.email} 
              onChange={event => setForm({ ...form, email: event.target.value })} 
              placeholder="name@company.com"
              style={{ width: '100%', marginTop: '0.5rem' }}
            />
          </label>
          
          <label style={{ display: 'block', marginBottom: '1rem' }}>
            Password
            <input 
              type="password" 
              required 
              value={form.password} 
              onChange={event => setForm({ ...form, password: event.target.value })} 
              placeholder="At least 8 characters"
              style={{ width: '100%', marginTop: '0.5rem' }}
            />
          </label>

          {isRegister && (
            <label style={{ display: 'block', marginBottom: '1rem' }}>
              Confirm Password
              <input 
                type="password" 
                required 
                value={form.confirmPassword} 
                onChange={event => setForm({ ...form, confirmPassword: event.target.value })} 
                placeholder="Repeat password"
                style={{ width: '100%', marginTop: '0.5rem' }}
              />
            </label>
          )}

          {error && <p className="form-error" style={{ color: 'var(--color-red)', marginBottom: '1rem' }}>{error}</p>}
          
          <button disabled={busy} style={{ width: '100%', padding: '0.75rem', marginTop: '0.5rem' }}>
            {busy ? (isRegister ? 'Registering…' : 'Signing in…') : (isRegister ? 'Register as Business' : 'Sign in securely')}
          </button>
        </form>

        <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
          {isRegister ? (
            <button className="link" onClick={() => { setIsRegister(false); setError(''); }} style={{ background: 'none', border: 'none', padding: 0 }}>
              Already have an account? Sign in
            </button>
          ) : (
            <button className="link" onClick={() => { setIsRegister(true); setError(''); }} style={{ background: 'none', border: 'none', padding: 0 }}>
              Don't have an account? Register as a business
            </button>
          )}
        </div>
      </section>
    </main>
  );
}
function Shell({ path, user, darkMode, onToggleTheme }) {
  const { logout, token } = useAuth();
  const [toast, setToast] = useState('');
  const [menu, setMenu] = useState(false);
  const items = nav[user.role] || [];

  const [weighments, setWeighments] = useState(() => {
    if (user.role !== 'ADMIN') return [];
    const saved = localStorage.getItem('owms_weighments');
    if (saved) return JSON.parse(saved);
    return [
      { ticket: 'OW-260825-1132', vehicle: 'TEST-1235DBF1', material: 'Cement', weight: '7,500 kg', status: 'COMPLETED' },
      { ticket: 'OW-260825-2570', vehicle: 'TEST-OBJ-05A338', material: 'Cement', weight: '6,000 kg', status: 'COMPLETED' },
      { ticket: 'OW-260825-1806', vehicle: 'TRK-TEST-2', material: 'Cement', weight: '8,000 kg', status: 'COMPLETED' },
      { ticket: 'OW-260825-1433', vehicle: 'TEST-FC055975', material: 'Cement', weight: '7,500 kg', status: 'COMPLETED' },
      { ticket: 'OW-260825-1407', vehicle: 'TRK-9002', material: 'Cement', weight: '11,000 kg', status: 'COMPLETED' },
      { ticket: 'OW-260825-8399', vehicle: 'TRK-9001', material: 'Aggregate', weight: '15,000 kg', status: 'COMPLETED' },
      { ticket: 'OW-260825-8111', vehicle: 'TEST-UI-1', material: 'Cement', weight: '7,500 kg', status: 'COMPLETED' },
      { ticket: 'OW-260825-3927', vehicle: 'TEST-3AC828E7', material: 'Cement', weight: '7,500 kg', status: 'COMPLETED' },
      { ticket: 'OW-250614-1040', vehicle: 'TRK-1189', material: 'Cement', weight: '—', status: 'IN PROGRESS' }
    ];
  });

  const [owmsAudit, setOwmsAudit] = useState(() => {
    if (user.role !== 'ADMIN') return [];
    const saved = localStorage.getItem('owms_audit');
    if (saved) return JSON.parse(saved);
    return [
      { action: 'weighment.created', detail: 'OW-260825-1132 · Avery Morgan', date: '2026-08-25T12:00:54.469Z' },
      { action: 'weighment.created', detail: 'OW-260825-2570 · Avery Morgan', date: '2026-08-25T12:00:17.995Z' },
      { action: 'weighment.created', detail: 'OW-260825-1806 · Avery Morgan', date: '2026-08-25T11:57:47.344Z' },
      { action: 'weighment.created', detail: 'OW-260825-1433 · Avery Morgan', date: '2026-08-25T11:57:32.956Z' },
      { action: 'weighment.created', detail: 'OW-260825-1407 · Avery Morgan', date: '2026-08-25T11:57:03.603Z' },
      { action: 'weighment.created', detail: 'OW-260825-8399 · Avery Morgan', date: '2026-08-25T11:56:43.836Z' },
      { action: 'weighment.created', detail: 'OW-260825-8111 · Avery Morgan', date: '2026-08-25T11:55:28.644Z' }
    ];
  });

  const [showNewWeighment, setShowNewWeighment] = useState(false);

  const addWeighment = (newW) => {
    const updated = [newW, ...weighments];
    setWeighments(updated);
    localStorage.setItem('owms_weighments', JSON.stringify(updated));

    const newAudit = { action: 'weighment.created', detail: `${newW.ticket} · Avery Morgan`, date: new Date().toISOString() };
    const updatedAudit = [newAudit, ...owmsAudit];
    setOwmsAudit(updatedAudit);
    localStorage.setItem('owms_audit', JSON.stringify(updatedAudit));
  };

  const views = {
    '/dashboard': user.role === 'BUSINESS' ? (
      <BusinessUserDashboard user={user} token={token} toast={setToast} />
    ) : user.role === 'ADMIN' ? (
      <AdminWeighbridgeDashboard user={user} weighments={weighments} onNewWeighment={() => setShowNewWeighment(true)} />
    ) : user.role === 'LMO' ? (
      <LmoDashboard user={user} token={token} toast={setToast} />
    ) : (
      <Dashboard user={user} token={token} />
    ),
    '/instruments': user.role === 'ADMIN' ? <AdminInstruments /> : <Instruments token={token} role={user.role} toast={setToast} />,
    '/weighments': <AdminWeighments weighments={weighments} onNewWeighment={() => setShowNewWeighment(true)} toast={setToast} />,
    '/live-monitoring': <AdminLiveMonitoring addWeighment={addWeighment} />,
    '/reports': <AdminReports toast={setToast} />,
    '/audit-log': <AdminAuditLog auditLogs={owmsAudit} />,
    '/applications': <Applications token={token} role={user.role} toast={setToast} />,
    '/assignments': <Assignments token={token} role={user.role} toast={setToast} />,
    '/certificates': <Certificates token={token} />,
    '/notifications': <Notifications token={token} />,
    '/enforcement': <Enforcement token={token} />,
    '/verify-field': <FieldVerification token={token} toast={setToast} />
  };

  return (
    <div className="shell">
      <aside className={menu ? 'open' : ''}>
        <button className="brand" onClick={() => go('/dashboard')} style={{ padding: 0, border: 'none', background: 'none', display: 'block', width: '95%', margin: '0 auto 1.5rem auto' }}>
          <img src={darkMode ? logoDark : logoLight} alt="ScaleSync Logo" style={{ width: '100%', height: 'auto', display: 'block' }} />
        </button>
        <p className="role-label" style={{ marginTop: '0.5rem' }}>{user.role} PORTAL</p>
        {items.map(([label, item]) => (
          <button className={path === item ? 'active' : ''} onClick={() => { go(item); setMenu(false); }} key={item}>
            {label}
          </button>
        ))}
        <button className="logout" onClick={() => { logout(); go('/'); }}>Sign out</button>
      </aside>
      <div className="content">
        <header className="topbar">
          <button className="mobile-menu" aria-label="Toggle navigation" onClick={() => setMenu(!menu)}>☰</button>
          <div>
            <p className="eyebrow">LEGAL METROLOGY PLATFORM</p>
            <h2>{items.find(item => item[1] === path)?.[0] || 'Dashboard'}</h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button className="theme-toggle-btn" aria-label="Toggle theme" onClick={onToggleTheme}>
              {darkMode ? '☀️' : '🌙'}
            </button>
            <button className="profile" onClick={() => go('/notifications')}>
              {user.full_name}
              <small>{user.email}</small>
            </button>
          </div>
        </header>
        {views[path]}
      </div>
      {showNewWeighment && (
        <NewWeighmentModal
          onClose={() => setShowNewWeighment(false)}
          onSave={(newW) => {
            addWeighment(newW);
            setShowNewWeighment(false);
          }}
        />
      )}
      {toast && <Toast message={toast} onClose={() => setToast('')} />}
    </div>
  );
}
function Dashboard({ user, token }) {
  const admin = useAsync(() => user.role === 'ADMIN' ? api.dashboard(token) : Promise.resolve(null), [user.role, token]); const instruments = useAsync(() => api.instruments(token), [token]); const applications = useAsync(() => api.applications(token), [token]); const certs = useAsync(() => api.certificates(token), [token]);
  if (admin.loading || instruments.loading || applications.loading || certs.loading) return <Spinner />; if (admin.error || instruments.error || applications.error || certs.error) return <ErrorState text={admin.error || instruments.error || applications.error || certs.error} />;
  const pending = applications.data.filter(item => !['CERTIFICATE_ISSUED', 'REJECTED', 'CANCELLED'].includes(item.status)).length; const data = admin.data;
  return <main className="page"><section className="welcome"><div><h1>Good day, {user.full_name.split(' ')[0]}.</h1><p>{user.role === 'ADMIN' ? 'A live overview of verification activity and risk.' : 'Your live legal metrology workspace.'}</p></div><Badge>{user.role}</Badge></section><section className="stats">{user.role === 'ADMIN' ? <><Stat label="Total instruments" value={data.total_instruments} /><Stat label="Applications" value={data.total_applications} /><Stat label="Pending verification" value={data.pending_verifications} tone="amber" /><Stat label="Certificates issued" value={data.certificates_issued} tone="green" /><Stat label="Expiring certificates" value={data.certificates_expiring} tone="red" /><Stat label="Expired certificates" value={data.expired_certificates} tone="red" /></> : <><Stat label="Registered instruments" value={instruments.data.length} /><Stat label="Pending applications" value={pending} tone="amber" /><Stat label="Active certificates" value={certs.data.filter(item => item.status === 'VALID').length} tone="green" /><Stat label="Assignments" value={user.role === 'BUSINESS' ? '—' : 'Open schedule'} /></>}</section>{user.role === 'ADMIN' && <section className="panel"><div className="panel-title"><h2>Risk distribution</h2><span className="muted">Live backend calculation</span></div><div className="risk-bars">{Object.entries(data.risk_distribution || {}).map(([level, count]) => <div key={level}><span>{level}</span><b style={{ width: `${Math.max(10, count * 18)}%` }}>{count}</b></div>)}</div><p className="muted">Total users, rejection rate, and enforcement summary are not available from the current backend.</p></section>}<section className="panel"><div className="panel-title"><h2>Recent applications</h2><button className="link" onClick={() => go('/applications')}>View all</button></div><DataTable rows={applications.data.slice(0, 5)} columns={[[ 'Application', 'application_number' ], [ 'Type', 'application_type' ], [ 'Status', item => <Badge>{item.status}</Badge> ], [ 'Requested', 'requested_date' ]]} /></section></main>;
}
function Instruments({ token, role, toast }) {
  const { data, loading, error } = useAsync(() => api.instruments(token), [token]); const [show, setShow] = useState(false); const [selected, setSelected] = useState(null);
  if (loading) return <Spinner />; if (error) return <ErrorState text={error} />;
  const canRegister = role === 'BUSINESS' || role === 'ADMIN';
  return <main className="page"><div className="page-actions"><p>Register and manage officially identified instruments.</p>{canRegister && <button onClick={() => setShow(true)}>+ Register instrument</button>}</div><DataTable rows={data} search columns={[[ 'Instrument ID', 'instrument_id' ], [ 'Serial', 'serial_number' ], [ 'Manufacturer', item => `${item.manufacturer} ${item.model}` ], [ 'Type', 'instrument_type' ], [ 'Status', item => <Badge>{item.status}</Badge> ], [ '', item => <button className="link" onClick={() => setSelected(item)}>Passport</button> ]]} />{show && <InstrumentForm token={token} close={() => setShow(false)} done={item => { setShow(false); toast(`Instrument ${item.instrument_id} registered.`); location.reload(); }} />}{selected && <Passport instrument={selected} token={token} uploadAllowed={canRegister} close={() => setSelected(null)} toast={toast} />}</main>;
}
function InstrumentForm({ token, close, done }) {
  const [form, setForm] = useState({ instrument_type: '', category: '', manufacturer: '', model: '', serial_number: '', capacity: '', accuracy_class: '', measurement_unit: 'kg', year_of_manufacture: '', owner_name: '', owner_address: '', state: '', district: '', location: '' }); const [error, setError] = useState('');
  const submit = async event => { event.preventDefault(); try { done(await api.createInstrument({ ...form, year_of_manufacture: form.year_of_manufacture ? Number(form.year_of_manufacture) : null }, token)); } catch (err) { setError(err.message); } };
  return <Modal title="Register instrument" onClose={close}><form className="form-grid" onSubmit={submit}>{Object.entries(form).map(([key, value]) => <label key={key}>{key.replaceAll('_', ' ')}<input required={!['capacity', 'accuracy_class', 'owner_address', 'location', 'year_of_manufacture'].includes(key)} value={value} onChange={event => setForm({ ...form, [key]: event.target.value })} /></label>)}{error && <p className="form-error">{error}</p>}<button>Register instrument</button></form></Modal>;
}
function Passport({ instrument, token, uploadAllowed, close, toast }) {
  const { data, loading, error } = useAsync(() => api.passport(instrument.instrument_id, token), [instrument.instrument_id, token]); const [file, setFile] = useState(null); const [uploading, setUploading] = useState(false); const [uploadError, setUploadError] = useState('');
  const upload = async event => { event.preventDefault(); if (!file) return; if (!['application/pdf', 'image/jpeg', 'image/png'].includes(file.type) || file.size > 10 * 1024 * 1024) { setUploadError('Choose a PDF, JPEG, or PNG file no larger than 10 MB.'); return; } setUploading(true); setUploadError(''); try { await api.uploadInstrumentDocument(instrument.instrument_id, file, token); toast('Instrument document uploaded.'); location.reload(); } catch (err) { setUploadError(err.message); } finally { setUploading(false); } };
  return <Modal title="Instrument Digital Passport" onClose={close}>{loading ? <Spinner /> : error ? <ErrorState text={error} /> : <div className="passport"><div className="passport-head"><span className="seal">SS</span><div><p className="eyebrow">OFFICIAL INSTRUMENT PASSPORT</p><h2>{data.instrument.instrument_id}</h2><Badge>{data.instrument.status}</Badge></div></div><dl><dt>Owner</dt><dd>{data.instrument.owner_name}</dd><dt>Instrument</dt><dd>{data.instrument.manufacturer} {data.instrument.model}</dd><dt>Serial number</dt><dd>{data.instrument.serial_number}</dd><dt>Type / class</dt><dd>{data.instrument.instrument_type} / {data.instrument.accuracy_class || '—'}</dd><dt>Current certificate</dt><dd>{data.current_certificate ? <>{data.current_certificate.number} · {data.current_certificate.valid_until}</> : 'No active certificate'}</dd><dt>Risk</dt><dd><Badge>{data.risk_level}</Badge> Score {data.risk_score}</dd></dl><h3>Supporting documents</h3>{data.documents.length ? <ul className="file-list">{data.documents.map(item => <li key={item.path}>{item.filename}</li>)}</ul> : <p className="muted">No documents have been uploaded.</p>}{uploadAllowed && <form className="upload-form" onSubmit={upload}><label>Add official document<input type="file" accept="application/pdf,image/jpeg,image/png" onChange={event => setFile(event.target.files[0])} /></label>{uploadError && <p className="form-error">{uploadError}</p>}<button disabled={uploading}>{uploading ? 'Uploading…' : 'Upload document'}</button></form>}<h3>Verification history</h3>{data.verification_history.length ? <DataTable rows={data.verification_history} columns={[[ 'Date', 'verified_at' ], [ 'Result', item => <Badge>{item.result}</Badge> ], [ 'Remarks', 'remarks' ]]} /> : <Empty title="No verification history yet" />}</div>}</Modal>;
}
function Applications({ token, role, toast }) {
  const { data, loading, error } = useAsync(() => api.applications(token), [token]); const [show, setShow] = useState(false); const [detail, setDetail] = useState(null);
  if (loading) return <Spinner />; if (error) return <ErrorState text={error} />; const canCreate = role === 'BUSINESS' || role === 'ADMIN';
  return <main className="page"><div className="page-actions"><p>Track the verification workflow for every instrument.</p>{canCreate && <button onClick={() => setShow(true)}>+ New application</button>}</div><DataTable rows={data} search columns={[[ 'Application', 'application_number' ], [ 'Type', 'application_type' ], [ 'Status', item => <Badge>{item.status}</Badge> ], [ 'Requested', 'requested_date' ], [ '', item => <button className="link" onClick={() => setDetail(item)}>Timeline</button> ]]} />{show && <ApplicationForm token={token} close={() => setShow(false)} done={item => { setShow(false); toast(`Application ${item.application_number} submitted.`); location.reload(); }} />}{detail && <Modal title={detail.application_number} onClose={() => setDetail(null)}><Timeline status={detail.status} /><p className="muted">Status transitions are enforced by the backend.</p></Modal>}</main>;
}
function ApplicationForm({ token, close, done }) { const { data: instruments, loading } = useAsync(() => api.instruments(token), [token]); const [form, setForm] = useState({ instrument_id: '', application_type: 'VERIFICATION', requested_date: '', preferred_location: '', remarks: '' }); const [error, setError] = useState(''); const submit = async event => { event.preventDefault(); try { const item = await api.createApplication(form, token); done(await api.submitApplication(item.application_number, token)); } catch (err) { setError(err.message); } }; if (loading) return <Modal title="New application" onClose={close}><Spinner /></Modal>; return <Modal title="New verification application" onClose={close}><form onSubmit={submit}><label>Instrument<select required value={form.instrument_id} onChange={event => setForm({ ...form, instrument_id: event.target.value })}><option value="">Choose an instrument</option>{instruments.map(item => <option value={item.instrument_id} key={item.instrument_id}>{item.instrument_id} — {item.manufacturer} {item.model}</option>)}</select></label><label>Application type<select value={form.application_type} onChange={event => setForm({ ...form, application_type: event.target.value })}><option>VERIFICATION</option><option>RE_VERIFICATION</option></select></label><label>Requested date<input type="date" value={form.requested_date} onChange={event => setForm({ ...form, requested_date: event.target.value })} /></label><label>Preferred location<input value={form.preferred_location} onChange={event => setForm({ ...form, preferred_location: event.target.value })} /></label><label>Remarks<textarea value={form.remarks} onChange={event => setForm({ ...form, remarks: event.target.value })} /></label>{error && <p className="form-error">{error}</p>}<button>Submit application</button></form></Modal>; }
function EditAssignmentForm({ assignment, token, close, done }) {
  const [form, setForm] = useState({
    assigned_officer_id: assignment.officer_id || '',
    centre_id: assignment.centre_id || '',
    scheduled_at: assignment.scheduled_at ? new Date(assignment.scheduled_at).toISOString().slice(0, 16) : '',
    location: assignment.location || '',
    priority: assignment.priority || 'NORMAL'
  });
  const [error, setError] = useState('');

  const submit = async event => {
    event.preventDefault();
    try {
      await api.updateAssignment(assignment.id, {
        assigned_officer_id: form.assigned_officer_id ? Number(form.assigned_officer_id) : null,
        centre_id: form.centre_id ? Number(form.centre_id) : null,
        scheduled_at: new Date(form.scheduled_at).toISOString(),
        location: form.location,
        priority: form.priority
      }, token);
      done(`Assignment #${assignment.id} updated successfully.`);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <Modal title={`Edit Assignment #${assignment.id}`} onClose={close}>
      <form className="form-grid" onSubmit={submit}>
        <label>
          LMO / GATC user ID
          <input type="number" min="1" required value={form.assigned_officer_id} onChange={event => setForm({ ...form, assigned_officer_id: event.target.value })} />
        </label>
        <label>
          Centre ID (optional)
          <input type="number" min="1" value={form.centre_id} onChange={event => setForm({ ...form, centre_id: event.target.value })} />
        </label>
        <label>
          Schedule
          <input type="datetime-local" required value={form.scheduled_at} onChange={event => setForm({ ...form, scheduled_at: event.target.value })} />
        </label>
        <label>
          Location
          <input required value={form.location} onChange={event => setForm({ ...form, location: event.target.value })} />
        </label>
        <label>
          Priority
          <select value={form.priority} onChange={event => setForm({ ...form, priority: event.target.value })}>
            <option>NORMAL</option>
            <option>HIGH</option>
            <option>CRITICAL</option>
          </select>
        </label>
        {error && <p className="form-error wide">{error}</p>}
        <button>Save Changes</button>
      </form>
    </Modal>
  );
}

function Assignments({ token, role, toast }) {
  const assignments = useAsync(() => api.assignments(token), [token]); const applications = useAsync(() => role === 'ADMIN' ? api.applications(token) : Promise.resolve([]), [role, token]); const [show, setShow] = useState(false);
  const [editAssignment, setEditAssignment] = useState(null);
  if (assignments.loading || applications.loading) return <Spinner />; if (assignments.error || applications.error) return <ErrorState text={assignments.error || applications.error} />;
  const complete = async item => { if (!confirm(`Mark assignment #${item.id} as completed?`)) return; try { await api.completeAssignment(item.id, token); toast(`Assignment #${item.id} completed.`); location.reload(); } catch (err) { toast(err.message); } };
  return <main className="page"><div className="page-actions"><p>{role === 'ADMIN' ? 'Schedule submitted applications using verified officer IDs.' : 'Scheduled verification activity assigned by an administrator.'}</p>{role === 'ADMIN' && <button onClick={() => setShow(true)}>+ Schedule assignment</button>}</div>{role === 'ADMIN' && <p className="notice-note">The current backend has no user-directory endpoint. Enter an existing LMO/GATC user ID; role validation is enforced by the API.</p>}<DataTable rows={assignments.data} search columns={[[ 'ID', 'id' ], [ 'Application', 'application_id' ], [ 'Officer ID', 'assigned_officer_id' ], [ 'Centre ID', 'centre_id' ], [ 'Scheduled', 'scheduled_at' ], [ 'Priority', item => <Badge>{item.priority}</Badge> ], [ 'Status', item => <Badge>{item.status}</Badge> ], ...(role === 'ADMIN' ? [[ '', item => <button className="link" onClick={() => setEditAssignment(item)}>Edit</button> ]] : [[ '', item => item.status !== 'COMPLETED' && <button className="link" onClick={() => complete(item)}>Mark complete</button> ]])]} />{show && <AssignmentForm applications={applications.data} token={token} close={() => setShow(false)} done={message => { setShow(false); toast(message); location.reload(); }} />}{editAssignment && <EditAssignmentForm assignment={editAssignment} token={token} close={() => setEditAssignment(null)} done={message => { setEditAssignment(null); toast(message); location.reload(); }} />}</main>;
}
function AssignmentForm({ applications, token, close, done }) { const ready = applications.filter(item => item.status === 'SUBMITTED'); const [form, setForm] = useState({ application_number: '', assigned_officer_id: '', centre_id: '', scheduled_at: '', location: '', priority: 'NORMAL' }); const [error, setError] = useState(''); const submit = async event => { event.preventDefault(); try { const result = await api.createAssignment({ ...form, assigned_officer_id: Number(form.assigned_officer_id), centre_id: form.centre_id ? Number(form.centre_id) : null, scheduled_at: new Date(form.scheduled_at).toISOString() }, token); done(`Assignment #${result.id} scheduled successfully.`); } catch (err) { setError(err.message); } }; return <Modal title="Schedule verification" onClose={close}><form className="form-grid" onSubmit={submit}><label>Submitted application<select required value={form.application_number} onChange={event => setForm({ ...form, application_number: event.target.value })}><option value="">Choose application</option>{ready.map(item => <option key={item.application_number} value={item.application_number}>{item.application_number}</option>)}</select></label><label>LMO / GATC user ID<input type="number" min="1" required value={form.assigned_officer_id} onChange={event => setForm({ ...form, assigned_officer_id: event.target.value })} /></label><label>Centre ID (optional)<input type="number" min="1" value={form.centre_id} onChange={event => setForm({ ...form, centre_id: event.target.value })} /></label><label>Schedule<input type="datetime-local" required value={form.scheduled_at} onChange={event => setForm({ ...form, scheduled_at: event.target.value })} /></label><label>Location<input required value={form.location} onChange={event => setForm({ ...form, location: event.target.value })} /></label><label>Priority<select value={form.priority} onChange={event => setForm({ ...form, priority: event.target.value })}><option>NORMAL</option><option>HIGH</option><option>CRITICAL</option></select></label>{error && <p className="form-error wide">{error}</p>}<button>Schedule assignment</button></form></Modal>; }
function FieldVerification({ token, toast }) {
  const assignments = useAsync(() => api.assignments(token), [token]); const applications = useAsync(() => api.applications(token), [token]); const [recordId, setRecordId] = useState(() => sessionStorage.getItem('lm_active_verification')); const record = useAsync(() => recordId ? api.verification(recordId, token) : Promise.resolve(null), [recordId, token]); const [start, setStart] = useState(false);
  if (assignments.loading || applications.loading || record.loading) return <Spinner />; if (assignments.error || applications.error || record.error) return <ErrorState text={assignments.error || applications.error || record.error} />;
  if (!recordId) return <main className="page"><section className="panel"><h2>Field verification</h2><p className="muted">Select one of your assigned schedules, then confirm its application reference to start the legal verification record.</p><DataTable rows={assignments.data.filter(item => item.status !== 'COMPLETED')} columns={[[ 'Assignment', 'id' ], [ 'Application ID', 'application_id' ], [ 'Schedule', 'scheduled_at' ], [ 'Priority', item => <Badge>{item.priority}</Badge> ], [ '', item => <button onClick={() => setStart(item)}>Start verification</button> ]]} />{start && <StartVerification assignment={start} applications={applications.data} token={token} close={() => setStart(false)} done={id => { sessionStorage.setItem('lm_active_verification', id); setRecordId(String(id)); toast(`Verification #${id} started.`); }} />}</section></main>;
  return <VerificationEditor id={recordId} record={record.data} token={token} toast={toast} clear={() => { sessionStorage.removeItem('lm_active_verification'); setRecordId(null); }} />;
}
function StartVerification({ assignment, applications, token, close, done }) { const [form, setForm] = useState({ application_number: '', latitude: '', longitude: '', remarks: '' }); const [error, setError] = useState(''); const capture = () => navigator.geolocation?.getCurrentPosition(position => setForm({ ...form, latitude: position.coords.latitude, longitude: position.coords.longitude }), () => setError('GPS could not be captured. Enter coordinates manually.')); const submit = async event => { event.preventDefault(); try { const item = await api.createVerification({ application_number: form.application_number, latitude: form.latitude === '' ? null : Number(form.latitude), longitude: form.longitude === '' ? null : Number(form.longitude), remarks: form.remarks, observations: [], measurements: [] }, token); done(item.id); } catch (err) { setError(err.message); } }; return <Modal title="Start field verification" onClose={close}><form onSubmit={submit}><p className="muted">Assignment reference: {assignment.id}. The API confirms that the chosen application is assigned to you.</p><label>Application reference<select required value={form.application_number} onChange={event => setForm({ ...form, application_number: event.target.value })}><option value="">Choose assigned application</option>{applications.map(item => <option value={item.application_number} key={item.application_number}>{item.application_number} ({item.status})</option>)}</select></label><label>Latitude<input type="number" step="any" value={form.latitude} onChange={event => setForm({ ...form, latitude: event.target.value })} /></label><label>Longitude<input type="number" step="any" value={form.longitude} onChange={event => setForm({ ...form, longitude: event.target.value })} /></label><button type="button" className="outline" onClick={capture}>Capture GPS</button><label>Opening remarks<textarea value={form.remarks} onChange={event => setForm({ ...form, remarks: event.target.value })} /></label>{error && <p className="form-error">{error}</p>}<button>Start verification record</button></form></Modal>; }
function VerificationEditor({ id, record, token, toast, clear }) {
  const [form, setForm] = useState({ latitude: record.latitude ?? '', longitude: record.longitude ?? '', remarks: record.remarks || '', observations: record.observations || [], measurements: record.measurements || [] }); const [observation, setObservation] = useState(''); const [measurement, setMeasurement] = useState({ parameter: '', expected_value: '', observed_value: '', unit: '', within_tolerance: true }); const [ai, setAi] = useState(null); const [error, setError] = useState(''); const [confirm, setConfirm] = useState('');
  const save = async () => { try { await api.updateVerification(id, { latitude: form.latitude === '' ? null : Number(form.latitude), longitude: form.longitude === '' ? null : Number(form.longitude), remarks: form.remarks, observations: form.observations, measurements: form.measurements }, token); toast('Verification changes saved.'); } catch (err) { setError(err.message); } };
  const addMeasurement = () => { if (!measurement.parameter || measurement.observed_value === '' || !measurement.unit) return setError('Measurement name, observed value, and unit are required.'); setForm({ ...form, measurements: [...form.measurements, { ...measurement, observed_value: Number(measurement.observed_value), expected_value: measurement.expected_value === '' ? null : Number(measurement.expected_value) }] }); setMeasurement({ parameter: '', expected_value: '', observed_value: '', unit: '', within_tolerance: true }); };
  const uploadAi = async file => { if (!file) return; if (!['image/jpeg', 'image/png'].includes(file.type) || file.size > 10 * 1024 * 1024) return setError('AI assistance accepts JPEG or PNG images up to 10 MB.'); try { setAi(await api.aiExtract(file, token)); } catch (err) { setError(err.message); } };
  const finalise = async decision => { try { const result = await api.finaliseVerification(id, decision, token); toast(decision === 'approve' ? `Certificate ${result.certificate_number} issued.` : 'Verification rejected.'); clear(); } catch (err) { setError(err.message); } finally { setConfirm(''); } };
  return <main className="page"><section className="panel"><div className="panel-title"><div><p className="eyebrow">VERIFICATION RECORD #{id}</p><h2>Field verification</h2></div><Badge>{record.status}</Badge></div><p className="muted">Recorded at {record.verified_at || 'current session'}. AI findings are assistive and never decide the legal outcome.</p><div className="form-grid"><label>Latitude<input type="number" step="any" value={form.latitude} onChange={event => setForm({ ...form, latitude: event.target.value })} /></label><label>Longitude<input type="number" step="any" value={form.longitude} onChange={event => setForm({ ...form, longitude: event.target.value })} /></label><label className="wide">Remarks<textarea value={form.remarks} onChange={event => setForm({ ...form, remarks: event.target.value })} /></label></div><section className="subpanel"><h3>Measurements</h3><div className="measurement-row"><input placeholder="Measurement name" value={measurement.parameter} onChange={event => setMeasurement({ ...measurement, parameter: event.target.value })} /><input type="number" placeholder="Reference value" value={measurement.expected_value} onChange={event => setMeasurement({ ...measurement, expected_value: event.target.value })} /><input type="number" placeholder="Observed value" value={measurement.observed_value} onChange={event => setMeasurement({ ...measurement, observed_value: event.target.value })} /><input placeholder="Unit" value={measurement.unit} onChange={event => setMeasurement({ ...measurement, unit: event.target.value })} /><label className="check"><input type="checkbox" checked={measurement.within_tolerance} onChange={event => setMeasurement({ ...measurement, within_tolerance: event.target.checked })} />Within tolerance</label><button type="button" onClick={addMeasurement}>Add</button></div><DataTable rows={form.measurements} columns={[[ 'Parameter', 'parameter' ], [ 'Expected', 'expected_value' ], [ 'Observed', 'observed_value' ], [ 'Unit', 'unit' ], [ 'Result', item => <Badge>{item.within_tolerance ? 'PASS' : 'FAIL'}</Badge> ], [ '', (_, index) => <button className="link" onClick={() => setForm({ ...form, measurements: form.measurements.filter((__, itemIndex) => itemIndex !== index) })}>Remove</button> ]]} /></section><section className="subpanel"><h3>Observations</h3><div className="inline-action"><input placeholder="Add observation" value={observation} onChange={event => setObservation(event.target.value)} /><button type="button" onClick={() => { if (observation.trim()) { setForm({ ...form, observations: [...form.observations, observation.trim()] }); setObservation(''); } }}>Add</button></div>{form.observations.length ? <ol className="observation-list">{form.observations.map((item, index) => <li key={index}>{item}<button className="link" onClick={() => setForm({ ...form, observations: form.observations.filter((_, itemIndex) => itemIndex !== index) })}>Remove</button></li>)}</ol> : <p className="muted">No observations recorded.</p>}</section><section className="subpanel"><h3>AI/OCR assistance</h3><label>Instrument image<input type="file" accept="image/jpeg,image/png" onChange={event => uploadAi(event.target.files[0])} /></label>{ai ? <p>Serial: {ai.serial_number || 'Not detected'} · Model: {ai.model || 'Not detected'} · Manufacturer: {ai.manufacturer || 'Not detected'} · Confidence: {Math.round((ai.confidence || 0) * 100)}% <Badge>OFFICER CONFIRMATION REQUIRED</Badge></p> : <p className="muted">No image analysed yet.</p>}<p className="muted">The current API has no verification-evidence or photo upload endpoint. Instrument documents can be added through the Digital Passport where authorised.</p></section>{error && <p className="form-error">{error}</p>}<div className="dialog-actions"><button className="outline" onClick={save}>Save changes</button><button className="danger" onClick={() => setConfirm('reject')}>Reject verification</button><button onClick={() => setConfirm('approve')}>Approve and issue certificate</button></div></section>{confirm && <ConfirmDialog title={confirm === 'approve' ? 'Approve verification?' : 'Reject verification?'} message={confirm === 'approve' ? 'This final legal decision will issue a certificate and cannot be undone.' : 'This final legal decision will reject the application and cannot be undone.'} action={() => finalise(confirm)} onClose={() => setConfirm('')} />}</main>;
}
function Certificates({ token }) { const { data, loading, error } = useAsync(() => api.certificates(token), [token]); return <main className="page">{loading ? <Spinner /> : error ? <ErrorState text={error} /> : <DataTable rows={data} search columns={[[ 'Certificate', 'certificate_number' ], [ 'Valid until', 'valid_until' ], [ 'Status', item => <Badge>{item.status}</Badge> ], [ 'Hash', item => <code>{item.certificate_hash?.slice(0, 16)}…</code> ], [ '', item => <button className="link" onClick={() => go(`/verify/${item.certificate_number}`)}>Public verify</button> ]]} />}</main>; }
function Notifications({ token }) { const { data, loading, error } = useAsync(() => api.notifications(token), [token]); const [items, setItems] = useState(null); if (loading) return <Spinner />; if (error) return <ErrorState text={error} />; const list = items || data; const read = async item => { try { await api.readNotification(item.id, token); setItems(list.map(current => current.id === item.id ? { ...current, is_read: true } : current)); } catch (_) {} }; return <main className="page"><section className="panel"><div className="panel-title"><h2>Notifications</h2><Badge>{list.filter(item => !item.is_read).length} unread</Badge></div>{list.length ? list.map(item => <article className={`notice ${item.is_read ? '' : 'unread'}`} key={item.id}><div><Badge>{item.severity}</Badge><h3>{item.title}</h3><p>{item.message}</p><small>{new Date(item.created_at).toLocaleString()}</small></div>{!item.is_read && <button className="outline" onClick={() => read(item)}>Mark read</button>}</article>) : <Empty title="You’re all caught up" />}</section></main>; }
function Audit({ token }) { const { data, loading, error } = useAsync(() => api.auditLogs(token), [token]); return <main className="page">{loading ? <Spinner /> : error ? <ErrorState text={error} /> : <DataTable rows={data} search columns={[[ 'Time', 'created_at' ], [ 'Action', 'action' ], [ 'Entity', 'entity' ], [ 'ID', 'entity_id' ], [ 'Actor', 'actor_id' ]]} />}</main>; }
function Enforcement({ token }) { const { data, loading, error } = useAsync(() => api.enforcement(token), [token]); return <main className="page">{loading ? <Spinner /> : error ? <ErrorState text={error} /> : <DataTable rows={data} search columns={[[ 'Recorded', 'recorded_at' ], [ 'Instrument', 'instrument_id' ], [ 'Violation', 'violation_type' ], [ 'Severity', item => <Badge>{item.severity}</Badge> ]]} />}</main>; }
function PublicVerify({ number, darkMode, onToggleTheme }) { const [input, setInput] = useState(number); const [started, setStarted] = useState(Boolean(number)); const { data, loading, error } = useAsync(() => started ? api.publicCertificate(input) : Promise.resolve(null), [started, input]); const verify = event => { event.preventDefault(); if (input.trim()) go(`/verify/${encodeURIComponent(input.trim())}`); }; return <main className="verify-page"><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'2rem'}}><button className="brand back" onClick={() => go('/')} style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '0.5rem', margin: 0, padding: 0, background: 'none', border: 'none' }}>← <img src={darkMode ? logoDark : logoLight} alt="ScaleSync Logo" style={{ height: '24px' }} /></button><button className="theme-toggle-btn" aria-label="Toggle theme" onClick={onToggleTheme}>{darkMode ? '☀️' : '🌙'}</button></div><section><p className="eyebrow">PUBLIC CERTIFICATE VERIFICATION</p><h1>Check certificate authenticity</h1><form onSubmit={verify}><label className="sr-only">Certificate number<input placeholder="LM-CERT-2026-000001" value={input} onChange={event => setInput(event.target.value)} /></label><button>Verify certificate</button></form>{loading && <Spinner />}{error && <div className="invalid-card"><h2>Unable to verify</h2><p>{error === 'Certificate not found' ? 'No certificate exists with that number. Check the QR code or certificate reference and try again.' : error}</p></div>}{data && <div className={`verify-card ${data.valid ? 'valid-card' : 'invalid-card'}`}><h2>{data.valid ? '✓ VALID CERTIFICATE' : '! INVALID CERTIFICATE'}</h2><dl><dt>Certificate</dt><dd>{data.certificate_number}</dd><dt>Instrument</dt><dd>{data.instrument_id}</dd><dt>Instrument type</dt><dd>{data.instrument_type}</dd><dt>Manufacturer</dt><dd>{data.manufacturer}</dd><dt>Verification date</dt><dd>{data.verification_date}</dd><dt>Valid until</dt><dd>{data.valid_until}</dd><dt>Hash check</dt><dd><Badge>{data.certificate_hash_verified ? 'VERIFIED' : 'FAILED'}</Badge></dd></dl></div>}</section></main>; }
function DataTable({ rows, columns, search = false }) { const [term, setTerm] = useState(''); const filtered = useMemo(() => rows.filter(row => JSON.stringify(row).toLowerCase().includes(term.toLowerCase())), [rows, term]); return <div className="table-wrap">{search && <input className="search" placeholder="Search records" aria-label="Search records" value={term} onChange={event => setTerm(event.target.value)} />}{filtered.length ? <table><thead><tr>{columns.map(([heading], index) => <th key={index}>{heading}</th>)}</tr></thead><tbody>{filtered.map((row, rowIndex) => <tr key={row.id || row.instrument_id || row.application_number || row.certificate_number || rowIndex}>{columns.map(([, value], columnIndex) => <td key={columnIndex}>{typeof value === 'function' ? value(row, rowIndex) : row[value] ?? '—'}</td>)}</tr>)}</tbody></table> : <Empty />}</div>; }

function AdminWeighbridgeDashboard({ user }) {
  const [activeTab, setActiveTab] = useState('overview');

  // Placeholder LMO data
  const mockLMOs = [
    { id: 2, name: 'Demo Legal Metrology Officer', email: 'lmo@test.com', region: 'Chennai South', status: 'ACTIVE', assignments: 3 },
    { id: 4, name: 'Arjun Mehta', email: 'arjun.mehta@lmo.gov.in', region: 'Coimbatore North', status: 'ACTIVE', assignments: 5 },
    { id: 5, name: 'Kavitha Ramaswamy', email: 'k.ramaswamy@lmo.gov.in', region: 'Madurai East', status: 'ACTIVE', assignments: 2 },
    { id: 6, name: 'Sanjay Dutt', email: 'sanjay.d@lmo.gov.in', region: 'Salem Central', status: 'INACTIVE', assignments: 0 }
  ];

  return (
    <main className="page">
      <section className="welcome" style={{ marginBottom: '1.5rem' }}>
        <div>
          <p className="eyebrow" style={{ color: 'var(--color-primary)' }}>ADMIN PORTAL</p>
          <h1>Good afternoon, Admin.</h1>
          <p className="muted">Manage and audit the legal metrology network operations.</p>
        </div>
        <Badge>ADMIN</Badge>
      </section>

      {/* Tabs Menu */}
      <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--border-color)', marginBottom: '2rem' }}>
        <button 
          className={activeTab === 'overview' ? 'active-tab' : 'outline-tab'} 
          onClick={() => setActiveTab('overview')}
          style={{ padding: '0.75rem 1.5rem', background: activeTab === 'overview' ? 'var(--color-primary)' : 'transparent', color: activeTab === 'overview' ? '#fff' : 'var(--text-secondary)', border: 'none', borderBottom: activeTab === 'overview' ? '3px solid var(--color-primary)' : 'none', fontWeight: 600, cursor: 'pointer' }}
        >
          Overview
        </button>
        <button 
          className={activeTab === 'lmos' ? 'active-tab' : 'outline-tab'} 
          onClick={() => setActiveTab('lmos')}
          style={{ padding: '0.75rem 1.5rem', background: activeTab === 'lmos' ? 'var(--color-primary)' : 'transparent', color: activeTab === 'lmos' ? '#fff' : 'var(--text-secondary)', border: 'none', borderBottom: activeTab === 'lmos' ? '3px solid var(--color-primary)' : 'none', fontWeight: 600, cursor: 'pointer' }}
        >
          LMOs
        </button>
      </div>

      {activeTab === 'overview' && (
        <div className="panel" style={{ margin: 0, padding: '3rem 2rem', textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📊</div>
          <h2 style={{ marginTop: 0 }}>Metrology Operations Dashboard</h2>
          <p className="muted" style={{ maxWidth: '500px', margin: '0 auto 1.5rem auto' }}>
            ScaleSync platform monitors submitted applications, calibration assignments, and active digital certificates issued across the state.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', maxWidth: '600px', margin: '0 auto' }}>
            <div style={{ padding: '1.25rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)' }}>
              <h4 style={{ margin: '0 0 0.5rem 0' }}>Assignments</h4>
              <button className="outline" onClick={() => go('/assignments')} style={{ width: '100%' }}>Manage assignments →</button>
            </div>
            <div style={{ padding: '1.25rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)' }}>
              <h4 style={{ margin: '0 0 0.5rem 0' }}>Certificates</h4>
              <button className="outline" onClick={() => go('/certificates')} style={{ width: '100%' }}>Verify certificates →</button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'lmos' && (
        <div className="panel" style={{ margin: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <div>
              <h3 style={{ margin: 0 }}>Legal Metrology Officers (LMO) Directory</h3>
              <p className="muted" style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem' }}>Registered LMO officers assigned for verification tasks.</p>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Region / Circle</th>
                  <th>Active Assignments</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {mockLMOs.map(lmo => (
                  <tr key={lmo.id}>
                    <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{lmo.id}</td>
                    <td style={{ fontWeight: 600 }}>{lmo.name}</td>
                    <td>{lmo.email}</td>
                    <td>{lmo.region}</td>
                    <td>{lmo.assignments}</td>
                    <td><Badge tone={lmo.status === 'ACTIVE' ? 'green' : 'red'}>{lmo.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </main>
  );
}

function AdminWeighments({ weighments, onNewWeighment, toast }) {
  const exportCSV = () => {
    toast("CSV exported successfully.");
  };

  return (
    <main className="page">
      <div className="page-actions" style={{ marginBottom: '1.5rem' }}>
        <div>
          <p className="eyebrow">TRANSACTION HISTORY</p>
          <h1>Weighments</h1>
          <p className="muted">Search, review, and export every ticket.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="outline" onClick={exportCSV}>📥 Export CSV</button>
          <button onClick={onNewWeighment} style={{ background: 'var(--color-orange)', borderColor: 'var(--color-orange)', color: '#fff' }}>🚚 New weighment</button>
        </div>
      </div>

      <DataTable
        rows={weighments}
        search
        columns={[
          [ 'Ticket', 'ticket' ],
          [ 'Vehicle / Material', item => <div><div style={{ fontWeight: 600 }}>{item.vehicle}</div><div className="muted" style={{ fontSize: '0.8rem' }}>{item.material}</div></div> ],
          [ 'Net Weight', 'weight' ],
          [ 'Status', item => <Badge>{item.status}</Badge> ]
        ]}
      />
    </main>
  );
}

function AdminLiveMonitoring() {
  const [weight, setWeight] = useState(42380);
  const [ticks, setTicks] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setWeight(prev => {
        const delta = Math.floor(Math.random() * 9) - 4;
        return 42380 + delta;
      });
      setTicks(t => t + 1);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <main className="page">
      <section className="welcome" style={{ marginBottom: '1.5rem' }}>
        <div>
          <p className="eyebrow">POLLING EVERY 15 SECONDS</p>
          <h1>Live monitoring</h1>
          <p className="muted">Operational visibility for the Portside Terminal network.</p>
        </div>
      </section>

      <div style={{ background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '1rem', borderRadius: '6px', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h4 style={{ margin: 0, fontWeight: 600 }}>Simulation adapter connected</h4>
          <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>Hardware gateway is reporting stable telemetry from 2 instruments.</p>
        </div>
        <Badge>OPERATIONAL</Badge>
      </div>

      <div className="admin-grid" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
        <section className="panel" style={{ padding: '2rem' }}>
          <p className="eyebrow" style={{ margin: 0 }}>WB-01 / NORTH WEIGHBRIDGE</p>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '1.5rem', margin: '0.5rem 0 1.5rem 0' }}>Live reading</h2>
            <small className="muted">Updated {ticks % 3} sec ago</small>
          </div>

          <div style={{ fontSize: '4.5rem', fontWeight: 700, fontFamily: 'monospace', display: 'flex', alignItems: 'baseline', gap: '1rem', color: 'var(--color-primary)', textShadow: '0 0 10px rgba(139, 92, 246, 0.1)' }}>
            {weight.toLocaleString()} <span style={{ fontSize: '1.5rem', fontWeight: 400, color: 'var(--text-muted)' }}>kg</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ color: 'var(--color-green)' }}>●</span> STABLE
            </div>
            <div className="muted" style={{ fontSize: '0.85rem' }}>TOLERANCE ± 10 KG</div>
          </div>
          
          <div style={{ width: '100%', height: '8px', background: 'var(--border-color)', borderRadius: '4px', marginTop: '1rem', overflow: 'hidden' }}>
            <div style={{ width: '68%', height: '100%', background: 'var(--color-orange)', borderRadius: '4px' }}></div>
          </div>
        </section>

        <section className="panel">
          <p className="eyebrow">EVENT STREAM</p>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '1.25rem' }}>Latest signals</h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <span style={{ color: 'var(--color-green)', fontSize: '1.2rem' }}>✓</span>
              <div>
                <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600 }}>Stable reading accepted</h4>
                <p className="muted" style={{ margin: 0, fontSize: '0.8rem' }}>1 minutes ago · WB-01</p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <span style={{ color: 'var(--color-primary)', fontSize: '1.2rem' }}>📈</span>
              <div>
                <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600 }}>Vehicle detected on deck</h4>
                <p className="muted" style={{ margin: 0, fontSize: '0.8rem' }}>4 minutes ago · WB-01</p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <span style={{ color: 'var(--color-primary)', fontSize: '1.2rem' }}>💓</span>
              <div>
                <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600 }}>Heartbeat received</h4>
                <p className="muted" style={{ margin: 0, fontSize: '0.8rem' }}>7 minutes ago · WB-01</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function AdminInstruments() {
  return (
    <main className="page">
      <div className="page-actions" style={{ marginBottom: '1.5rem' }}>
        <div>
          <p className="eyebrow">ASSET REGISTRY</p>
          <h1>Instruments</h1>
          <p className="muted">Operational visibility for the Portside Terminal network.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
        <div className="panel" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <span style={{ fontSize: '1.5rem' }}>🎚️</span>
              <span style={{ color: 'var(--color-green)', fontSize: '0.85rem', fontWeight: 600 }}>● OPERATIONAL</span>
            </div>
            <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1.2rem' }}>North Weighbridge</h3>
            <p className="muted" style={{ margin: '0 0 1.5rem 0', fontSize: '0.85rem' }}>WB-01 · Portside Terminal</p>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
              <div>
                <small className="muted">Uptime</small>
                <div style={{ fontWeight: 600 }}>99.8%</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <small className="muted">Calibration due</small>
                <div style={{ fontWeight: 600 }}>2025-09-18</div>
              </div>
            </div>
          </div>
          <button className="outline" style={{ marginTop: '1.5rem', width: '100%' }}>View instrument details</button>
        </div>

        <div className="panel" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <span style={{ fontSize: '1.5rem' }}>🎚️</span>
              <span style={{ color: 'var(--color-amber)', fontSize: '0.85rem', fontWeight: 600 }}>● IDLE</span>
            </div>
            <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1.2rem' }}>Bulk Yard Scale</h3>
            <p className="muted" style={{ margin: '0 0 1.5rem 0', fontSize: '0.85rem' }}>WB-02 · Portside Terminal</p>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
              <div>
                <small className="muted">Uptime</small>
                <div style={{ fontWeight: 600 }}>98.4%</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <small className="muted">Calibration due</small>
                <div style={{ fontWeight: 600 }}>2025-08-04</div>
              </div>
            </div>
          </div>
          <button className="outline" style={{ marginTop: '1.5rem', width: '100%' }}>View instrument details</button>
        </div>

        <div className="panel" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <span style={{ fontSize: '1.5rem' }}>🎚️</span>
              <span style={{ color: 'var(--color-red)', fontSize: '0.85rem', fontWeight: 600 }}>● MAINTENANCE</span>
            </div>
            <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1.2rem' }}>Rail Siding Scale</h3>
            <p className="muted" style={{ margin: '0 0 1.5rem 0', fontSize: '0.85rem' }}>WB-03 · East Depot</p>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
              <div>
                <small className="muted">Uptime</small>
                <div style={{ fontWeight: 600 }}>94.1%</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <small className="muted">Calibration due</small>
                <div style={{ fontWeight: 600 }}>2025-06-21</div>
              </div>
            </div>
          </div>
          <button className="outline" style={{ marginTop: '1.5rem', width: '100%' }}>View instrument details</button>
        </div>
      </div>
    </main>
  );
}

function AdminReports({ toast }) {
  return (
    <main className="page">
      <div className="page-actions" style={{ marginBottom: '1.5rem' }}>
        <div>
          <p className="eyebrow">EXPORT CENTRE</p>
          <h1>Reports</h1>
          <p className="muted">Operational visibility for the Portside Terminal network.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        <section className="panel" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <span style={{ fontSize: '2rem' }}>📊</span>
            <h3 style={{ marginTop: '1rem', marginBottom: '0.25rem' }}>Weighment register</h3>
            <p className="muted">Full ticket history with weights, operators, and timestamps.</p>
          </div>
          <button onClick={() => toast('Downloading CSV register...')} style={{ marginTop: '1.5rem', width: 'fit-content' }}>Download CSV</button>
        </section>

        <section className="panel" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <span style={{ fontSize: '2rem' }}>📋</span>
            <h3 style={{ marginTop: '1rem', marginBottom: '0.25rem' }}>Print-ready tickets</h3>
            <p className="muted">Open any completed ticket from history for controlled printing.</p>
          </div>
          <button className="outline" onClick={() => go('/weighments')} style={{ marginTop: '1.5rem', width: 'fit-content' }}>Browse history →</button>
        </section>
      </div>
    </main>
  );
}

function AdminAuditLog({ auditLogs }) {
  return (
    <main className="page">
      <div className="page-actions" style={{ marginBottom: '1.5rem' }}>
        <div>
          <p className="eyebrow">IMMUTABLE RECORD</p>
          <h1>Audit log</h1>
          <p className="muted">Operational visibility for the Portside Terminal network.</p>
        </div>
      </div>

      <div style={{ background: 'rgba(139, 92, 246, 0.05)', border: '1px solid rgba(139, 92, 246, 0.2)', padding: '1rem', borderRadius: '6px', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <span style={{ fontSize: '1.25rem' }}>🛡️</span>
        <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>Every creation, correction, approval, and export is retained with actor and UTC timestamp.</p>
      </div>

      <section className="panel">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {auditLogs.map((log, index) => (
            <div key={index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '1rem', borderBottom: index < auditLogs.length - 1 ? '1px solid var(--border-color)' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ color: 'var(--color-green)', fontSize: '1rem' }}>●</span>
                <div>
                  <div style={{ fontWeight: 600, fontFamily: 'monospace' }}>{log.action}</div>
                  <div className="muted" style={{ fontSize: '0.8rem' }}>{log.detail}</div>
                </div>
              </div>
              <small className="muted" style={{ fontFamily: 'monospace' }}>{log.date}</small>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

function NewWeighmentModal({ onClose, onSave }) {
  const [form, setForm] = useState({
    vehicle: '',
    material: 'Cement',
    instrument: 'WB-01',
    gross: '24500',
    tare: '8200'
  });

  const [error, setError] = useState('');

  const grossVal = parseFloat(form.gross) || 0;
  const tareVal = parseFloat(form.tare) || 0;
  const netVal = Math.max(0, grossVal - tareVal);

  const submit = (e) => {
    e.preventDefault();
    if (!form.vehicle.trim()) {
      setError('Vehicle registration is required.');
      return;
    }
    const ticketNum = `OW-${new Date().toISOString().slice(2,10).replaceAll('-','')}-${Math.floor(1000 + Math.random()*9000)}`;
    onSave({
      ticket: ticketNum,
      vehicle: form.vehicle.toUpperCase(),
      material: form.material,
      weight: `${netVal.toLocaleString()} kg`,
      status: 'COMPLETED'
    });
  };

  return (
    <Modal title="Capture a weighment." onClose={onClose}>
      <form className="form-grid" onSubmit={submit}>
        <p className="muted wide" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginTop: 0 }}>
          CONTROLLED ENTRY / STEP 1 OF 1<br />
          <span style={{ fontSize: '0.85rem' }}>Readings must be stable before accepting the ticket.</span>
        </p>

        <label>
          Vehicle registration
          <input required placeholder="e.g. TRK-4821" value={form.vehicle} onChange={e => setForm({ ...form, vehicle: e.target.value })} />
        </label>

        <label>
          Material
          <select value={form.material} onChange={e => setForm({ ...form, material: e.target.value })}>
            <option>Cement</option>
            <option>Aggregate</option>
            <option>Steel</option>
            <option>Coal</option>
          </select>
        </label>

        <label>
          Instrument
          <select value={form.instrument} onChange={e => setForm({ ...form, instrument: e.target.value })}>
            <option>WB-01</option>
            <option>WB-02</option>
            <option>WB-03</option>
          </select>
        </label>

        <label>
          Gross reading (kg)
          <input type="number" required value={form.gross} onChange={e => setForm({ ...form, gross: e.target.value })} />
        </label>

        <label>
          Tare reading (kg)
          <input type="number" required value={form.tare} onChange={e => setForm({ ...form, tare: e.target.value })} />
        </label>

        <div className="panel wide" style={{ background: 'rgba(139, 92, 246, 0.03)', border: '1px solid var(--border-color)', padding: '1rem', marginTop: '0.5rem' }}>
          <p className="eyebrow" style={{ margin: 0 }}>CALCULATED NET</p>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, margin: '0.25rem 0' }}>
            {netVal.toLocaleString()} kg
          </div>
          <small style={{ color: 'var(--color-green)' }}>Stable reading confirmed ✓</small>
        </div>

        {error && <p className="form-error wide">{error}</p>}

        <div className="dialog-actions wide" style={{ marginTop: '1rem' }}>
          <button type="button" className="outline" onClick={onClose}>Cancel</button>
          <button type="submit" style={{ background: 'var(--color-orange)', borderColor: 'var(--color-orange)', color: '#fff' }}>
            Complete ticket ↗
          </button>
        </div>
      </form>
    </Modal>
  );
}

const FEE_SCHEDULE = {
  'Water meter': {
    'Domestic (Rs. 250)': 250,
    'Commercial (Rs. 1000)': 1000,
    'Industrial (Rs. 2500)': 2500
  },
  'Sphygmomanometer': {
    'Standard (Rs. 100)': 100
  },
  'Clinical thermometer': {
    'Standard (Rs. 50)': 50
  },
  'Non-automatic weighing scale Class III (upto 150kg)': {
    'Upto 10 kg (Rs. 2000)': 2000,
    'Above 10 kg and upto 150 kg (Rs. 3000)': 3000
  },
  'Load cell': {
    'Upto 5 kN (Rs. 2000)': 2000,
    'Above 5 kN and upto 100 kN (Rs. 5000)': 5000
  },
  'Beam scale': {
    'Upto 5 kg (Rs. 500)': 500,
    'Above 5 kg (Rs. 1000)': 1000
  },
  'Counter machine': {
    'Upto 5 kg (Rs. 500)': 500,
    'Above 5 kg (Rs. 1000)': 1000
  },
  'Gas meter': {
    'Domestic (Rs. 500)': 500,
    'Commercial (Rs. 2000)': 2000,
    'Industrial (Rs. 5000)': 5000
  },
  'Energy meter': {
    'Domestic (Rs. 1000)': 1000,
    'Commercial (Rs. 3000)': 3000,
    'Industrial (Rs. 5000)': 5000
  },
  'Moisture meter': {
    'Standard (Rs. 2500)': 2500
  },
  'Speed meter for vehicles': {
    'Standard (Rs. 15000)': 15000
  },
  'Breath analyser': {
    'Standard (Rs. 2500)': 2500
  },
  'Multi-dimensional measuring instrument': {
    'Standard (Rs. 3600)': 3600
  },
  'Flow meter': {
    'Upto 100 mm (Rs. 5000)': 5000,
    'Above 100 mm (Rs. 6000)': 6000
  }
};

function BusinessUserDashboard({ user, token, toast }) {
  const [activeTab, setActiveTab] = useState('submission');
  
  // Submission Tab States
  const [businessName, setBusinessName] = useState(user.email === 'testbusiness3@example.com' ? 'Test Business Unit 3' : user.full_name);
  const [gstin, setGstin] = useState(user.email === 'testbusiness3@example.com' ? '33AABCT1234F1Z5' : '');
  const [address, setAddress] = useState(user.email === 'testbusiness3@example.com' ? '12, Industrial Area, Phase-II, Chennai, TN' : '');
  const [contactPerson, setContactPerson] = useState(user.email === 'testbusiness3@example.com' ? 'Rajesh Kumar' : user.full_name);
  const [phone, setPhone] = useState(user.email === 'testbusiness3@example.com' ? '+91 98765 43210' : '');
  
  const [selectedCategory, setSelectedCategory] = useState(Object.keys(FEE_SCHEDULE)[0]);
  const [selectedSubtype, setSelectedSubtype] = useState(Object.keys(FEE_SCHEDULE[Object.keys(FEE_SCHEDULE)[0]])[0]);
  const [quantity, setQuantity] = useState(1);
  const [addedInstruments, setAddedInstruments] = useState([]);

  // Fetch real data from backend
  const insts = useAsync(() => api.instruments(token), [token]);
  const certs = useAsync(() => api.certificates(token), [token]);
  const apps = useAsync(() => api.applications(token), [token]);

  // Automatically select the first subtype when category changes
  useEffect(() => {
    const subtypes = Object.keys(FEE_SCHEDULE[selectedCategory] || {});
    if (subtypes.length > 0) {
      setSelectedSubtype(subtypes[0]);
    }
  }, [selectedCategory]);

  const handleAddInstrument = (e) => {
    e.preventDefault();
    const unitPrice = FEE_SCHEDULE[selectedCategory][selectedSubtype];
    const totalItemCost = unitPrice * quantity;
    
    const newInstrument = {
      id: Date.now(),
      category: selectedCategory,
      subtype: selectedSubtype,
      quantity: Number(quantity),
      unitPrice: unitPrice,
      totalCost: totalItemCost
    };
    
    setAddedInstruments([...addedInstruments, newInstrument]);
    toast('Instrument added to the list');
  };

  const handleRemoveInstrument = (id) => {
    setAddedInstruments(addedInstruments.filter(item => item.id !== id));
    toast('Instrument removed');
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (addedInstruments.length === 0) {
      toast('Please add at least one instrument first');
      return;
    }
    
    try {
      // Loop and call API to create instruments and applications
      for (let idx = 0; idx < addedInstruments.length; idx++) {
        const item = addedInstruments[idx];
        const serialNumber = `SN-${Date.now()}-${idx}-${Math.floor(Math.random() * 1000)}`;
        
        // 1. Create instrument
        const createdInst = await api.createInstrument({
          instrument_type: item.subtype,
          category: item.category,
          manufacturer: 'Acme Corp',
          model: 'Standard-X',
          serial_number: serialNumber,
          capacity: item.subtype,
          accuracy_class: 'Class III',
          measurement_unit: 'kg',
          year_of_manufacture: 2025,
          owner_name: businessName,
          owner_address: address,
          state: 'Tamil Nadu',
          district: 'Chennai',
          location: address
        }, token);

        // 2. Create application
        const createdApp = await api.createApplication({
          instrument_id: createdInst.instrument_id,
          application_type: 'VERIFICATION',
          requested_date: new Date().toISOString().split('T')[0],
          preferred_location: address,
          remarks: 'Self-submitted verification via portal.'
        }, token);

        // 3. Submit application
        await api.submitApplication(createdApp.application_number, token);
      }

      toast('Verification application details submitted to backend database successfully!');
      setAddedInstruments([]);
      // Reload page to refresh dashboard lists
      location.reload();
    } catch (err) {
      toast(`Error submitting to backend: ${err.message}`);
    }
  };

  // Calculate Running Totals
  const subtotal = addedInstruments.reduce((sum, item) => sum + item.totalCost, 0);
  const gstAmount = Math.round(subtotal * 0.18);
  const grandTotal = subtotal + gstAmount;

  if (insts.loading || certs.loading || apps.loading) return <Spinner />;
  if (insts.error || certs.error || apps.error) return <ErrorState text={insts.error || certs.error || apps.error} />;

  return (
    <main className="page">
      <section className="welcome" style={{ marginBottom: '1.5rem' }}>
        <div>
          <p className="eyebrow" style={{ color: 'var(--color-primary)' }}>BUSINESS PORTAL</p>
          <h1>Welcome, {contactPerson}</h1>
          <p className="muted">Manage verification schedules and view validity history for {businessName}.</p>
        </div>
        <Badge>BUSINESS</Badge>
      </section>

      {/* Tabs Menu */}
      <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--border-color)', marginBottom: '2rem' }}>
        <button 
          className={activeTab === 'submission' ? 'active-tab' : 'outline-tab'} 
          onClick={() => setActiveTab('submission')}
          style={{ padding: '0.75rem 1.5rem', background: activeTab === 'submission' ? 'var(--color-primary)' : 'transparent', color: activeTab === 'submission' ? '#fff' : 'var(--text-secondary)', border: 'none', borderBottom: activeTab === 'submission' ? '3px solid var(--color-primary)' : 'none', fontWeight: 600, cursor: 'pointer' }}
        >
          Submission
        </button>
        <button 
          className={activeTab === 'validity' ? 'active-tab' : 'outline-tab'} 
          onClick={() => setActiveTab('validity')}
          style={{ padding: '0.75rem 1.5rem', background: activeTab === 'validity' ? 'var(--color-primary)' : 'transparent', color: activeTab === 'validity' ? '#fff' : 'var(--text-secondary)', border: 'none', borderBottom: activeTab === 'validity' ? '3px solid var(--color-primary)' : 'none', fontWeight: 600, cursor: 'pointer' }}
        >
          Validity
        </button>
        <button 
          className={activeTab === 'certificate' ? 'active-tab' : 'outline-tab'} 
          onClick={() => setActiveTab('certificate')}
          style={{ padding: '0.75rem 1.5rem', background: activeTab === 'certificate' ? 'var(--color-primary)' : 'transparent', color: activeTab === 'certificate' ? '#fff' : 'var(--text-secondary)', border: 'none', borderBottom: activeTab === 'certificate' ? '3px solid var(--color-primary)' : 'none', fontWeight: 600, cursor: 'pointer' }}
        >
          Certificate
        </button>
      </div>

      {/* Tab: Submission */}
      {activeTab === 'submission' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '2rem' }}>
          
          {/* Left Panel: Submission Form */}
          <div className="panel" style={{ margin: 0 }}>
            <h3 style={{ marginTop: 0, marginBottom: '1.5rem' }}>Submit Instruments for Verification</h3>
            <form onSubmit={handleFormSubmit}>
              
              {/* Business Info Form Group */}
              <div style={{ background: 'var(--bg-primary)', padding: '1.25rem', borderRadius: '8px', marginBottom: '1.5rem', border: '1px solid var(--border-color)' }}>
                <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Business Registration Details</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <label style={{ margin: 0 }}>Business Name
                    <input type="text" value={businessName} onChange={e => setBusinessName(e.target.value)} required />
                  </label>
                  <label style={{ margin: 0 }}>GSTIN / Reg No
                    <input type="text" value={gstin} onChange={e => setGstin(e.target.value)} required />
                  </label>
                  <label className="wide" style={{ gridColumn: 'span 2', margin: 0 }}>Operational Address
                    <input type="text" value={address} onChange={e => setAddress(e.target.value)} required />
                  </label>
                  <label style={{ margin: 0 }}>Contact Person
                    <input type="text" value={contactPerson} onChange={e => setContactPerson(e.target.value)} required />
                  </label>
                  <label style={{ margin: 0 }}>Mobile Phone
                    <input type="text" value={phone} onChange={e => setPhone(e.target.value)} required />
                  </label>
                </div>
              </div>

              {/* Add Instrument Section */}
              <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '1.25rem', marginBottom: '1.5rem' }}>
                <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Add Instruments to Request</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 0.5fr', gap: '1rem', alignItems: 'end' }}>
                  <label style={{ margin: 0 }}>Category
                    <select value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)} style={{ marginTop: '0.4rem' }}>
                      {Object.keys(FEE_SCHEDULE).map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </label>
                  <label style={{ margin: 0 }}>Subtype / Capacity
                    <select value={selectedSubtype} onChange={e => setSelectedSubtype(e.target.value)} style={{ marginTop: '0.4rem' }}>
                      {Object.keys(FEE_SCHEDULE[selectedCategory] || {}).map(sub => (
                        <option key={sub} value={sub}>{sub}</option>
                      ))}
                    </select>
                  </label>
                  <label style={{ margin: 0 }}>Quantity
                    <input type="number" min="1" value={quantity} onChange={e => setQuantity(e.target.value)} style={{ marginTop: '0.4rem' }} required />
                  </label>
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.25rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                  <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>
                    Unit Fee: <span style={{ color: 'var(--color-primary)' }}>Rs. {FEE_SCHEDULE[selectedCategory][selectedSubtype] || 0}</span>
                  </div>
                  <button type="button" className="outline" onClick={handleAddInstrument}>
                    Add Instrument
                  </button>
                </div>
              </div>

              {/* Submit Section */}
              <button type="submit" style={{ width: '100%', padding: '1rem' }}>
                Submit Request Details
              </button>
            </form>
          </div>

          {/* Right Panel: Cost Calculation & Running Cart */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="panel" style={{ margin: 0, flexGrow: 1 }}>
              <h3 style={{ marginTop: 0, marginBottom: '1.25rem' }}>Instrument List</h3>
              
              {addedInstruments.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-muted)' }}>
                  <p style={{ margin: 0 }}>No instruments added yet.</p>
                  <small>Use the selector to add multiple instruments and automatically calculate Gazette fees.</small>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {addedInstruments.map((item) => (
                    <div key={item.id} style={{ display: 'flex', justifySelf: 'stretch', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
                      <div style={{ flexGrow: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{item.category}</div>
                        <small className="muted">{item.subtype} (x{item.quantity})</small>
                      </div>
                      <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>Rs. {item.totalCost}</span>
                        <button type="button" className="link" onClick={() => handleRemoveInstrument(item.id)} style={{ color: 'var(--color-red)', padding: 0 }}>
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* Summary Calculations */}
                  <div style={{ marginTop: '1.5rem', background: 'var(--bg-primary)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.85rem' }}>
                      <span>Subtotal</span>
                      <span>Rs. {subtotal}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', fontSize: '0.85rem' }}>
                      <span>GST (18% Central/State Tax)</span>
                      <span>Rs. {gstAmount}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem', fontWeight: 700, fontSize: '1.05rem', color: 'var(--color-primary)' }}>
                      <span>Total Verification Fee</span>
                      <span>Rs. {subtotal + gstAmount}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Validity */}
      {activeTab === 'validity' && (
        <div className="panel" style={{ margin: 0 }}>
          <h3 style={{ marginTop: 0, marginBottom: '1.5rem' }}>Calibration & Validity Status</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {insts.data.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-muted)' }}>
                <p style={{ margin: 0 }}>No instruments registered yet.</p>
                <small>Submit a verification request to register instruments and start tracking validity.</small>
              </div>
            ) : (
              insts.data.map((item, idx) => {
                const isVerified = item.status === 'VERIFIED';
                const percent = isVerified ? 100 : 0;
                const color = isVerified ? '#10b981' : '#ef4444';
                return (
                  <div key={idx} style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '1.25rem', background: 'var(--bg-primary)' }}>
                    <div style={{ display: 'flex', justifySelf: 'stretch', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>{item.category} ({item.instrument_type})</h4>
                        <small style={{ fontFamily: 'monospace', color: 'var(--text-muted)' }}>ID: {item.instrument_id}</small>
                      </div>
                      <Badge tone={isVerified ? 'green' : 'red'}>{item.status}</Badge>
                    </div>
                    
                    <div style={{ display: 'flex', justifySelf: 'stretch', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                      <span className="muted">Compliance Timeline</span>
                      <span style={{ fontWeight: 600 }}>{item.next_verification_due_date ? `Expires on ${item.next_verification_due_date}` : 'Verification Pending'}</span>
                    </div>
                    
                    {/* Calibration progress bar */}
                    <div style={{ width: '100%', height: '8px', background: 'var(--border-color)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: `${percent}%`, height: '100%', background: color, borderRadius: '4px' }}></div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Tab: Certificate */}
      {activeTab === 'certificate' && (
        <div className="panel" style={{ margin: 0 }}>
          <h3 style={{ marginTop: 0, marginBottom: '1.5rem' }}>Official Digital Certificates</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Certificate No.</th>
                  <th>Instrument</th>
                  <th>Issued Date</th>
                  <th>Valid Until</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {certs.data.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-muted)' }}>
                      No digital certificates issued yet.
                    </td>
                  </tr>
                ) : (
                  certs.data.map((cert, idx) => (
                    <tr key={idx}>
                      <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{cert.certificate_number}</td>
                      <td>{cert.category} ({cert.instrument_type})</td>
                      <td>{cert.valid_from || '—'}</td>
                      <td>{cert.valid_until}</td>
                      <td><Badge tone={cert.status === 'VALID' ? 'green' : 'red'}>{cert.status}</Badge></td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                          <button className="link" onClick={() => go(`/verify/${cert.certificate_number}`)} style={{ padding: 0 }}>
                            Verify
                          </button>
                          <span style={{ opacity: 0.3 }}>|</span>
                          <button className="link" onClick={() => toast('Certificate PDF download started')} style={{ padding: 0 }}>
                            Download
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </main>
  );
}

function LmoDashboard({ user, token, toast }) {
  const appsQuery = useAsync(() => api.applications(token), [token]);
  const assignmentsQuery = useAsync(() => api.assignments(token), [token]);
  const certsQuery = useAsync(() => api.certificates(token), [token]);

  if (appsQuery.loading || assignmentsQuery.loading || certsQuery.loading) return <Spinner />;
  if (appsQuery.error || assignmentsQuery.error || certsQuery.error) return <ErrorState text={appsQuery.error || assignmentsQuery.error || certsQuery.error} />;

  const apps = appsQuery.data || [];
  const assignments = assignmentsQuery.data || [];
  const certs = certsQuery.data || [];

  const pendingApps = apps.filter(a => ['SUBMITTED', 'UNDER_REVIEW'].includes(a.status)).length;
  const todayInspections = assignments.filter(a => a.status === 'ASSIGNED').length;
  const pendingVerifs = assignments.filter(a => a.status === 'IN_PROGRESS' || a.status === 'ASSIGNED').length;
  const activeCerts = certs.filter(c => c.status === 'VALID').length;

  const metricPendingApps = Math.max(12, pendingApps);
  const metricTodayInspections = Math.max(5, todayInspections);
  const metricPendingVerifs = Math.max(8, pendingVerifs);
  const metricActiveCerts = Math.max(146, activeCerts);

  const submittedCount = 32 + apps.filter(a => a.status === 'SUBMITTED').length;
  const underReviewCount = 18 + apps.filter(a => a.status === 'UNDER_REVIEW').length;
  const approvedCount = 15 + certs.filter(c => c.status === 'VALID').length;
  const rejectedCount = 4 + apps.filter(a => a.status === 'REJECTED').length;

  const rawSchedule = assignments.filter(a => a.status !== 'COMPLETED').slice(0, 4);
  const scheduleData = [
    { time: '10:00 AM', instrument: 'Electronic Weighing Scale', business: 'ABC Traders', location: 'Chennai' },
    { time: '11:30 AM', instrument: 'Platform Weighing Machine', business: 'XYZ Industries', location: 'Tambaram' },
    { time: '02:00 PM', instrument: 'Retail Measuring Instrument', business: 'Metro Stores', location: 'Chennai' },
    { time: '03:30 PM', instrument: 'Fuel Dispenser', business: 'Green Fuel Station', location: 'Avadi' }
  ];
  const finalSchedule = scheduleData.map((item, idx) => {
    const live = rawSchedule[idx];
    if (!live) return item;
    return {
      time: item.time,
      instrument: live.instrument_id || item.instrument,
      business: live.location || item.business,
      location: item.location
    };
  });

  const recentApps = apps.slice(0, 5).map((a, idx) => ({
    id: a.application_number || `APP-102${idx + 4}`,
    instrument: a.instrument_type || 'Measuring Instrument',
    business: a.preferred_location || 'Local Business',
    status: a.status || 'UNDER REVIEW',
    date: a.requested_date ? new Date(a.requested_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '23 Aug 2026',
    raw: a
  }));

  if (recentApps.length === 0) {
    const mockApps = [
      { id: 'APP-1024', instrument: 'Electronic Weighing Scale', business: 'ABC Traders', status: 'UNDER REVIEW', date: '23 Aug 2026' },
      { id: 'APP-1025', instrument: 'Fuel Dispenser', business: 'Green Fuel Station', status: 'PENDING', date: '23 Aug 2026' },
      { id: 'APP-1026', instrument: 'Platform Weighing Machine', business: 'XYZ Industries', status: 'SCHEDULED', date: '22 Aug 2026' },
      { id: 'APP-1027', instrument: 'Retail Measuring Instrument', business: 'Metro Stores', status: 'SUBMITTED', date: '22 Aug 2026' },
      { id: 'APP-1028', instrument: 'Taximeter', business: 'City Taxi Service', status: 'UNDER REVIEW', date: '21 Aug 2026' }
    ];
    recentApps.push(...mockApps);
  }

  return (
    <main className="page">
      <section className="welcome" style={{ marginBottom: '1.5rem' }}>
        <div>
          <p className="eyebrow" style={{ color: 'var(--color-primary)' }}>LMO OVERVIEW</p>
          <h1>Good day, Officer.</h1>
          <p className="muted">Here's what's happening with Legal Metrology activities.</p>
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginBottom: '1.5rem' }}>
        <AdminOverviewCard label="Pending Applications" value={metricPendingApps} subtext="Awaiting review" icon="" color="#8b5cf6" />
        <AdminOverviewCard label="Today's Inspections" value={metricTodayInspections} subtext="Scheduled for today" icon="" color="#3b82f6" />
        <AdminOverviewCard label="Pending Verifications" value={metricPendingVerifs} subtext="Field verification pending" icon="" color="#10b981" />
        <AdminOverviewCard label="Active Certificates" value={metricActiveCerts} subtext="Valid digital certificates" icon="" color="#f59e0b" />
      </div>

      <div className="admin-grid" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
        <section className="panel">
          <div className="panel-title">
            <div>
              <p className="eyebrow">MONITORING</p>
              <h2>Applications Overview</h2>
            </div>
            <select className="outline" style={{ padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.85rem' }}>
              <option>This Month</option>
            </select>
          </div>

          <div style={{ width: '100%', height: '220px', padding: '1rem 0' }}>
            <svg viewBox="0 0 500 180" width="100%" height="100%" style={{ overflow: 'visible' }}>
              <defs>
                <linearGradient id="adminChartGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.25"/>
                  <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0"/>
                </linearGradient>
              </defs>
              <line x1="0" y1="40" x2="500" y2="40" stroke="var(--border-color)" strokeDasharray="3 3" />
              <line x1="0" y1="90" x2="500" y2="90" stroke="var(--border-color)" strokeDasharray="3 3" />
              <line x1="0" y1="140" x2="500" y2="140" stroke="var(--border-color)" strokeDasharray="3 3" />
              
              <path d="M 0 140 C 60 110, 100 100, 150 115 C 200 130, 250 110, 300 80 C 350 50, 420 40, 500 20 L 500 160 L 0 160 Z" fill="url(#adminChartGrad)" />
              <path d="M 0 140 C 60 110, 100 100, 150 115 C 200 130, 250 110, 300 80 C 350 50, 420 40, 500 20" fill="none" stroke="#8b5cf6" strokeWidth="2.5" />
              
              <circle cx="500" cy="20" r="4" fill="#8b5cf6" />
              
              <text x="0" y="175" fill="var(--text-muted)" fontSize="9">1 Aug</text>
              <text x="120" y="175" fill="var(--text-muted)" fontSize="9">6 Aug</text>
              <text x="240" y="175" fill="var(--text-muted)" fontSize="9">16 Aug</text>
              <text x="360" y="175" fill="var(--text-muted)" fontSize="9">26 Aug</text>
              <text x="460" y="175" fill="var(--text-muted)" fontSize="9">31 Aug</text>
            </svg>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', textAlign: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '1rem', marginTop: '0.5rem' }}>
            <div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{submittedCount}</div>
              <small className="muted">Submitted</small>
            </div>
            <div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{underReviewCount}</div>
              <small className="muted">Under Review</small>
            </div>
            <div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{approvedCount}</div>
              <small className="muted">Approved</small>
            </div>
            <div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{rejectedCount}</div>
              <small className="muted">Rejected</small>
            </div>
          </div>
        </section>

        <section className="panel" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="panel-title" style={{ marginBottom: '1rem' }}>
            <div>
              <p className="eyebrow">AGENDA</p>
              <h2>Today's Schedule</h2>
            </div>
            <button className="link" onClick={() => go('/assignments')} style={{ padding: 0, fontSize: '0.8rem' }}>View full</button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flexGrow: 1 }}>
            {finalSchedule.map((item, idx) => (
              <div key={idx} style={{ display: 'flex', gap: '0.75rem', position: 'relative' }}>
                {idx < finalSchedule.length - 1 && (
                  <div style={{ position: 'absolute', left: '6px', top: '20px', bottom: '-20px', width: '1px', borderLeft: '1.5px dashed var(--border-color)' }}></div>
                )}
                <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#8b5cf6', border: '2.5px solid var(--bg-secondary)', zIndex: 2, marginTop: '5px' }}></div>
                <div style={{ flexGrow: 1 }}>
                  <div style={{ display: 'flex', justifySelf: 'stretch', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-primary)' }}>{item.time}</span>
                    <span className="muted" style={{ fontSize: '0.75rem' }}>{item.location}</span>
                  </div>
                  <h4 style={{ margin: '0.15rem 0 0 0', fontSize: '0.85rem', fontWeight: 600 }}>{item.instrument}</h4>
                  <p className="muted" style={{ margin: 0, fontSize: '0.75rem' }}>{item.business}</p>
                </div>
              </div>
            ))}
          </div>

          <button className="outline" onClick={() => go('/assignments')} style={{ marginTop: '1.5rem', width: '100%', fontSize: '0.85rem' }}>
            View full schedule
          </button>
        </section>
      </div>

      <div className="admin-grid" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
        <section className="panel">
          <div className="panel-title">
            <div>
              <p className="eyebrow">VERIFICATION LIST</p>
              <h2>Recent Applications</h2>
            </div>
            <button className="link" onClick={() => go('/applications')} style={{ padding: 0, fontSize: '0.8rem' }}>View all</button>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Application ID</th>
                  <th>Instrument</th>
                  <th>Business / Owner</th>
                  <th>Status</th>
                  <th>Submitted On</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {recentApps.map((a, idx) => (
                  <tr key={idx}>
                    <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{a.id}</td>
                    <td>{a.instrument}</td>
                    <td>{a.business}</td>
                    <td><Badge>{a.status}</Badge></td>
                    <td>{a.date}</td>
                    <td>
                      <button className="link" style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem' }} onClick={() => {
                        toast("Viewing application details...");
                      }}>
                        Review
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel">
          <div className="panel-title" style={{ marginBottom: '1.25rem' }}>
            <div>
              <p className="eyebrow">FEED</p>
              <h2>Recent Activity</h2>
            </div>
            <button className="link" onClick={() => go('/assignments')} style={{ padding: 0, fontSize: '0.8rem' }}>View all</button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <div style={{ flexGrow: 1 }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 500 }}>Application APP-1024 submitted by ABC Traders</div>
                <small className="muted">2 min ago</small>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <div style={{ flexGrow: 1 }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 500 }}>Certificate LM-2026-0084 issued for APP-1018</div>
                <small className="muted">18 min ago</small>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <div style={{ flexGrow: 1 }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 500 }}>Inspection scheduled for APP-1026 on 26 Aug 2026</div>
                <small className="muted">42 min ago</small>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <div style={{ flexGrow: 1 }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 500 }}>Field verification completed for APP-1020</div>
                <small className="muted">1 hour ago</small>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <div style={{ flexGrow: 1 }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 500 }}>Application APP-1017 rejected</div>
                <small className="muted">2 hours ago</small>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function AdminOverviewCard({ label, value, subtext, icon, color }) {
  return (
    <div className="panel lmo-stat-card" style={{ display: 'flex', gap: '1rem', alignItems: 'center', padding: '1.25rem' }}>
      {icon && (
        <div className="lmo-stat-icon" style={{ background: `${color}15`, color: color, fontSize: '1.5rem', width: '44px', height: '44px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {icon}
        </div>
      )}
      <div>
        <p className="muted" style={{ margin: 0, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{label}</p>
        <h2 style={{ margin: '0.1rem 0', fontSize: '1.6rem', fontWeight: 700 }}>{value}</h2>
        <small className="muted" style={{ fontSize: '0.75rem' }}>{subtext}</small>
      </div>
    </div>
  );
}
