import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  MessageSquare,
  Menu,
  X,
  Home,
  Compass,
  Sparkles,
  FileText,
  TrendingUp,
  FolderArchive,
  ChevronRight,
  Mail
} from 'lucide-react';

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
      {/* 6-petal orchid blossom geometric logo */}
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
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();

  const isHomeActive = location.pathname === '/' || location.pathname === '/home';
  const isChatActive = location.pathname === '/chat';
  const isBrowseActive = location.pathname.startsWith('/browse');
  const isDiscoverActive = location.pathname === '/discover';
  const isPredictActive = location.pathname === '/predict';
  const isQuizActive = location.pathname === '/quiz';
  const isMockActive = location.pathname === '/mock';

  const closeDrawer = () => setDrawerOpen(false);
  const isChatPage = location.pathname === '/chat';

  return (
    <>
      <header className={`topbar-wrap ${isChatPage ? 'topbar-chat-mode' : ''}`}>
        <div className="topbar">
          <div className="topbar-left">
            <Link to="/" className="brand" aria-label="Orchids home" onClick={closeDrawer}>
              <OrchidLogo size={20} className="orchid-flower-logo" />
              <span className="brand-text">Orchids</span>
            </Link>

            <nav aria-label="Main Navigation">
              <Link to="/" className={isHomeActive ? 'active' : ''}>
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
            </nav>
          </div>

          <div className="topbar-right">
            <a
              href="https://mail.google.com/mail/?view=cm&fs=1&to=2305113@kiit.ac.in&su=Feedback%20for%20Orchids"
              target="_blank"
              rel="noopener noreferrer"
              className="topbar-feedback-btn desktop-only"
              title="Send Feedback to 2305113@kiit.ac.in via Gmail"
            >
              <Mail size={14} />
              Feedback
            </a>

            <Link to="/chat" className="topbar-action-pill desktop-only">
              <MessageSquare size={14} />
              Start Chat
            </Link>

            {/* Mobile Hamburger Drawer Button */}
            <button
              type="button"
              className="topbar-hamburger-btn mobile-only"
              onClick={() => setDrawerOpen(!drawerOpen)}
              aria-label={drawerOpen ? 'Close Menu' : 'Open Menu'}
            >
              {drawerOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </header>

      {/* Slide-out Mobile Navigation Drawer (Only rendered when open on mobile) */}
      {drawerOpen && (
        <>
          <div
            className="mobile-drawer-backdrop"
            onClick={closeDrawer}
            aria-hidden="true"
          />

          <aside className="mobile-nav-drawer open">
            <div className="mobile-drawer-header">
              <div className="brand">
                <OrchidLogo size={22} className="orchid-flower-logo" />
                <span className="brand-text">Orchids AI</span>
              </div>
              <button
                className="mobile-drawer-close"
                onClick={closeDrawer}
                aria-label="Close drawer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="mobile-drawer-body">
              <div className="mobile-drawer-section-title">Navigation</div>
              
              <div className="mobile-drawer-links">
                <Link
                  to="/"
                  className={`mobile-drawer-link ${isHomeActive ? 'active' : ''}`}
                  onClick={closeDrawer}
                >
                  <div className="drawer-link-icon-wrap home">
                    <Home size={18} />
                  </div>
                  <span>Home Landing</span>
                  <ChevronRight size={16} className="drawer-chevron" />
                </Link>

                <Link
                  to="/chat"
                  className={`mobile-drawer-link ${isChatActive ? 'active' : ''}`}
                  onClick={closeDrawer}
                >
                  <div className="drawer-link-icon-wrap chat">
                    <MessageSquare size={18} />
                  </div>
                  <span>AI Chat Assistant</span>
                  <ChevronRight size={16} className="drawer-chevron" />
                </Link>

                <Link
                  to="/discover"
                  className={`mobile-drawer-link ${isDiscoverActive ? 'active' : ''}`}
                  onClick={closeDrawer}
                >
                  <div className="drawer-link-icon-wrap discover">
                    <Compass size={18} />
                  </div>
                  <span>Knowledge Discovery</span>
                  <ChevronRight size={16} className="drawer-chevron" />
                </Link>

                <Link
                  to="/predict"
                  className={`mobile-drawer-link ${isPredictActive ? 'active' : ''}`}
                  onClick={closeDrawer}
                >
                  <div className="drawer-link-icon-wrap predict">
                    <TrendingUp size={18} />
                  </div>
                  <span>Score Predictor</span>
                  <ChevronRight size={16} className="drawer-chevron" />
                </Link>

                <Link
                  to="/quiz"
                  className={`mobile-drawer-link ${isQuizActive ? 'active' : ''}`}
                  onClick={closeDrawer}
                >
                  <div className="drawer-link-icon-wrap quiz">
                    <Sparkles size={18} />
                  </div>
                  <span>Quiz Generator</span>
                  <ChevronRight size={16} className="drawer-chevron" />
                </Link>

                <Link
                  to="/mock"
                  className={`mobile-drawer-link ${isMockActive ? 'active' : ''}`}
                  onClick={closeDrawer}
                >
                  <div className="drawer-link-icon-wrap mock">
                    <FileText size={18} />
                  </div>
                  <span>Mock Exam & Notes</span>
                  <ChevronRight size={16} className="drawer-chevron" />
                </Link>

                <Link
                  to="/browse"
                  className={`mobile-drawer-link ${isBrowseActive ? 'active' : ''}`}
                  onClick={closeDrawer}
                >
                  <div className="drawer-link-icon-wrap browse">
                    <FolderArchive size={18} />
                  </div>
                  <span>Browse PYQ Archive</span>
                  <ChevronRight size={16} className="drawer-chevron" />
                </Link>

                <a
                  href="https://mail.google.com/mail/?view=cm&fs=1&to=2305113@kiit.ac.in&su=Feedback%20for%20Orchids"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mobile-drawer-link"
                  onClick={closeDrawer}
                  title="Send Feedback to 2305113@kiit.ac.in via Gmail"
                >
                  <div className="drawer-link-icon-wrap feedback">
                    <Mail size={18} />
                  </div>
                  <span>Feedback</span>
                  <ChevronRight size={16} className="drawer-chevron" />
                </a>
              </div>
            </div>

            <div className="mobile-drawer-footer">
              <Link
                to="/chat"
                className="mobile-drawer-cta"
                onClick={closeDrawer}
              >
                <MessageSquare size={16} />
                Start Chatting with AI
              </Link>
              <div className="mobile-drawer-subtext">
                Orchids Exam Preparation System • KIIT University
              </div>
            </div>
          </aside>
        </>
      )}
    </>
  );
}