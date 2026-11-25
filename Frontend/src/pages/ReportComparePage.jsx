import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { ErrorState } from '../components/ui/ErrorState';
import { EvaluationMethodBadge, ScoreBadge } from '../components/reports/ReportComponents';
import { Skeleton } from '../components/ui/Skeleton';
import { useTranslation } from '../context/LanguageContext';
import { ROUTES } from '../config/routes';
import { reportsApi } from '../services/api/reportsApi';
import { reportScore } from '../utils/reportUtils';

export default function ReportComparePage() {
  const [searchParams] = useSearchParams();
  const { t } = useTranslation();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const ids = (searchParams.get('ids') || '').split(',').filter(Boolean).slice(0, 2);

  const load = () => {
    if (ids.length !== 2) {
      setError(new Error(t('reports.compareChooseTwo')));
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all(ids.map((id) => reportsApi.get(id))).then((results) => {
      const items = results.map((result) => result.report);
      if (!items[0]?.category || items[0].category !== items[1]?.category) {
        throw new Error(t('reports.compareSameCategory'));
      }
      setReports(items);
      setError(null);
    }).catch(setError).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [searchParams]);

  if (loading) return <main className="mx-auto max-w-6xl space-y-4" aria-label={t('reports.loading')}><Skeleton className="h-12 w-2/3" /><Skeleton className="h-72 w-full" /></main>;
  if (error) return <main className="mx-auto max-w-4xl"><ErrorState title={t('reports.compareError')} message={error.message} onRetry={load} retryLabel={t('common.retry')} /></main>;

  const scoreRows = [
    ['total', 'reports.totalScore'],
    ['content', 'reports.contentScore'],
    ['communication', 'reports.communicationScore'],
  ];

  return (
    <main className="mx-auto max-w-6xl">
      <header className="mb-6">
        <p className="text-sm font-semibold text-primary">{t('reports.eyebrow')}</p>
        <h1 className="mt-1 text-3xl font-bold">{t('reports.compareTitle')}</h1>
        <p className="mt-2 text-muted dark:text-muted-dark">{t('reports.compareCategory', { category: t(`questionBank.categories.${reports[0].category}`) })}</p>
      </header>
      <div className="grid gap-5 md:grid-cols-2">
        {reports.map((report) => (
          <Card key={report.id}>
            <h2 className="text-xl font-semibold">{report.title}</h2>
            <p className="mt-1 text-sm text-muted dark:text-muted-dark">{report.createdAt ? new Date(report.createdAt).toLocaleDateString() : '—'}</p>
            <div className="mt-3"><EvaluationMethodBadge method={report.method} /></div>
            <dl className="mt-5 space-y-4">
              {scoreRows.map(([key, label]) => (
                <div key={key} className="flex items-center justify-between gap-3 border-b border-slate-200 pb-3 dark:border-slate-700">
                  <dt>{t(label)}</dt><dd><ScoreBadge score={reportScore(report, key)} /></dd>
                </div>
              ))}
            </dl>
            <Link className="mt-4 inline-flex text-sm font-semibold text-primary underline" to={ROUTES.REPORT_DETAIL.replace(':id', encodeURIComponent(report.id))}>{t('reports.openReport')}</Link>
          </Card>
        ))}
      </div>
    </main>
  );
}

