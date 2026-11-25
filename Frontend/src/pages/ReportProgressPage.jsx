import { lazy, Suspense, useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { ErrorState } from '../components/ui/ErrorState';
import { Skeleton } from '../components/ui/Skeleton';
import { useTranslation } from '../context/LanguageContext';
import { reportsApi } from '../services/api/reportsApi';
import { buildReportsCsv, saveBlob } from '../utils/reportUtils';

const ReportProgressChart = lazy(() => import('../components/reports/ReportProgressChart')
  .then((module) => ({ default: module.ReportProgressChart })));

export default function ReportProgressPage() {
  const { t } = useTranslation();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = () => {
    setLoading(true);
    reportsApi.list({ page: 1, limit: 1000 }).then((result) => {
      setReports(result.items || []);
      setError(null);
    }).catch(setError).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const exportCsv = () => {
    const csv = buildReportsCsv(reports, {
      date: t('reports.csvDate'),
      title: t('reports.csvTitle'),
      category: t('reports.csvCategory'),
      total: t('reports.csvTotal'),
      content: t('reports.csvContent'),
      communication: t('reports.csvCommunication'),
    });
    saveBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), 'talkready-progress.csv');
  };

  return (
    <main className="mx-auto max-w-7xl">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-primary">{t('reports.eyebrow')}</p>
          <h1 className="mt-1 text-3xl font-bold">{t('reports.progressTitle')}</h1>
          <p className="mt-2 text-muted dark:text-muted-dark">{t('reports.progressDescription')}</p>
        </div>
        <Button variant="secondary" disabled={loading || !reports.length} onClick={exportCsv}>
          <Download aria-hidden="true" className="h-4 w-4" />{t('reports.exportCsv')}
        </Button>
      </header>
      {loading ? (
        <Card aria-label={t('reports.loading')}><Skeleton className="h-72 w-full" /></Card>
      ) : error ? (
        <ErrorState title={t('reports.loadError')} message={error.message} onRetry={load} retryLabel={t('common.retry')} />
      ) : reports.length ? (
        <Suspense fallback={<Card aria-label={t('reports.progressLoading')}><Skeleton className="h-72 w-full" /></Card>}>
          <ReportProgressChart />
        </Suspense>
      ) : (
        <Card><p className="text-sm text-muted dark:text-muted-dark">{t('reports.progressEmpty')}</p></Card>
      )}
    </main>
  );
}

