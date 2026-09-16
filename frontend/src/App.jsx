import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import CosmicBackground from './components/CosmicBackground';
import TopBar from './components/TopBar';
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
      <CosmicBackground />
      <TopBar />
      <div className="page">
        <Routes>
          <Route path="/" element={<ChatPage />} />
          <Route path="/browse" element={<BrowseSubjectsPage />} />
          <Route path="/browse/subject/:subjectId" element={<BrowseDocumentsPage />} />
          <Route path="/browse/document/:docId" element={<ViewDocumentPage />} />
          <Route path="/discover" element={<KnowledgeDiscoveryPage />} />
          <Route path="/predict" element={<ScorePredictorPage />} />
          <Route path="/quiz" element={<QuizPage />} />
          <Route path="/notes" element={<RevisionNotesPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </>
  );
}
