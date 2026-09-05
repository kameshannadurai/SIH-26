import { useState } from 'react';
import { api } from '../api/client';
import { Spinner } from './UI';

export function PaymentGatewayModal({
  title = "Statutory Fee e-Challan Payment",
  purpose = "BUSINESS_REGISTRATION",
  purposeLabel = "Mandatory Establishment Registration & Initial Verification Quota",
  payerName = "Authorized Signatory",
  organizationName = "Commercial Establishment",
  state = "Tamil Nadu",
  district = "Chennai",
  baseFee = 500,
  taxRate = 0.18,
  feeBreakdown = null,
  stampFee = 100,
  onCancel,
  onPaymentSuccess,
  darkMode
}) {
  const [selectedMethod, setSelectedMethod] = useState('UPI');
  const [processing, setProcessing] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [error, setError] = useState('');

  // Auto-detect theme if not explicitly passed
  const isDark = darkMode !== undefined 
    ? !!darkMode 
    : (typeof document !== 'undefined' && (
        document.documentElement.classList.contains('dark') || 
        document.body.classList.contains('dark') ||
        localStorage.getItem('lm_theme') === 'dark'
      ));

  const c = isDark ? {
    modalBg: '#12101e',
    modalBorder: '1px solid rgba(99, 102, 241, 0.25)',
    cardBg: 'rgba(255, 255, 255, 0.03)',
    cardBorder: '1px solid rgba(255, 255, 255, 0.08)',
    textPrimary: '#f8fafc',
    textSecondary: '#cbd5e1',
    textMuted: '#94a3b8',
    tableBg: 'rgba(0, 0, 0, 0.25)',
    tableHeaderBg: 'rgba(99, 102, 241, 0.12)',
    tableBorder: '1px solid rgba(255, 255, 255, 0.08)',
    tableDashed: '1px dashed rgba(255, 255, 255, 0.12)',
    highlightBg: 'rgba(99, 102, 241, 0.18)',
    highlightText: '#a5b4fc',
    accentColor: '#818cf8',
    noticeBg: 'rgba(234, 179, 8, 0.08)',
    noticeBorder: '1px solid rgba(234, 179, 8, 0.25)',
    noticeText: '#fde047',
    methodCardBg: 'rgba(255, 255, 255, 0.03)',
    methodCardActiveBg: 'rgba(99, 102, 241, 0.2)',
    methodCardActiveBorder: '#818cf8',
    receiptBoxBg: 'rgba(16, 185, 129, 0.1)',
    receiptBoxBorder: '1px solid rgba(16, 185, 129, 0.3)',
    receiptBoxTitle: '#34d399',
  } : {
    modalBg: '#ffffff',
    modalBorder: '1px solid #e2e8f0',
    cardBg: '#f8fafc',
    cardBorder: '1px solid #e2e8f0',
    textPrimary: '#0f172a',
    textSecondary: '#334155',
    textMuted: '#64748b',
    tableBg: '#ffffff',
    tableHeaderBg: '#f1f5f9',
    tableBorder: '1px solid #e2e8f0',
    tableDashed: '1px dashed #e2e8f0',
    highlightBg: 'rgba(79, 70, 229, 0.08)',
    highlightText: '#4338ca',
    accentColor: '#4f46e5',
    noticeBg: '#fffbeb',
    noticeBorder: '1px solid #fef3c7',
    noticeText: '#92400e',
    methodCardBg: '#f8fafc',
    methodCardActiveBg: '#eff6ff',
    methodCardActiveBorder: '#6366f1',
    receiptBoxBg: '#ecfdf5',
    receiptBoxBorder: '1px solid #a7f3d0',
    receiptBoxTitle: '#065f46',
  };

  const effectiveBaseFee = feeBreakdown && feeBreakdown.length > 0
    ? feeBreakdown.reduce((sum, item) => sum + (Number(item.amount) || 0), 0)
    : baseFee;
  const effectiveStampFee = Number(stampFee) || 0;
  const subtotal = effectiveBaseFee + effectiveStampFee;
  const gstAmount = Math.round(subtotal * taxRate);
  const totalAmount = subtotal + gstAmount;

  const handlePay = async () => {
    setProcessing(true);
    setError('');
    try {
      // Simulate realistic payment gateway processing latency
      await new Promise(r => setTimeout(r, 1200));

      const res = await api.simulatePayment({
        amount: totalAmount,
        purpose,
        payment_method: selectedMethod === 'UPI' ? 'UPI / BharatPay' : selectedMethod === 'NETBANKING' ? 'State Bank Treasury / Net Banking' : 'Corporate Debit Card',
        payer_name: payerName,
        organization_name: organizationName,
        state: state || 'IN'
      });

      setReceipt(res);
    } catch (err) {
      setError(err.message || 'Payment simulation failed. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const handleFinish = () => {
    if (receipt && onPaymentSuccess) {
      onPaymentSuccess(receipt);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        overflowY: 'auto'
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '620px',
          background: c.modalBg,
          color: c.textPrimary,
          borderRadius: '16px',
          border: c.modalBorder,
          boxShadow: isDark ? '0 25px 60px rgba(0, 0, 0, 0.75)' : '0 25px 60px rgba(15, 23, 42, 0.25)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          transition: 'background 0.2s ease, color 0.2s ease'
        }}
      >
        {/* Gateway Official Header */}
        <div
          style={{
            background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)',
            color: '#ffffff',
            padding: '1.25rem 1.75rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '2px solid #6366f1'
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
              <span style={{ fontSize: '1.2rem' }}>🏛️</span>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, letterSpacing: '0.08em', color: '#a5b4fc', textTransform: 'uppercase' }}>
                Govt. of India • Legal Metrology Department
              </span>
            </div>
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#ffffff' }}>
              {receipt ? "Payment Receipt Voucher" : title}
            </h3>
          </div>
          {!processing && !receipt && onCancel && (
            <button
              onClick={onCancel}
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                border: 'none',
                color: '#ffffff',
                fontSize: '1.2rem',
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              ×
            </button>
          )}
        </div>

        {/* Content Body */}
        <div style={{ padding: '1.75rem', maxHeight: '75vh', overflowY: 'auto' }}>
          {receipt ? (
            /* SUCCESS CONFIRMATION RECEIPT */
            <div>
              <div
                style={{
                  textAlign: 'center',
                  padding: '1.5rem',
                  background: c.receiptBoxBg,
                  borderRadius: '12px',
                  border: c.receiptBoxBorder,
                  marginBottom: '1.5rem'
                }}
              >
                <div style={{ fontSize: '2.8rem', marginBottom: '0.5rem' }}>✅</div>
                <h3 style={{ margin: '0 0 0.25rem 0', color: c.receiptBoxTitle, fontWeight: 900 }}>Payment Confirmed</h3>
                <p style={{ margin: 0, fontSize: '0.85rem', color: c.textMuted }}>
                  Statutory e-Challan generated successfully. Transaction ID: <strong style={{ color: c.textPrimary }}>{receipt.transaction_id}</strong>
                </p>
              </div>

              {/* Receipt Table */}
              <div
                style={{
                  background: c.cardBg,
                  border: c.cardBorder,
                  borderRadius: '10px',
                  padding: '1.25rem',
                  marginBottom: '1.5rem',
                  fontSize: '0.86rem'
                }}
              >
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                  <div>
                    <span style={{ color: c.textMuted, display: 'block', fontSize: '0.75rem' }}>Challan Reference No.</span>
                    <strong style={{ color: c.textPrimary }}>{receipt.challan_number}</strong>
                  </div>
                  <div>
                    <span style={{ color: c.textMuted, display: 'block', fontSize: '0.75rem' }}>Payment Status</span>
                    <span style={{ color: '#10b981', fontWeight: 800 }}>PAID / CONFIRMED</span>
                  </div>
                  <div>
                    <span style={{ color: c.textMuted, display: 'block', fontSize: '0.75rem' }}>Payer Establishment</span>
                    <span style={{ color: c.textPrimary, fontWeight: 600 }}>{organizationName}</span>
                  </div>
                  <div>
                    <span style={{ color: c.textMuted, display: 'block', fontSize: '0.75rem' }}>Amount Paid</span>
                    <strong style={{ fontSize: '1.1rem', color: c.accentColor }}>₹{totalAmount.toFixed(2)}</strong>
                  </div>
                  <div>
                    <span style={{ color: c.textMuted, display: 'block', fontSize: '0.75rem' }}>Gateway Mode</span>
                    <span style={{ color: c.textSecondary }}>{receipt.payment_method} (Stub)</span>
                  </div>
                  <div>
                    <span style={{ color: c.textMuted, display: 'block', fontSize: '0.75rem' }}>Timestamp</span>
                    <span style={{ color: c.textSecondary }}>{new Date(receipt.timestamp).toLocaleString()}</span>
                  </div>
                </div>

                <div style={{ marginTop: '1rem', paddingTop: '0.85rem', borderTop: c.tableDashed, fontSize: '0.75rem', color: c.textMuted }}>
                  📜 <em>{receipt.statutory_reference}</em>
                </div>
              </div>

              <button
                type="button"
                className="primary"
                onClick={handleFinish}
                style={{
                  width: '100%',
                  padding: '0.85rem',
                  fontSize: '1rem',
                  fontWeight: 800,
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: '#ffffff',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)'
                }}
              >
                Proceed & Complete Registration ➔
              </button>
            </div>
          ) : (
            /* PAYMENT CHECKOUT & FEE BREAKDOWN */
            <div>
              {/* Payer Summary */}
              <div
                style={{
                  background: c.cardBg,
                  padding: '1rem 1.25rem',
                  borderRadius: '10px',
                  border: c.cardBorder,
                  marginBottom: '1.25rem',
                  fontSize: '0.85rem'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                  <span style={{ color: c.textMuted }}>Establishment:</span>
                  <strong style={{ color: c.textPrimary }}>{organizationName || 'New Establishment'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                  <span style={{ color: c.textMuted }}>Signatory:</span>
                  <span style={{ color: c.textSecondary, fontWeight: 500 }}>{payerName}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: c.textMuted }}>Jurisdiction:</span>
                  <span style={{ color: c.textSecondary }}>{district ? `${district}, ${state}` : state}</span>
                </div>
              </div>

              {/* Statutory Fee Schedule Breakdown Table */}
              <div style={{ marginBottom: '1.25rem' }}>
                <h4 style={{ margin: '0 0 0.6rem 0', fontSize: '0.82rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: c.textSecondary }}>
                  Statutory Fee Schedule (Legal Metrology Act, 2009)
                </h4>
                <div
                  style={{
                    background: c.tableBg,
                    border: c.tableBorder,
                    borderRadius: '10px',
                    overflow: 'hidden'
                  }}
                >
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                    <thead>
                      <tr style={{ background: c.tableHeaderBg, borderBottom: c.tableBorder }}>
                        <th style={{ padding: '0.65rem 0.85rem', textAlign: 'left', fontWeight: 700, color: c.textPrimary }}>Item Description</th>
                        <th style={{ padding: '0.65rem 0.85rem', textAlign: 'right', fontWeight: 700, color: c.textPrimary }}>Amount (INR)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {feeBreakdown && feeBreakdown.length > 0 ? (
                        feeBreakdown.map((item, idx) => (
                          <tr key={idx} style={{ borderBottom: c.tableBorder }}>
                            <td style={{ padding: '0.65rem 0.85rem' }}>
                              <div style={{ color: c.textPrimary, fontWeight: 700 }}>{item.name || item.instrument_id}</div>
                              <div style={{ fontSize: '0.75rem', color: c.accentColor, fontWeight: 600 }}>{item.categoryLabel || item.category}</div>
                              <small style={{ color: c.textMuted }}>{item.ruleDescription || 'Statutory Schedule Fee'}</small>
                            </td>
                            <td style={{ padding: '0.65rem 0.85rem', textAlign: 'right', fontWeight: 700, color: c.textPrimary, verticalAlign: 'top' }}>
                              ₹{Number(item.amount || 0).toFixed(2)}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr style={{ borderBottom: c.tableBorder }}>
                          <td style={{ padding: '0.65rem 0.85rem' }}>
                            <div style={{ color: c.textPrimary }}><strong>Establishment Registration Fee</strong></div>
                            <small style={{ color: c.textMuted }}>Sec. 19/24, Legal Metrology (General) Rules 2011</small>
                          </td>
                          <td style={{ padding: '0.65rem 0.85rem', textAlign: 'right', fontWeight: 700, color: c.textPrimary }}>
                            ₹{effectiveBaseFee.toFixed(2)}
                          </td>
                        </tr>
                      )}
                      {effectiveStampFee > 0 && (
                        <tr style={{ borderBottom: c.tableBorder }}>
                          <td style={{ padding: '0.65rem 0.85rem' }}>
                            <div style={{ color: c.textPrimary }}><strong>Digital Security Stamp & Hologram Quota</strong></div>
                            <small style={{ color: c.textMuted }}>Tamper-proof physical and digital certification fee</small>
                          </td>
                          <td style={{ padding: '0.65rem 0.85rem', textAlign: 'right', fontWeight: 700, color: c.textPrimary }}>
                            ₹{effectiveStampFee.toFixed(2)}
                          </td>
                        </tr>
                      )}
                      <tr style={{ borderBottom: c.tableBorder }}>
                        <td style={{ padding: '0.65rem 0.85rem', color: c.textMuted }}>
                          Statutory Goods & Services Tax (CGST 9% + SGST 9%)
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem', textAlign: 'right', color: c.textMuted, fontWeight: 600 }}>
                          ₹{gstAmount.toFixed(2)}
                        </td>
                      </tr>
                      <tr style={{ background: c.highlightBg, fontWeight: 800 }}>
                        <td style={{ padding: '0.75rem 0.85rem', color: c.highlightText, fontSize: '0.95rem' }}>
                          Total Statutory Fee Payable
                        </td>
                        <td style={{ padding: '0.75rem 0.85rem', textAlign: 'right', color: c.highlightText, fontSize: '1.15rem', fontWeight: 900 }}>
                          ₹{totalAmount.toFixed(2)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Statutory Rules Box */}
              <div
                style={{
                  padding: '0.75rem 1rem',
                  background: c.noticeBg,
                  border: c.noticeBorder,
                  borderRadius: '8px',
                  marginBottom: '1.25rem',
                  fontSize: '0.76rem',
                  color: c.noticeText,
                  lineHeight: '1.4'
                }}
              >
                ⚖️ <strong>Legal Metrology Statutory Notice:</strong> Registration fees are non-refundable once the official e-Challan transaction is initiated. Upon payment confirmation, your registration dossier will be submitted to the jurisdictional Legal Metrology Office.
              </div>

              {/* Payment Method Selector */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 800, marginBottom: '0.5rem', color: c.textPrimary }}>
                  Select Payment Method:
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                  {[
                    { id: 'UPI', label: '📱 UPI / BharatPay', desc: 'GPay, PhonePe, Paytm, BHIM' },
                    { id: 'NETBANKING', label: '🏛️ SBI / Net Banking', desc: 'All Indian Treasury Banks' },
                    { id: 'CARD', label: '💳 Corporate Card', desc: 'Visa, RuPay, MasterCard' },
                    { id: 'QR', label: '⚡ Dynamic Bharat QR', desc: 'Scan & Pay Instantly' }
                  ].map(m => (
                    <div
                      key={m.id}
                      onClick={() => setSelectedMethod(m.id)}
                      style={{
                        padding: '0.65rem 0.85rem',
                        borderRadius: '8px',
                        border: selectedMethod === m.id ? `2px solid ${c.methodCardActiveBorder}` : c.cardBorder,
                        background: selectedMethod === m.id ? c.methodCardActiveBg : c.methodCardBg,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <div style={{ fontWeight: 700, fontSize: '0.84rem', color: selectedMethod === m.id ? c.accentColor : c.textPrimary }}>
                        {m.label}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: c.textMuted }}>{m.desc}</div>
                    </div>
                  ))}
                </div>
              </div>

              {error && (
                <div style={{ padding: '0.65rem', background: '#fee2e2', color: '#991b1b', borderRadius: '6px', fontSize: '0.82rem', marginBottom: '1rem' }}>
                  {error}
                </div>
              )}

              {/* Pay Button */}
              <button
                type="button"
                className="primary"
                onClick={handlePay}
                disabled={processing}
                style={{
                  width: '100%',
                  padding: '0.85rem',
                  fontSize: '1rem',
                  fontWeight: 800,
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                  color: '#ffffff',
                  border: 'none',
                  cursor: processing ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.6rem'
                }}
              >
                {processing ? (
                  <>
                    <Spinner /> <span>Processing e-Challan Payment (₹{totalAmount.toFixed(2)})...</span>
                  </>
                ) : (
                  <span>🔒 Authorize & Pay ₹{totalAmount.toFixed(2)} (Stub Sandbox)</span>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
