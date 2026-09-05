import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api/client';
import { useTranslation } from '../i18n/LanguageContext';

function renderFormattedMessage(text) {
  if (!text) return null;
  const str = typeof text === 'string' ? text : String(text);
  const lines = str.split('\n');
  return lines.map((line, idx) => {
    // Check for bullet list item
    const isBullet = line.trim().startsWith('- ') || line.trim().startsWith('• ') || line.trim().startsWith('* ');
    const cleanedLine = isBullet ? line.trim().replace(/^[-•*]\s+/, '') : line;

    // Simple parser for **bold** and `code`
    const parts = [];
    const regex = /(\*\*.*?\*\*|`.*?`)/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(cleanedLine)) !== null) {
      if (match.index > lastIndex) {
        parts.push(cleanedLine.substring(lastIndex, match.index));
      }
      const raw = match[0];
      if (raw.startsWith('**') && raw.endsWith('**')) {
        parts.push(<strong key={match.index}>{raw.slice(2, -2)}</strong>);
      } else if (raw.startsWith('`') && raw.endsWith('`')) {
        parts.push(<code key={match.index} className="inline-code">{raw.slice(1, -1)}</code>);
      }
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < cleanedLine.length) {
      parts.push(cleanedLine.substring(lastIndex));
    }

    if (isBullet) {
      return (
        <li key={idx} style={{ marginLeft: '1.25rem', marginBottom: '0.35rem' }}>
          {parts.length > 0 ? parts : cleanedLine}
        </li>
      );
    }
    if (cleanedLine.trim() === '') {
      return <div key={idx} style={{ height: '0.6rem' }} />;
    }
    return (
      <p key={idx} style={{ margin: '0 0 0.45rem' }}>
        {parts.length > 0 ? parts : cleanedLine}
      </p>
    );
  });
}

export function AIAssistantDrawer({ user, token, onNavigate, darkMode, isOpen: propIsOpen, onOpen, onClose, showFloatingButton = true }) {
  const { t } = useTranslation();
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = propIsOpen !== undefined ? propIsOpen : internalOpen;
  const [showPrompts, setShowPrompts] = useState(true);

  const handleOpen = () => {
    if (onOpen) onOpen();
    else setInternalOpen(true);
  };

  const handleClose = () => {
    if (onClose) onClose();
    else setInternalOpen(false);
  };

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const role = user?.role || 'PUBLIC';

  const roleTitles = {
    BUSINESS: 'Business Compliance Copilot',
    LMO: 'LMO Field Inspection Assistant',
    GATC: 'GATC Laboratory Testing Copilot',
    ADMIN: 'Governance & Intelligence Copilot',
    PUBLIC: 'Citizen Legal Metrology Helper'
  };

  const rolePrompts = {
    BUSINESS: [
      'What is the status of my applications?',
      'When is my upcoming inspection?',
      'Which instruments are due for renewal?',
      'What are the GATC 2025 verification fees?'
    ],
    LMO: [
      "What inspections are scheduled today?",
      'Show pending citizen complaints in my district',
      'What are the MPE error limits for Class 3 scales?',
      'Check verification standards checklist'
    ],
    GATC: [
      'Show assigned GATC test applications',
      'What are the 18 GATC verifiable categories?',
      'View calibration standards for Flow Meters'
    ],
    ADMIN: [
      'Show platform summary and pending stats',
      'Which establishments are flagged as High Risk?',
      'Show officer workload across districts',
      'What is the citizen complaint resolution rate?'
    ],
    PUBLIC: [
      'How do I report an inaccurate weighing scale?',
      'How to verify a verification certificate QR?',
      'What are consumer rights under Legal Metrology Act?'
    ]
  };

  const defaultWelcome = {
    sender: 'ai',
    text: `Hello ${user ? user.full_name : 'Citizen'}! I am your local **${roleTitles[role]}**.\n\nI can assist you with real-time status queries, Legal Metrology Act 2009 rules, GATC 2025 amendment standards, and verification tolerances.`,
    quick_actions: []
  };

  // Initial welcome message
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([defaultWelcome]);
    }
  }, [user, role]);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const handleClear = () => {
    setMessages([defaultWelcome]);
  };

  const handleSend = async (queryText) => {
    const textToSend = queryText || input;
    if (!textToSend.trim() || loading) return;

    const userMsg = { sender: 'user', text: textToSend };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await api.aiChat(textToSend, token);
      setMessages(prev => [
        ...prev,
        {
          sender: 'ai',
          text: res.response,
          quick_actions: res.quick_actions || [],
          disclaimer: res.disclaimer
        }
      ]);
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          sender: 'ai',
          text: `⚠️ Error fetching response: ${err.message}. The local assistant operates offline without external API keys.`,
          quick_actions: []
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating Copilot Launcher Button */}
      {showFloatingButton && !isOpen && (
        <button
          className="ai-copilot-btn"
          onClick={handleOpen}
          title="Open Legal Metrology Local AI Assistant"
          aria-label="Open AI Copilot"
        >
          <span className="ai-icon">🤖</span>
          <span className="ai-label">{t('ai_copilot')}</span>
        </button>
      )}

      {/* Slide-over Assistant Drawer */}
      {isOpen && (
        <>
          <div
            className="ai-drawer-backdrop"
            onClick={handleClose}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.45)',
              zIndex: 9998,
              backdropFilter: 'blur(3px)',
            }}
          />
          <aside className={`ai-drawer expanded ${darkMode ? 'dark' : ''}`} style={{ zIndex: 9999 }}>
            <header className="ai-drawer-header">
              <div className="ai-title-wrap">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <span className="ai-badge-role">{role}</span>
                  <small className="ai-status-indicator">● Local Offline Intelligence</small>
                </div>
                <h3>{roleTitles[role]}</h3>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button
                  type="button"
                  className="icon-button"
                  onClick={handleClear}
                  title="Clear conversation"
                  style={{ fontSize: '0.85rem', padding: '0.4rem 0.65rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-muted)', cursor: 'pointer' }}
                >
                  🗑️
                </button>
                <button
                  type="button"
                  className="icon-button"
                  onClick={handleClose}
                  aria-label="Close Assistant"
                  style={{ fontSize: '1.25rem', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', cursor: 'pointer' }}
                >
                  ✕
                </button>
              </div>
            </header>

            {/* Quick Prompts Bar */}
            <div className="ai-quick-prompts">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: showPrompts ? '0.6rem' : 0 }}>
                <span className="prompts-heading" style={{ margin: 0 }}>Suggested Inquiries:</span>
                <button
                  type="button"
                  onClick={() => setShowPrompts(!showPrompts)}
                  style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', padding: 0 }}
                >
                  {showPrompts ? 'Hide ▲' : 'Show Suggestions ▼'}
                </button>
              </div>
              {showPrompts && (
                <div className="prompts-scroll">
                  {(rolePrompts[role] || []).map((prompt, idx) => (
                    <button
                      key={idx}
                      className="quick-prompt-pill"
                      onClick={() => handleSend(prompt)}
                      disabled={loading}
                    >
                      💡 {prompt}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Messages Stream */}
            <div className="ai-messages-container">
              {messages.map((msg, index) => (
                <div key={index} className={`ai-message-row ${msg.sender}`}>
                  <div className="ai-message-bubble">
                    {msg.sender === 'ai' && (
                      <div className="ai-avatar">
                        <span>🤖 Legal Metrology Intelligence</span>
                      </div>
                    )}
                    <div className="ai-message-content">
                      {renderFormattedMessage(msg.text)}
                      {msg.quick_actions && msg.quick_actions.length > 0 && (
                        <div className="ai-actions-row">
                          {msg.quick_actions.map((act, aIdx) => (
                            <button
                              key={aIdx}
                              className="ai-action-btn"
                              onClick={() => {
                                handleClose();
                                if (onNavigate) onNavigate(act.path);
                              }}
                            >
                              ↗ {act.label}
                            </button>
                          ))}
                        </div>
                      )}
                      {msg.disclaimer && (
                        <div className="ai-disclaimer-tag">
                          ⚖️ {msg.disclaimer}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {loading && (
                <div className="ai-message-row ai">
                  <div className="ai-message-bubble">
                    <div className="ai-avatar">🤖 Legal Metrology Intelligence</div>
                    <div className="ai-typing-indicator">
                      <span></span><span></span><span></span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Box */}
            <form
              className="ai-input-form"
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
            >
              <input
                type="text"
                placeholder={`Ask ${roleTitles[role]} about compliance, rules, standards...`}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={loading}
              />
              <button type="submit" className="primary" disabled={loading || !input.trim()}>
                Send Query →
              </button>
            </form>
          </aside>
        </>
      )}
    </>
  );
}
