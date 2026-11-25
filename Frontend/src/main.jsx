import React from 'react';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { AppRoutes } from './routes/AppRoutes';
import { ErrorBoundary } from './routes/ErrorBoundary';
import { AuthProvider } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';
import { ThemeProvider } from './context/ThemeContext';
import { OfflineProvider } from './context/OfflineContext';
import { PWAUpdatePrompt } from './components/layout/PWAUpdatePrompt';
import { ToastProvider } from './components/ui/Toast';
import './styles/index.css';

function AppRoot() {
  return (
    <AuthProvider>
      <OfflineProvider>
        <ErrorBoundary>
          <AppRoutes />
        </ErrorBoundary>
        <PWAUpdatePrompt />
      </OfflineProvider>
    </AuthProvider>
  );
}

const router = createBrowserRouter(
  [{ path: '*', element: <AppRoot /> }],
  { future: { v7_relativeSplatPath: true, v7_startTransition: true } },
);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <LanguageProvider>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </LanguageProvider>
    </ThemeProvider>
  </React.StrictMode>,
);
