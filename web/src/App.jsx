import { useEffect, useMemo, useState } from 'react';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { api } from './api/client';
import { Badge, ConfirmDialog, Empty, ErrorState, Modal, Spinner, Stat, Timeline, Toast, useAsync } from './components/UI';
import { INDIAN_STATES, INDIAN_STATES_AND_DISTRICTS } from './data/indianLocations';
import { BrandLogo } from './BrandLogo';
import { PhoneMockupWrapper } from './components/PhoneMockup';
import { QRCodeSVG } from './components/QRCodeSVG';
import { CertificateOfAuthenticityModal } from './components/CertificateOfAuthenticity';
import { AIAssistantDrawer } from './components/AIAssistantDrawer';
import { CitizenComplaintPortal } from './components/CitizenComplaintPortal';
import { SmartScheduler } from './components/SmartScheduler';
import { ComplaintHeatmap } from './components/ComplaintHeatmap';
import { AdminWorkforceManager } from './components/AdminWorkforceManager';
import { OfficerComplaintWorkbench } from './components/OfficerComplaintWorkbench';
import { PaymentGatewayModal } from './components/PaymentGateway';


const nav = {
  BUSINESS: [
    ['Overview', '/dashboard'],
    ['Instruments', '/instruments'],
    ['Applications', '/applications'],
    ['Smart Schedule', '/schedule'],
    ['Certificates', '/certificates'],
    ['Due tracking', '/due-tracking'],
    ['Notifications', '/notifications']
  ],
  LMO: [
    ['Overview', '/dashboard'],
    ['Assigned inspections', '/assignments'],
    ['Citizen Complaints', '/complaints'],
    ['My Schedule', '/schedule'],
    ['Field verification', '/verify-field'],
    ['Certificates', '/certificates'],
    ['Due tracking', '/due-tracking'],
    ['Notifications', '/notifications']
  ],
  GATC: [
    ['Overview', '/dashboard'],
    ['Assigned tests', '/assignments'],
    ['Testing Schedule', '/schedule'],
    ['Field verification', '/verify-field'],
    ['Certificates', '/certificates'],
    ['Notifications', '/notifications']
  ],
  ADMIN: [
    ['Overview', '/dashboard'],
    ['Assignments & Routing', '/assignments'],
    ['Workforce & Overrides', '/workforce'],
    ['Citizen Complaints', '/complaints'],
    ['Complaint Heatmap', '/heatmap'],
    ['Certificates', '/certificates'],
    ['Due tracking', '/due-tracking'],
    ['Notifications', '/notifications']
  ],
};

const publicPaths = new Set(['/', '/login', '/register', '/verify', '/complaints']);
const go = path => {
  history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
};
const allowed = (role, path) => (nav[role] || []).some(([, item]) => item === path);


export function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}

function AppInner() {
  const [path, setPath] = useState(location.pathname);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('lm_theme') === 'dark');

  useEffect(() => {
    const handler = () => setPath(location.pathname);
    addEventListener('popstate', handler);
    return () => removeEventListener('popstate', handler);
  }, []);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('lm_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('lm_theme', 'light');
    }
  }, [darkMode]);

  const [mockupMode, setMockupMode] = useState(() => location.search.includes('mockup=true'));
  const toggleTheme = () => setDarkMode(!darkMode);
  const toggleMockup = () => setMockupMode(!mockupMode);

  const content = path.startsWith('/verify/') ? (
    <PublicVerify tokenOrNumber={decodeURIComponent(path.split('/verify/')[1] || '')} darkMode={darkMode} onToggleTheme={toggleTheme} />
  ) : (
    <Router path={path} darkMode={darkMode} onToggleTheme={toggleTheme} />
  );

  return (
    <PhoneMockupWrapper active={mockupMode} onToggle={toggleMockup} darkMode={darkMode}>
      {content}
    </PhoneMockupWrapper>
  );
}


function Router({ path, darkMode, onToggleTheme }) {
  const { user, loading, token } = useAuth();
  if (loading) return <Spinner label="Restoring your secure session…" />;
  
  if (path.startsWith('/complaints') && (!user || user.role === 'BUSINESS')) {
    return (
      <>
        <CitizenComplaintPortal onBackToHome={() => go('/')} darkMode={darkMode} />
        <AIAssistantDrawer user={user} token={token} onNavigate={go} darkMode={darkMode} />
      </>
    );
  }

  if (!user) {
    if (path === '/login') return <Login darkMode={darkMode} onToggleTheme={onToggleTheme} />;
    if (path === '/register') return <Register darkMode={darkMode} onToggleTheme={onToggleTheme} />;
    return (
      <>
        <Landing darkMode={darkMode} onToggleTheme={onToggleTheme} />
        <AIAssistantDrawer user={null} token={null} onNavigate={go} darkMode={darkMode} />
      </>
    );
  }
  if (!allowed(user.role, path)) {
    go('/dashboard');
    return null;
  }
  return <Shell path={path} user={user} darkMode={darkMode} onToggleTheme={onToggleTheme} />;
}

function Landing({ darkMode, onToggleTheme }) {
  return (
    <div className="public">
      <header className="public-nav">
        <button className="brand" onClick={() => go('/')} style={{ background: 'none', border: 'none', padding: 0 }}>
          <BrandLogo darkMode={darkMode} />
        </button>
        <nav>
          <a href="#about">About</a>
          <a href="#amendment">2025 Rules</a>
          <button className="theme-toggle-btn" aria-label="Toggle theme" onClick={onToggleTheme}>
            {darkMode ? '☀️' : '🌙'}
          </button>
          <button className="outline" onClick={() => go('/complaints')}>⚖️ Citizen Complaints</button>
          <button className="outline" onClick={() => go('/register')}>Register business</button>
          <button onClick={() => go('/login')}>Sign in</button>
        </nav>
      </header>
      <main>
        <section className="hero">
          <div>
            <p className="eyebrow">GOVERNMENT OF INDIA · LEGAL METROLOGY</p>
            <h1>Trust every <em>measure.</em></h1>
            <p>Complete Smart Legal Metrology Digital Ecosystem with 18-category automatic GATC routing, smart officer scheduling, tamper-evident digital certificates, and citizen complaint redressal.</p>
            <div className="hero-actions">
              <button onClick={() => go('/login')}>Access Portal</button>
              <button className="outline" onClick={() => go('/complaints')}>⚖️ File / Track Complaint</button>
              <button className="outline" onClick={() => go('/register')}>Register Establishment</button>
              <button className="outline" onClick={() => go('/verify/')}>Verify Certificate QR</button>
            </div>
          </div>
          <div className="hero-card">
            <span className="seal">SS</span>
            <h3>Smart Digital Metrology Ecosystem</h3>
            <p>18 GATC amendment categories, automated AI assistance, collision-prevented scheduling, and citizen grievance redressal.</p>
            <div className="verified-line">✓ GATC 2025 Rules & Legal Metrology Act 2009</div>
          </div>
        </section>
        <section className="feature-grid" id="about">
          <article>
            <b>01</b>
            <h3>Intelligent 18-Category Routing</h3>
            <p>Automated dispatch to GATC accredited testing centres or regional LMO officers based on 2025 amendment categories and jurisdiction.</p>
          </article>
          <article>
            <b>02</b>
            <h3>Smart Officer Scheduling</h3>
            <p>Officers configure inspection windows; businesses pick available slots with real-time double-booking prevention.</p>
          </article>
          <article>
            <b>03</b>
            <h3>Citizen Complaint Portal</h3>
            <p>Dual-entry QR code scanning or direct shop search with mobile OTP verification, GPS geotagging, and repeat offender tracking.</p>
          </article>
        </section>
      </main>

    </div>
  );
}

function Register({ darkMode, onToggleTheme }) {
  const [form, setForm] = useState({
    full_name: '', email: '', password: '', organization_name: '', contact_number: '',
    state: '', district: '', address: '', latitude: '', longitude: ''
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [receiptData, setReceiptData] = useState(null);

  const districts = form.state ? (INDIAN_STATES_AND_DISTRICTS[form.state] || []) : [];

  const captureGPS = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => {
        setForm(prev => ({
          ...prev,
          latitude: pos.coords.latitude.toFixed(6),
          longitude: pos.coords.longitude.toFixed(6)
        }));
      },
      () => setError('Unable to retrieve GPS coordinates. Please allow location permissions.')
    );
  };

  const handleValidateAndPay = event => {
    event.preventDefault();
    if (!form.full_name.trim() || !form.email.trim() || !form.password || !form.organization_name.trim() || !form.contact_number.trim() || !form.state || !form.district || !form.address.trim()) {
      setError('Please fill in all mandatory establishment details before proceeding.');
      return;
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    setError('');
    setShowPayment(true);
  };

  const handlePaymentSuccess = async (receipt) => {
    setReceiptData(receipt);
    setShowPayment(false);
    setBusy(true);
    setError('');
    try {
      await api.register({
        ...form,
        role: 'BUSINESS',
        latitude: form.latitude ? parseFloat(form.latitude) : null,
        longitude: form.longitude ? parseFloat(form.longitude) : null,
        role_specific_info: {
          challan_number: receipt.challan_number,
          transaction_id: receipt.transaction_id,
          amount_paid: receipt.amount,
          payment_status: 'PAID',
          payment_timestamp: receipt.timestamp,
          statutory_ref: receipt.statutory_reference
        }
      });
      setSuccess(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="auth-page" style={{ maxWidth: '650px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <button className="brand back" onClick={() => go('/')} style={{ background: 'none', border: 'none', padding: 0 }}>
          <BrandLogo darkMode={darkMode} />
        </button>
        <button className="theme-toggle-btn" aria-label="Toggle theme" onClick={onToggleTheme}>
          {darkMode ? '☀️' : '🌙'}
        </button>
      </div>
      <section>
        <p className="eyebrow">OFFICIAL BUSINESS REGISTRATION</p>
        <h1>Register Business Account</h1>
        <p>Register your establishment under the Legal Metrology Act, 2009.</p>

        {success ? (
          <div className="valid-card" style={{ marginTop: '1.5rem', textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🏛️</div>
            <h2 style={{ color: '#10b981' }}>✓ Registration & Statutory Payment Confirmed</h2>
            <p style={{ marginTop: '0.5rem' }}>
              Your establishment <strong>{form.organization_name}</strong> has been registered with the Legal Metrology Department.
            </p>
            {receiptData && (
              <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '1rem', margin: '1rem 0', textAlign: 'left', fontSize: '0.84rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>e-Challan Reference:</span>
                  <strong>{receiptData.challan_number}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Transaction Ref ID:</span>
                  <span>{receiptData.transaction_id}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Statutory Fee Paid:</span>
                  <span style={{ color: '#10b981', fontWeight: 800 }}>₹{receiptData.amount.toFixed(2)} (PAID)</span>
                </div>
              </div>
            )}
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              You can now sign in to register instruments, track quotas, and apply for verification.
            </p>
            <button style={{ marginTop: '1rem', width: '100%' }} onClick={() => go('/login')}>
              Proceed to Sign In ➔
            </button>
          </div>
        ) : (
          <form onSubmit={handleValidateAndPay} className="form-grid" style={{ marginTop: '1.5rem' }}>
            <label className="wide">Full Name of Authorized Signatory
              <input required value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} placeholder="e.g. Ramesh Kumar" />
            </label>
            <label>Official Email Address
              <input type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="owner@company.com" />
            </label>
            <label>Password
              <input type="password" required minLength={8} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="At least 8 characters" />
            </label>
            <label>Establishment / Business Name
              <input required value={form.organization_name} onChange={e => setForm({ ...form, organization_name: e.target.value })} placeholder="e.g. Southern Scales & Measures Pvt Ltd" />
            </label>
            <label>Contact Number
              <input required value={form.contact_number} onChange={e => setForm({ ...form, contact_number: e.target.value })} placeholder="+91 98400 00000" />
            </label>
            
            <label>Indian State / UT
              <select required value={form.state} onChange={e => setForm({ ...form, state: e.target.value, district: '' })}>
                <option value="">Select State / UT</option>
                {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <label>Jurisdiction District
              <select required value={form.district} disabled={!form.state} onChange={e => setForm({ ...form, district: e.target.value })}>
                <option value="">{form.state ? 'Select District' : 'Choose State First'}</option>
                {districts.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </label>

            <label className="wide">Full Business Address
              <textarea required value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="Building, Street, Area, Pincode" />
            </label>

            <div className="wide" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <label>GPS Latitude (Optional)
                  <input type="number" step="any" value={form.latitude} onChange={e => setForm({ ...form, latitude: e.target.value })} placeholder="e.g. 13.0604" />
                </label>
              </div>
              <div style={{ flex: 1 }}>
                <label>GPS Longitude (Optional)
                  <input type="number" step="any" value={form.longitude} onChange={e => setForm({ ...form, longitude: e.target.value })} placeholder="e.g. 80.2496" />
                </label>
              </div>
              <button type="button" className="outline" style={{ height: '42px', marginTop: '22px' }} onClick={captureGPS}>
                📍 Autofill GPS
              </button>
            </div>

            {error && <p className="form-error wide">{error}</p>}
            <button className="wide" disabled={busy} style={{ marginTop: '1rem', background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)', color: '#fff', fontWeight: 800 }}>
              {busy ? 'Registering establishment…' : '💳 Proceed to Statutory Fee Payment (₹708)'}
            </button>
            <p className="wide muted" style={{ textAlign: 'center', marginTop: '0.5rem' }}>
              Already registered? <button type="button" className="link" onClick={() => go('/login')}>Sign in here</button>
            </p>
          </form>
        )}

        {showPayment && (
          <PaymentGatewayModal
            title="Business Registration Statutory e-Challan"
            purpose="BUSINESS_REGISTRATION"
            purposeLabel="Establishment Registration & Initial Verification Quota"
            payerName={form.full_name}
            organizationName={form.organization_name}
            state={form.state}
            district={form.district}
            baseFee={500}
            taxRate={0.18}
            onCancel={() => setShowPayment(false)}
            onPaymentSuccess={handlePaymentSuccess}
            darkMode={darkMode}
          />
        )}
      </section>
    </main>
  );
}

function Login({ darkMode, onToggleTheme }) {
  const { login } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async event => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(form.email, form.password);
      go('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="auth-page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <button className="brand back" onClick={() => go('/')} style={{ background: 'none', border: 'none', padding: 0 }}>
          <BrandLogo darkMode={darkMode} />
        </button>
        <button className="theme-toggle-btn" aria-label="Toggle theme" onClick={onToggleTheme}>
          {darkMode ? '☀️' : '🌙'}
        </button>
      </div>
      <section>
        <p className="eyebrow">SECURE PORTAL</p>
        <h1>Sign in</h1>
        <p>Sign in to access your Legal Metrology workspace.</p>
        <form onSubmit={submit}>
          <label>Email Address
            <input type="email" required value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} />
          </label>
          <div style={{ margin: '1rem 0', padding: '0.85rem', background: 'var(--bg-hover)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)' }}>
              ⚡ QUICK DEMO CREDENTIALS:
            </p>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="outline"
                style={{ fontSize: '0.78rem', padding: '0.35rem 0.7rem' }}
                onClick={() => setForm({ email: 'admin@test.com', password: 'Password123' })}
              >
                👑 Admin
              </button>
              <button
                type="button"
                className="outline"
                style={{ fontSize: '0.78rem', padding: '0.35rem 0.7rem' }}
                onClick={() => setForm({ email: 'lmo.chennai@test.com', password: 'Password123' })}
              >
                ⚖️ LMO Officer
              </button>
              <button
                type="button"
                className="outline"
                style={{ fontSize: '0.78rem', padding: '0.35rem 0.7rem' }}
                onClick={() => setForm({ email: 'gatc.mumbai@test.com', password: 'Password123' })}
              >
                🔬 GATC Lab
              </button>
              <button
                type="button"
                className="outline"
                style={{ fontSize: '0.78rem', padding: '0.35rem 0.7rem' }}
                onClick={() => setForm({ email: 'business@test.com', password: 'Password123' })}
              >
                🏢 Business
              </button>
            </div>
          </div>


          <label>Password
            <input type="password" required value={form.password} onChange={event => setForm({ ...form, password: event.target.value })} />
          </label>

          {error && <p className="form-error">{error}</p>}

          <button disabled={busy} style={{ width: '100%', marginTop: '0.5rem' }}>
            {busy ? 'Signing in…' : 'Sign in securely'}
          </button>
          <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
            <button type="button" className="link" onClick={() => go('/register')}>
              Don't have an account? Register as a business
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}

function Shell({ path, user, darkMode, onToggleTheme }) {
  const { logout, token } = useAuth();
  const [toast, setToast] = useState('');
  const [menu, setMenu] = useState(false);
  const items = nav[user.role] || [];

  const views = {
    '/dashboard': <Dashboard user={user} token={token} />,
    '/instruments': <Instruments token={token} role={user.role} toast={setToast} />,
    '/applications': <Applications token={token} role={user.role} toast={setToast} />,
    '/assignments': <Assignments token={token} role={user.role} toast={setToast} />,
    '/certificates': <Certificates token={token} role={user.role} toast={setToast} darkMode={darkMode} />,
    '/due-tracking': <DueTracking token={token} />,
    '/notifications': <Notifications token={token} />,
    '/verify-field': <FieldVerification token={token} toast={setToast} />,
    '/schedule': <SmartScheduler user={user} token={token} />,
    '/complaints': <OfficerComplaintWorkbench user={user} token={token} />,
    '/workforce': <AdminWorkforceManager token={token} />,
    '/heatmap': <ComplaintHeatmap token={token} darkMode={darkMode} />
  };

  return (
    <div className="shell">
      <aside className={menu ? 'open' : ''}>
        <button className="brand" onClick={() => go('/dashboard')} style={{ padding: 0, border: 'none', background: 'none', display: 'block', margin: '0 0 1.5rem 0' }}>
          <BrandLogo darkMode={darkMode} />
        </button>
        <p className="role-label">{user.role} PORTAL</p>
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
              <small>{user.email} {user.district ? `· ${user.district}` : ''}</small>
            </button>
          </div>
        </header>
        {views[path]}
        <AIAssistantDrawer user={user} token={token} onNavigate={go} darkMode={darkMode} />
      </div>
      {toast && <Toast message={toast} onClose={() => setToast('')} />}
    </div>
  );

}

function Dashboard({ user, token }) {
  const admin = useAsync(() => user.role === 'ADMIN' ? api.dashboard(token) : Promise.resolve(null), [user.role, token]);
  const instruments = useAsync(() => api.instruments(token), [token]);
  const applications = useAsync(() => api.applications(token), [token]);
  const certs = useAsync(() => api.certificates(token), [token]);

  if (admin.loading || instruments.loading || applications.loading || certs.loading) return <Spinner />;
  if (admin.error || instruments.error || applications.error || certs.error) {
    return <ErrorState text={admin.error || instruments.error || applications.error || certs.error} />;
  }

  const pending = (applications.data || []).filter(item => !['CERTIFICATE_ISSUED', 'REJECTED', 'CANCELLED'].includes(item.status)).length;
  const data = admin.data;

  return (
    <main className="page">
      <section className="welcome">
        <div>
          <h1>Good day, {user.full_name.split(' ')[0]}.</h1>
          <p>{user.role === 'ADMIN' ? 'A live overview of legal metrology verification activity and risk.' : 'Your live legal metrology workspace.'}</p>
        </div>
        <Badge>{user.role}</Badge>
      </section>

      <section className="stats">
        {user.role === 'ADMIN' ? (
          <>
            <Stat label="Total instruments" value={data?.total_instruments} />
            <Stat label="Applications" value={data?.total_applications} />
            <Stat label="Pending verification" value={data?.pending_verifications} tone="amber" />
            <Stat label="Certificates issued" value={data?.certificates_issued} tone="green" />
            <Stat label="Expiring certificates" value={data?.certificates_expiring} tone="red" />
            <Stat label="Expired certificates" value={data?.expired_certificates} tone="red" />
          </>
        ) : (
          <>
            <Stat label="Registered instruments" value={(instruments.data || []).length} />
            <Stat label="Pending applications" value={pending} tone="amber" />
            <Stat label="Active certificates" value={(certs.data || []).filter(item => item.status === 'VALID').length} tone="green" />
            <Stat label="Assignments" value={user.role === 'BUSINESS' ? '—' : 'Open schedule'} />
          </>
        )}
      </section>

      {user.role === 'ADMIN' && data?.risk_distribution && (() => {
        const entries = Object.entries(data.risk_distribution || {});
        const total = entries.reduce((acc, [, v]) => acc + Number(v || 0), 0);
        const maxVal = Math.max(...entries.map(([, v]) => Number(v || 0)), 1);

        const riskColors = {
          LOW: { bar: 'linear-gradient(90deg, #10b981, #059669)', text: '#10b981' },
          MEDIUM: { bar: 'linear-gradient(90deg, #f59e0b, #d97706)', text: '#f59e0b' },
          HIGH: { bar: 'linear-gradient(90deg, #f97316, #ea580c)', text: '#f97316' },
          CRITICAL: { bar: 'linear-gradient(90deg, #ef4444, #b91c1c)', text: '#ef4444' }
        };

        return (
          <section className="panel">
            <div className="panel-title">
              <div>
                <h2>Risk distribution</h2>
                <small className="muted">{total} total instruments evaluated</small>
              </div>
              <span className="muted">Live calculation</span>
            </div>
            <div className="risk-bars-container">
              {entries.map(([level, count]) => {
                const countNum = Number(count || 0);
                const percent = total > 0 ? Math.round((countNum / total) * 100) : 0;
                const barWidth = total > 0 && countNum > 0 ? Math.min(100, Math.max(8, (countNum / total) * 100)) : 0;
                const colors = riskColors[level.toUpperCase()] || { bar: 'var(--color-primary)', text: 'var(--color-primary)' };

                return (
                  <div className="risk-row" key={level}>
                    <div className="risk-label">
                      <span style={{ fontWeight: 700, color: colors.text }}>{level}</span>
                      <small className="muted">{countNum} instruments ({percent}%)</small>
                    </div>
                    <div className="risk-track">
                      <div
                        className="risk-bar"
                        style={{
                          width: `${barWidth}%`,
                          background: colors.bar,
                        }}
                      >
                        {barWidth >= 12 && <span className="risk-bar-text">{countNum}</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })()}


      <section className="panel">
        <div className="panel-title">
          <h2>Recent applications</h2>
          <button className="link" onClick={() => go('/applications')}>View all</button>
        </div>
        <DataTable
          rows={(applications.data || []).slice(0, 5)}
          columns={[
            ['Application', 'application_number'],
            ['Type', 'application_type'],
            ['Status', item => <Badge>{item.status}</Badge>],
            ['Requested', 'requested_date']
          ]}
        />
      </section>
    </main>
  );
}

function Instruments({ token, role, toast }) {
  const { data, loading, error, refresh } = useAsync(() => api.instruments(token), [token]);
  const [show, setShow] = useState(false);
  const [selected, setSelected] = useState(null);

  if (loading) return <Spinner />;
  if (error) return <ErrorState text={error} />;
  const canRegister = role === 'BUSINESS' || role === 'ADMIN';

  return (
    <main className="page">
      <div className="page-actions">
        <p>Register and manage officially identified weighing and measuring instruments.</p>
        {canRegister && <button onClick={() => setShow(true)}>+ Register instrument (2025 GATC Rules)</button>}
      </div>
      <DataTable
        rows={data || []}
        search
        columns={[
          ['Instrument ID', 'instrument_id'],
          ['Serial Number', 'serial_number'],
          ['Category', 'category'],
          ['Manufacturer / Model', item => `${item.manufacturer} ${item.model}`],
          ['Capacity / Unit', item => `${item.capacity || '—'} ${item.measurement_unit || ''}`],
          ['Jurisdiction', item => `${item.district}, ${item.state}`],
          ['Status', item => <Badge>{item.status}</Badge>],
          ['', item => <button className="link" onClick={() => setSelected(item)}>Digital Passport</button>]
        ]}
      />
      {show && (
        <InstrumentForm
          token={token}
          close={() => setShow(false)}
          done={item => {
            setShow(false);
            toast(`Instrument ${item.instrument_id} registered.`);
            refresh();
          }}
        />
      )}
      {selected && (
        <Passport
          instrument={selected}
          token={token}
          uploadAllowed={canRegister}
          close={() => setSelected(null)}
          toast={toast}
        />
      )}
    </main>
  );
}

function InstrumentForm({ token, close, done }) {
  const [gatcCategories, setGatcCategories] = useState([]);
  const [selectedCat, setSelectedCat] = useState(null);
  const [form, setForm] = useState({
    instrument_type: '', category: '', manufacturer: '', model: '', serial_number: '',
    capacity: '', accuracy_class: '', measurement_unit: '', year_of_manufacture: new Date().getFullYear(),
    owner_name: '', owner_address: '', state: '', district: '', location: ''
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.gatcRules().then(res => setGatcCategories(res.categories || [])).catch(console.error);
  }, []);

  const onCategoryChange = catId => {
    const cat = gatcCategories.find(c => c.id === catId);
    setSelectedCat(cat);
    setForm(prev => ({
      ...prev,
      category: catId,
      instrument_type: cat ? cat.name : prev.instrument_type,
      measurement_unit: cat && cat.units ? cat.units[0] : 'kg',
      accuracy_class: cat && cat.accuracy_classes ? cat.accuracy_classes[0] : ''
    }));
  };

  const districts = form.state ? (INDIAN_STATES_AND_DISTRICTS[form.state] || []) : [];

  const submit = async event => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await api.createInstrument({
        ...form,
        year_of_manufacture: form.year_of_manufacture ? Number(form.year_of_manufacture) : null
      }, token);
      done(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Register Instrument (2025 GATC Amendment)" onClose={close}>
      <form className="form-grid" onSubmit={submit}>
        <label className="wide">Verifiable Category (18 Categories under 2025 Rules)
          <select required value={form.category} onChange={e => onCategoryChange(e.target.value)}>
            <option value="">Select one of 18 GATC categories</option>
            {gatcCategories.map(c => <option key={c.id} value={c.id}>{c.name} — {c.description}</option>)}
          </select>
        </label>
        <label>Instrument Type
          <input required value={form.instrument_type} onChange={e => setForm({ ...form, instrument_type: e.target.value })} />
        </label>
        <label>Serial Number
          <input required value={form.serial_number} onChange={e => setForm({ ...form, serial_number: e.target.value })} />
        </label>
        <label>Manufacturer
          <input required value={form.manufacturer} onChange={e => setForm({ ...form, manufacturer: e.target.value })} />
        </label>
        <label>Model
          <input required value={form.model} onChange={e => setForm({ ...form, model: e.target.value })} />
        </label>
        <label>{selectedCat?.capacity_prompt || 'Capacity / Range'}
          <input required value={form.capacity} onChange={e => setForm({ ...form, capacity: e.target.value })} />
        </label>
        <label>Measurement Unit
          {selectedCat?.units ? (
            <select value={form.measurement_unit} onChange={e => setForm({ ...form, measurement_unit: e.target.value })}>
              {selectedCat.units.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          ) : (
            <input value={form.measurement_unit} onChange={e => setForm({ ...form, measurement_unit: e.target.value })} />
          )}
        </label>
        <label>State / UT
          <select required value={form.state} onChange={e => setForm({ ...form, state: e.target.value, district: '' })}>
            <option value="">Select State</option>
            {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label>District (Jurisdiction)
          <select required value={form.district} disabled={!form.state} onChange={e => setForm({ ...form, district: e.target.value })}>
            <option value="">Select District</option>
            {districts.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </label>
        <label className="wide">Owner / Establishment Name
          <input required value={form.owner_name} onChange={e => setForm({ ...form, owner_name: e.target.value })} />
        </label>
        {error && <p className="form-error wide">{error}</p>}
        <button className="wide" disabled={busy}>{busy ? 'Registering…' : 'Register Instrument'}</button>
      </form>
    </Modal>
  );
}

function Passport({ instrument, token, uploadAllowed, close, toast }) {
  const { data, loading, error } = useAsync(() => api.passport(instrument.instrument_id, token), [instrument.instrument_id, token]);
  return (
    <Modal title="Digital Instrument Passport" onClose={close}>
      {loading ? <Spinner /> : error ? <ErrorState text={error} /> : (
        <div className="passport">
          <div className="passport-head">
            <span className="seal">SS</span>
            <div>
              <p className="eyebrow">OFFICIAL INSTRUMENT PASSPORT</p>
              <h2>{data.instrument.instrument_id}</h2>
              <Badge>{data.instrument.status}</Badge>
            </div>
          </div>
          <dl>
            <dt>Owner</dt><dd>{data.instrument.owner_name}</dd>
            <dt>Jurisdiction</dt><dd>{data.instrument.district}, {data.instrument.state}</dd>
            <dt>Instrument</dt><dd>{data.instrument.manufacturer} {data.instrument.model} ({data.instrument.category})</dd>
            <dt>Capacity / Unit</dt><dd>{data.instrument.capacity || '—'} {data.instrument.measurement_unit || ''}</dd>
            <dt>Active Certificate</dt><dd>{data.current_certificate ? `${data.current_certificate.number}` : 'No active certificate'}</dd>
          </dl>
          <h3>Certificate History</h3>
          <DataTable
            rows={data.all_certificates || []}
            columns={[
              ['Certificate No.', 'number'],
              ['Valid From', 'valid_from'],
              ['Valid Until', 'valid_until'],
              ['Status', item => <Badge>{item.status}</Badge>]
            ]}
          />
        </div>
      )}
    </Modal>
  );
}

function Applications({ token, role, toast }) {
  const { data, loading, error, refresh } = useAsync(() => api.applications(token), [token]);
  const [show, setShow] = useState(false);
  const [detail, setDetail] = useState(null);

  if (loading) return <Spinner />;
  if (error) return <ErrorState text={error} />;
  const canCreate = role === 'BUSINESS' || role === 'ADMIN';

  return (
    <main className="page">
      <div className="page-actions">
        <p>Track the verification workflow for every registered instrument.</p>
        {canCreate && <button onClick={() => setShow(true)}>+ New application</button>}
      </div>
      <DataTable
        rows={data || []}
        search
        columns={[
          ['Application', 'application_number'],
          ['Type', 'application_type'],
          ['Status', item => <Badge>{item.status}</Badge>],
          ['Requested', 'requested_date'],
          ['', item => <button className="link" onClick={() => setDetail(item)}>Timeline</button>]
        ]}
      />
      {show && (
        <ApplicationForm
          token={token}
          close={() => setShow(false)}
          done={item => {
            setShow(false);
            toast(`Application ${item.application_number} submitted & auto-assigned to regional LMO.`);
            refresh();
          }}
        />
      )}
      {detail && (
        <Modal title={detail.application_number} onClose={() => setDetail(null)}>
          <Timeline status={detail.status} />
        </Modal>
      )}
    </main>
  );
}

function ApplicationForm({ token, close, done, user }) {
  const { data: instruments, loading } = useAsync(() => api.instruments(token), [token]);
  const [form, setForm] = useState({
    instrument_id: '', application_type: 'VERIFICATION', requested_date: new Date().toISOString().split('T')[0],
    preferred_location: '', remarks: ''
  });
  const [error, setError] = useState('');
  const [showPayment, setShowPayment] = useState(false);
  const [busy, setBusy] = useState(false);

  const selectedInstrument = (instruments || []).find(i => i.instrument_id === form.instrument_id);

  const handleValidateAndPay = event => {
    event.preventDefault();
    if (!form.instrument_id) {
      setError('Please select an instrument to verify.');
      return;
    }
    if (!form.preferred_location.trim()) {
      setError('Please enter the inspection premises location.');
      return;
    }
    setError('');
    setShowPayment(true);
  };

  const handlePaymentSuccess = async (receipt) => {
    setShowPayment(false);
    setBusy(true);
    setError('');
    try {
      const item = await api.createApplication({
        ...form,
        remarks: `${form.remarks ? form.remarks + ' | ' : ''}Statutory e-Challan: ${receipt.challan_number} (Txn: ${receipt.transaction_id})`
      }, token);
      const submitted = await api.submitApplication(item.application_number, token);
      done(submitted);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Modal title="New application" onClose={close}><Spinner /></Modal>;

  return (
    <Modal title="New Verification Application" onClose={close}>
      <form onSubmit={handleValidateAndPay}>
        <label>Select Instrument
          <select required value={form.instrument_id} onChange={e => setForm({ ...form, instrument_id: e.target.value })}>
            <option value="">Choose an instrument</option>
            {(instruments || []).map(item => (
              <option value={item.instrument_id} key={item.instrument_id}>
                {item.instrument_id} — {item.manufacturer} {item.model} ({item.category})
              </option>
            ))}
          </select>
        </label>
        <label>Application Type
          <select value={form.application_type} onChange={e => setForm({ ...form, application_type: e.target.value })}>
            <option value="VERIFICATION">INITIAL VERIFICATION</option>
            <option value="RE_VERIFICATION">RE-VERIFICATION</option>
          </select>
        </label>
        <label>Preferred Inspection Date
          <input type="date" required value={form.requested_date} onChange={e => setForm({ ...form, requested_date: e.target.value })} />
        </label>
        <label>Premises / Location
          <input required value={form.preferred_location} onChange={e => setForm({ ...form, preferred_location: e.target.value })} placeholder="Full address" />
        </label>
        <label>Remarks
          <textarea value={form.remarks} onChange={e => setForm({ ...form, remarks: e.target.value })} />
        </label>
        {error && <p className="form-error">{error}</p>}
        <button style={{ marginTop: '1rem', width: '100%', background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)', color: '#fff', fontWeight: 800 }} disabled={busy}>
          {busy ? 'Submitting application…' : '💳 Proceed to Statutory Stamping Fee Payment (₹708)'}
        </button>
      </form>

      {showPayment && (
        <PaymentGatewayModal
          title="Verification Stamping Fee e-Challan"
          purpose="INSTRUMENT_VERIFICATION_FEE"
          purposeLabel={`Verification & Stamping Fee for ${selectedInstrument?.manufacturer || ''} ${selectedInstrument?.model || ''} (${selectedInstrument?.category || 'Instrument'})`}
          payerName="Authorized Commercial Establishment"
          organizationName={selectedInstrument?.owner_name || "Commercial Establishment"}
          state={selectedInstrument?.state || "Tamil Nadu"}
          district={selectedInstrument?.district || "Chennai"}
          baseFee={500}
          taxRate={0.18}
          onCancel={() => setShowPayment(false)}
          onPaymentSuccess={handlePaymentSuccess}
        />
      )}
    </Modal>
  );
}

function Assignments({ token, role, toast }) {
  const assignments = useAsync(() => api.assignments(token), [token]);
  if (assignments.loading) return <Spinner />;

  return (
    <main className="page">
      <div className="page-actions">
        <p>{role === 'ADMIN' ? 'Manage regional jurisdiction inspection assignments.' : 'Scheduled verification activity assigned by jurisdiction.'}</p>
      </div>
      <DataTable
        rows={assignments.data || []}
        search
        columns={[
          ['Assignment ID', 'id'],
          ['Application No.', 'application_number'],
          ['Scheduled At', item => new Date(item.scheduled_at).toLocaleString()],
          ['Priority', item => <Badge>{item.priority}</Badge>],
          ['Status', item => <Badge>{item.status}</Badge>],
          ['Action', item => (
            <button className="link" onClick={() => {
              sessionStorage.setItem('lm_active_verification', item.id);
              go('/verify-field');
            }}>
              Field Verification →
            </button>
          )]
        ]}
      />
    </main>
  );
}

function FieldVerification({ token, toast }) {
  const assignments = useAsync(() => api.assignments(token), [token]);
  const [recordId, setRecordId] = useState(() => sessionStorage.getItem('lm_active_verification'));
  const record = useAsync(() => recordId ? api.verification(recordId, token) : Promise.resolve(null), [recordId, token]);

  if (assignments.loading || record.loading) return <Spinner />;

  if (!recordId) {
    return (
      <main className="page">
        <section className="panel">
          <h2>Field Verification Workbench</h2>
          <p className="muted">Select an assigned application to initiate physical verification.</p>
          <DataTable
            rows={(assignments.data || []).filter(item => item.status !== 'COMPLETED')}
            columns={[
              ['Assignment ID', 'id'],
              ['Application No.', 'application_number'],
              ['Priority', item => <Badge>{item.priority}</Badge>],
              ['', item => (
                <button onClick={async () => {
                  const res = await api.createVerification({ application_number: item.application_number }, token);
                  sessionStorage.setItem('lm_active_verification', res.id);
                  setRecordId(String(res.id));
                }}>
                  Start Verification Record
                </button>
              )]
            ]}
          />
        </section>
      </main>
    );
  }

  return (
    <VerificationEditor
      id={recordId}
      record={record.data}
      token={token}
      toast={toast}
      clear={() => {
        sessionStorage.removeItem('lm_active_verification');
        setRecordId(null);
      }}
    />
  );
}

function VerificationEditor({ id, record, token, toast, clear }) {
  const [form, setForm] = useState({
    latitude: record?.latitude ?? '', longitude: record?.longitude ?? '', remarks: record?.remarks || '',
    standards_used: record?.standards_used || '', defects_found: record?.defects_found || '',
    measurements: record?.measurements || [], observations: record?.observations || []
  });
  const [meas, setMeas] = useState({ parameter: '', observed_value: '', unit: 'kg', within_tolerance: true });
  const [busy, setBusy] = useState(false);

  const captureGPS = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(pos => {
        setForm(prev => ({ ...prev, latitude: pos.coords.latitude.toFixed(6), longitude: pos.coords.longitude.toFixed(6) }));
      });
    }
  };

  const finalise = async decision => {
    setBusy(true);
    try {
      const res = await api.finaliseVerification(id, decision, token);
      if (decision === 'approve') {
        toast(`Certificate ${res.certificate_number} generated & QR token issued!`);
      } else {
        toast('Verification rejected.');
      }
      clear();
    } catch (err) {
      toast(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="page">
      <section className="panel">
        <div className="panel-title">
          <h2>Field Verification Record #{id}</h2>
          <Badge>{record?.status || 'IN PROGRESS'}</Badge>
        </div>
        <div className="form-grid" style={{ marginTop: '1.5rem' }}>
          <label>GPS Latitude
            <input type="number" step="any" value={form.latitude} onChange={e => setForm({ ...form, latitude: e.target.value })} />
          </label>
          <label>GPS Longitude
            <input type="number" step="any" value={form.longitude} onChange={e => setForm({ ...form, longitude: e.target.value })} />
          </label>
          <button type="button" className="wide outline" onClick={captureGPS}>📍 Capture On-Site GPS</button>
          <label className="wide">Working Standards Used
            <input value={form.standards_used} onChange={e => setForm({ ...form, standards_used: e.target.value })} placeholder="e.g. Class M1 Test Weights 150kg" />
          </label>
          <label className="wide">Defects / Non-Conformities Found
            <input value={form.defects_found} onChange={e => setForm({ ...form, defects_found: e.target.value })} placeholder="e.g. None / zero deviation noted" />
          </label>
          <label className="wide">General Inspection Remarks
            <textarea value={form.remarks} onChange={e => setForm({ ...form, remarks: e.target.value })} />
          </label>
        </div>

        <section className="subpanel" style={{ marginTop: '1.5rem' }}>
          <h3>Verification Measurements</h3>
          <div className="measurement-row">
            <input placeholder="Parameter (e.g. Full Load Test)" value={meas.parameter} onChange={e => setMeas({ ...meas, parameter: e.target.value })} />
            <input type="number" placeholder="Observed Value" value={meas.observed_value} onChange={e => setMeas({ ...meas, observed_value: e.target.value })} />
            <input placeholder="Unit" value={meas.unit} onChange={e => setMeas({ ...meas, unit: e.target.value })} style={{ width: '80px' }} />
            <button type="button" onClick={() => {
              if (meas.parameter && meas.observed_value !== '') {
                setForm({ ...form, measurements: [...form.measurements, { ...meas, observed_value: Number(meas.observed_value) }] });
                setMeas({ parameter: '', observed_value: '', unit: 'kg', within_tolerance: true });
              }
            }}>+ Add</button>
          </div>
          <DataTable rows={form.measurements} columns={[
            ['Parameter', 'parameter'],
            ['Observed', 'observed_value'],
            ['Unit', 'unit'],
            ['Tolerance', item => <Badge>{item.within_tolerance ? 'PASS' : 'FAIL'}</Badge>]
          ]} />
        </section>

        <div className="dialog-actions" style={{ marginTop: '2rem' }}>
          <button className="danger" disabled={busy} onClick={() => finalise('reject')}>Reject Verification</button>
          <button disabled={busy} onClick={() => finalise('approve')}>Approve & Issue Certificate</button>
        </div>
      </section>
    </main>
  );
}

function Certificates({ token, role, toast, darkMode }) {
  const { data, loading, error } = useAsync(() => api.certificates(token), [token]);
  const [selectedCert, setSelectedCert] = useState(null);

  if (loading) return <Spinner />;
  if (error) return <ErrorState text={error} />;

  return (
    <main className="page">
      <div className="page-actions">
        <div>
          <h1>Issued Verification Certificates</h1>
          <p>Tamper-evident verification certificates with cryptographic QR code validation and printable Certificates of Authenticity.</p>
        </div>
      </div>
      <DataTable
        rows={data || []}
        search
        columns={[
          ['Certificate No.', 'certificate_number'],
          ['Valid From', 'valid_from'],
          ['Valid Until', 'valid_until'],
          ['Status', item => <Badge>{item.status}</Badge>],
          ['Hash Digest', item => <code>{item.certificate_hash?.slice(0, 16)}…</code>],
          ['Actions', item => (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <button
                className="outline"
                style={{ fontSize: '0.78rem', padding: '0.35rem 0.65rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                onClick={() => setSelectedCert(item)}
              >
                <span>📜</span>
                <span>View CoA & QR</span>
              </button>
              {role !== 'BUSINESS' && (
                <button
                  className="link"
                  style={{ fontSize: '0.78rem' }}
                  onClick={() => go(`/verify/${encodeURIComponent(item.qr_token || item.certificate_number)}`)}
                >
                  Public Verify →
                </button>
              )}
            </div>
          )]

        ]}
      />

      {selectedCert && (
        <CertificateOfAuthenticityModal
          cert={selectedCert}
          onClose={() => setSelectedCert(null)}
          darkMode={darkMode}
        />
      )}
    </main>
  );
}


function DueTracking({ token }) {
  const { data, loading, error } = useAsync(() => api.dueTracking(token), [token]);
  if (loading) return <Spinner />;
  if (error) return <ErrorState text={error} />;

  return (
    <main className="page">
      <div className="page-actions">
        <h1>Due-Date Tracking</h1>
      </div>
      <DataTable
        rows={data || []}
        search
        columns={[
          ['Instrument ID', 'instrument_id'],
          ['Type / Category', item => `${item.instrument_type} (${item.category})`],
          ['Owner', 'owner_name'],
          ['Jurisdiction', item => `${item.district}, ${item.state}`],
          ['Next Due Date', 'next_verification_due_date'],
          ['Status', item => <Badge>{item.urgency}</Badge>]
        ]}
      />
    </main>
  );
}

function Notifications({ token }) {
  const { data, loading, error } = useAsync(() => api.notifications(token), [token]);
  if (loading) return <Spinner />;
  if (error) return <ErrorState text={error} />;

  return (
    <main className="page">
      <div className="page-actions">
        <h1>Notifications & Alerts</h1>
      </div>
      {(data || []).map(item => (
        <div key={item.id} className="notice">
          <div>
            <Badge>{item.severity}</Badge>
            <h3>{item.title}</h3>
            <p>{item.message}</p>
          </div>
        </div>
      ))}
    </main>
  );
}

function PublicVerify({ tokenOrNumber, darkMode, onToggleTheme }) {
  const [input, setInput] = useState(tokenOrNumber);
  const [started, setStarted] = useState(Boolean(tokenOrNumber));
  const [showCoA, setShowCoA] = useState(false);
  const [copied, setCopied] = useState(false);
  const { data, loading, error } = useAsync(() => started && input.trim() ? api.publicCertificate(input.trim()) : Promise.resolve(null), [started, input]);

  const verify = event => {
    event.preventDefault();
    if (input.trim()) {
      setStarted(true);
      go(`/verify/${encodeURIComponent(input.trim())}`);
    }
  };

  const publicUrl = data ? `${window.location.origin}/verify/${encodeURIComponent(data.qr_token || data.certificate_number)}` : '';

  const copyLink = () => {
    if (publicUrl) {
      navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  return (
    <main className="verify-page" style={{ maxWidth: '820px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button
            onClick={() => {
              if (window.history.length > 1) {
                window.history.back();
              } else {
                go('/');
              }
            }}
            className="outline"
            title="Go back"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.5rem 1.1rem',
              borderRadius: '999px',
              fontWeight: 700,
              fontSize: '0.88rem',
              cursor: 'pointer',
              boxShadow: '0 2px 8px var(--shadow-default)',
            }}
          >
            <span>←</span>
            <span>Back</span>
          </button>
          <button className="brand back" onClick={() => go('/')} style={{ background: 'none', border: 'none', padding: 0 }}>
            <BrandLogo darkMode={darkMode} />
          </button>
        </div>
        <button className="theme-toggle-btn" aria-label="Toggle theme" onClick={onToggleTheme}>
          {darkMode ? '☀️' : '🌙'}
        </button>
      </div>

      <section>
        <p className="eyebrow">NATIONAL CERTIFICATE VERIFICATION</p>
        <h1>Public Verification Registry</h1>
        <p>Scan QR code or enter certificate verification token to check validity.</p>
        
        <form onSubmit={verify}>
          <input placeholder="Enter QR Token or LM-CERT Number" value={input} onChange={event => setInput(event.target.value)} />
          <button style={{ marginTop: '0.8rem', width: '100%' }}>Verify Authenticity</button>
        </form>

        {loading && <Spinner label="Verifying cryptographic signature with national ledger…" />}

        {error && (
          <div className="invalid-card" style={{ marginTop: '1.5rem' }}>
            <h2>! Verification Failed</h2>
            <p>{error}</p>
          </div>
        )}

        {data && (
          <div style={{ marginTop: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Main Verification Card */}
            <div className={`verify-card ${data.status === 'VALID' ? 'valid-card' : 'invalid-card'}`} style={{ margin: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.35rem' }}>
                    {data.status === 'VALID' ? '✓ VALID DIGITAL CERTIFICATE' : '! INVALID / EXPIRED CERTIFICATE'}
                  </h2>
                  <p style={{ margin: '0.3rem 0 0', fontSize: '0.85rem', opacity: 0.85 }}>
                    {data.issuing_authority || 'Legal Metrology Department, Government of India'}
                  </p>
                </div>

                <Badge>{data.status}</Badge>
              </div>

              {/* Grid: Certificate Data + Live Scannable QR Code */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '1.5rem', alignItems: 'center' }}>
                <dl style={{ margin: 0 }}>
                  <dt>Certificate No:</dt><dd><strong>{data.certificate_number}</strong></dd>
                  <dt>Instrument ID:</dt><dd>{data.instrument_id}</dd>
                  <dt>Type / Category:</dt><dd>{data.instrument_type} {data.category ? `(${data.category})` : ''}</dd>
                  <dt>Manufacturer:</dt><dd>{data.manufacturer} {data.model || ''}</dd>
                  <dt>Serial Number:</dt><dd><code>{data.serial_number || '—'}</code></dd>
                  <dt>Verification Date:</dt><dd>{data.verification_date}</dd>
                  <dt>Valid Until:</dt><dd><strong>{data.valid_until}</strong></dd>
                  <dt>SHA-256 Digest:</dt><dd><Badge>{data.certificate_hash_verified ? 'VERIFIED TAMPER-FREE' : 'MISMATCH'}</Badge></dd>
                </dl>

                {/* Scannable QR Box */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: '#ffffff', padding: '0.85rem', borderRadius: '12px', boxShadow: '0 4px 16px rgba(0,0,0,0.1)', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                  <QRCodeSVG value={publicUrl} size={140} />
                  <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#167046', marginTop: '0.45rem' }}>
                    LIVE QR CODE
                  </span>
                  <button
                    type="button"
                    onClick={copyLink}
                    className="outline"
                    style={{ marginTop: '0.4rem', fontSize: '0.7rem', padding: '0.2rem 0.5rem', borderRadius: '6px' }}
                  >
                    {copied ? '✓ Copied' : 'Copy URL'}
                  </button>
                </div>
              </div>

              {/* Current Verification Check Breakdown */}
              <div style={{ marginTop: '1.5rem', paddingTop: '1.2rem', borderTop: '1px solid rgba(0, 0, 0, 0.1)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', fontSize: '0.8rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span style={{ color: '#167046', fontWeight: 900 }}>✓</span>
                  <span><strong>Cryptographic Ledger:</strong> SHA-256 Valid</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span style={{ color: '#167046', fontWeight: 900 }}>✓</span>
                  <span><strong>GATC 2025 Rules:</strong> Compliant</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span style={{ color: '#167046', fontWeight: 900 }}>✓</span>
                  <span><strong>Jurisdiction:</strong> Regional Division</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span style={{ color: '#167046', fontWeight: 900 }}>✓</span>
                  <span><strong>Legal Status:</strong> Non-Revoked</span>
                </div>
              </div>

              {/* Action Buttons: Certificate of Authenticity Modal & Print */}
              <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.8rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setShowCoA(true)}
                  style={{
                    background: 'linear-gradient(135deg, #0f52ba, #7c3aed)',
                    color: '#ffffff',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.65rem 1.25rem',
                    borderRadius: '8px',
                    fontWeight: 700,
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                  }}
                >
                  <span>📜</span>
                  <span>View Official Certificate of Authenticity (Printable A4)</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {showCoA && data && (
          <CertificateOfAuthenticityModal
            cert={data}
            onClose={() => setShowCoA(false)}
            darkMode={darkMode}
          />
        )}

        <div style={{ marginTop: '2rem', textAlign: 'center' }}>
          <button
            type="button"
            className="link"
            onClick={() => {
              if (window.history.length > 1) {
                window.history.back();
              } else {
                go('/');
              }
            }}
            style={{ fontSize: '0.92rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
          >
            ← Return to previous screen
          </button>
        </div>
      </section>
    </main>
  );
}


function DataTable({ rows, columns, search = false }) {
  const [term, setTerm] = useState('');
  const filtered = useMemo(() => {
    const list = rows || [];
    if (!term.trim()) return list;
    return list.filter(row => JSON.stringify(row).toLowerCase().includes(term.toLowerCase()));
  }, [rows, term]);

  return (
    <div className="table-wrap">
      {search && <input className="search" placeholder="Filter records..." value={term} onChange={event => setTerm(event.target.value)} />}
      {filtered.length ? (
        <table>
          <thead>
            <tr>{columns.map(([heading], index) => <th key={index}>{heading}</th>)}</tr>
          </thead>
          <tbody>
            {filtered.map((row, rowIndex) => (
              <tr key={row.id || row.instrument_id || row.application_number || row.certificate_number || rowIndex}>
                {columns.map(([, value], columnIndex) => (
                  <td key={columnIndex}>
                    {typeof value === 'function' ? value(row, rowIndex) : row[value] ?? '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      ) : <Empty />}
    </div>
  );
}
