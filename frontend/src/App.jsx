import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import OrchidsBackground from './components/OrchidsBackground';
import TopBar from './components/TopBar';
import LandingShowcase from './components/LandingShowcase';
import ChatPage from './pages/ChatPage';
import BrowseSubjectsPage from './pages/BrowseSubjectsPage';
import BrowseDocumentsPage from './pages/BrowseDocumentsPage';
import ViewDocumentPage from './pages/ViewDocumentPage';
import KnowledgeDiscoveryPage from './pages/KnowledgeDiscoveryPage';
import ScorePredictorPage from './pages/ScorePredictorPage';
import QuizPage from './pages/QuizPage';
import RevisionNotesPage from './pages/RevisionNotesPage';
import './quiz.css';
import './notes.css';

export default function App() {
  return (
    <>
      <OrchidsBackground />
      <TopBar />
      <Routes>
        {/* Full-width ChatGPT style Chat Page */}
        <Route path="/" element={<ChatPage />} />
        
        {/* Exact Landing Showcase from Reference Image */}
        <Route path="/use-cases" element={<LandingShowcase />} />

        {/* Sub-pages wrapped in standard page container */}
        <Route
          path="/browse"
          element={
            <div className="page">
              <BrowseSubjectsPage />
            </div>
          }
        />
        <Route
          path="/browse/subject/:subjectId"
          element={
            <div className="page">
              <BrowseDocumentsPage />
            </div>
          }
        />
        <Route
          path="/browse/document/:docId"
          element={
            <div className="page">
              <ViewDocumentPage />
            </div>
          }
        />
        <Route
          path="/discover"
          element={
            <div className="page">
              <KnowledgeDiscoveryPage />
            </div>
          }
        />
        <Route
          path="/predict"
          element={
            <div className="page">
              <ScorePredictorPage />
            </div>
          }
        />
        <Route
          path="/quiz"
          element={
            <div className="page">
              <QuizPage />
            </div>
          }
        />
        <Route
          path="/notes"
          element={
            <div className="page">
              <RevisionNotesPage />
            </div>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
