import { Badge } from '../ui/Badge';
import { ProgressBar } from '../ui/ProgressBar';
import { evaluationMethodKey, reportScore, scoreTone } from '../../utils/reportUtils';
import { useTranslation } from '../../context/LanguageContext';

export function ScoreBadge({ score }) {
  const { t } = useTranslation();
  const value = Math.max(0, Math.min(100, Math.round(Number(score) || 0)));
  return <Badge tone={scoreTone(value)}>{t('reports.scoreLabel', { score: value, range: t(`reports.ranges.${scoreTone(value)}`) })}</Badge>;
}

export function EvaluationMethodBadge({ method }) {
  const { t } = useTranslation();
  return (
    <Badge title={t('reports.methodHelp')} tone={method === 'local-rule-based-v1' ? 'warning' : 'primary'}>
      {t(evaluationMethodKey(method))}
    </Badge>
  );
}

export function ScoreRing({ value, label }) {
  const score = reportScore({ totalScore: value });
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - score / 100);
  return (
    <div role="img" aria-label={`${label}: ${score}%`} className="flex items-center gap-3">
      <svg viewBox="0 0 100 100" className="h-20 w-20 -rotate-90" aria-hidden="true">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="currentColor" className="text-slate-200 dark:text-slate-700" strokeWidth="9" />
        <circle cx="50" cy="50" r={radius} fill="none" stroke="currentColor" className="text-primary" strokeWidth="9" strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" />
      </svg>
      <div>
        <p className="text-2xl font-bold tabular-nums">{score}%</p>
        <p className="text-sm text-muted dark:text-muted-dark">{label}</p>
      </div>
    </div>
  );
}

export function EvaluationBreakdown({ evaluation }) {
  const { t } = useTranslation();
  const breakdown = evaluation?.breakdown || {};
  const values = [
    ['relevance', breakdown.relevance],
    ['keywords', breakdown.keywordCoverage],
    ['completeness', breakdown.completeness],
    ['clarity', breakdown.clarity],
    ['communication', breakdown.communication ?? evaluation?.communicationScore],
  ];
  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      {values.map(([key, value]) => (
        <ProgressBar key={key} value={value} label={t(`reports.${key}`)} />
      ))}
    </div>
  );
}

