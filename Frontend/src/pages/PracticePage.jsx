import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, Gauge, MessageCircle, Mic, Sparkles, Target } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { ErrorState } from '../components/ui/ErrorState';
import { Skeleton } from '../components/ui/Skeleton';
import { useTranslation } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { interviewsApi } from '../services/api/interviewsApi';
import { questionsApi } from '../services/api/questionsApi';
import { getDailyPracticeStreak } from '../services/offline/dailyPractice';
import { saveInterviewSnapshot } from '../services/offline/localInterviewStore';
import { getSpeechCapabilities } from '../utils/speechCapabilities';
import { Category, Difficulty, Language } from '../config/constants';

const DRILLS = [
  { id: 'intro', tag: 'practice:intro', icon: MessageCircle, mode: 'selected' },
  { id: 'star', tag: 'practice:star', icon: Target, mode: 'text' },
  { id: 'filler', tag: 'practice:filler', icon: Sparkles, mode: 'selected' },
  { id: 'pace', tag: 'practice:pace', icon: Gauge, mode: 'voice' },
  { id: 'daily', tag: null, icon: CalendarDays, mode: 'selected' },
];

async function loadCommunicationQuestions() {
  const items = [];
  let page = 1;
  let pages = 1;
  while (page <= pages && page <= 50) {
    const result = await questionsApi.list({
      category: Category.COMMUNICATION,
      language: Language.ENGLISH,
      page,
      limit: 100,
    });
    items.push(...(result.items || []));
    pages = Math.max(1, Number(result.pagination?.pages) || 1);
    page += 1;
  }
  return items.filter((question) => question.isActive !== false);
}

function todayQuestion(questions, date = new Date()) {
  if (!questions.length) return null;
  const day = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / 86400000;
  const ordered = [...questions].sort((left, right) => String(left.id).localeCompare(String(right.id)));
  return ordered[((day % ordered.length) + ordered.length) % ordered.length];
}

export default function PracticePage() {
  const { t } = useTranslation();
  const { user, guestProfile } = useAuth();
  const navigate = useNavigate();
  const online = useOnlineStatus();
  const speechCapabilities = getSpeechCapabilities();
  const canUseVoice = Boolean(online && speechCapabilities.recognition && speechCapabilities.synthesis && speechCapabilities.microphone);
  const [mode, setMode] = useState('text');
  const [questions, setQuestions] = useState([]);
  const [streak, setStreak] = useState({ streakCount: 0, lastCompletedDate: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [startError, setStartError] = useState(null);
  const [storageError, setStorageError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [starting, setStarting] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [availableQuestions, savedStreak] = await Promise.all([
        loadCommunicationQuestions(),
        getDailyPracticeStreak(),
      ]);
      setQuestions(availableQuestions);
      setStreak(savedStreak);
    } catch (loadError) {
      setError(loadError);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load, retryCount]);
  useEffect(() => {
    if (!canUseVoice && mode === 'voice') setMode('text');
  }, [canUseVoice, mode]);

  const daily = useMemo(() => todayQuestion(questions), [questions]);
  const voiceUnavailable = !online
    ? t('practice.voiceOffline')
    : !speechCapabilities.recognition
      ? t('practice.voiceRecognitionUnavailable')
      : !speechCapabilities.synthesis
        ? t('practice.voiceSynthesisUnavailable')
        : !speechCapabilities.microphone
          ? t('practice.voiceMicrophoneUnavailable')
          : '';

  const startDrill = async (drill) => {
    const question = drill.id === 'daily'
      ? daily
      : questions.find((item) => item.tags?.includes(drill.tag));
    if (!question) {
      setStartError({ drill, message: t('practice.noQuestions') });
      return;
    }
    const selectedMode = drill.mode === 'voice' ? 'voice' : drill.mode === 'text' ? 'text' : mode;
    if (selectedMode === 'voice' && !canUseVoice) {
      setStartError({ drill, message: voiceUnavailable });
      return;
    }
    setStarting(drill.id);
    setError(null);
    setStartError(null);
    try {
      const interview = await interviewsApi.create({
        category: Category.COMMUNICATION,
        jobRole: question.jobRole || '',
        difficulty: question.difficulty || Difficulty.BEGINNER,
        mode: selectedMode,
        style: 'friendly',
        language: Language.ENGLISH,
        duration: 5,
        questionCount: 1,
        practiceType: 'practice',
        source: 'bank',
        skills: question.skill ? [question.skill] : [],
        preferredQuestionId: question.id,
      });
      if (!interview?.id) throw new Error(t('practice.createError'));
      const practiceInterview = { ...interview, practiceDrill: drill.id };
      let snapshotError = null;
      try {
        await saveInterviewSnapshot({
          interview: practiceInterview,
          answers: {},
          currentIndex: 0,
          elapsedSeconds: 0,
          questionElapsedSeconds: 0,
        });
        setStorageError(null);
      } catch (saveError) {
        snapshotError = saveError;
        setStorageError(saveError);
      }
      navigate(`/interview/${encodeURIComponent(interview.id)}/check`, {
        state: { interview: practiceInterview, ...(snapshotError ? { storageError: snapshotError } : {}) },
      });
    } catch (createError) {
      setStartError({ drill, message: createError.message || t('practice.createError') });
    } finally {
      setStarting(null);
    }
  };

  const descriptionName = user?.name || guestProfile?.name || t('dashboard.friend');
  const streakCount = Number(streak.streakCount) || 0;

  return (
    <main className="mx-auto max-w-7xl">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-primary">{t('practice.eyebrow')}</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950 dark:text-white">{t('practice.title')}</h1>
          <p className="mt-2 max-w-3xl text-muted dark:text-muted-dark">{t('practice.description', { name: descriptionName })}</p>
        </div>
        <Badge tone="primary">{t('practice.streak', { count: streakCount })}</Badge>
      </header>

      <p className="mb-5 rounded-xl border border-slate-200 bg-white p-3 text-sm text-muted dark:border-slate-700 dark:bg-slate-900 dark:text-muted-dark">
        {t('practice.promptLanguageNotice')}
      </p>

      {storageError && <p role="status" className="mb-4 rounded-lg border border-warning/40 bg-warning-light p-3 text-sm">{t('practice.storageNotice')} {storageError.message}</p>}
      {error && <div role="alert" className="mb-4"><ErrorState title={t('practice.loadError')} message={error.message} retryLabel={t('common.retry')} onRetry={() => setRetryCount((count) => count + 1)} /></div>}
      {startError && (
        <div role="alert" className="mb-4 rounded-lg border border-danger/30 bg-danger-light p-3 text-sm text-danger">
          <p>{startError.message}</p>
          <Button className="mt-2" size="sm" variant="secondary" disabled={Boolean(starting)} onClick={() => { void startDrill(startError.drill); }}>
            {t('common.retry')}
          </Button>
        </div>
      )}

      <fieldset className="mb-5">
        <legend className="mb-2 text-sm font-semibold">{t('practice.modeLabel')}</legend>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant={mode === 'text' ? 'primary' : 'secondary'} aria-pressed={mode === 'text'} onClick={() => setMode('text')}>
            {t('practice.textMode')}
          </Button>
          <Button type="button" variant={mode === 'voice' ? 'primary' : 'secondary'} aria-pressed={mode === 'voice'} disabled={!canUseVoice} title={!canUseVoice ? voiceUnavailable : undefined} onClick={() => setMode('voice')}>
            <Mic aria-hidden="true" className="h-4 w-4" />{t('practice.voiceMode')}
          </Button>
        </div>
        {!canUseVoice && <p className="mt-2 text-sm text-warning">{voiceUnavailable}</p>}
      </fieldset>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label={t('practice.loading')}>
          {Array.from({ length: 5 }, (_, index) => <Skeleton className="h-64" key={index} />)}
        </div>
      ) : !error && !questions.length ? (
        <Card><p className="text-sm text-muted dark:text-muted-dark">{t('practice.noQuestions')}</p></Card>
      ) : !error && (
        <section aria-label={t('practice.drills')} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {DRILLS.map(({ id, tag, icon: Icon, mode: drillMode }) => {
            const question = id === 'daily' ? daily : questions.find((item) => item.tags?.includes(tag));
            const requiresVoice = drillMode === 'voice';
            const disabled = !question || (requiresVoice && !canUseVoice) || Boolean(starting);
            return (
              <Card key={id} className="flex h-full flex-col">
                <div className="flex items-start gap-3">
                  <span className="rounded-lg bg-primary-light p-2 text-primary dark:bg-indigo-950">
                    <Icon aria-hidden="true" className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <h2 className="font-semibold">{t(`practice.drills.${id}.title`)}</h2>
                    <p className="mt-1 text-sm text-muted dark:text-muted-dark">{t(`practice.drills.${id}.description`)}</p>
                  </div>
                </div>
                {id === 'daily' && question && (
                  <blockquote className="mt-4 rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800">
                    <span className="font-medium">{t('practice.todaysPrompt')} </span>{question.text}
                  </blockquote>
                )}
                {question && id !== 'daily' && (
                  <blockquote className="mt-4 rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800">
                    <span className="font-medium">{t('practice.prompt')} </span>{question.text}
                  </blockquote>
                )}
                <p className="mt-4 flex-1 text-sm text-primary">{t(`practice.tips.${id}`)}</p>
                {requiresVoice && !canUseVoice && <p className="mt-3 text-xs text-warning">{voiceUnavailable}</p>}
                <Button className="mt-4 w-full" disabled={disabled} loading={starting === id} onClick={() => { void startDrill({ id, tag, mode: drillMode }); }}>
                  {t('practice.start')}
                </Button>
              </Card>
            );
          })}
        </section>
      )}
    </main>
  );
}
