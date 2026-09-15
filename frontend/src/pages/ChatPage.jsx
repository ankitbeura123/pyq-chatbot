import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { marked } from 'marked';

export default function ChatPage() {
  const [searchParams] = useSearchParams();
  const [subjectsBySemester, setSubjectsBySemester] = useState({});
  const [selectedSemester, setSelectedSemester] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const chatBoxRef = useRef(null);
  const textareaRef = useRef(null);
  const initialTriggeredRef = useRef(false);

  // Fetch subjects grouped by semester
  useEffect(() => {
    async function loadSubjects() {
      try {
        const res = await fetch('/api/subjects/');
        const data = await res.json();
        setSubjectsBySemester(data.subjects_by_semester || {});
      } catch (err) {
        console.error('Failed to load subjects:', err);
      }
    }
    loadSubjects();
  }, []);

  // Handle URL search params on load
  useEffect(() => {
    if (initialTriggeredRef.current || Object.keys(subjectsBySemester).length === 0) return;

    const subjectParam = searchParams.get('subject');
    const promptParam = searchParams.get('prompt');

    if (subjectParam) {
      // Find which semester contains this subject if possible
      for (const [sem, subs] of Object.entries(subjectsBySemester)) {
        const match = subs.find(s => s.name.toLowerCase() === subjectParam.toLowerCase());
        if (match) {
          setSelectedSemester(sem);
          setSelectedSubject(match.name);
          break;
        }
      }
    }

    if (promptParam) {
      initialTriggeredRef.current = true;
      sendChatMessage(promptParam, subjectParam || selectedSubject);
    }
  }, [subjectsBySemester, searchParams]);

  // Scroll chat to bottom
  useEffect(() => {
    if (chatBoxRef.current) {
      chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  // Filter subjects for dropdown based on selected semester
  const availableSubjects = selectedSemester
    ? subjectsBySemester[selectedSemester] || []
    : Object.values(subjectsBySemester).flat();

  const handleSemesterChange = (e) => {
    const sem = e.target.value;
    setSelectedSemester(sem);
    setSelectedSubject('');
  };

  const adjustTextareaHeight = () => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, 110)}px`;
    }
  };

  const sendChatMessage = async (msgText, subjOverride) => {
    const text = (msgText !== undefined ? msgText : inputMessage).trim();
    if (!text || isLoading) return;

    const currentSubj = subjOverride !== undefined ? subjOverride : selectedSubject;

    // Add User entry
    const userMsg = { role: 'user', content: text, isMarkdown: false };
    setMessages(prev => [...prev, userMsg]);
    setInputMessage('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    setIsLoading(true);

    try {
      const res = await fetch('/api/chat/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, subject: currentSubj || '' })
      });
      const data = await res.json();
      if (data.response) {
        setMessages(prev => [...prev, { role: 'assistant', content: marked.parse(data.response), isMarkdown: true }]);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: data.error || 'Unknown error occurred.', isMarkdown: false }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Transmission lost: ${err.message}`, isMarkdown: false }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendChatMessage();
    }
  };

  return (
    <>
      <style>{`
        .app-panel {
          max-width: 640px; margin: 0 auto;
          display: flex; flex-direction: column;
          min-height: 620px;
          box-shadow: 0 30px 80px -20px rgba(0,0,0,0.7), 0 0 90px -30px rgba(156,140,240,0.25);
          overflow: hidden;
        }

        .panel-header { padding: 18px 22px 14px; border-bottom: 1px solid var(--glass-edge); display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
        .panel-header .sub { font-size: 10px; color: var(--dim); letter-spacing: 0.04em; flex: 1; min-width: 140px; }

        .subject-select-wrap { display: flex; gap: 8px; }
        .subject-select-wrap select {
          appearance: none; background: rgba(255,255,255,0.05); border: 1px solid var(--glass-edge);
          color: var(--starlight); font-family: 'Space Mono', monospace; font-size: 10.5px;
          padding: 7px 26px 7px 12px; border-radius: 8px; cursor: pointer;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%23E7ECFA'/%3E%3C/svg%3E");
          background-repeat: no-repeat; background-position: right 10px center;
          max-width: 160px;
        }
        .subject-select-wrap select:focus { outline: none; border-color: var(--violet); }
        .subject-select-wrap select:disabled { opacity: 0.4; cursor: not-allowed; }

        #chat-box { flex: 1; overflow-y: auto; padding: 24px 24px 10px; height: 46vh; min-height: 320px; position: relative; }
        .empty-placeholder {
          font-family: 'Cormorant Garamond', serif; font-style: italic; font-size: 17px; color: var(--dim); line-height: 1.6; padding: 10px 4px;
        }

        .log-entry { position: relative; z-index: 1; display: flex; gap: 14px; margin-bottom: 24px; opacity: 0; transform: translateY(10px); animation: entryIn 0.4s cubic-bezier(0.16,1,0.3,1) forwards; }
        @keyframes entryIn { to { opacity: 1; transform: translateY(0); } }

        .star-node { flex-shrink: 0; width: 24px; display: flex; flex-direction: column; align-items: center; padding-top: 4px; }
        .star-glyph { width: 10px; height: 10px; border-radius: 50%; position: relative; }
        .star-glyph::after { content:""; position:absolute; inset:-6px; border-radius:50%; border:1px solid currentColor; opacity:0.3; animation: ripple 3s ease-out infinite; }
        @keyframes ripple { 0%{transform:scale(0.85);opacity:0.35;} 70%{transform:scale(1.5);opacity:0;} 100%{opacity:0;} }
        .log-entry.observer .star-glyph { background: var(--gold); color: var(--gold); box-shadow: 0 0 10px rgba(228,182,103,0.6); }
        .log-entry.system .star-glyph { background: var(--violet); color: var(--violet); box-shadow: 0 0 10px rgba(156,140,240,0.6); }

        .log-body { flex: 1; padding-top: 1px; min-width: 0; }
        .log-head { display: flex; align-items: baseline; gap: 10px; margin-bottom: 5px; }
        .designation { font-family: 'Cormorant Garamond', serif; font-size: 14px; font-style: italic; font-weight: 600; }
        .log-entry.observer .designation { color: var(--gold); }
        .log-entry.system .designation { color: var(--violet); }
        .log-text { font-family: 'Cormorant Garamond', serif; font-size: 17px; line-height: 1.65; color: var(--starlight); }
        .log-entry.observer .log-text { white-space: pre-wrap; }

        .log-text.markdown-body h1, .log-text.markdown-body h2, .log-text.markdown-body h3, .log-text.markdown-body h4 { font-family: 'Space Mono', monospace; font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--cyan); margin: 12px 0 6px; }
        .log-text.markdown-body p { margin: 0 0 10px; }
        .log-text.markdown-body ul, .log-text.markdown-body ol { margin: 0 0 10px; padding-left: 20px; }
        .log-text.markdown-body strong { color: var(--gold); font-weight: 600; }
        .log-text.markdown-body code { font-family: 'Space Mono', monospace; font-size: 0.8em; background: rgba(255,255,255,0.06); padding: 1px 5px; border-radius: 4px; }
        .log-text.markdown-body table { border-collapse: collapse; width: 100%; margin: 10px 0; font-size: 0.85em; }
        .log-text.markdown-body th, .log-text.markdown-body td { border: 1px solid var(--glass-edge); padding: 6px 9px; text-align: left; }
        .log-text.markdown-body hr { border: none; border-top: 1px solid var(--glass-edge); margin: 12px 0; }

        .drift-row { display: flex; align-items: center; gap: 6px; height: 18px; }
        .drift-dot { width: 4px; height: 4px; border-radius: 50%; background: var(--violet); opacity: 0.4; animation: twinkle 1.4s infinite ease-in-out; }
        .drift-dot:nth-child(2) { animation-delay: 0.2s; }
        .drift-dot:nth-child(3) { animation-delay: 0.4s; }
        @keyframes twinkle { 0%,60%,100%{opacity:0.2;transform:scale(0.8);} 30%{opacity:1;transform:scale(1.3);} }

        .composer-wrap { flex-shrink: 0; padding: 14px 20px 20px; border-top: 1px solid var(--glass-edge); }
        .composer { display: flex; align-items: flex-end; gap: 12px; background: rgba(255,255,255,0.04); border: 1px solid var(--glass-edge); border-radius: 14px; padding: 12px 15px; transition: border-color 0.25s, box-shadow 0.25s; }
        .composer:focus-within { border-color: rgba(156,140,240,0.55); box-shadow: 0 0 0 1px rgba(156,140,240,0.2), 0 0 24px rgba(156,140,240,0.15); }
        .composer textarea { flex: 1; border: none; outline: none; resize: none; background: transparent; font-family: 'Cormorant Garamond', serif; font-size: 17px; color: var(--starlight); line-height: 1.5; max-height: 110px; min-height: 22px; }
        .composer textarea::placeholder { color: var(--dim); font-style: italic; }
        .send-btn { flex-shrink: 0; width: 32px; height: 32px; border-radius: 50%; background: rgba(156,140,240,0.12); border: 1px solid var(--violet); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background 0.2s, transform 0.15s; }
        .send-btn:hover:not(:disabled) { background: rgba(156,140,240,0.25); box-shadow: 0 0 16px rgba(156,140,240,0.4); }
        .send-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .send-btn svg { width: 13px; height: 13px; stroke: var(--violet); }

        @media (prefers-reduced-motion: reduce) { .log-entry, .drift-dot, .star-glyph::after { animation: none !important; } .log-entry { opacity: 1; transform: none; } }
      `}</style>

      <div className="card app-panel">
        <div className="panel-header">
          <div className="sub">observing your PYQ archive · signal locked</div>
          <div className="subject-select-wrap">
            <select
              id="semester-select"
              value={selectedSemester}
              onChange={handleSemesterChange}
            >
              <option value="">All semesters</option>
              {Object.keys(subjectsBySemester).map(sem => (
                <option key={sem} value={sem}>{sem}</option>
              ))}
            </select>

            <select
              id="subject-select"
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
            >
              <option value="">{selectedSemester ? `All in ${selectedSemester}` : 'All subjects'}</option>
              {availableSubjects.map(s => (
                <option key={s.id || s.name} value={s.name}>{s.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div id="chat-box" ref={chatBoxRef}>
          {messages.length === 0 && !isLoading && (
            <div className="empty-placeholder">
              Point me at a topic and I'll help you fix its position among your past papers.
            </div>
          )}

          {messages.map((m, idx) => {
            const isUser = m.role === 'user';
            const cls = isUser ? 'observer' : 'system';
            const label = isUser ? 'You' : 'Observatory';

            return (
              <div key={idx} className={`log-entry ${cls}`}>
                <div className="star-node">
                  <div className="star-glyph" />
                </div>
                <div className="log-body">
                  <div className="log-head">
                    <span className="designation">{label}</span>
                  </div>
                  {m.isMarkdown ? (
                    <div
                      className="log-text markdown-body"
                      dangerouslySetInnerHTML={{ __html: m.content }}
                    />
                  ) : (
                    <div className="log-text">{m.content}</div>
                  )}
                </div>
              </div>
            );
          })}

          {isLoading && (
            <div className="log-entry system">
              <div className="star-node">
                <div className="star-glyph" />
              </div>
              <div className="log-body">
                <div className="log-head">
                  <span className="designation">Observatory</span>
                </div>
                <div className="log-text">
                  <div className="drift-row">
                    <span className="drift-dot" />
                    <span className="drift-dot" />
                    <span className="drift-dot" />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="composer-wrap">
          <div className="composer">
            <textarea
              ref={textareaRef}
              id="user-input"
              rows={1}
              value={inputMessage}
              placeholder="Chart your next question…"
              onChange={(e) => {
                setInputMessage(e.target.value);
                adjustTextareaHeight();
              }}
              onKeyDown={handleKeyDown}
            />
            <button
              className="send-btn"
              id="send-btn"
              onClick={() => sendChatMessage()}
              disabled={isLoading || !inputMessage.trim()}
              aria-label="Send message"
            >
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="19" x2="12" y2="5" />
                <polyline points="5 12 12 5 19 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
