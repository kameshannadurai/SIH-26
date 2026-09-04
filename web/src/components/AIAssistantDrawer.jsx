import { useState, useEffect, useRef } from 'react';
import { api } from '../api/client';

export function AIAssistantDrawer({ user, token, onNavigate, darkMode }) {
  const [isOpen, setIsOpen] = useState(false);
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

  // Initial welcome message
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          sender: 'ai',
          text: `Hello ${user ? user.full_name : 'Citizen'}! I am your local **${roleTitles[role]}**.\n\nI can assist you with real-time status queries, Legal Metrology Act 2009 rules, GATC 2025 amendment standards, and verification tolerances.`,
          quick_actions: []
        }
      ]);
    }
  }, [user, role]);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

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
      {/* Floating Copilot Launcher Button (Visible only when drawer is closed) */}
      {!isOpen && (
        <button
          className="ai-copilot-btn"
          onClick={() => setIsOpen(true)}
          title="Open Legal Metrology Local AI Assistant"
          aria-label="Open AI Copilot"
        >
          <span className="ai-icon">🤖</span>
          <span className="ai-label">AI Copilot</span>
        </button>
      )}

      {/* Slide-over Assistant Drawer */}
      {isOpen && (
        <>
          <div
            className="ai-drawer-backdrop"
            onClick={() => setIsOpen(false)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.4)',
              zIndex: 9998,
              backdropFilter: 'blur(2px)',
            }}
          />
          <aside className={`ai-drawer ${darkMode ? 'dark' : ''}`} style={{ zIndex: 9999 }}>
            <header className="ai-drawer-header">
              <div className="ai-title-wrap">
                <span className="ai-badge-role">{role}</span>
                <h3>{roleTitles[role]}</h3>
                <small className="ai-status-indicator">● Local Offline Intelligence</small>
              </div>
              <button className="icon-button" onClick={() => setIsOpen(false)} aria-label="Close Assistant">×</button>
            </header>

          {/* Quick Prompts Bar */}
          <div className="ai-quick-prompts">
            <span className="prompts-heading">Suggested Inquiries:</span>
            <div className="prompts-scroll">
              {(rolePrompts[role] || []).map((prompt, idx) => (
                <button
                  key={idx}
                  className="quick-prompt-pill"
                  onClick={() => handleSend(prompt)}
                  disabled={loading}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>

          {/* Messages Stream */}
          <div className="ai-messages-container">
            {messages.map((msg, index) => (
              <div key={index} className={`ai-message-row ${msg.sender}`}>
                <div className="ai-message-bubble">
                  {msg.sender === 'ai' && <div className="ai-avatar">Gov AI</div>}
                  <div className="ai-message-content">
                    <p style={{ whiteSpace: 'pre-line' }}>{msg.text}</p>
                    {msg.quick_actions && msg.quick_actions.length > 0 && (
                      <div className="ai-actions-row">
                        {msg.quick_actions.map((act, aIdx) => (
                          <button
                            key={aIdx}
                            className="ai-action-btn"
                            onClick={() => {
                              setIsOpen(false);
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
                  <div className="ai-avatar">Gov AI</div>
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
              placeholder={`Ask ${roleTitles[role]}...`}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading}
            />
            <button type="submit" className="primary" disabled={loading || !input.trim()}>
              Send
            </button>
          </form>
        </aside>
      </>
    )}
  </>
);
}
