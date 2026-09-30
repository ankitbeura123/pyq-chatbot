import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { MessageSquare } from 'lucide-react';

export function OrchidLogo({ size = 22, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* 6-petal orchid blossom geometric logo matching screenshot */}
      <circle cx="12" cy="12" r="2.2" />
      <circle cx="12" cy="5.5" r="3.2" />
      <circle cx="17.6" cy="8.7" r="3.2" />
      <circle cx="17.6" cy="15.3" r="3.2" />
      <circle cx="12" cy="18.5" r="3.2" />
      <circle cx="6.4" cy="15.3" r="3.2" />
      <circle cx="6.4" cy="8.7" r="3.2" />
    </svg>
  );
}

export default function TopBar() {
  const location = useLocation();

  const isHomeActive = location.pathname === '/' || location.pathname === '/home';
  const isChatActive = location.pathname === '/chat';
  const isBrowseActive = location.pathname.startsWith('/browse');
  const isDiscoverActive = location.pathname === '/discover';
  const isPredictActive = location.pathname === '/predict';
  const isQuizActive = location.pathname === '/quiz';
  const isMockActive = location.pathname === '/mock';

  return (
    <header className="topbar-wrap">
      <div className="topbar">
        <div className="topbar-left">
          <Link to="/" className="brand" aria-label="Orchids home">
            <OrchidLogo size={20} className="orchid-flower-logo" />
            <span className="brand-text">Orchids</span>
          </Link>

          <nav aria-label="Main Navigation">
            <Link
              to="/"
              className={isHomeActive ? 'active' : ''}
            >
              Home
            </Link>
            <Link to="/chat" className={isChatActive ? 'active' : ''}>
              Chat
            </Link>
            <Link to="/browse" className={isBrowseActive ? 'active' : ''}>
              Browse
            </Link>
            <Link to="/discover" className={isDiscoverActive ? 'active' : ''}>
              Discover
            </Link>
            <Link to="/predict" className={isPredictActive ? 'active' : ''}>
              Predict
            </Link>
            <Link to="/quiz" className={isQuizActive ? 'active' : ''}>
              Quiz
            </Link>
            <Link to="/mock" className={isMockActive ? 'active' : ''}>
              Mock
            </Link>
            <a
              href="https://mail.google.com/mail/?view=cm&fs=1&to=2305113@kiit.ac.in&su=Feedback%20for%20Orchids%20Observatory"
              target="_blank"
              rel="noopener noreferrer"
              className="nav-feedback-link"
              title="Send Feedback to 2305113@kiit.ac.in via Gmail"
            >
              Feedback
            </a>
          </nav>
        </div>

        <div className="topbar-right">
          <Link to="/login" className="topbar-login-btn">
            Login
          </Link>
          <Link to="/chat" className="topbar-action-pill">
            <MessageSquare size={14} />
            Start Chat
          </Link>
        </div>
      </div>
    </header>
  );
}