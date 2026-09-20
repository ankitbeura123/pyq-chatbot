import React from 'react';
import { Navigate } from 'react-router-dom';

export default function ViewDocumentPage() {
  return <Navigate to="/browse" replace />;
}
