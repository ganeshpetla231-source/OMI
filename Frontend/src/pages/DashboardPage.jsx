import { lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/LanguageContext';
import { useDashboard } from '../hooks/useDashboard';
import {
  RecentActivityList,
  RecommendationCard,
  QuickActions,
  SkillsOverview,
  StatsOverview,
  WelcomeHeader,
} from '../components/dashboard/DashboardComponents';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { ROUTES } from '../config/routes';
import { Skeleton } from '../components/ui/Skeleton';

const ReportProgressChart = lazy(() => import('../components/reports/ReportProgressChart')
  .then((module) => ({ default: module.ReportProgressChart })));

export default function DashboardPage() {
  const { t } = useTranslation();
  const { user, isGuest } = useAuth();
  const navigate = useNavigate();
  const dashboard = useDashboard();
  const hasInterviews = Number(dashboard.stats.data?.totalInterviews || 0) > 0;

  const startInterview = (recommendation = {}) => {
    const category = recommendation.category || 'general';
    const jobRole = recommendation.jobRole || recommendation.role || '';
    const difficulty = recommendation.difficulty || 'beginner';
    const skill = recommendation.skill || '';
    navigate(ROUTES.INTERVIEW_SETUP, {
      state: {
        category,
        jobRole,
        role: jobRole,
        difficulty,
        skill,
        skills: skill ? [skill] : [],
      },
    });
  };

  return (
    <div className="mx-auto max-w-7xl">
      <WelcomeHeader name={user?.name} />
      {!dashboard.stats.loading && !dashboard.stats.error && !hasInterviews && (
        <EmptyState
          title={t('dashboard.firstInterviewTitle')}
          description={isGuest ? t('dashboard.guestEmptyDescription') : t('dashboard.emptyDescription')}
          action={<Button onClick={() => startInterview()}>{t('dashboard.startFirstInterview')}</Button>}
        />
      )}
      <StatsOverview resource={dashboard.stats} onRetry={() => { void dashboard.retry('stats'); }} />
      <Suspense fallback={<div className="mt-6" aria-label={t('reports.progressLoading')}><Skeleton className="h-72 w-full" /></div>}>
        <div className="mt-6"><ReportProgressChart /></div>
      </Suspense>
      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <RecentActivityList resource={dashboard.activity} onRetry={() => { void dashboard.retry('activity'); }} />
        <SkillsOverview resource={dashboard.skills} onRetry={() => { void dashboard.retry('skills'); }} />
        <RecommendationCard
          resource={dashboard.recommendations}
          onRetry={() => { void dashboard.retry('recommendations'); }}
          onPractice={startInterview}
        />
      </div>
      <div className="mt-6">
        <QuickActions availableRoutes={[ROUTES.INTERVIEW_SETUP, ROUTES.QUESTION_BANK, ROUTES.NOTES, ROUTES.RESUME, ROUTES.REPORTS, ROUTES.PRACTICE]} />
      </div>
    </div>
  );
}
