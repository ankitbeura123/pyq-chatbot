import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  Home,
  MessageSquare,
  Compass,
  Sparkles,
  FileText,
  TrendingUp,
  FolderArchive,
  Menu,
  X,
  ChevronRight
} from 'lucide-react';

export default function MobileNavBar() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const location = useLocation();

  const isMoreActive =
    location.pathname.startsWith('/browse') ||
    location.pathname === '/predict' ||
    location.pathname === '/notes';

  const closeSheet = () => setSheetOpen(false);

  return (
    <>
      {/* Slide-up "More" Bottom Sheet Modal (Only rendered when sheetOpen is true) */}
      {sheetOpen && (
        <>
          <div
            className="mobile-sheet-backdrop"
            onClick={closeSheet}
            aria-hidden="true"
          />

          <div className="mobile-more-sheet open">
            <div className="mobile-sheet-handle-bar">
              <div className="mobile-sheet-pill" />
            </div>
            
            <div className="mobile-sheet-header">
              <div className="mobile-sheet-title">Explore All Features</div>
              <button
                className="mobile-sheet-close-btn"
                onClick={closeSheet}
                aria-label="Close menu"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mobile-sheet-grid">
              <NavLink
                to="/predict"
                className={({ isActive }) => `mobile-sheet-item ${isActive ? 'active' : ''}`}
                onClick={closeSheet}
              >
                <div className="mobile-sheet-icon-box blue">
                  <TrendingUp size={20} />
                </div>
                <div className="mobile-sheet-item-text">
                  <div className="mobile-sheet-item-title">Score Predictor</div>
                  <div className="mobile-sheet-item-desc">Analyze your target marks & exam trends</div>
                </div>
                <ChevronRight size={16} className="mobile-sheet-chevron" />
              </NavLink>

              <NavLink
                to="/browse"
                className={({ isActive }) => `mobile-sheet-item ${isActive ? 'active' : ''}`}
                onClick={closeSheet}
              >
                <div className="mobile-sheet-icon-box purple">
                  <FolderArchive size={20} />
                </div>
                <div className="mobile-sheet-item-text">
                  <div className="mobile-sheet-item-title">Browse PYQ Archive</div>
                  <div className="mobile-sheet-item-desc">View original question papers by semester</div>
                </div>
                <ChevronRight size={16} className="mobile-sheet-chevron" />
              </NavLink>

              <NavLink
                to="/mock"
                className={({ isActive }) => `mobile-sheet-item ${isActive ? 'active' : ''}`}
                onClick={closeSheet}
              >
                <div className="mobile-sheet-icon-box green">
                  <FileText size={20} />
                </div>
                <div className="mobile-sheet-item-text">
                  <div className="mobile-sheet-item-title">Mock Papers & Notes</div>
                  <div className="mobile-sheet-item-desc">Generate official formatted test papers</div>
                </div>
                <ChevronRight size={16} className="mobile-sheet-chevron" />
              </NavLink>
            </div>
          </div>
        </>
      )}

      {/* Persistent Mobile Bottom Navigation Bar */}
      <nav className="mobile-bottom-nav" aria-label="Mobile Navigation">
        <NavLink
          to="/"
          end
          className={({ isActive }) => `mobile-nav-tab ${isActive ? 'active' : ''}`}
        >
          <div className="mobile-nav-icon-wrap">
            <Home size={19} />
          </div>
          <span className="mobile-nav-label">Home</span>
        </NavLink>

        <NavLink
          to="/chat"
          className={({ isActive }) => `mobile-nav-tab ${isActive ? 'active' : ''}`}
        >
          <div className="mobile-nav-icon-wrap">
            <MessageSquare size={19} />
          </div>
          <span className="mobile-nav-label">Chat</span>
        </NavLink>

        <NavLink
          to="/discover"
          className={({ isActive }) => `mobile-nav-tab ${isActive ? 'active' : ''}`}
        >
          <div className="mobile-nav-icon-wrap">
            <Compass size={19} />
          </div>
          <span className="mobile-nav-label">Discover</span>
        </NavLink>

        <NavLink
          to="/quiz"
          className={({ isActive }) => `mobile-nav-tab ${isActive ? 'active' : ''}`}
        >
          <div className="mobile-nav-icon-wrap">
            <Sparkles size={19} />
          </div>
          <span className="mobile-nav-label">Quiz</span>
        </NavLink>

        <NavLink
          to="/mock"
          className={({ isActive }) => `mobile-nav-tab ${isActive ? 'active' : ''}`}
        >
          <div className="mobile-nav-icon-wrap">
            <FileText size={19} />
          </div>
          <span className="mobile-nav-label">Mock</span>
        </NavLink>

        <button
          type="button"
          className={`mobile-nav-tab more-btn ${isMoreActive || sheetOpen ? 'active' : ''}`}
          onClick={() => setSheetOpen(!sheetOpen)}
          aria-label="More tools menu"
        >
          <div className="mobile-nav-icon-wrap">
            <Menu size={19} />
          </div>
          <span className="mobile-nav-label">More</span>
        </button>
      </nav>
    </>
  );
}
