import React from 'react';
import { Link, useLocation } from 'react-router-dom';

export default function TopBar() {
  const location = useLocation();

  const isBrowseActive = location.pathname.startsWith('/browse');
  const isChatActive = location.pathname === '/';
  const isDiscoverActive = location.pathname === '/discover';
  const isPredictActive = location.pathname === '/predict';
  const isQuizActive = location.pathname === '/quiz';

  return (
    <div className="topbar-wrap">
      <div className="topbar">
        <Link to="/" className="brand">
          <svg className="orbit-mark" viewBox="0 0 44 44" fill="none">
            <circle cx="22" cy="22" r="3" fill="#E4B667" />
            <ellipse
              cx="22"
              cy="22"
              rx="20"
              ry="8"
              stroke="rgba(226,231,245,0.35)"
              strokeWidth="0.8"
              transform="rotate(-20 22 22)"
            />
            <ellipse
              cx="22"
              cy="22"
              rx="20"
              ry="8"
              stroke="rgba(156,140,240,0.35)"
              strokeWidth="0.8"
              transform="rotate(35 22 22)"
            />
            <circle cx="37" cy="16" r="1.6" fill="#6FD3D9" />
          </svg>
          <span className="brand-text">
            Observatory <span>PYQ</span>
          </span>
        </Link>
        <nav>
          <Link to="/" className={isChatActive ? 'active' : ''}>
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
        </nav>
      </div>
    </div>
  );
}