import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Link } from 'react-router-dom';
import { reportsApi } from '../../services/api/reportsApi';
import { useTranslation } from '../../context/LanguageContext';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { ErrorState } from '../ui/ErrorState';
import { Skeleton } from '../ui/Skeleton';
import { ROUTES } from '../../config/routes';

export function ReportProgressChart() {
  const { t } = useTranslation();
  const [period, setPeriod] = useState('weekly');
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    reportsApi.progress({ period }).then((result) => {
      if (active) {
        setData(result);
        setError(null);
      }
    }).catch((loadError) => {
      if (active) setError(loadError);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [period, retryCount]);

  const points = data?.points || [];
  const improvement = Number(data?.improvement) || 0;

  return (
    <Card>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{t('reports.progressTitle')}</h2>
          <p className="mt-1 text-sm text-muted dark:text-muted-dark">{t('reports.progressDescription')}</p>
        </div>
        <div className="flex gap-2" role="group" aria-label={t('reports.periodToggle')}>
          {['weekly', 'monthly'].map((option) => (
            <Button key={option} variant={period === option ? 'primary' : 'secondary'} size="sm" aria-pressed={period === option} onClick={() => setPeriod(option)}>
              {t(`reports.${option}`)}
            </Button>
          ))}
        </div>
      </header>
      {loading ? (
        <div className="mt-5 space-y-3" aria-label={t('reports.progressLoading')}>
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-5 w-56" />
        </div>
      ) : error ? (
        <ErrorState title={t('reports.progressError')} message={error.message} onRetry={() => setRetryCount((count) => count + 1)} retryLabel={t('common.retry')} />
      ) : (
        <>
          <p className="mt-4 text-sm" role="status">
            {improvement > 0 ? t('reports.improvementUp', { score: improvement })
              : improvement < 0 ? t('reports.improvementDown', { score: Math.abs(improvement) })
                : t('reports.noImprovement')}
          </p>
          <div className="mt-4 grid gap-6 xl:grid-cols-2">
            <div role="img" aria-label={t('reports.averageChartLabel')}>
              <h3 className="mb-2 text-sm font-semibold">{t('reports.averageScore')}</h3>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={points} margin={{ left: 0, right: 12, top: 8, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip formatter={(value) => [`${value}%`, t('reports.averageScore')]} />
                  <Line type="monotone" dataKey="total" name={t('reports.averageScore')} stroke="#4f46e5" strokeWidth={3} dot />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div role="img" aria-label={t('reports.scoreComparisonChartLabel')}>
              <h3 className="mb-2 text-sm font-semibold">{t('reports.scoreComparison')}</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={points} margin={{ left: 0, right: 12, top: 8, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip formatter={(value) => `${value}%`} />
                  <Bar dataKey="content" name={t('reports.contentScore')} fill="#4f46e5" />
                  <Bar dataKey="communication" name={t('reports.communicationScore')} fill="#0f766e" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <p className="sr-only">
            {t('reports.chartSummary', {
              count: points.length,
              latest: points.at(-1)?.total || 0,
              improvement,
            })}
          </p>
          <Link className="mt-3 inline-flex text-sm font-semibold text-primary underline" to={ROUTES.REPORT_PROGRESS}>
            {t('reports.viewProgress')}
          </Link>
        </>
      )}
    </Card>
  );
}

