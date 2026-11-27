import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Download, GitCompareArrows, Trash2 } from 'lucide-react';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { Modal } from '../components/ui/Modal';
import { Skeleton } from '../components/ui/Skeleton';
import { ScoreBadge, EvaluationMethodBadge } from '../components/reports/ReportComponents';
import { useToast } from '../components/ui/Toast';
import { useTranslation } from '../context/LanguageContext';
import { ROUTES } from '../config/routes';
import { reportsApi } from '../services/api/reportsApi';
import { buildReportsCsv, reportScore, saveBlob } from '../utils/reportUtils';

const categories = ['hr', 'technical', 'general', 'communication', 'coding'];

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString();
}

export default function ReportHistoryPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const navigate = useNavigate();
  const [reports, setReports] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [sort, setSort] = useState('newest');
  const [selected, setSelected] = useState([]);
  const [deleting, setDeleting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await reportsApi.list({ category, from, to, page, limit: 10 });
      setReports(result.items || []);
      setPagination(result.pagination || { page: 1, pages: 1, total: (result.items || []).length });
      setError(null);
      setSelected([]);
    } catch (loadError) {
      setError(loadError);
    } finally {
      setLoading(false);
    }
  }, [category, from, page, to]);

  useEffect(() => { void load(); }, [load]);

  const sortedReports = useMemo(() => [...reports].sort((left, right) => {
    if (sort === 'oldest') return String(left.createdAt).localeCompare(String(right.createdAt));
    if (sort === 'score-high') return reportScore(right) - reportScore(left);
    if (sort === 'score-low') return reportScore(left) - reportScore(right);
    return String(right.createdAt).localeCompare(String(left.createdAt));
  }), [reports, sort]);

  const updateFilter = (setter) => (event) => {
    setter(event.target.value);
    setPage(1);
  };

  const toggleComparison = (report) => {
    setSelected((current) => {
      if (current.some((item) => item.id === report.id)) return current.filter((item) => item.id !== report.id);
      if (current.length >= 2 || (current.length && current[0].category !== report.category)) return current;
      return [...current, report];
    });
  };

  const compareReports = () => {
    if (selected.length !== 2 || selected[0].category !== selected[1].category) return;
    const query = new URLSearchParams({ ids: selected.map((report) => report.id).join(',') });
    navigate(`${ROUTES.REPORT_COMPARE}?${query.toString()}`);
  };

  const exportCsv = () => {
    const csv = buildReportsCsv(sortedReports, {
      date: t('reports.csvDate'),
      title: t('reports.csvTitle'),
      category: t('reports.csvCategory'),
      total: t('reports.csvTotal'),
      content: t('reports.csvContent'),
      communication: t('reports.csvCommunication'),
    });
    saveBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), 'talkready-reports.csv');
  };

  const confirmDelete = async () => {
    try {
      await reportsApi.remove(deleting.id);
      setDeleting(null);
      await load();
      toast.success(t('reports.deleted'));
    } catch (deleteError) {
      toast.error(`${t('reports.deleteError')} ${deleteError.message}`);
    }
  };

  return (
    <main className="mx-auto max-w-7xl">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-primary">{t('reports.eyebrow')}</p>
          <h1 className="mt-1 text-3xl font-bold">{t('reports.historyTitle')}</h1>
          <p className="mt-2 text-muted dark:text-muted-dark">{t('reports.historyDescription')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={exportCsv} disabled={!reports.length}>
            <Download aria-hidden="true" className="h-4 w-4" />{t('reports.exportCsv')}
          </Button>
          <Link className="inline-flex min-h-touch items-center rounded-lg border border-slate-300 px-4 text-sm font-medium hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800" to={ROUTES.REPORT_PROGRESS}>
            {t('reports.progressTitle')}
          </Link>
        </div>
      </header>

      <Card>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm font-medium">
            {t('reports.category')}
            <select className="mt-1 min-h-touch w-full rounded-lg border border-slate-300 bg-white px-3 dark:border-slate-600 dark:bg-slate-900" value={category} onChange={updateFilter(setCategory)}>
              <option value="">{t('reports.allCategories')}</option>
              {categories.map((item) => <option key={item} value={item}>{t(`questionBank.categories.${item}`)}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium">
            {t('reports.from')}
            <input type="date" className="mt-1 min-h-touch w-full rounded-lg border border-slate-300 bg-white px-3 dark:border-slate-600 dark:bg-slate-900" value={from} onChange={updateFilter(setFrom)} />
          </label>
          <label className="text-sm font-medium">
            {t('reports.to')}
            <input type="date" className="mt-1 min-h-touch w-full rounded-lg border border-slate-300 bg-white px-3 dark:border-slate-600 dark:bg-slate-900" value={to} onChange={updateFilter(setTo)} />
          </label>
          <label className="text-sm font-medium">
            {t('reports.sort')}
            <select className="mt-1 min-h-touch w-full rounded-lg border border-slate-300 bg-white px-3 dark:border-slate-600 dark:bg-slate-900" value={sort} onChange={(event) => setSort(event.target.value)}>
              <option value="newest">{t('reports.newest')}</option>
              <option value="oldest">{t('reports.oldest')}</option>
              <option value="score-high">{t('reports.highestScore')}</option>
              <option value="score-low">{t('reports.lowestScore')}</option>
            </select>
          </label>
        </div>
      </Card>

      {selected.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary-light p-3 dark:bg-indigo-950">
          <p className="text-sm">{t('reports.selectedForCompare', { count: selected.length })}</p>
          <Button size="sm" disabled={selected.length !== 2} onClick={compareReports}>
            <GitCompareArrows aria-hidden="true" className="h-4 w-4" />{t('reports.compare')}
          </Button>
        </div>
      )}

      <section className="mt-5" aria-label={t('reports.historyTitle')}>
        {loading ? (
          <div className="space-y-3" aria-label={t('reports.loading')}>
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : error ? (
          <ErrorState title={t('reports.loadError')} message={error.message} onRetry={() => { void load(); }} retryLabel={t('common.retry')} />
        ) : sortedReports.length ? (
          <Card className="overflow-x-auto p-0">
            <table className="w-full min-w-[780px] border-collapse text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800">
                <tr>
                  <th scope="col" className="p-4">{t('reports.compare')}</th>
                  <th scope="col" className="p-4">{t('reports.date')}</th>
                  <th scope="col" className="p-4">{t('reports.title')}</th>
                  <th scope="col" className="p-4">{t('reports.category')}</th>
                  <th scope="col" className="p-4">{t('reports.score')}</th>
                  <th scope="col" className="p-4">{t('reports.method')}</th>
                  <th scope="col" className="p-4">{t('reports.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {sortedReports.map((report) => {
                  const checked = selected.some((item) => item.id === report.id);
                  const differentCategory = selected.length > 0 && selected[0].category !== report.category;
                  return (
                    <tr key={report.id} className="border-t border-slate-200 dark:border-slate-700">
                      <td className="p-4">
                        <input
                          type="checkbox"
                          aria-label={t('reports.selectCompare', { title: report.title })}
                          checked={checked}
                          disabled={!checked && (selected.length >= 2 || differentCategory)}
                          onChange={() => toggleComparison(report)}
                        />
                      </td>
                      <td className="p-4 whitespace-nowrap">{formatDate(report.createdAt)}</td>
                      <td className="p-4 font-medium">
                        <Link className="text-primary underline" to={ROUTES.REPORT_DETAIL.replace(':id', encodeURIComponent(report.id))}>{report.title || t('reports.untitled')}</Link>
                      </td>
                      <td className="p-4"><Badge>{report.category
                        ? (categories.includes(report.category) ? t(`questionBank.categories.${report.category}`) : report.category)
                        : t('reports.unknown')}</Badge></td>
                      <td className="p-4"><ScoreBadge score={reportScore(report)} /></td>
                      <td className="p-4"><EvaluationMethodBadge method={report.method} /></td>
                      <td className="p-4">
                        <Button variant="ghost" size="icon" aria-label={t('reports.deleteReport', { title: report.title })} onClick={() => setDeleting(report)}>
                          <Trash2 aria-hidden="true" className="h-4 w-4 text-danger" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        ) : (
          <EmptyState
            title={t('reports.emptyTitle')}
            description={t('reports.emptyDescription')}
            action={<Button onClick={() => navigate(ROUTES.INTERVIEW_SETUP)}>{t('reports.startInterview')}</Button>}
          />
        )}
      </section>

      {!loading && !error && pagination.pages > 1 && (
        <nav className="mt-5 flex items-center justify-center gap-3" aria-label={t('reports.pagination')}>
          <Button variant="secondary" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>{t('common.previous')}</Button>
          <span>{t('common.pageOf', { page, pages: pagination.pages })}</span>
          <Button variant="secondary" disabled={page >= pagination.pages} onClick={() => setPage((value) => value + 1)}>{t('common.next')}</Button>
        </nav>
      )}

      <Modal
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title={t('reports.deleteTitle')}
        description={t('reports.deleteDescription', { title: deleting?.title || '' })}
      >
        <div className="mt-5 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setDeleting(null)}>{t('common.cancel')}</Button>
          <Button variant="danger" onClick={() => { void confirmDelete(); }}>{t('reports.deleteConfirm')}</Button>
        </div>
      </Modal>
    </main>
  );
}

