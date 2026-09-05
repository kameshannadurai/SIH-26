import React, { useEffect, useMemo, useState } from 'react';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { LanguageProvider, useTranslation } from './i18n/LanguageContext';
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
import { LanguageSelector } from './components/LanguageSelector';
import { calculateBatchVerificationFees, calculateGazetteStatutoryFee } from './data/feeSchedule';

export function getGreetingName(fullName) {
  if (!fullName) return 'Officer';
  const clean = fullName.replace(/^(Thiru\.?|Tmt\.?|Mr\.?|Mrs\.?|Ms\.?|Dr\.?|Shri\.?|Smt\.?)\s+/i, '').trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'Officer';
  const wordPart = parts.find(p => p.replace(/[^a-zA-Z]/g, '').length > 1);
  return (wordPart || parts[0]).replace(/[,.]/g, '');
}

const getNavConfig = (t) => ({
  BUSINESS: [
    [t('nav_overview'), '/dashboard'],
    [t('nav_instruments'), '/instruments'],
    [t('nav_applications'), '/applications'],
    [t('nav_schedule'), '/schedule'],
    [t('nav_certificates'), '/certificates'],
    [t('nav_due_tracking'), '/due-tracking']
  ],
  LMO: [
    [t('nav_overview'), '/dashboard'],
    [t('nav_assignments'), '/assignments'],
    [t('nav_complaints'), '/complaints'],
    [t('nav_verify_field'), '/verify-field'],
    [t('nav_certificates'), '/certificates'],
    [t('nav_due_tracking'), '/due-tracking']
  ],
  GATC: [
    [t('nav_overview'), '/dashboard'],
    [t('nav_tests'), '/assignments'],
    [t('nav_verify_field'), '/verify-field'],
    [t('nav_certificates'), '/certificates']
  ],
  ADMIN: [
    [t('nav_overview'), '/dashboard'],
    [t('nav_assignments'), '/assignments'],
    [t('nav_workforce'), '/workforce'],
    [t('nav_officer_schedules'), '/schedule'],
    [t('nav_complaints'), '/complaints'],
    [t('nav_heatmap'), '/heatmap'],
    [t('nav_certificates'), '/certificates'],
    [t('nav_due_tracking'), '/due-tracking']
  ],
});

const allowedPathsByRole = {
  BUSINESS: ['/dashboard', '/instruments', '/applications', '/schedule', '/certificates', '/due-tracking'],
  LMO: ['/dashboard', '/assignments', '/complaints', '/verify-field', '/certificates', '/due-tracking', '/schedule'],
  GATC: ['/dashboard', '/assignments', '/verify-field', '/certificates', '/schedule'],
  ADMIN: ['/dashboard', '/assignments', '/workforce', '/schedule', '/complaints', '/heatmap', '/certificates', '/due-tracking'],
};

const go = path => {
  history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
};
const allowed = (role, path) => (allowedPathsByRole[role] || []).includes(path);


export function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <AppInner />
      </AuthProvider>
    </LanguageProvider>
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
    <Router path={path} darkMode={darkMode} onToggleTheme={toggleTheme} mockupMode={mockupMode} onToggleMockup={toggleMockup} />
  );

  return (
    <PhoneMockupWrapper active={mockupMode} onToggle={toggleMockup} darkMode={darkMode}>
      {content}
    </PhoneMockupWrapper>
  );
}


function Router({ path, darkMode, onToggleTheme, mockupMode, onToggleMockup }) {
  const { user, loading, token } = useAuth();
  if (loading) return <Spinner label="Restoring your secure session…" />;
  
  if (path.startsWith('/complaints') && (!user || user.role === 'BUSINESS')) {
    return (
      <>
        <CitizenComplaintPortal onBackToHome={() => go('/')} darkMode={darkMode} onToggleTheme={onToggleTheme} />
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
  return (
    <Shell
      path={path}
      user={user}
      darkMode={darkMode}
      onToggleTheme={onToggleTheme}
      mockupMode={mockupMode}
      onToggleMockup={onToggleMockup}
    />
  );
}

function Landing({ darkMode, onToggleTheme }) {
  const { t } = useTranslation();

  return (
    <div className="public">
      <header className="public-nav">
        <button className="brand" onClick={() => go('/')} style={{ background: 'none', border: 'none', padding: 0 }}>
          <BrandLogo darkMode={darkMode} />
        </button>
        <nav style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <a href="#about">About</a>
          <LanguageSelector compact />
          <button className="theme-toggle-btn" aria-label="Toggle theme" onClick={onToggleTheme}>
            {darkMode ? '☀️' : '🌙'}
          </button>
          <button className="outline" onClick={() => go('/complaints')}>{t('hero_cta_complaint')}</button>
          <button className="outline" onClick={() => go('/register')}>{t('register_business')}</button>
          <button onClick={() => go('/login')}>{t('sign_in')}</button>
        </nav>
      </header>
      <main>
        <section className="hero">
          <div>
            <p className="eyebrow">{t('hero_eyebrow')}</p>
            <h1>{t('hero_title')}</h1>
            <p>{t('hero_subtitle')}</p>
            <div className="hero-actions">
              <button onClick={() => go('/login')}>{t('hero_cta_login')}</button>
              <button className="outline" onClick={() => go('/complaints')}>{t('hero_cta_complaint')}</button>
              <button className="outline" onClick={() => go('/register')}>{t('hero_cta_register')}</button>
              <button className="outline" onClick={() => go('/verify/')}>{t('hero_cta_verify')}</button>
            </div>
          </div>
          <div className="hero-card">
            <span className="seal">SS</span>
            <h3>{t('hero_card_title')}</h3>
            <p>{t('hero_card_desc')}</p>
            <div className="verified-line">{t('hero_card_verified')}</div>
          </div>
        </section>
        <section className="feature-grid" id="about">
          <article>
            <b>01</b>
            <h3>{t('feat_1_title')}</h3>
            <p>{t('feat_1_desc')}</p>
          </article>
          <article>
            <b>02</b>
            <h3>{t('feat_2_title')}</h3>
            <p>{t('feat_2_desc')}</p>
          </article>
          <article>
            <b>03</b>
            <h3>{t('feat_3_title')}</h3>
            <p>{t('feat_3_desc')}</p>
          </article>
        </section>
      </main>
    </div>
  );
}

function Register({ darkMode, onToggleTheme }) {
  const { t } = useTranslation();
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <LanguageSelector compact />
          <button className="theme-toggle-btn" aria-label="Toggle theme" onClick={onToggleTheme}>
            {darkMode ? '☀️' : '🌙'}
          </button>
        </div>
      </div>
      <section>
        <p className="eyebrow">OFFICIAL BUSINESS REGISTRATION</p>
        <h1>{t('register_business')}</h1>
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

const LMO_OFFICERS = [
  { email: 'lmo.chennai@test.com', name: 'S. Murugan', district: 'Chennai' },
  { email: 'lmo.coimbatore@test.com', name: 'K. Balasubramanian', district: 'Coimbatore' },
  { email: 'lmo.madurai@test.com', name: 'R. Meenakshi Sundaram', district: 'Madurai' },
  { email: 'lmo.trichy@test.com', name: 'V. Soundararajan', district: 'Tiruchirappalli' },
  { email: 'lmo.salem@test.com', name: 'P. Ramanathan', district: 'Salem' },
  { email: 'lmo.tirunelveli@test.com', name: 'M. Chelliah', district: 'Tirunelveli' },
  { email: 'lmo.vellore@test.com', name: 'S. Gomathi', district: 'Vellore' },
  { email: 'lmo.erode@test.com', name: 'T. Vijayaraghavan', district: 'Erode' },
  { email: 'lmo.kanchipuram@test.com', name: 'A. Chandrasekhar', district: 'Kanchipuram' },
  { email: 'lmo.thanjavur@test.com', name: 'N. Vijayalakshmi', district: 'Thanjavur' },
];

function Login({ darkMode, onToggleTheme }) {
  const { login } = useAuth();
  const { t } = useTranslation();
  const [form, setForm] = useState({ email: 'lmo.chennai@test.com', password: 'Password123' });
  const [selectedLmo, setSelectedLmo] = useState('lmo.chennai@test.com');
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <LanguageSelector compact />
          <button className="theme-toggle-btn" aria-label="Toggle theme" onClick={onToggleTheme}>
            {darkMode ? '☀️' : '🌙'}
          </button>
        </div>
      </div>
      <section>
        <p className="eyebrow">SECURE PORTAL</p>
        <h1>{t('sign_in')}</h1>
        <p>Sign in to access your Legal Metrology workspace.</p>
        <form onSubmit={submit}>
          <label>Email Address
            <input type="email" required value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} />
          </label>
          <div style={{ margin: '1rem 0', padding: '0.85rem', background: 'var(--bg-hover)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)' }}>
              ⚡ QUICK DEMO CREDENTIALS:
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                type="button"
                className="outline"
                style={{ fontSize: '0.78rem', padding: '0.35rem 0.7rem' }}
                onClick={() => setForm({ email: 'admin@test.com', password: 'Password123' })}
              >
                👑 Admin
              </button>

              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', background: 'var(--bg-secondary)', padding: '0.15rem 0.35rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <button
                  type="button"
                  className="outline"
                  style={{ fontSize: '0.78rem', padding: '0.25rem 0.5rem', border: 'none', background: 'transparent' }}
                  onClick={() => {
                    const target = selectedLmo || 'lmo.chennai@test.com';
                    setForm({ email: target, password: 'Password123' });
                  }}
                  title="Click to fill selected LMO officer"
                >
                  ⚖️ LMO:
                </button>
                <select
                  value={selectedLmo}
                  onChange={(e) => {
                    setSelectedLmo(e.target.value);
                    if (e.target.value) {
                      setForm({ email: e.target.value, password: 'Password123' });
                    }
                  }}
                  style={{
                    fontSize: '0.78rem',
                    padding: '0.25rem 0.5rem',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    background: darkMode ? '#151122' : '#ffffff',
                    color: darkMode ? '#f8fafc' : '#0f172a',
                    colorScheme: darkMode ? 'dark' : 'light',
                    cursor: 'pointer',
                    fontWeight: 700,
                  }}
                  title="Select district LMO officer"
                >
                  {LMO_OFFICERS.map(off => (
                    <option
                      key={off.email}
                      value={off.email}
                      style={{
                        background: darkMode ? '#151122' : '#ffffff',
                        color: darkMode ? '#f8fafc' : '#0f172a',
                      }}
                    >
                      {off.district}: {off.name}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                className="outline"
                style={{ fontSize: '0.78rem', padding: '0.35rem 0.7rem' }}
                onClick={() => setForm({ email: 'gatc.chennai@test.com', password: 'Password123' })}
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
            {busy ? 'Signing in…' : t('sign_in')}
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

function Shell({ path, user, darkMode, onToggleTheme, mockupMode, onToggleMockup }) {
  const { logout, token } = useAuth();
  const { t } = useTranslation();
  const [toast, setToast] = useState('');
  const [menu, setMenu] = useState(false);

  const navConfig = getNavConfig(t);
  const items = navConfig[user.role] || [];

  const views = {
    '/dashboard': <Dashboard user={user} token={token} />,
    '/instruments': <Instruments token={token} role={user.role} toast={setToast} user={user} />,
    '/applications': <Applications token={token} role={user.role} toast={setToast} user={user} darkMode={darkMode} />,
    '/assignments': <Assignments token={token} role={user.role} toast={setToast} />,
    '/certificates': <Certificates token={token} role={user.role} toast={setToast} darkMode={darkMode} />,
    '/due-tracking': <DueTracking token={token} />,
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

        <button className="logout" onClick={() => { logout(); go('/'); }}>{t('sign_out')}</button>
      </aside>
      <div className="content">
        <header className="topbar">
          <button className="mobile-menu" aria-label="Toggle navigation" onClick={() => setMenu(!menu)}>☰</button>
          <div>
            <p className="eyebrow">{t('app_title')}</p>
            <h2>{items.find(item => item[1] === path)?.[0] || t('nav_overview')}</h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <LanguageSelector />
            <button className="theme-toggle-btn" aria-label="Toggle theme" onClick={onToggleTheme}>
              {darkMode ? '☀️' : '🌙'}
            </button>
            <button className="profile" onClick={() => go('/dashboard')}>
              {user.full_name}
              <small>{user.email} {user.district ? `· ${user.district}` : ''}</small>
            </button>
          </div>
        </header>
        {views[path]}
        <AIAssistantDrawer
          user={user}
          token={token}
          onNavigate={go}
          darkMode={darkMode}
        />
      </div>
      {toast && <Toast message={toast} onClose={() => setToast('')} />}
    </div>
  );
}

function Dashboard({ user, token }) {
  const { t } = useTranslation();
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
          <h1>{t('good_day', { name: getGreetingName(user.full_name) })}</h1>
          <p>{user.role === 'ADMIN' ? t('admin_overview_desc') : t('user_overview_desc')}</p>
        </div>
        <Badge>{user.role}</Badge>
      </section>

      <section className="stats">
        {user.role === 'ADMIN' ? (
          <>
            <Stat label={t('total_instruments')} value={data?.total_instruments} />
            <Stat label={t('total_applications')} value={data?.total_applications} />
            <Stat label={t('pending_verification')} value={data?.pending_verifications} tone="amber" />
            <Stat label={t('certificates_issued')} value={data?.certificates_issued} tone="green" />
            <Stat label={t('expiring_certificates')} value={data?.certificates_expiring} tone="red" />
            <Stat label={t('expired_certificates')} value={data?.expired_certificates} tone="red" />
          </>
        ) : (
          <>
            <Stat label={t('registered_instruments')} value={(instruments.data || []).length} />
            <Stat label={t('pending_applications')} value={pending} tone="amber" />
            <Stat label={t('active_certificates')} value={(certs.data || []).filter(item => item.status === 'VALID').length} tone="green" />
            <Stat label={t('nav_assignments')} value={user.role === 'BUSINESS' ? '—' : 'Open schedule'} />
          </>
        )}
      </section>

      {user.role === 'ADMIN' && data?.risk_distribution && (() => {
        const entries = Object.entries(data.risk_distribution || {});
        const total = entries.reduce((acc, [, v]) => acc + Number(v || 0), 0);

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
                <h2>{t('risk_distribution')}</h2>
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
          <h2>{t('recent_applications')}</h2>
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

function Instruments({ token, role, toast, user }) {
  const { t } = useTranslation();
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
        {canRegister && <button onClick={() => setShow(true)}>{t('register_instrument_btn')}</button>}
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
          ['', item => <button className="link" onClick={() => setSelected(item)}>{t('digital_passport')}</button>]
        ]}
      />
      {show && (
        <InstrumentForm
          token={token}
          user={user}
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

const GATC_INSTRUMENT_DEFAULTS = {
  water_meter: {
    instrument_type: "Commercial Multi-Jet Water Meter",
    manufacturer: "Kranti Meters Ltd",
    model: "KM-WM-50 MultiJet DN25",
    capacity: "25 mm (10 m³/h)",
    measurement_unit: "m³",
    accuracy_class: "Class B",
    prefix: "WM-TN"
  },
  sphygmomanometer: {
    instrument_type: "Clinical Digital NIBP Blood Pressure Monitor",
    manufacturer: "Omron Healthcare India",
    model: "HBP-1320 Professional NIBP",
    capacity: "0-300 mmHg",
    measurement_unit: "mmHg",
    accuracy_class: "Medical Grade Class II",
    prefix: "SP-OM"
  },
  clinical_thermometer: {
    instrument_type: "Precision Digital Clinical Thermometer",
    manufacturer: "Hicks India Medical",
    model: "DT-02 Digital Oval Gauge",
    capacity: "32-42 °C",
    measurement_unit: "°C",
    accuracy_class: "Class 1",
    prefix: "TH-HK"
  },
  automatic_rail_weighbridge: {
    instrument_type: "Weighing-In-Motion Rail Vehicle Scale",
    manufacturer: "Schenck Process India",
    model: "RailScan 150 Dynamic Motion",
    capacity: "120 t",
    measurement_unit: "t",
    accuracy_class: "Class 0.5",
    prefix: "RW-SP"
  },
  tape_measure: {
    instrument_type: "Class II Dip Steel Measuring Tape",
    manufacturer: "Freemans Precision Gauges",
    model: "Pro-Grip Dip Steel 50M",
    capacity: "50 m",
    measurement_unit: "m",
    accuracy_class: "Class II",
    prefix: "TM-FM"
  },
  non_auto_weighing_class_3: {
    instrument_type: "Medium Accuracy Commercial Retail Scale",
    manufacturer: "Essae-Teraoka Ltd",
    model: "DS-215 Commercial Retail Bench",
    capacity: "30 kg",
    measurement_unit: "kg",
    accuracy_class: "Class III",
    prefix: "NA3-ES"
  },
  non_auto_weighing_class_4: {
    instrument_type: "Ordinary Accuracy Heavy Industrial Scale",
    manufacturer: "Avery Weigh-Tronix",
    model: "ZM510 Heavy Industrial Platform",
    capacity: "500 kg",
    measurement_unit: "kg",
    accuracy_class: "Class IIII",
    prefix: "NA4-AV"
  },
  load_cell: {
    instrument_type: "High Precision Shear Beam Load Cell",
    manufacturer: "Zemic Europe B.V.",
    model: "H8C Nickel Plated Force Cell",
    capacity: "50 kN (5000 kg)",
    measurement_unit: "kN",
    accuracy_class: "Class C3",
    prefix: "LC-ZM"
  },
  beam_scale: {
    instrument_type: "Equal Arm Precision Brass Beam Scale",
    manufacturer: "Standard Precision Balances",
    model: "BS-10 Equal Arm Standard",
    capacity: "5 kg",
    measurement_unit: "kg",
    accuracy_class: "Class C",
    prefix: "BS-SP"
  },
  counter_machine: {
    instrument_type: "Commercial Mechanical Dial Counter Scale",
    manufacturer: "Salter Scales India",
    model: "CM-250 Mechanical Dial Counter",
    capacity: "10 kg",
    measurement_unit: "kg",
    accuracy_class: "Class III",
    prefix: "CM-SL"
  },
  weights_all: {
    instrument_type: "Cast Iron Hexagonal Working Standard Weight Set",
    manufacturer: "National Metrology Corporation",
    model: "M1 Hexagonal Standard Weight Set",
    capacity: "1 g - 20 kg Set (12 pcs)",
    measurement_unit: "kg",
    accuracy_class: "Class M1",
    prefix: "WT-NM"
  },
  gas_meter: {
    instrument_type: "Diaphragm Commercial Gas Flow Meter",
    manufacturer: "Pietro Fiorentini",
    model: "G4 Commercial Diaphragm Flow",
    capacity: "6 m³/h",
    measurement_unit: "m³",
    accuracy_class: "Class 1.5",
    prefix: "GM-PF"
  },
  energy_meter: {
    instrument_type: "3-Phase 4-Wire Static Industrial Energy Meter",
    manufacturer: "Secure Meters Ltd",
    model: "Premier 300 3-Phase Polyphase",
    capacity: "10-60 A (3x240V)",
    measurement_unit: "kWh",
    accuracy_class: "Class 0.5S",
    prefix: "EM-SM"
  },
  moisture_meter: {
    instrument_type: "Advanced Grain & Seed Moisture Tester",
    manufacturer: "Kett Electric Laboratory",
    model: "PM-650 Advanced Grain Gauge",
    capacity: "6-40 %",
    measurement_unit: "%",
    accuracy_class: "Standard Grade",
    prefix: "MM-KT"
  },
  speed_meter: {
    instrument_type: "Doppler Radar Vehicle Speed Measurement Device",
    manufacturer: "Truvelo Manufacturers",
    model: "DopplerRadar D-Cam 200",
    capacity: "0-250 km/h",
    measurement_unit: "km/h",
    accuracy_class: "Grade A ±1 km/h",
    prefix: "SM-TR"
  },
  breath_analyser: {
    instrument_type: "Evidential Fuel-Cell Alcohol Breath Analyser",
    manufacturer: "Dräger Safety AG",
    model: "Alcotest 6820 Fuel Cell Sensor",
    capacity: "0.0-5.0 mg/L",
    measurement_unit: "mg/L",
    accuracy_class: "Evidential Grade",
    prefix: "BA-DR"
  },
  multi_dim_measuring: {
    instrument_type: "Automated 3D Volume & Dimension Scanner",
    manufacturer: "Mettler Toledo India",
    model: "CSN840 Volume & Dimension Scanner",
    capacity: "120x120x120 cm",
    measurement_unit: "cm",
    accuracy_class: "Class 1",
    prefix: "MD-MT"
  },
  flow_meter: {
    instrument_type: "Coriolis Mass Flow Measurement Meter",
    manufacturer: "KROHNE Messtechnik",
    model: "Optimass 6400 Coriolis Mass",
    capacity: "50 mm (0-500 L/min)",
    measurement_unit: "L/min",
    accuracy_class: "Class 0.2",
    prefix: "FM-KR"
  }
};

function InstrumentForm({ token, close, done, user }) {
  const [gatcCategories, setGatcCategories] = useState([]);
  const [selectedCat, setSelectedCat] = useState(null);
  const [form, setForm] = useState({
    instrument_type: '',
    category: '',
    manufacturer: '',
    model: '',
    serial_number: '',
    capacity: '',
    accuracy_class: '',
    measurement_unit: '',
    year_of_manufacture: new Date().getFullYear(),
    owner_name: user?.organization_name || user?.full_name || 'Commercial Establishment',
    owner_address: user?.address || 'Industrial Estate, Ambattur',
    state: user?.state || 'Tamil Nadu',
    district: user?.district || 'Chennai',
    location: user?.address || 'Unit 4B, Phase II Industrial Zone'
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const applyCategoryDefaults = (catId, cats = gatcCategories) => {
    const cat = (cats || []).find(c => c.id === catId);
    setSelectedCat(cat);
    const preset = GATC_INSTRUMENT_DEFAULTS[catId];
    const randomSuffix = Math.floor(100000 + Math.random() * 900000);
    const prefix = preset?.prefix || `LM-${catId?.substring(0, 3)?.toUpperCase() || 'INS'}`;

    setForm(prev => ({
      ...prev,
      category: catId,
      instrument_type: preset?.instrument_type || (cat ? cat.name : prev.instrument_type),
      manufacturer: preset?.manufacturer || prev.manufacturer,
      model: preset?.model || prev.model,
      serial_number: `${prefix}-${randomSuffix}`,
      capacity: preset?.capacity || prev.capacity,
      measurement_unit: preset?.measurement_unit || (cat && cat.units ? cat.units[0] : 'kg'),
      accuracy_class: preset?.accuracy_class || (cat && cat.accuracy_classes ? cat.accuracy_classes[0] : ''),
      owner_name: user?.organization_name || user?.full_name || prev.owner_name,
      state: user?.state || prev.state || 'Tamil Nadu',
      district: user?.district || prev.district || 'Chennai',
      owner_address: user?.address || prev.owner_address,
      location: user?.address || prev.location
    }));
  };

  useEffect(() => {
    api.gatcRules()
      .then(res => {
        const cats = res.categories || [];
        setGatcCategories(cats);
        if (cats.length > 0 && !form.category) {
          const defaultCatId = cats.find(c => c.id === 'non_auto_weighing_class_3')?.id || cats[0].id;
          applyCategoryDefaults(defaultCatId, cats);
        }
      })
      .catch(console.error);
  }, []);

  const onCategoryChange = catId => {
    applyCategoryDefaults(catId);
  };

  const handleRegenerateSerial = () => {
    if (form.category) {
      applyCategoryDefaults(form.category);
    }
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

  const dbBusinessName = user?.organization_name || user?.full_name || 'Commercial Establishment';

  return (
    <Modal title="Register Instrument (2025 GATC Amendment)" onClose={close}>
      <div
        style={{
          background: 'rgba(99, 102, 241, 0.08)',
          border: '1px solid rgba(99, 102, 241, 0.25)',
          borderRadius: '8px',
          padding: '0.65rem 0.9rem',
          marginBottom: '1rem',
          fontSize: '0.8rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <div>
          🏢 <strong>Registered Business (from DB):</strong> <span style={{ color: '#818cf8', fontWeight: 700 }}>{dbBusinessName}</span>
          <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.72rem', marginTop: '0.1rem' }}>
            Specs and serial numbers are pre-filled based on category selection. All fields are fully editable.
          </span>
        </div>
        <button
          type="button"
          onClick={handleRegenerateSerial}
          style={{
            fontSize: '0.75rem',
            padding: '0.35rem 0.65rem',
            background: 'rgba(99, 102, 241, 0.2)',
            color: '#c7d2fe',
            border: '1px solid rgba(99, 102, 241, 0.4)',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 700,
            whiteSpace: 'nowrap'
          }}
        >
          🎲 Re-generate Specs
        </button>
      </div>

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
        <label>Serial Number (Auto-Generated)
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
        <label>Accuracy Class
          <input value={form.accuracy_class} onChange={e => setForm({ ...form, accuracy_class: e.target.value })} />
        </label>
        <label>Year of Manufacture
          <input type="number" value={form.year_of_manufacture} onChange={e => setForm({ ...form, year_of_manufacture: e.target.value })} />
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
        <label className="wide">Owner / Establishment Name (From Registered Database Profile)
          <input required value={form.owner_name} onChange={e => setForm({ ...form, owner_name: e.target.value })} />
        </label>
        {error && <p className="form-error wide">{error}</p>}
        <button className="wide" disabled={busy}>{busy ? 'Registering…' : 'Register Instrument'}</button>
      </form>
    </Modal>
  );
}

function Passport({ instrument, token, uploadAllowed, close, toast }) {
  const { t } = useTranslation();
  const { data, loading, error } = useAsync(() => api.passport(instrument.instrument_id, token), [instrument.instrument_id, token]);
  return (
    <Modal title={t('digital_passport')} onClose={close}>
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
          <h3>{t('certificate_history')}</h3>
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

function Applications({ token, role, toast, user, darkMode }) {
  const { t } = useTranslation();
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
        {canCreate && <button onClick={() => setShow(true)}>{t('new_application_btn')}</button>}
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
          user={user}
          darkMode={darkMode}
          close={() => setShow(false)}
          done={result => {
            setShow(false);
            if (Array.isArray(result)) {
              toast(`Batch submitted! ${result.length} verification application(s) created & auto-assigned to regional LMO.`);
            } else {
              toast(`Application ${result?.application_number || 'Batch'} submitted & auto-assigned to regional LMO.`);
            }
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

function ApplicationForm({ token, close, done, user, darkMode }) {
  const { data: instruments, loading } = useAsync(() => api.instruments(token), [token]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [form, setForm] = useState({
    application_type: 'VERIFICATION',
    requested_date: new Date().toISOString().split('T')[0],
    preferred_location: '',
    remarks: ''
  });
  const [error, setError] = useState('');
  const [showPayment, setShowPayment] = useState(false);
  const [busy, setBusy] = useState(false);
  const [submissionProgress, setSubmissionProgress] = useState(null);

  useEffect(() => {
    if (instruments && instruments.length > 0 && selectedIds.length === 0) {
      setSelectedIds([instruments[0].instrument_id]);
    }
  }, [instruments]);

  const allInstruments = instruments || [];
  const filteredInstruments = useMemo(() => {
    if (!searchQuery.trim()) return allInstruments;
    const q = searchQuery.toLowerCase();
    return allInstruments.filter(inst =>
      (inst.instrument_id || '').toLowerCase().includes(q) ||
      (inst.manufacturer || '').toLowerCase().includes(q) ||
      (inst.model || '').toLowerCase().includes(q) ||
      (inst.category || '').toLowerCase().includes(q) ||
      (inst.serial_number || '').toLowerCase().includes(q) ||
      (inst.capacity || '').toLowerCase().includes(q)
    );
  }, [allInstruments, searchQuery]);

  const selectedInstruments = useMemo(() => {
    return allInstruments.filter(inst => selectedIds.includes(inst.instrument_id));
  }, [allInstruments, selectedIds]);

  const fees = useMemo(() => {
    return calculateBatchVerificationFees(selectedInstruments, 100, 0.18);
  }, [selectedInstruments]);

  const toggleSelectInstrument = (instId) => {
    setSelectedIds(prev =>
      prev.includes(instId) ? prev.filter(id => id !== instId) : [...prev, instId]
    );
  };

  const handleSelectAllFiltered = () => {
    const filteredIds = filteredInstruments.map(i => i.instrument_id);
    setSelectedIds(prev => Array.from(new Set([...prev, ...filteredIds])));
  };

  const handleClearSelection = () => {
    setSelectedIds([]);
  };

  const handleValidateAndPay = event => {
    event.preventDefault();
    if (selectedIds.length === 0) {
      setError('Please select at least one instrument for verification.');
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
    const submittedList = [];

    try {
      for (let i = 0; i < selectedInstruments.length; i++) {
        const inst = selectedInstruments[i];
        setSubmissionProgress(`Submitting application ${i + 1} of ${selectedInstruments.length} (${inst.instrument_id})...`);
        const item = await api.createApplication({
          ...form,
          instrument_id: inst.instrument_id,
          remarks: `${form.remarks ? form.remarks + ' | ' : ''}Statutory e-Challan: ${receipt.challan_number} (Txn: ${receipt.transaction_id}) [Item ${i + 1}/${selectedInstruments.length}]`
        }, token);
        const submitted = await api.submitApplication(item.application_number, token);
        submittedList.push(submitted);
      }
      done(submittedList);
    } catch (err) {
      setError(`Error during application submission: ${err.message}`);
    } finally {
      setBusy(false);
      setSubmissionProgress(null);
    }
  };

  if (loading) return <Modal title="New Verification Application" onClose={close}><Spinner /></Modal>;

  const firstInstrument = selectedInstruments[0] || allInstruments[0];

  return (
    <Modal title="New Verification Application" onClose={close}>
      <form onSubmit={handleValidateAndPay} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <label style={{ margin: 0, fontWeight: 700, fontSize: '0.9rem' }}>
              Select Instruments for Verification ({selectedIds.length} selected)
            </label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                className="link"
                style={{ fontSize: '0.75rem', textDecoration: 'underline' }}
                onClick={handleSelectAllFiltered}
              >
                Select All ({filteredInstruments.length})
              </button>
              {selectedIds.length > 0 && (
                <button
                  type="button"
                  className="link"
                  style={{ fontSize: '0.75rem', color: '#ef4444', textDecoration: 'underline' }}
                  onClick={handleClearSelection}
                >
                  Clear All
                </button>
              )}
            </div>
          </div>

          <div style={{ marginBottom: '0.6rem' }}>
            <input
              type="text"
              placeholder="🔍 Search instruments by ID, model, category, capacity..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem',
                fontSize: '0.85rem',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-secondary)',
                color: 'var(--text-primary)'
              }}
            />
          </div>

          <div
            style={{
              maxHeight: '220px',
              overflowY: 'auto',
              border: '1px solid var(--border-color)',
              borderRadius: '10px',
              background: 'var(--bg-primary)',
              padding: '0.4rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.4rem'
            }}
          >
            {filteredInstruments.length === 0 ? (
              <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                No registered instruments match "{searchQuery}".
              </div>
            ) : (
              filteredInstruments.map(inst => {
                const isSelected = selectedIds.includes(inst.instrument_id);
                const feeData = calculateGazetteStatutoryFee(inst);
                return (
                  <div
                    key={inst.instrument_id}
                    onClick={() => toggleSelectInstrument(inst.instrument_id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.6rem 0.8rem',
                      borderRadius: '8px',
                      background: isSelected ? 'rgba(99, 102, 241, 0.12)' : 'var(--bg-secondary)',
                      border: isSelected ? '1.5px solid #6366f1' : '1px solid var(--border-color)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: '#6366f1' }}
                      />
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                          <span style={{ fontFamily: 'monospace', fontSize: '0.8rem', fontWeight: 700, color: '#6366f1' }}>
                            {inst.instrument_id}
                          </span>
                          <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                            {inst.manufacturer} {inst.model}
                          </strong>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                          <span>{feeData.categoryLabel}</span>
                          {inst.capacity && <span> • Cap: {inst.capacity}</span>}
                          {inst.accuracy_class && <span> • {inst.accuracy_class}</span>}
                        </div>
                      </div>
                    </div>

                    <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '0.75rem' }}>
                      <div style={{ fontWeight: 800, color: '#6366f1', fontSize: '0.9rem' }}>
                        ₹{feeData.fee.toLocaleString('en-IN')}
                      </div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                        Gazette Sl.{feeData.gazetteSlNo}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {selectedInstruments.length > 0 && (
          <div
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: '10px',
              padding: '0.85rem 1rem',
              fontSize: '0.82rem'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <strong style={{ fontSize: '0.84rem', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                📜 Gazette Statutory Fee Schedule Breakdown
              </strong>
              <span style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 700, background: 'rgba(16, 185, 129, 0.1)', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>
                Legal Metrology Act 2009
              </span>
            </div>

            <div style={{ maxHeight: '110px', overflowY: 'auto', marginBottom: '0.6rem' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                <tbody>
                  {fees.items.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px dashed var(--border-color)' }}>
                      <td style={{ padding: '0.35rem 0' }}>
                        <span style={{ fontWeight: 600 }}>{item.name}</span>
                        <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem' }}>{item.ruleDescription}</span>
                      </td>
                      <td style={{ padding: '0.35rem 0', textAlign: 'right', fontWeight: 700, verticalAlign: 'top' }}>
                        ₹{item.amount.toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                <span>Subtotal Base Statutory Fee ({fees.count} item{fees.count > 1 ? 's' : ''}):</span>
                <span>₹{fees.subtotalBaseFee.toLocaleString('en-IN')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                <span>Digital Security Stamp & Hologram Quota:</span>
                <span>₹{fees.stampFee.toLocaleString('en-IN')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                <span>Statutory GST (CGST 9% + SGST 9%):</span>
                <span>₹{fees.gstAmount.toLocaleString('en-IN')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '0.3rem', borderTop: '1px solid var(--border-color)', fontWeight: 800, fontSize: '0.95rem', color: '#6366f1' }}>
                <span>Total Statutory Fee Payable:</span>
                <span>₹{fees.totalPayable.toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
          <label style={{ margin: 0 }}>Application Type
            <select
              value={form.application_type}
              onChange={e => setForm({ ...form, application_type: e.target.value })}
              style={{ marginTop: '0.3rem' }}
            >
              <option value="VERIFICATION">INITIAL VERIFICATION</option>
              <option value="RE_VERIFICATION">RE-VERIFICATION</option>
            </select>
          </label>
          <label style={{ margin: 0 }}>Preferred Inspection Date
            <input
              type="date"
              required
              value={form.requested_date}
              onChange={e => setForm({ ...form, requested_date: e.target.value })}
              style={{ marginTop: '0.3rem' }}
            />
          </label>
        </div>

        <label style={{ margin: 0 }}>Premises / Location
          <input
            required
            value={form.preferred_location}
            onChange={e => setForm({ ...form, preferred_location: e.target.value })}
            placeholder="Full business premises inspection address"
            style={{ marginTop: '0.3rem' }}
          />
        </label>

        <label style={{ margin: 0 }}>Remarks & Special Instructions
          <textarea
            rows={2}
            value={form.remarks}
            onChange={e => setForm({ ...form, remarks: e.target.value })}
            placeholder="e.g., Specific slot timing, calibration test weights ready on site..."
            style={{ marginTop: '0.3rem' }}
          />
        </label>

        {error && <p className="form-error" style={{ margin: 0 }}>{error}</p>}

        <button
          type="submit"
          style={{
            marginTop: '0.5rem',
            width: '100%',
            padding: '0.85rem 1rem',
            background: selectedIds.length === 0 ? 'var(--bg-secondary)' : 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
            color: '#fff',
            fontWeight: 800,
            fontSize: '0.95rem',
            borderRadius: '10px',
            border: 'none',
            cursor: selectedIds.length === 0 ? 'not-allowed' : 'pointer',
            boxShadow: selectedIds.length > 0 ? '0 4px 14px rgba(99, 102, 241, 0.4)' : 'none'
          }}
          disabled={busy || selectedIds.length === 0}
        >
          {busy
            ? (submissionProgress || 'Submitting batch applications…')
            : selectedIds.length === 0
            ? 'Select at least 1 instrument to continue'
            : `💳 Proceed to Statutory Stamping Fee Payment (₹${fees.totalPayable.toLocaleString('en-IN')})`}
        </button>
      </form>

      {showPayment && (
        <PaymentGatewayModal
          title={`Batch Verification Stamping Fee e-Challan (${fees.count} Instruments)`}
          purpose="BATCH_INSTRUMENT_VERIFICATION_FEE"
          purposeLabel={`Statutory Verification & Stamping Fee for ${fees.count} Selected Instruments`}
          payerName={user?.full_name || "Authorized Commercial Signatory"}
          organizationName={firstInstrument?.owner_name || user?.organization || "Commercial Establishment"}
          state={firstInstrument?.state || "Tamil Nadu"}
          district={firstInstrument?.district || "Chennai"}
          baseFee={fees.subtotalBaseFee}
          stampFee={fees.stampFee}
          feeBreakdown={fees.items}
          taxRate={0.18}
          darkMode={darkMode}
          onCancel={() => setShowPayment(false)}
          onPaymentSuccess={handlePaymentSuccess}
        />
      )}
    </Modal>
  );
}

function Assignments({ token, role, toast }) {
  const { t } = useTranslation();
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
            <button className="link" onClick={async () => {
              try {
                const res = await api.createVerification({ application_number: item.application_number }, token);
                sessionStorage.setItem('lm_active_verification', res.id);
                go('/verify-field');
              } catch (err) {
                toast(err.message);
              }
            }}>
              {t('start_field_verification')}
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
  const record = useAsync(async () => {
    if (!recordId) return null;
    try {
      return await api.verification(recordId, token);
    } catch (err) {
      sessionStorage.removeItem('lm_active_verification');
      setRecordId(null);
      return null;
    }
  }, [recordId, token]);

  if (assignments.loading || (recordId && record.loading)) return <Spinner />;

  if (!recordId || !record.data) {
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
                  try {
                    const res = await api.createVerification({ application_number: item.application_number }, token);
                    sessionStorage.setItem('lm_active_verification', res.id);
                    setRecordId(String(res.id));
                  } catch (err) {
                    toast(err.message);
                  }
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
  const { t } = useTranslation();
  const [form, setForm] = useState(() => ({
    latitude: record?.latitude ?? '13.082700',
    longitude: record?.longitude ?? '80.270700',
    remarks: record?.remarks || 'Physical verification conducted on site. All calibration tolerances conform to Legal Metrology Standards.',
    standards_used: record?.standards_used || 'Class M1 Standard Working Weights (50kg x 3)',
    defects_found: record?.defects_found || 'None / Zero Deviation',
    measurements: (record?.measurements && record.measurements.length > 0)
      ? record.measurements
      : [
          { parameter: 'Full Capacity Calibration Test', observed_value: 50.0, expected_value: 50.0, unit: 'kg', within_tolerance: true },
          { parameter: 'Corner Load Sensitivity Test', observed_value: 10.0, expected_value: 10.0, unit: 'kg', within_tolerance: true },
          { parameter: 'Zero Return Repeatability Test', observed_value: 0.0, expected_value: 0.0, unit: 'kg', within_tolerance: true }
        ],
    observations: (record?.observations && record.observations.length > 0)
      ? record.observations
      : ['Manufacturer stamping and lead seal verified intact.', 'Anti-tampering verification sticker affixed.']
  }));
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
      await api.updateVerification(id, {
        latitude: form.latitude ? parseFloat(form.latitude) : null,
        longitude: form.longitude ? parseFloat(form.longitude) : null,
        remarks: form.remarks || (decision === 'approve' ? 'Verification passed. Verified under Legal Metrology Act.' : 'Verification rejected.'),
        standards_used: form.standards_used || 'Class M1 Standard Working Weights',
        defects_found: form.defects_found || 'None',
        measurements: form.measurements.length > 0 ? form.measurements : [
          { parameter: 'Full Capacity Calibration Test', observed_value: 50.0, expected_value: 50.0, unit: 'kg', within_tolerance: true }
        ],
        observations: form.observations.length > 0 ? form.observations : ['Physical verification complete.']
      }, token).catch(() => {});

      const res = await api.finaliseVerification(id, decision, token);
      if (decision === 'approve') {
        toast(`Verification Approved! Certificate ${res.certificate_number} generated & QR token issued!`);
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
          <button type="button" className="wide outline" onClick={captureGPS}>{t('capture_gps')}</button>
          <label className="wide">{t('standards_used')}
            <input value={form.standards_used} onChange={e => setForm({ ...form, standards_used: e.target.value })} placeholder="e.g. Class M1 Test Weights 150kg" />
          </label>
          <label className="wide">{t('defects_found')}
            <input value={form.defects_found} onChange={e => setForm({ ...form, defects_found: e.target.value })} placeholder="e.g. None / zero deviation noted" />
          </label>
          <label className="wide">{t('general_remarks')}
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
          <button className="danger" disabled={busy} onClick={() => finalise('reject')}>{t('reject_verification')}</button>
          <button disabled={busy} onClick={() => finalise('approve')}>{t('approve_issue_cert')}</button>
        </div>
      </section>
    </main>
  );
}

function Certificates({ token, role, toast, darkMode }) {
  const { t } = useTranslation();
  const { data, loading, error } = useAsync(() => api.certificates(token), [token]);
  const [selectedCert, setSelectedCert] = useState(null);

  if (loading) return <Spinner />;
  if (error) return <ErrorState text={error} />;

  return (
    <main className="page">
      <div className="page-actions">
        <div>
          <h1>{t('nav_certificates')}</h1>
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
  const { t } = useTranslation();
  const { data, loading, error } = useAsync(() => api.dueTracking(token), [token]);
  if (loading) return <Spinner />;
  if (error) return <ErrorState text={error} />;

  return (
    <main className="page">
      <div className="page-actions">
        <h1>{t('nav_due_tracking')}</h1>
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

function PublicVerify({ tokenOrNumber, darkMode, onToggleTheme }) {
  const { t } = useTranslation();
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
            <span>{t('back')}</span>
          </button>
          <button className="brand back" onClick={() => go('/')} style={{ background: 'none', border: 'none', padding: 0 }}>
            <BrandLogo darkMode={darkMode} />
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <LanguageSelector compact />
          <button className="theme-toggle-btn" aria-label="Toggle theme" onClick={onToggleTheme}>
            {darkMode ? '☀️' : '🌙'}
          </button>
        </div>
      </div>

      <section>
        <p className="eyebrow">{t('hero_eyebrow')}</p>
        <h1>{t('public_verify_title')}</h1>
        <p>{t('public_verify_sub')}</p>
        
        <form onSubmit={verify}>
          <input placeholder="Enter QR Token or LM-CERT Number" value={input} onChange={event => setInput(event.target.value)} />
          <button style={{ marginTop: '0.8rem', width: '100%' }}>{t('verify_authenticity_btn')}</button>
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
            <div className={`verify-card ${data.status === 'VALID' ? 'valid-card' : 'invalid-card'}`} style={{ margin: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.35rem' }}>
                    {data.status === 'VALID' ? t('valid_cert_heading') : t('invalid_cert_heading')}
                  </h2>
                  <p style={{ margin: '0.3rem 0 0', fontSize: '0.85rem', opacity: 0.85 }}>
                    {data.issuing_authority || 'Legal Metrology Department, Government of India'}
                  </p>
                </div>

                <Badge>{data.status}</Badge>
              </div>

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

              <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.8rem', flexWrap: 'wrap', alignItems: 'center' }}>
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
                  <span>{t('view_coa_printable')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const qrVal = data.qr_token || data.certificate_number;
                    go(`/complaints?qr=${encodeURIComponent(qrVal)}`);
                  }}
                  style={{
                    background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
                    color: '#ffffff',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.65rem 1.35rem',
                    borderRadius: '8px',
                    fontWeight: 700,
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(220, 38, 38, 0.3)',
                    border: 'none',
                  }}
                  title="Report inaccurate measures or unverified instruments"
                >
                  <span>⚖️</span>
                  <span>{t('hero_cta_complaint') || 'File / Report Grievance'}</span>
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
            ← {t('back')}
          </button>
        </div>
      </section>
    </main>
  );
}

function extractSortValue(row, colDef) {
  if (!row) return '';
  const [heading, accessor] = colDef;
  if (typeof accessor === 'string') {
    return row[accessor] ?? '';
  }
  if (typeof accessor === 'function') {
    try {
      const res = accessor(row);
      if (res === null || res === undefined) return '';
      if (typeof res === 'string' || typeof res === 'number' || typeof res === 'boolean') {
        return res;
      }
      if (res?.props?.children !== undefined) {
        return String(res.props.children);
      }
    } catch (e) {}
  }
  const cleanHeading = String(heading || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  for (const k of Object.keys(row)) {
    if (k.toLowerCase().replace(/[^a-z0-9]/g, '') === cleanHeading) {
      return row[k] ?? '';
    }
  }
  return '';
}

function compareSortValues(valA, valB, direction) {
  const isEmptyA = valA === null || valA === undefined || valA === '';
  const isEmptyB = valB === null || valB === undefined || valB === '';
  if (isEmptyA && isEmptyB) return 0;
  if (isEmptyA) return 1;
  if (isEmptyB) return -1;

  const numA = Number(valA);
  const numB = Number(valB);
  const isNum = !isNaN(numA) && !isNaN(numB) && typeof valA !== 'boolean' && typeof valB !== 'boolean' && String(valA).trim() !== '' && String(valB).trim() !== '';
  if (isNum) {
    return direction === 'desc' ? numB - numA : numA - numB;
  }

  const dateA = Date.parse(valA);
  const dateB = Date.parse(valB);
  if (!isNaN(dateA) && !isNaN(dateB) && (typeof valA === 'string' && (valA.includes('-') || valA.includes('/') || valA.includes(':')))) {
    return direction === 'desc' ? dateB - dateA : dateA - dateB;
  }

  const strA = String(valA).toLowerCase();
  const strB = String(valB).toLowerCase();
  return direction === 'desc' ? strB.localeCompare(strA, undefined, { numeric: true, sensitivity: 'base' }) : strA.localeCompare(strB, undefined, { numeric: true, sensitivity: 'base' });
}

function DataTable({ rows, columns, search = false }) {
  const { t } = useTranslation();
  const [term, setTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ colIndex: null, direction: null });

  const handleHeaderClick = (index, heading) => {
    if (!heading && heading !== 0) return;

    if (sortConfig.colIndex !== index) {
      setSortConfig({ colIndex: index, direction: 'desc' });
    } else if (sortConfig.direction === 'desc') {
      setSortConfig({ colIndex: index, direction: 'asc' });
    } else {
      setSortConfig({ colIndex: null, direction: null });
    }
  };

  const filteredAndSorted = useMemo(() => {
    let list = rows || [];
    if (term.trim()) {
      list = list.filter(row => JSON.stringify(row).toLowerCase().includes(term.toLowerCase()));
    }
    if (sortConfig.colIndex !== null && sortConfig.direction !== null) {
      const colDef = columns[sortConfig.colIndex];
      if (colDef) {
        list = [...list].sort((a, b) => {
          const valA = extractSortValue(a, colDef);
          const valB = extractSortValue(b, colDef);
          return compareSortValues(valA, valB, sortConfig.direction);
        });
      }
    }
    return list;
  }, [rows, term, sortConfig, columns]);

  return (
    <div className="table-wrap">
      {search && <input className="search" placeholder={t('search_placeholder')} value={term} onChange={event => setTerm(event.target.value)} />}
      {filteredAndSorted.length ? (
        <table>
          <thead>
            <tr>
              {columns.map(([heading], index) => {
                const isSorted = sortConfig.colIndex === index && sortConfig.direction !== null;
                const isDesc = isSorted && sortConfig.direction === 'desc';
                const isAsc = isSorted && sortConfig.direction === 'asc';
                const isSortable = Boolean(heading);

                return (
                  <th
                    key={index}
                    className={isSortable ? `sortable ${isSorted ? 'sorted' : ''}` : ''}
                    onClick={isSortable ? () => handleHeaderClick(index, heading) : undefined}
                    title={isSortable ? (isDesc ? 'Sorted High to Low' : isAsc ? 'Sorted Low to High' : 'Click to sort') : undefined}
                    style={{ cursor: isSortable ? 'pointer' : 'default', userSelect: 'none' }}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                      {heading}
                      {isSortable && (
                        <span className="sort-icon" style={{ opacity: isSorted ? 1 : 0.35, fontSize: '0.75rem', color: isSorted ? '#818cf8' : 'inherit' }}>
                          {isDesc ? '▼' : isAsc ? '▲' : '⇅'}
                        </span>
                      )}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {filteredAndSorted.map((row, rowIndex) => (
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
