import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import OrchidsBackground from './components/OrchidsBackground';
import TopBar from './components/TopBar';
import HomePage from './pages/HomePage';
import ChatPage from './pages/ChatPage';
import BrowseSubjectsPage from './pages/BrowseSubjectsPage';
import BrowseDocumentsPage from './pages/BrowseDocumentsPage';
import KnowledgeDiscoveryPage from './pages/KnowledgeDiscoveryPage';
import ScorePredictorPage from './pages/ScorePredictorPage';
import QuizPage from './pages/QuizPage';
import MockExamPage from './pages/MockExamPage';
import './quiz.css';
import './notes.css';
import './mock.css';

export default function App() {
  return (
    <>
      <OrchidsBackground />
      <TopBar />
      <Routes>
        {/* Home Page Landing */}
        <Route path="/" element={<HomePage />} />
        <Route path="/home" element={<HomePage />} />
        
        {/* Full-width Conversational Chat Page */}
        <Route path="/chat" element={<ChatPage />} />

        {/* Redirect old use cases */}
        <Route path="/use-cases" element={<Navigate to="/" replace />} />

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
          element={<Navigate to="/browse" replace />}
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
          path="/mock"
          element={
            <div className="page">
              <MockExamPage />
            </div>
          }
        />
        {/* Redirect old notes tab to mock */}
        <Route path="/notes" element={<Navigate to="/mock" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
