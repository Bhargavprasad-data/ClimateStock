import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { BrainCircuit, X, Send, Sparkles } from 'lucide-react';
import './ChatBot.css';

const SUGGESTIONS = [
  'What does a heatwave mean for energy stocks?',
  'Explain how the Dual-Model engine works.',
  'How do you calculate the Safe Range?',
  'Identify signs of a Volatility Spike.',
  'Explain the current temperature risk level.',
  'Which company is most climate-sensitive?',
  'How does the XGBoost model work here?',
];

const WELCOME_MSG = {
  role: 'ai',
  content:
    "Hi! I'm **ClimateIQ** 🌡️📈 - How can I help u??",
};

// Simple markdown-like renderer for bold text
const renderContent = (text) => {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return <span key={i}>{part}</span>;
  });
};

const ChatBot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [messages, setMessages] = useState([WELCOME_MSG]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showBadge, setShowBadge] = useState(true);
  const [isBackendReady, setIsBackendReady] = useState(false);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Ping backend to check readiness for shimmer skeleton
  useEffect(() => {
    const checkBackend = async () => {
      try {
        await axios.get('http://localhost:5000/api/climate-summary');
        setIsBackendReady(true);
      } catch (err) {
        setIsBackendReady(false);
      }
    };
    checkBackend();
    const ping = setInterval(checkBackend, 4000);
    return () => clearInterval(ping);
  }, []);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen) {
      setShowBadge(false);
      setTimeout(() => inputRef.current?.focus(), 350);
    }
  }, [isOpen]);

  const openPanel = () => {
    setClosing(false);
    setIsOpen(true);
  };

  const closePanel = () => {
    setClosing(true);
    setTimeout(() => setIsOpen(false), 240);
  };

  const sendMessage = async (text) => {
    const userMsg = text || input.trim();
    if (!userMsg || loading) return;

    setInput('');
    setError(null);

    const updatedMessages = [...messages, { role: 'user', content: userMsg }];
    setMessages(updatedMessages);
    setLoading(true);

    // Build history for context (exclude welcome msg, convert to API format)
    const history = updatedMessages
      .slice(1, -1) // exclude welcome and the just-added user msg
      .map((m) => ({ role: m.role, content: m.content }));

    try {
      const res = await axios.post('http://localhost:5000/api/chat', {
        message: userMsg,
        history,
      });
      setMessages((prev) => [
        ...prev,
        { role: 'ai', content: res.data.reply },
      ]);
    } catch (err) {
      const errMsg = err.response?.data?.details || err.response?.data?.error || 'Could not connect to AI service.';
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      {/* ── Floating Action Button ─────────────────────────── */}
      <button
        className="chat-fab"
        onClick={isOpen ? closePanel : openPanel}
        aria-label="Open ClimateIQ chat"
        id="chat-fab-btn"
      >
        {isOpen ? <X size={24} /> : <BrainCircuit size={24} />}
        {!isOpen && showBadge && (
          <span className="chat-fab-badge">1</span>
        )}
      </button>

      {/* ── Chat Panel ────────────────────────────────────── */}
      {isOpen && (
        <div className={`chat-panel ${closing ? 'closing' : ''}`} id="chat-panel">
          {/* Header */}
          <div className="chat-header">
            <div className="chat-header-avatar">
              <Sparkles size={18} />
            </div>
            <div className="chat-header-info">
              <div className="chat-header-name">ClimateIQ</div>
              <div className="chat-header-status">
                <span className="status-dot" />
                Live • Connected to app data
              </div>
            </div>
            <button className="chat-close-btn" onClick={closePanel} aria-label="Close chat">
              <X size={18} />
            </button>
          </div>

          {/* Messages */}
          <div className="chat-messages" id="chat-messages">
            {!isBackendReady ? (
              <div style={{ padding: '8px 4px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <style>{`
                  @keyframes shimmer {
                    0%   { background-position: -600px 0; }
                    100% { background-position:  600px 0; }
                  }
                  .chat-sk {
                    background: linear-gradient(90deg,
                      rgba(130, 130, 130, 0.1) 25%,
                      rgba(130, 130, 130, 0.25) 50%,
                      rgba(130, 130, 130, 0.1) 75%
                    );
                    background-size: 600px 100%;
                    animation: shimmer 1.6s infinite linear;
                    border-radius: 8px;
                  }
                `}</style>
                {/* AI skeleton bubble 1 */}
                <div style={{ display: 'flex', gap: '10px' }}>
                  <div className="chat-sk" style={{ width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0 }} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, marginTop: '4px' }}>
                    <div className="chat-sk" style={{ width: '85%', height: '12px' }} />
                    <div className="chat-sk" style={{ width: '65%', height: '12px' }} />
                  </div>
                </div>
                {/* User skeleton bubble */}
                <div style={{ display: 'flex', gap: '10px', alignSelf: 'flex-end', flexDirection: 'row-reverse' }}>
                  <div className="chat-sk" style={{ width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0 }} />
                  <div className="chat-sk" style={{ width: '130px', height: '36px', borderRadius: '14px 14px 0 14px', marginTop: '4px' }} />
                </div>
                {/* AI skeleton bubble 2 */}
                <div style={{ display: 'flex', gap: '10px' }}>
                  <div className="chat-sk" style={{ width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0 }} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, marginTop: '4px' }}>
                    <div className="chat-sk" style={{ width: '90%', height: '12px' }} />
                    <div className="chat-sk" style={{ width: '40%', height: '12px' }} />
                  </div>
                </div>
              </div>
            ) : (
              <>
                {messages.map((msg, i) => (
                  <div key={i} className={`chat-msg ${msg.role}`}>
                    <div className="chat-msg-avatar">
                      {msg.role === 'ai' ? <BrainCircuit size={14} /> : 'U'}
                    </div>
                    <div className="chat-msg-bubble">
                      {renderContent(msg.content)}
                    </div>
                  </div>
                ))}

                {/* Typing indicator */}
                {loading && (
                  <div className="chat-msg ai chat-typing">
                    <div className="chat-msg-avatar">
                      <BrainCircuit size={14} />
                    </div>
                    <div className="typing-dots">
                      <span /><span /><span />
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Suggestion chips (show only when just the welcome msg is visible and backend is ready) */}
          {isBackendReady && messages.length === 1 && !loading && (
            <div className="chat-suggestions">
              <div className="chat-suggestions-label">Try asking</div>
              {SUGGESTIONS.map((s, i) => (
                <button
                  key={i}
                  className="chat-suggestion-chip"
                  onClick={() => sendMessage(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="chat-error">⚠️ {error}</div>
          )}

          {/* Input */}
          <div className="chat-input-area">
            <textarea
              ref={inputRef}
              className="chat-input"
              placeholder="Ask about climate & stocks…"
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              id="chat-input-field"
            />
            <button
              className="chat-send-btn"
              onClick={() => sendMessage()}
              disabled={!input.trim() || loading || !isBackendReady}
              aria-label="Send message"
              id="chat-send-btn"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default ChatBot;
