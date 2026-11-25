import { useCallback, useEffect, useState } from 'react';
import { Activity, BookOpenCheck, Users } from 'lucide-react';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { Skeleton } from '../components/ui/Skeleton';
import { useTranslation } from '../context/LanguageContext';
import { adminApi } from '../services/api/adminApi';

function dashboardModel(data = {}) {
  const questionsByCategory = data.questionsByCategory || data.categoryCounts || [];
  const categoryRows = Array.isArray(questionsByCategory)
    ? questionsByCategory
    : Object.entries(questionsByCategory).map(([category, count]) => ({ category, count }));
  const recentUsers = data.recentUsers || data.users?.recent || data.users?.items || [];
  const recentInterviews = data.recentInterviews || data.interviews?.recent || data.interviews?.items || [];
  return {
    users: Number(data.usersCount ?? data.userCount ?? data.users?.total ?? data.users?.count ?? data.totalUsers ?? 0),
    interviews: Number(data.interviewsCount ?? data.interviewCount ?? data.interviews?.total ?? data.interviews?.count ?? data.totalInterviews ?? 0),
    questions: Number(data.questionsCount ?? data.questionCount ?? data.questions?.total ?? data.questions?.count ?? data.totalQuestions ?? 0),
    questionsByCategory: categoryRows,
    recentUsers: Array.isArray(recentUsers) ? recentUsers : [],
    recentInterviews: Array.isArray(recentInterviews) ? recentInterviews : [],
  };
}

function MetricCard({ label, value, icon: Icon }) {
  return (
    <Card>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-muted dark:text-muted-dark">{label}</p>
          <p className="mt-2 text-3xl font-bold tabular-nums">{value}</p>
        </div>
        <Icon aria-hidden="true" className="h-7 w-7 text-primary" />
      </div>
    </Card>
  );
}

export default function AdminDashboardPage() {
  const { t } = useTranslation();
  const [state, setState] = useState({ loading: true, error: null, data: null });
  const load = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const data = await adminApi.getDashboard();
      setState({ loading: false, error: null, data: dashboardModel(data) });
    } catch (error) {
      setState((current) => ({ ...current, loading: false, error }));
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <main className="mx-auto max-w-7xl">
      <header className="mb-6">
        <p className="text-sm font-semibold text-primary">{t('admin.eyebrow')}</p>
        <h1 className="mt-1 text-3xl font-bold">{t('admin.dashboardTitle')}</h1>
        <p className="mt-2 text-muted dark:text-muted-dark">{t('admin.dashboardDescription')}</p>
      </header>

      {state.loading ? (
        <section aria-label={t('admin.loadingDashboard')} className="grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((item) => <Skeleton key={item} className="h-28" />)}
        </section>
      ) : state.error ? (
        <ErrorState title={t('admin.dashboardError')} message={state.error.message} retryLabel={t('common.retry')} onRetry={() => { void load(); }} />
      ) : state.data && (
        <>
          <section aria-label={t('admin.usageStatistics')} className="grid gap-4 sm:grid-cols-3">
            <MetricCard label={t('admin.totalUsers')} value={state.data.users} icon={Users} />
            <MetricCard label={t('admin.totalInterviews')} value={state.data.interviews} icon={Activity} />
            <MetricCard label={t('admin.activeQuestions')} value={state.data.questions} icon={BookOpenCheck} />
          </section>

          <section className="mt-6 grid gap-6 xl:grid-cols-2">
            <Card>
              <h2 className="text-lg font-semibold">{t('admin.questionsByCategory')}</h2>
              {state.data.questionsByCategory.length ? (
                <ul className="mt-4 space-y-4">
                  {state.data.questionsByCategory.map((row) => {
                    const count = Number(row.count ?? row.total ?? 0);
                    const maximum = Math.max(...state.data.questionsByCategory.map((item) => Number(item.count ?? item.total ?? 0)), 1);
                    const category = row.category || row.name || row.label || t('admin.unknownCategory');
                    return (
                      <li key={category}>
                        <div className="mb-1 flex justify-between gap-3 text-sm">
                          <span>{t(`questionBank.categories.${category}`) === `questionBank.categories.${category}` ? category : t(`questionBank.categories.${category}`)}</span>
                          <span className="font-semibold tabular-nums">{count}</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800" role="img" aria-label={t('admin.categoryBar', { category, count })}>
                          <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, (count / maximum) * 100)}%` }} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : <EmptyState title={t('admin.noCategoryData')} description={t('admin.noCategoryDataDescription')} />}
            </Card>

            <Card>
              <h2 className="text-lg font-semibold">{t('admin.recentUsers')}</h2>
              {state.data.recentUsers.length ? (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[32rem] text-left text-sm">
                    <thead><tr className="border-b border-slate-200 text-muted dark:border-slate-700"><th className="py-2 pr-3">{t('admin.name')}</th><th className="py-2 pr-3">{t('admin.email')}</th><th className="py-2">{t('admin.role')}</th></tr></thead>
                    <tbody>{state.data.recentUsers.map((user) => (
                      <tr key={user.id || user.email} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                        <td className="py-3 pr-3">{user.name || t('admin.unknown')}</td>
                        <td className="py-3 pr-3">{user.email || t('admin.unknown')}</td>
                        <td className="py-3"><Badge>{user.role || t('admin.unknown')}</Badge></td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              ) : <EmptyState title={t('admin.noRecentUsers')} description={t('admin.noRecentUsersDescription')} />}
            </Card>
          </section>

          <Card className="mt-6">
            <h2 className="text-lg font-semibold">{t('admin.recentInterviews')}</h2>
            {state.data.recentInterviews.length ? (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[36rem] text-left text-sm">
                  <thead><tr className="border-b border-slate-200 text-muted dark:border-slate-700"><th className="py-2 pr-3">{t('admin.title')}</th><th className="py-2 pr-3">{t('admin.category')}</th><th className="py-2 pr-3">{t('admin.jobRole')}</th><th className="py-2">{t('admin.status')}</th></tr></thead>
                  <tbody>{state.data.recentInterviews.map((interview) => (
                    <tr key={interview.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                      <td className="py-3 pr-3">{interview.title || interview.jobRole || t('admin.untitledInterview')}</td>
                      <td className="py-3 pr-3">{interview.category || t('admin.unknown')}</td>
                      <td className="py-3 pr-3">{interview.jobRole || t('admin.unknown')}</td>
                      <td className="py-3"><Badge tone={interview.status === 'completed' ? 'success' : 'neutral'}>{interview.status || t('admin.unknown')}</Badge></td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            ) : <EmptyState title={t('admin.noRecentInterviews')} description={t('admin.noRecentInterviewsDescription')} />}
          </Card>
        </>
      )}
    </main>
  );
}
