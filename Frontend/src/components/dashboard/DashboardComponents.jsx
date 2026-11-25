import {
  ArrowUpRight,
  BookOpen,
  Briefcase,
  Clock3,
  FileText,
  MessageSquareText,
  Sparkles,
  Trophy,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { ROUTES } from '../../config/routes';
import { useTranslation } from '../../context/LanguageContext';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { EmptyState } from '../ui/EmptyState';
import { ErrorState } from '../ui/ErrorState';
import { ProgressBar } from '../ui/ProgressBar';
import { Skeleton } from '../ui/Skeleton';

export function WelcomeHeader({ name }) {
  const { t } = useTranslation();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'dashboard.goodMorning' : hour < 18 ? 'dashboard.goodAfternoon' : 'dashboard.goodEvening';
  return (
    <header className="mb-7">
      <p className="text-sm font-semibold text-primary">{t(greeting)}</p>
      <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950 dark:text-white">
        {t('dashboard.welcome', { name: name || t('dashboard.friend') })}
      </h1>
      <p className="mt-2 text-muted dark:text-muted-dark">{t('dashboard.motivation')}</p>
    </header>
  );
}

const statDefinitions = [
  { key: 'totalInterviews', label: 'dashboard.totalInterviews', icon: MessageSquareText },
  { key: 'averageScore', label: 'dashboard.averageScore', icon: ArrowUpRight, suffix: '%' },
  { key: 'practiceHours', label: 'dashboard.practiceHours', icon: Clock3 },
  { key: 'bestScore', label: 'dashboard.bestScore', icon: Trophy, suffix: '%' },
];

export function StatCard({ statKey, stat, loading, error, onRetry }) {
  const { t, language } = useTranslation();
  const definition = statDefinitions.find((item) => item.key === statKey);
  if (loading) {
    return (
      <Card aria-label={t('dashboard.loadingStat', { label: t(definition.label) })}>
        <Skeleton className="h-4 w-28" />
        <Skeleton className="mt-4 h-8 w-20" />
      </Card>
    );
  }
  if (error) {
    return (
      <Card>
        <ErrorState
          title={t('dashboard.statErrorTitle', { label: t(definition.label) })}
          message={error.message || t('dashboard.errorMessage')}
          retryLabel={t('common.retry')}
          onRetry={onRetry}
        />
      </Card>
    );
  }

  const Icon = definition.icon;
  const value = Number(stat.data ?? 0);
  return (
    <Card className="min-w-0">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-muted dark:text-muted-dark">{t(definition.label)}</p>
        <span className="rounded-lg bg-primary-light p-2 text-primary dark:bg-indigo-950 dark:text-indigo-200">
          <Icon aria-hidden="true" className="h-5 w-5" />
        </span>
      </div>
      <p className="mt-3 text-3xl font-bold tabular-nums text-slate-950 dark:text-white">
        {Number.isFinite(value) ? new Intl.NumberFormat(language, { maximumFractionDigits: 1 }).format(value) : '0'}
        {definition.suffix}
      </p>
      {stat.trend && <p className="mt-1 text-xs text-success">{t('dashboard.trend', { trend: stat.trend })}</p>}
    </Card>
  );
}

export function StatsOverview({ resource, onRetry }) {
  const { t } = useTranslation();
  const stats = resource.data || {};
  if (resource.error) {
    return (
      <Card className="col-span-full">
        <ErrorState
          title={t('dashboard.statsErrorTitle')}
          message={resource.error.message || t('dashboard.errorMessage')}
          retryLabel={t('common.retry')}
          onRetry={onRetry}
        />
      </Card>
    );
  }
  const valueFor = (key) => ({
    data: stats[key],
    trend: stats.trend,
  });
  return (
    <section aria-label={t('dashboard.statsSection')} className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {statDefinitions.map(({ key }) => (
        <StatCard
          key={key}
          statKey={key}
          stat={{ ...valueFor(key), trend: stats.trends?.[key] || stats[`${key}Trend`] }}
          loading={resource.loading}
          error={resource.error}
          onRetry={onRetry}
        />
      ))}
    </section>
  );
}

export function RecentActivityList({ resource, onRetry }) {
  const { t, language } = useTranslation();
  if (resource.loading) {
    return <Card aria-label={t('dashboard.loadingActivity')}><Skeleton className="h-5 w-40" /><Skeleton className="mt-5 h-12 w-full" /></Card>;
  }
  if (resource.error) {
    return <Card><ErrorState title={t('dashboard.activityErrorTitle')} message={resource.error.message || t('dashboard.errorMessage')} retryLabel={t('common.retry')} onRetry={onRetry} /></Card>;
  }
  const activities = Array.isArray(resource.data) ? resource.data : resource.data?.items || [];
  const formatDate = (value) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? t('dashboard.recently')
      : new Intl.DateTimeFormat(language, { dateStyle: 'medium' }).format(date);
  };
  return (
    <Card>
      <h2 className="text-lg font-semibold text-slate-950 dark:text-white">{t('dashboard.recentActivity')}</h2>
      {activities.length ? (
        <ul className="mt-4 divide-y divide-slate-200 dark:divide-slate-700">
          {activities.slice(0, 5).map((activity, index) => (
            <li key={activity.id || `${activity.title}-${index}`} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <p className="truncate font-medium">{activity.title || activity.jobRole || activity.category || t('dashboard.interview')}</p>
                <p className="mt-1 text-xs text-muted dark:text-muted-dark">
                  {activity.completedAt || activity.createdAt
                    ? formatDate(activity.completedAt || activity.createdAt)
                    : t('dashboard.recently')}
                </p>
              </div>
              {activity.totalScore != null && <span className="shrink-0 text-sm font-semibold text-primary">{activity.totalScore}%</span>}
            </li>
          ))}
        </ul>
      ) : <EmptyState title={t('dashboard.noActivityTitle')} description={t('dashboard.noActivityDescription')} />}
    </Card>
  );
}

export function SkillsOverview({ resource, onRetry }) {
  const { t } = useTranslation();
  if (resource.loading) {
    return <Card aria-label={t('dashboard.loadingSkills')}><Skeleton className="h-5 w-36" /><Skeleton className="mt-5 h-3 w-full" /><Skeleton className="mt-5 h-3 w-full" /></Card>;
  }
  if (resource.error) {
    return <Card><ErrorState title={t('dashboard.skillsErrorTitle')} message={resource.error.message || t('dashboard.errorMessage')} retryLabel={t('common.retry')} onRetry={onRetry} /></Card>;
  }
  const skills = resource.data || {};
  const strongTopics = skills.strongTopics || skills.strong || [];
  const weakTopics = skills.weakTopics || skills.weak || [];
  return (
    <Card>
      <h2 className="text-lg font-semibold text-slate-950 dark:text-white">{t('dashboard.skillsTitle')}</h2>
      <div className="mt-5 space-y-4">
        <ProgressBar value={skills.technical} label={t('dashboard.technical')} />
        <ProgressBar value={skills.communication} label={t('dashboard.communication')} />
      </div>
      <TopicList title={t('dashboard.strongTopics')} topics={strongTopics} variant="strong" />
      <TopicList title={t('dashboard.growthTopics')} topics={weakTopics} variant="weak" />
    </Card>
  );
}

function TopicList({ title, topics, variant }) {
  const { t } = useTranslation();
  const normalizedTopics = Array.isArray(topics) ? topics.map((topic) => typeof topic === 'string' ? topic : topic.name).filter(Boolean) : [];
  return (
    <div className="mt-5">
      <h3 className="text-sm font-medium">{title}</h3>
      {normalizedTopics.length ? (
        <ul className="mt-2 flex flex-wrap gap-2">
          {normalizedTopics.map((topic) => (
            <li key={topic} className={`rounded-full px-3 py-1 text-xs ${variant === 'strong' ? 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200' : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200'}`}>
              {topic}
            </li>
          ))}
        </ul>
      ) : <p className="mt-1 text-sm text-muted dark:text-muted-dark">{t('dashboard.noTopics')}</p>}
    </div>
  );
}

export function RecommendationCard({ resource, onRetry, onPractice }) {
  const { t } = useTranslation();
  if (resource.loading) {
    return <Card aria-label={t('dashboard.loadingRecommendations')}><Skeleton className="h-5 w-40" /><Skeleton className="mt-4 h-4 w-full" /></Card>;
  }
  if (resource.error) {
    return <Card><ErrorState title={t('dashboard.recommendationsErrorTitle')} message={resource.error.message || t('dashboard.errorMessage')} retryLabel={t('common.retry')} onRetry={onRetry} /></Card>;
  }
  const recommendations = Array.isArray(resource.data) ? resource.data : resource.data?.items || [];
  return (
    <Card>
      <div className="flex items-center gap-2">
        <Sparkles aria-hidden="true" className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold text-slate-950 dark:text-white">{t('dashboard.recommendationsTitle')}</h2>
      </div>
      {recommendations.length ? (
        <ul className="mt-4 space-y-4">
          {recommendations.slice(0, 3).map((recommendation, index) => (
            <li key={recommendation.id || index} className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800">
              <h3 className="font-semibold">{recommendation.title || recommendation.skill || t('dashboard.practiceSuggestion')}</h3>
              <p className="mt-1 text-sm text-muted dark:text-muted-dark">
                {recommendation.reason ? t(recommendation.reason) : t('dashboard.recommendationReason')}
              </p>
              <Button className="mt-3" size="sm" onClick={() => onPractice(recommendation)}>
                {t('dashboard.practiceNow')}
              </Button>
            </li>
          ))}
        </ul>
      ) : <EmptyState title={t('dashboard.noRecommendationsTitle')} description={t('dashboard.noRecommendationsDescription')} />}
    </Card>
  );
}

const quickActionDefinitions = [
  { key: 'startInterview', label: 'dashboard.startFirstInterview', to: ROUTES.INTERVIEW_SETUP, icon: MessageSquareText },
  { key: 'communicationPractice', label: 'nav.practice', to: ROUTES.PRACTICE, icon: Sparkles },
  { key: 'questions', label: 'dashboard.practiceQuestions', to: '/questions', icon: BookOpen },
  { key: 'notes', label: 'dashboard.notes', to: '/notes', icon: FileText },
  { key: 'resume', label: 'dashboard.resume', to: ROUTES.RESUME, icon: Briefcase },
  { key: 'reports', label: 'dashboard.reports', to: '/reports', icon: Trophy },
];

export function QuickActions({ availableRoutes = [] }) {
  const { t } = useTranslation();
  const actions = quickActionDefinitions.filter((action) => availableRoutes.includes(action.to));
  if (!actions.length) return null;
  return (
    <Card>
      <h2 className="text-lg font-semibold text-slate-950 dark:text-white">{t('dashboard.quickActions')}</h2>
      <div className="mt-4 flex flex-wrap gap-3">
        {actions.map(({ key, label, to, icon: Icon }) => (
          <Link key={key} to={to} className="inline-flex min-h-touch items-center gap-2 rounded-lg border border-slate-300 px-4 text-sm font-medium hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800">
            <Icon aria-hidden="true" className="h-4 w-4" />{t(label)}
          </Link>
        ))}
      </div>
    </Card>
  );
}

