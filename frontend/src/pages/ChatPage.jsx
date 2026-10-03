import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { marked } from 'marked';
import {
  Plus,
  Trash2,
  Send,
  ArrowUp,
  PanelLeftClose,
  PanelLeft,
  Copy,
  Check,
  RotateCw,
  ThumbsUp,
  ThumbsDown,
  Sparkles,
  BookOpen,
  FileText,
  Compass,
  TrendingUp,
  ChevronDown,
  X,
  Bot,
  User,
  Sliders
} from 'lucide-react';
import { OrchidLogo } from '../components/TopBar';
import CustomSelect from '../components/CustomSelect';

const SESSIONS_STORAGE_KEY = 'orchids_chat_sessions_v2';

export default function ChatPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [subjectsBySemester, setSubjectsBySemester] = useState({});
  const [selectedSemester, setSelectedSemester] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(() => typeof window !== 'undefined' && window.innerWidth > 768);

  // Chat sessions
  const [sessions, setSessions] = useState(() => {
    try {
      const saved = localStorage.getItem(SESSIONS_STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Failed to load chat sessions:', e);
    }
    return [
      {
        id: 'default',
        title: 'New conversation',
        messages: [],
        createdAt: Date.now()
      }
    ];
  });

  const [activeSessionId, setActiveSessionId] = useState(() => {
    return sessions[0]?.id || 'default';
  });

  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState(null);

  const chatBoxRef = useRef(null);
  const textareaRef = useRef(null);
  const initialTriggeredRef = useRef(false);

  // Active session
  const currentSession = sessions.find(s => s.id === activeSessionId) || sessions[0];
  const messages = currentSession?.messages || [];

  // Save sessions to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(sessions));
    } catch (e) {
      console.error('Failed to persist sessions:', e);
    }
  }, [sessions]);

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

  // Handle URL query parameters (e.g. ?subject=OS&prompt=...)
  useEffect(() => {
    if (initialTriggeredRef.current || Object.keys(subjectsBySemester).length === 0) return;

    const subjectParam = searchParams.get('subject');
    const promptParam = searchParams.get('prompt');

    if (subjectParam) {
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

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (chatBoxRef.current) {
      chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const availableSubjects = selectedSemester
    ? subjectsBySemester[selectedSemester] || []
    : Object.values(subjectsBySemester).flat();

  const handleSemesterChange = (val) => {
    const sem = typeof val === 'object' && val?.target ? val.target.value : val;
    setSelectedSemester(sem);
    setSelectedSubject('');
  };

  const handleCreateNewChat = () => {
    const newId = 'session_' + Date.now();
    const newSession = {
      id: newId,
      title: 'New conversation',
      messages: [],
      createdAt: Date.now()
    };
    setSessions(prev => [newSession, ...prev]);
    setActiveSessionId(newId);
    setInputMessage('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleDeleteSession = (e, idToDelete) => {
    e.stopPropagation();
    setSessions(prev => {
      const filtered = prev.filter(s => s.id !== idToDelete);
      if (filtered.length === 0) {
        const fallback = {
          id: 'session_' + Date.now(),
          title: 'New conversation',
          messages: [],
          createdAt: Date.now()
        };
        setActiveSessionId(fallback.id);
        return [fallback];
      }
      if (activeSessionId === idToDelete) {
        setActiveSessionId(filtered[0].id);
      }
      return filtered;
    });
  };

  const handleClearCurrentChat = () => {
    setSessions(prev =>
      prev.map(s => (s.id === activeSessionId ? { ...s, messages: [], title: 'New conversation' } : s))
    );
  };

  const adjustTextareaHeight = () => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
    }
  };

  const updateActiveSessionMessages = (newMessages, updatedTitle) => {
    setSessions(prev =>
      prev.map(s => {
        if (s.id === activeSessionId) {
          return {
            ...s,
            messages: newMessages,
            title: updatedTitle || s.title
          };
        }
        return s;
      })
    );
  };

  const sendChatMessage = async (msgText, subjOverride) => {
    const text = (msgText !== undefined ? msgText : inputMessage).trim();
    if (!text || isLoading) return;

    const currentSubj = subjOverride !== undefined ? subjOverride : selectedSubject;

    // Generate smart title for session if it's the first message
    let sessionTitle = currentSession.title;
    if (messages.length === 0 || sessionTitle === 'New conversation') {
      sessionTitle = text.length > 30 ? text.slice(0, 30) + '…' : text;
    }

    const userMsg = { role: 'user', content: text, isMarkdown: false, timestamp: Date.now() };
    const updatedMessages = [...messages, userMsg];
    updateActiveSessionMessages(updatedMessages, sessionTitle);

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
        updateActiveSessionMessages(
          [
            ...updatedMessages,
            {
              role: 'assistant',
              content: marked.parse(data.response),
              rawContent: data.response,
              isMarkdown: true,
              timestamp: Date.now()
            }
          ],
          sessionTitle
        );
      } else {
        updateActiveSessionMessages(
          [
            ...updatedMessages,
            {
              role: 'assistant',
              content: data.error || 'Unknown error occurred.',
              rawContent: data.error || '',
              isMarkdown: false,
              timestamp: Date.now()
            }
          ],
          sessionTitle
        );
      }
    } catch (err) {
      updateActiveSessionMessages(
        [
          ...updatedMessages,
          {
            role: 'assistant',
            content: `Connection lost: ${err.message}`,
            rawContent: err.message,
            isMarkdown: false,
            timestamp: Date.now()
          }
        ],
        sessionTitle
      );
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

  const copyToClipboard = (text, idx) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleRegenerate = (idx) => {
    if (idx > 0 && messages[idx - 1]?.role === 'user') {
      const prevUserText = messages[idx - 1].content;
      sendChatMessage(prevUserText);
    }
  };

  const promptSuggestions = [
    {
      title: 'Exam Pattern Analysis',
      sub: 'Identify high-yield repeated questions in Operating Systems',
      prompt: 'Identify the top recurring questions and high-weightage topics in Operating Systems past papers.'
    },
    {
      title: 'Step-by-step Solution',
      sub: 'Explain Dynamic Programming with previous year question examples',
      prompt: 'Explain Dynamic Programming approach for 0/1 Knapsack with a worked example from previous year papers.'
    },
    {
      title: 'Predicted Weightage',
      sub: 'Which units carry highest marks in Data Communications?',
      prompt: 'Which syllabus units and modules historically carry the highest weightage in Data Communication & Networking?'
    },
    {
      title: 'Quick Revision Sheet',
      sub: 'Summarize key formulas and complexity for Sorting Algorithms',
      prompt: 'Generate a quick revision cheatsheet of time & space complexities for all major sorting algorithms with exam tips.'
    }
  ];

  return (
    <div className={`chatgpt-layout ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
      {/* Mobile Backdrop for Sidebar Drawer */}
      <div
        className={`chat-sidebar-backdrop ${sidebarOpen ? 'visible' : ''}`}
        onClick={() => setSidebarOpen(false)}
        aria-hidden="true"
      />

      {/* Left Sidebar */}
      <aside className={`chatgpt-sidebar ${sidebarOpen ? '' : 'collapsed'}`}>
        <div className="sidebar-header">
          <button className="new-chat-btn" onClick={handleCreateNewChat}>
            <Plus size={15} strokeWidth={2.4} />
            <span>New chat</span>
          </button>
          <button
            className="sidebar-icon-btn"
            onClick={() => setSidebarOpen(false)}
            title="Close sidebar"
          >
            <PanelLeftClose size={17} />
          </button>
        </div>

        <div className="sidebar-scroll-area">
          <div className="sidebar-section-title">Recent Chats</div>
          <div className="chat-history-list">
            {sessions.map(s => (
              <button
                key={s.id}
                className={`chat-history-item ${s.id === activeSessionId ? 'active' : ''}`}
                onClick={() => {
                  setActiveSessionId(s.id);
                  if (window.innerWidth <= 768) setSidebarOpen(false);
                }}
              >
                <span className="chat-history-title">{s.title || 'New conversation'}</span>
                {sessions.length > 1 && (
                  <button
                    className="chat-item-delete"
                    onClick={(e) => handleDeleteSession(e, s.id)}
                    title="Delete conversation"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </button>
            ))}
          </div>

          <div className="sidebar-nav-links">
            <div className="sidebar-section-title">Explore Tools</div>
            <Link to="/browse" className="sidebar-nav-link" onClick={() => window.innerWidth <= 768 && setSidebarOpen(false)}>
              <FileText size={15} />
              <span>Browse PYQ Archive</span>
            </Link>
            <Link to="/discover" className="sidebar-nav-link" onClick={() => window.innerWidth <= 768 && setSidebarOpen(false)}>
              <Compass size={15} />
              <span>Knowledge Discovery</span>
            </Link>
            <Link to="/predict" className="sidebar-nav-link" onClick={() => window.innerWidth <= 768 && setSidebarOpen(false)}>
              <TrendingUp size={15} />
              <span>Score Predictor</span>
            </Link>
            <Link to="/quiz" className="sidebar-nav-link" onClick={() => window.innerWidth <= 768 && setSidebarOpen(false)}>
              <Sparkles size={15} />
              <span>AI Quiz Generator</span>
            </Link>
            <Link to="/mock" className="sidebar-nav-link" onClick={() => window.innerWidth <= 768 && setSidebarOpen(false)}>
              <BookOpen size={15} />
              <span>Mock & Notes</span>
            </Link>
          </div>
        </div>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="user-avatar-circle">O</div>
            <div>
              <div className="user-meta-name">Orchids User</div>
              <div className="user-meta-plan">Free Academic Tier</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className="chatgpt-main">
        {/* Top Header */}
        <div className="chatgpt-top-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <button
              className="sidebar-icon-btn"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              title={sidebarOpen ? "Close history" : "Open history"}
              aria-label="Toggle chat history"
            >
              <PanelLeft size={18} />
            </button>

            <div className="model-badge-selector">
              <span className="model-badge-dot" />
              <span>Orchids 4.0 Pro</span>
            </div>
          </div>

          <div className="chat-filter-selectors">
            <CustomSelect
              size="sm"
              value={selectedSemester}
              onChange={handleSemesterChange}
              placeholder="Semester"
              options={[
                { value: "", label: "All Semesters" },
                ...Object.keys(subjectsBySemester).map(sem => ({ value: sem, label: sem }))
              ]}
              style={{ minWidth: 105 }}
            />

            <CustomSelect
              size="sm"
              value={selectedSubject}
              onChange={(val) => setSelectedSubject(val)}
              disabled={!selectedSemester}
              placeholder={selectedSemester ? `Subject` : 'All Subjects'}
              options={[
                { value: "", label: selectedSemester ? `All in ${selectedSemester}` : 'All Subjects' },
                ...availableSubjects.map(s => ({ value: s.name, label: s.name }))
              ]}
              style={{ minWidth: 115 }}
            />

            {messages.length > 0 && (
              <button
                className="action-icon-btn"
                onClick={handleClearCurrentChat}
                title="Clear current conversation"
                style={{ marginLeft: 2 }}
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Message Stream */}
        <div className="chatgpt-messages-container" ref={chatBoxRef}>
          {messages.length === 0 && !isLoading ? (
            <div className="chatgpt-welcome-screen">
              <div className="welcome-orchid-emblem">
                <OrchidLogo size={28} />
              </div>
              <h2 className="welcome-title">What would you like to master today?</h2>
              <p className="welcome-subtitle">
                Ask questions across your past university papers, generate study solutions, or analyze exam patterns with Orchids AI.
              </p>

              <div className="welcome-prompts-grid">
                {promptSuggestions.map((item, idx) => (
                  <div
                    key={idx}
                    className="prompt-suggestion-card"
                    onClick={() => sendChatMessage(item.prompt)}
                  >
                    <div className="prompt-card-title">{item.title}</div>
                    <div className="prompt-card-sub">{item.sub}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="chatgpt-stream">
              {messages.map((m, idx) => {
                const isUser = m.role === 'user';
                return (
                  <div
                    key={idx}
                    className={`chat-row ${isUser ? 'user-row' : 'assistant-row'}`}
                  >
                    {!isUser && (
                      <div className="chat-avatar orchid-avatar" title="Orchids Assistant">
                        <OrchidLogo size={16} />
                      </div>
                    )}

                    <div className="chat-bubble-wrap">
                      {isUser ? (
                        <div className="chat-bubble">{m.content}</div>
                      ) : (
                        <>
                          <div
                            className="chat-bubble markdown-body"
                            dangerouslySetInnerHTML={{ __html: m.content }}
                          />
                          <div className="assistant-actions">
                            <button
                              className="action-icon-btn"
                              onClick={() => copyToClipboard(m.rawContent || m.content, idx)}
                              title="Copy response"
                            >
                              {copiedIndex === idx ? (
                                <>
                                  <Check size={13} strokeWidth={2.4} />
                                  <span>Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy size={13} />
                                  <span>Copy</span>
                                </>
                              )}
                            </button>
                            <button
                              className="action-icon-btn"
                              onClick={() => handleRegenerate(idx)}
                              title="Regenerate response"
                            >
                              <RotateCw size={13} />
                              <span>Retry</span>
                            </button>
                            <button className="action-icon-btn" title="Good response">
                              <ThumbsUp size={13} />
                            </button>
                            <button className="action-icon-btn" title="Bad response">
                              <ThumbsDown size={13} />
                            </button>
                          </div>
                        </>
                      )}
                    </div>

                    {isUser && (
                      <div className="chat-avatar user-avatar" title="You">
                        <div className="user-avatar-circle" style={{ width: 28, height: 28, fontSize: 11 }}>
                          U
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {isLoading && (
                <div className="chat-row assistant-row">
                  <div className="chat-avatar orchid-avatar">
                    <OrchidLogo size={16} />
                  </div>
                  <div className="chat-bubble" style={{ background: '#ffffff', padding: '14px 18px', border: '1px solid rgba(15, 23, 42, 0.06)' }}>
                    <div className="loading-pulse-dots">
                      <span className="loading-dot" />
                      <span className="loading-dot" />
                      <span className="loading-dot" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Floating Composer */}
        <div className="chatgpt-composer-fixed-wrap">
          <div className="chatgpt-composer-box">
            {selectedSubject && (
              <div className="composer-subject-pill">
                <span>Subject: {selectedSubject}</span>
                <X
                  size={12}
                  style={{ cursor: 'pointer' }}
                  onClick={() => setSelectedSubject('')}
                />
              </div>
            )}

            <div className="composer-input-row">
              <textarea
                ref={textareaRef}
                className="composer-textarea"
                rows={1}
                value={inputMessage}
                placeholder={
                  selectedSubject
                    ? `Ask Orchids about ${selectedSubject}…`
                    : 'Message Orchids…'
                }
                onChange={(e) => {
                  setInputMessage(e.target.value);
                  adjustTextareaHeight();
                }}
                onKeyDown={handleKeyDown}
              />
              <button
                className="composer-send-btn"
                onClick={() => sendChatMessage()}
                disabled={isLoading || !inputMessage.trim()}
                title="Send message"
              >
                <ArrowUp size={16} strokeWidth={2.4} />
              </button>
            </div>
          </div>

          <div className="chatgpt-disclaimer">
            Orchids may produce inaccurate information about subjects or exams. Verify with official syllabus.
          </div>
        </div>
      </main>
    </div>
  );
}
