import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { Route, Routes } from 'react-router-dom';
import { PublicLayout } from '../layouts/PublicLayout';
import { AppLayout } from '../layouts/AppLayout';
import { Skeleton } from '../components/ui/Skeleton';
import { ErrorState } from '../components/ui/ErrorState';
import { ROUTES } from '../config/routes';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/LanguageContext';
import { AdminRoute, GuestOrAuthRoute, PublicOnlyRoute } from './ProtectedRoute';
import { initializeQuestionCache } from '../services/offline/localQuestions';
import { Button } from '../components/ui/Button';

const HomePage = lazy(() => import('../pages/HomePage'));
const DashboardPage = lazy(() => import('../pages/DashboardPage'));
const PracticePage = lazy(() => import('../pages/PracticePage'));
const QuestionBankPage = lazy(() => import('../pages/QuestionBankPage'));
const NotesPage = lazy(() => import('../pages/NotesPage'));
const ResumePage = lazy(() => import('../pages/ResumePage'));
const InterviewSetupPage = lazy(() => import('../pages/InterviewSetupPage'));
const InterviewReadinessPage = lazy(() => import('../pages/InterviewReadinessPage'));
const InterviewPage = lazy(() => import('../pages/InterviewPage'));
const ReportHistoryPage = lazy(() => import('../pages/ReportHistoryPage'));
const ReportDetailsPage = lazy(() => import('../pages/ReportDetailsPage'));
const ReportProgressPage = lazy(() => import('../pages/ReportProgressPage'));
const ReportComparePage = lazy(() => import('../pages/ReportComparePage'));
const NotFoundPage = lazy(() => import('../pages/NotFoundPage'));
const LoginPage = lazy(() => import('../pages/LoginPage'));
const RegisterPage = lazy(() => import('../pages/RegisterPage'));
const ForbiddenPage = lazy(() => import('../pages/ForbiddenPage'));
const ProfilePage = lazy(() => import('../pages/ProfilePage'));
const SettingsPage = lazy(() => import('../pages/SettingsPage'));
const AdminDashboardPage = lazy(() => import('../pages/AdminDashboardPage'));
const AdminQuestionsPage = lazy(() => import('../pages/AdminQuestionsPage'));

function PageFallback() {
  return (
    <div className="container space-y-4 py-12" aria-label="Loading page">
      <Skeleton className="h-10 w-2/3 max-w-lg" />
      <Skeleton className="h-5 w-full max-w-xl" />
      <Skeleton className="h-5 w-4/5 max-w-lg" />
    </div>
  );
}

function HomeRoute() {
  const { isAuthenticated, isGuest } = useAuth();
  return isAuthenticated || isGuest
    ? <AppLayout><DashboardPage /></AppLayout>
    : <PublicLayout><HomePage /></PublicLayout>;
}

function QuestionBankRoute() {
  const { isAuthenticated, isGuest } = useAuth();
  return isAuthenticated || isGuest
    ? <AppLayout><QuestionBankPage /></AppLayout>
    : <PublicLayout><QuestionBankPage /></PublicLayout>;
}

function AuthBootstrap() {
  const { loading, restoreError, refreshUser } = useAuth();
  const { t } = useTranslation();
  if (loading) return <PageFallback />;
  if (restoreError) {
    return (
      <main className="container flex min-h-screen items-center justify-center py-12">
        <ErrorState
          title={t('errors.sessionRestoreTitle')}
          message={restoreError.message || t('errors.sessionRestoreMessage')}
          onRetry={() => { void refreshUser().catch(() => undefined); }}
        />
      </main>
    );
  }
  return null;
}

function QuestionCacheBootstrap() {
  const { t } = useTranslation();
  const [error, setError] = useState(null);
  const initialize = useCallback(async () => {
    try {
      await initializeQuestionCache();
      setError(null);
    } catch (initializationError) {
      setError(initializationError);
    }
  }, []);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  if (!error) return null;
  return (
    <div role="alert" className="fixed bottom-4 left-4 right-4 z-40 mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 rounded-xl border border-danger/30 bg-white p-4 text-sm shadow-lg dark:bg-slate-900">
      <p>{t('questionBank.cacheInitError')} {error.message}</p>
      <Button size="sm" onClick={() => { void initialize(); }}>{t('common.retry')}</Button>
    </div>
  );
}

export function AppRoutes() {
  const { loading, restoreError } = useAuth();
  return (
    <>
      <QuestionCacheBootstrap />
      {loading || restoreError ? <AuthBootstrap /> : (
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path={ROUTES.HOME} element={<HomeRoute />} />
            <Route path={ROUTES.DASHBOARD} element={<GuestOrAuthRoute><AppLayout><DashboardPage /></AppLayout></GuestOrAuthRoute>} />
            <Route path={ROUTES.PRACTICE} element={<GuestOrAuthRoute><AppLayout><PracticePage /></AppLayout></GuestOrAuthRoute>} />
            <Route path={ROUTES.QUESTION_BANK} element={<QuestionBankRoute />} />
            <Route path={ROUTES.NOTES} element={<GuestOrAuthRoute><AppLayout><NotesPage /></AppLayout></GuestOrAuthRoute>} />
            <Route path={ROUTES.RESUME} element={<GuestOrAuthRoute><AppLayout><ResumePage /></AppLayout></GuestOrAuthRoute>} />
            <Route path={ROUTES.INTERVIEW_SETUP} element={<GuestOrAuthRoute><AppLayout><InterviewSetupPage /></AppLayout></GuestOrAuthRoute>} />
            <Route path={ROUTES.INTERVIEW_CHECK} element={<GuestOrAuthRoute><AppLayout><InterviewReadinessPage /></AppLayout></GuestOrAuthRoute>} />
            <Route path={ROUTES.INTERVIEW} element={<GuestOrAuthRoute><AppLayout><InterviewPage /></AppLayout></GuestOrAuthRoute>} />
            <Route path={ROUTES.REPORTS} element={<GuestOrAuthRoute><AppLayout><ReportHistoryPage /></AppLayout></GuestOrAuthRoute>} />
            <Route path={ROUTES.REPORT_PROGRESS} element={<GuestOrAuthRoute><AppLayout><ReportProgressPage /></AppLayout></GuestOrAuthRoute>} />
            <Route path={ROUTES.REPORT_COMPARE} element={<GuestOrAuthRoute><AppLayout><ReportComparePage /></AppLayout></GuestOrAuthRoute>} />
            <Route path={ROUTES.REPORT_DETAIL} element={<GuestOrAuthRoute><AppLayout><ReportDetailsPage /></AppLayout></GuestOrAuthRoute>} />
            <Route path={ROUTES.PROFILE} element={<GuestOrAuthRoute><AppLayout><ProfilePage /></AppLayout></GuestOrAuthRoute>} />
            <Route path={ROUTES.SETTINGS} element={<GuestOrAuthRoute><AppLayout><SettingsPage /></AppLayout></GuestOrAuthRoute>} />
            <Route path={ROUTES.ADMIN} element={<AdminRoute><AppLayout><AdminDashboardPage /></AppLayout></AdminRoute>} />
            <Route path={ROUTES.ADMIN_QUESTIONS} element={<AdminRoute><AppLayout><AdminQuestionsPage /></AppLayout></AdminRoute>} />
            <Route path={ROUTES.LOGIN} element={<PublicOnlyRoute><LoginPage /></PublicOnlyRoute>} />
            <Route path={ROUTES.REGISTER} element={<PublicOnlyRoute><RegisterPage /></PublicOnlyRoute>} />
            <Route path={ROUTES.FORBIDDEN} element={<PublicLayout><ForbiddenPage /></PublicLayout>} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      )}
    </>
  );
}
