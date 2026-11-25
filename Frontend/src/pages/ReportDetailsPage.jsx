import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ArrowDown, ArrowUp, Download, RotateCcw } from 'lucide-react';
import { EvaluationBreakdown, EvaluationMethodBadge, ScoreBadge, ScoreRing } from '../components/reports/ReportComponents';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { ErrorState } from '../components/ui/ErrorState';
import { Modal } from '../components/ui/Modal';
import { Skeleton } from '../components/ui/Skeleton';
import { Textarea } from '../components/ui/Textarea';
import { useToast } from '../components/ui/Toast';
import { useTranslation } from '../context/LanguageContext';
import { answersApi } from '../services/api/answersApi';
import { reportsApi } from '../services/api/reportsApi';
import { reportFilename, reportScore, saveBlob } from '../utils/reportUtils';

function average(items, selector) {
  const scores = items.map(selector).filter((value) => Number.isFinite(Number(value)));
  return scores.length ? Math.round(scores.reduce((sum, score) => sum + Number(score), 0) / scores.length) : 0;
}

function reportResults(report) {
  return Array.isArray(report?.questionResults) ? report.questionResults : report?.items || [];
}

function voiceMetricsExist(report, results) {
  const analysis = report.communicationAnalysis || {};
  return results.some((result) => result.voiceMetrics && Object.keys(result.voiceMetrics).length > 0)
    || ['wordsPerMinute', 'averageWordsPerMinute', 'pace', 'pauses', 'pauseCount', 'longestPauseSeconds', 'fillerCount', 'fillerWords']
      .some((key) => analysis[key] !== undefined && analysis[key] !== null);
}

export default function ReportDetailsPage() {
  const { id } = useParams();
  const { t } = useTranslation();
  const toast = useToast();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retrying, setRetrying] = useState(null);
  const [answerDraft, setAnswerDraft] = useState('');
  const [retryBusy, setRetryBusy] = useState(false);
  const [retryError, setRetryError] = useState(null);
  const [comparisons, setComparisons] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await reportsApi.get(id);
      setReport(result.report);
      setError(null);
    } catch (loadError) {
      setError(loadError);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  const results = useMemo(() => reportResults(report), [report]);
  const voiceAvailable = report ? voiceMetricsExist(report, results) : false;

  const saveRetry = async () => {
    if (!retrying || !report?.interviewId) return;
    setRetryBusy(true);
    setRetryError(null);
    try {
      const answerId = retrying.answerId
        || `${report.interviewId}-answer-${retrying.questionIndex}`;
      const response = await answersApi.retry(report.interviewId, answerId, {
        questionId: retrying.questionId,
        questionIndex: retrying.questionIndex,
        answerText: answerDraft,
      });
      const nextEvaluation = response.answer?.evaluation;
      if (!nextEvaluation) throw new Error(t('reports.retryNoEvaluation'));
      const previousEvaluation = response.previousEvaluation || retrying.evaluation;
      const nextResults = results.map((item) => item.questionIndex === retrying.questionIndex
        ? {
          ...item,
          answerId: response.answer.id || item.answerId,
          answerText: response.answer.answerText,
          evaluation: nextEvaluation,
        }
        : item);
      const nextReport = {
        ...report,
        questionResults: nextResults,
        scores: {
          total: average(nextResults, (item) => item.evaluation?.score),
          content: average(nextResults, (item) => item.evaluation?.contentScore),
          communication: average(nextResults, (item) => item.evaluation?.communicationScore),
        },
      };
      setReport(nextReport);
      setComparisons((current) => ({
        ...current,
        [retrying.questionIndex]: {
          previous: previousEvaluation,
          current: nextEvaluation,
          delta: Number(nextEvaluation.score || 0) - Number(previousEvaluation?.score || 0),
        },
      }));
      setRetrying(null);
      toast.success(t('reports.retrySuccess'));
    } catch (retryFailure) {
      setRetryError(retryFailure);
    } finally {
      setRetryBusy(false);
    }
  };

  const downloadPdf = async () => {
    try {
      if (report.method === 'local-rule-based-v1') {
        window.print();
        return;
      }
      const result = await reportsApi.download(report.id);
      if (result.offline || result.report) {
        window.print();
        return;
      }
      saveBlob(result.blob, result.filename || reportFilename(report));
    } catch (downloadError) {
      toast.error(`${t('reports.pdfError')} ${downloadError.message}`);
    }
  };

  if (loading) {
    return <main className="mx-auto max-w-6xl space-y-4" aria-label={t('reports.loading')}><Skeleton className="h-10 w-2/3" /><Skeleton className="h-36 w-full" /><Skeleton className="h-72 w-full" /></main>;
  }
  if (error || !report) {
    return <main className="mx-auto max-w-4xl"><ErrorState title={t('reports.loadError')} message={error?.message || t('reports.notFound')} onRetry={() => { void load(); }} retryLabel={t('common.retry')} /></main>;
  }

  const total = reportScore(report, 'total');
  const content = reportScore(report, 'content');
  const communication = reportScore(report, 'communication');
  const analysis = report.communicationAnalysis || {};
  const voiceResults = results.filter((item) => item.voiceMetrics);
  const wordsPerMinute = voiceResults.map((item) => Number(item.voiceMetrics?.wordsPerMinute)).filter(Number.isFinite);
  const reportWpm = Array.isArray(analysis.wordsPerMinute)
    ? analysis.wordsPerMinute.map(Number).filter(Number.isFinite)
    : Number.isFinite(Number(analysis.wordsPerMinute ?? analysis.averageWordsPerMinute ?? analysis.pace))
      ? [Number(analysis.wordsPerMinute ?? analysis.averageWordsPerMinute ?? analysis.pace)]
      : [];
  const averageWpm = wordsPerMinute.length
    ? Math.round(wordsPerMinute.reduce((sum, value) => sum + value, 0) / wordsPerMinute.length)
    : reportWpm.length
      ? Math.round(reportWpm.reduce((sum, value) => sum + value, 0) / reportWpm.length)
      : null;
  const rawFillers = analysis.fillerWords;
  const fillerWordCount = Array.isArray(rawFillers)
    ? rawFillers.reduce((sum, item) => sum + Number(item.count || 0), 0)
    : rawFillers && typeof rawFillers === 'object'
      ? Object.values(rawFillers).reduce((sum, value) => sum + Number(value || 0), 0)
      : 0;
  const fillerCount = Number(analysis.fillerCount)
    || fillerWordCount
    || results.reduce((sum, item) => sum + Number(item.evaluation?.breakdown?.fillerCount || 0), 0);
  const pauses = voiceResults.map((item) => Number(item.voiceMetrics?.pauseCount ?? item.voiceMetrics?.pauses)).filter(Number.isFinite);
  const reportPauses = Array.isArray(analysis.pauses)
    ? analysis.pauses.map(Number).filter(Number.isFinite)
    : Number.isFinite(Number(analysis.pauseCount ?? analysis.pauses)) ? [Number(analysis.pauseCount ?? analysis.pauses)] : [];
  const pauseCount = pauses.length
    ? pauses.reduce((sum, value) => sum + value, 0)
    : reportPauses.reduce((sum, value) => sum + value, 0);
  const longestPauseValues = voiceResults
    .map((item) => Number(item.voiceMetrics?.longestPauseSeconds))
    .filter(Number.isFinite);
  const reportLongestPauses = Array.isArray(analysis.longestPauseSeconds)
    ? analysis.longestPauseSeconds.map(Number).filter(Number.isFinite)
    : Number.isFinite(Number(analysis.longestPauseSeconds))
      ? [Number(analysis.longestPauseSeconds)]
      : [];
  const longestPause = longestPauseValues.length
    ? Math.max(...longestPauseValues)
    : reportLongestPauses.length ? Math.max(...reportLongestPauses) : 0;

  return (
    <main className="report-page mx-auto max-w-6xl">
      <header className="report-header mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-primary">{t('reports.eyebrow')}</p>
          <h1 className="mt-1 text-3xl font-bold">{report.title || t('reports.untitled')}</h1>
          <p className="mt-2 text-sm text-muted dark:text-muted-dark">
            {report.category ? t(`questionBank.categories.${report.category}`) : t('reports.unknown')}
            {report.jobRole ? ` · ${report.jobRole}` : ''}
            {report.createdAt ? ` · ${new Date(report.createdAt).toLocaleDateString()}` : ''}
          </p>
        </div>
        <div className="no-print flex flex-wrap items-center gap-2">
          <EvaluationMethodBadge method={report.method || results[0]?.evaluation?.method} />
          <Button onClick={() => { void downloadPdf(); }}><Download aria-hidden="true" className="h-4 w-4" />{t('reports.downloadPdf')}</Button>
        </div>
      </header>

      <section aria-labelledby="report-scores-title">
        <h2 id="report-scores-title" className="sr-only">{t('reports.scoreSummary')}</h2>
        <div className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900 sm:grid-cols-3">
          <ScoreRing value={total} label={t('reports.totalScore')} />
          <ScoreRing value={content} label={t('reports.contentScore')} />
          <ScoreRing value={communication} label={t('reports.communicationScore')} />
        </div>
      </section>

      <section className="mt-6 grid gap-5 lg:grid-cols-3" aria-label={t('reports.overview')}>
        {[
          ['strengths', report.strengths || []],
          ['weaknesses', report.weaknesses || []],
          ['suggestions', report.suggestions || []],
        ].map(([key, entries]) => (
          <Card key={key}>
            <h2 className="text-lg font-semibold">{t(`reports.${key}`)}</h2>
            {entries.length ? (
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm">
                {entries.map((entry, index) => <li key={`${entry}-${index}`}>{entry}</li>)}
              </ul>
            ) : <p className="mt-3 text-sm text-muted dark:text-muted-dark">{t('reports.noItems')}</p>}
          </Card>
        ))}
      </section>

      <section className="mt-7" aria-labelledby="question-results-title">
        <h2 id="question-results-title" className="mb-3 text-xl font-bold">{t('reports.questionResults')}</h2>
        {results.length ? (
          <div className="space-y-3">
            {results.map((result, index) => {
              const evaluation = result.evaluation || {};
              const questionIndex = Number(result.questionIndex ?? index);
              const comparison = comparisons[questionIndex];
              return (
                <details key={result.questionId || questionIndex} className="group rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
                  <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 p-4 font-semibold">
                    <span>{t('reports.questionNumber', { number: questionIndex + 1 })}. {result.questionText || t('reports.question')}</span>
                    <span className="flex items-center gap-2"><ScoreBadge score={evaluation.score} />{t('reports.expandQuestion')}</span>
                  </summary>
                  <div className="border-t border-slate-200 p-4 dark:border-slate-700">
                    <h3 className="font-semibold">{t('reports.yourAnswer')}</h3>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-muted dark:text-muted-dark">{result.answerText || t('reports.noAnswer')}</p>
                    <EvaluationBreakdown evaluation={evaluation} />
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <div>
                        <h3 className="font-semibold">{t('reports.matchedKeywords')}</h3>
                        {evaluation.matchedKeywords?.length ? (
                          <ul className="mt-2 space-y-1 text-sm">{evaluation.matchedKeywords.map((keyword) => <li key={keyword}><span aria-label={t('reports.matched')}>✓</span> {keyword}</li>)}</ul>
                        ) : <p className="mt-2 text-sm text-muted dark:text-muted-dark">{t('reports.none')}</p>}
                      </div>
                      <div>
                        <h3 className="font-semibold">{t('reports.missingKeywords')}</h3>
                        {evaluation.missingKeywords?.length ? (
                          <ul className="mt-2 space-y-1 text-sm">{evaluation.missingKeywords.map((keyword) => <li key={keyword}><span aria-label={t('reports.missing')}>✗</span> {keyword}</li>)}</ul>
                        ) : <p className="mt-2 text-sm text-muted dark:text-muted-dark">{t('reports.none')}</p>}
                      </div>
                    </div>
                    {evaluation.explanation && <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800">{evaluation.explanation}</p>}
                    {evaluation.sampleAnswer && (
                      <div className="mt-4">
                        <h3 className="font-semibold">{t('reports.sampleAnswer')}</h3>
                        <p className="mt-1 whitespace-pre-wrap text-sm text-muted dark:text-muted-dark">{evaluation.sampleAnswer}</p>
                      </div>
                    )}
                    {evaluation.suggestions?.length > 0 && (
                      <div className="mt-4">
                        <h3 className="font-semibold">{t('reports.suggestions')}</h3>
                        <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">{evaluation.suggestions.map((suggestion, suggestionIndex) => <li key={`${suggestion}-${suggestionIndex}`}>{suggestion}</li>)}</ul>
                      </div>
                    )}
                    {comparison && (
                      <p role="status" className="mt-4 flex items-center gap-2 rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800">
                        {comparison.delta > 0 ? <ArrowUp aria-hidden="true" className="h-4 w-4 text-success" /> : comparison.delta < 0 ? <ArrowDown aria-hidden="true" className="h-4 w-4 text-danger" /> : null}
                        {t('reports.retryComparison', { previous: comparison.previous?.score ?? 0, current: comparison.current.score, delta: Math.abs(comparison.delta), direction: comparison.delta > 0 ? t('reports.up') : comparison.delta < 0 ? t('reports.down') : t('reports.unchanged') })}
                      </p>
                    )}
                    <Button className="no-print mt-4" variant="secondary" size="sm" onClick={() => {
                      setRetrying({ ...result, questionIndex, evaluation });
                      setAnswerDraft(result.answerText || '');
                      setRetryError(null);
                    }}>
                      <RotateCcw aria-hidden="true" className="h-4 w-4" />{t('reports.retryQuestion')}
                    </Button>
                  </div>
                </details>
              );
            })}
          </div>
        ) : <Card><p className="text-sm text-muted dark:text-muted-dark">{t('reports.noQuestionResults')}</p></Card>}
      </section>

      <section className="mt-7" aria-labelledby="communication-title">
        <Card>
          <h2 id="communication-title" className="text-xl font-bold">{t('reports.communicationAnalysis')}</h2>
          {!voiceAvailable ? (
            <p className="mt-3 text-sm text-muted dark:text-muted-dark">{t('reports.noVoiceMetrics')}</p>
          ) : (
            <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-sm text-muted dark:text-muted-dark">{t('reports.pace')}</p>
                <p className="mt-1 text-2xl font-bold">{averageWpm ?? '—'} <span className="text-sm font-normal">{t('reports.wordsPerMinute')}</span></p>
                <p className="mt-1 text-xs text-muted dark:text-muted-dark">{t('reports.idealPace')}</p>
                <meter className="mt-2 w-full" min="0" max="200" low="80" high="180" optimum="140" value={averageWpm || 0} aria-label={t('reports.pace')} />
              </div>
              <div>
                <p className="text-sm text-muted dark:text-muted-dark">{t('reports.fillerWords')}</p>
                <p className="mt-1 text-2xl font-bold">{fillerCount}</p>
                <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700" role="img" aria-label={t('reports.fillerChart', { count: fillerCount })}>
                  <div className="h-full bg-warning" style={{ width: `${Math.min(100, fillerCount * 8)}%` }} />
                </div>
              </div>
              <div>
                <p className="text-sm text-muted dark:text-muted-dark">{t('reports.pauses')}</p>
                <p className="mt-1 text-2xl font-bold">{pauseCount}</p>
                <p className="mt-1 text-xs text-muted dark:text-muted-dark">{t('reports.pausesSummary')}</p>
              </div>
              <div>
                <p className="text-sm text-muted dark:text-muted-dark">{t('reports.longestPause')}</p>
                <p className="mt-1 text-2xl font-bold">{longestPause.toFixed(1)} <span className="text-sm font-normal">{t('reports.secondsUnit')}</span></p>
              </div>
            </div>
          )}
        </Card>
      </section>

      <Modal
        open={Boolean(retrying)}
        onClose={() => setRetrying(null)}
        title={t('reports.retryTitle')}
        description={t('reports.retryDescription')}
      >
        <Textarea label={t('reports.yourAnswer')} value={answerDraft} maxLength={5000} onChange={(event) => setAnswerDraft(event.target.value)} />
        {retryError && <p role="alert" className="mt-3 text-sm text-danger">{t('reports.retryError')} {retryError.message}</p>}
        <div className="mt-5 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setRetrying(null)}>{t('common.cancel')}</Button>
          <Button loading={retryBusy} onClick={() => { void saveRetry(); }}>{t('reports.submitRetry')}</Button>
        </div>
      </Modal>
    </main>
  );
}

