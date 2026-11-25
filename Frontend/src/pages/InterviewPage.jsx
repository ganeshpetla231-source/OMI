import { useCallback, useEffect, useRef, useState } from 'react';
import { useBlocker, useNavigate, useParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Mic, Pause, Play, RotateCcw, Send, SkipForward, Volume2 } from 'lucide-react';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { ErrorState } from '../components/ui/ErrorState';
import { Modal } from '../components/ui/Modal';
import { ProgressBar } from '../components/ui/ProgressBar';
import { Skeleton } from '../components/ui/Skeleton';
import { Textarea } from '../components/ui/Textarea';
import { useTranslation } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { InterviewProvider } from '../context/InterviewContext';
import { useInterview } from '../hooks/useInterview';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { useSpeechSynthesis } from '../hooks/useSpeechSynthesis';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { ROUTES } from '../config/routes';
import { countFillerWords } from '../utils/voiceMetrics';

function formatTime(seconds) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}

function wordCount(value) {
  const trimmed = value.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

const STAR_FIELD_ORDER = ['situation', 'task', 'action', 'result'];
const STAR_SCORING_LABELS = {
  situation: 'Situation',
  task: 'Task',
  action: 'Action',
  result: 'Result',
};

function parseStarAnswer(answerText = '') {
  const fields = Object.fromEntries(STAR_FIELD_ORDER.map((field) => [field, '']));
  let activeField = null;
  for (const line of String(answerText).split('\n')) {
    const match = line.match(/^(situation|task|action|result):\s*/i);
    if (match) {
      activeField = match[1].toLowerCase();
      fields[activeField] = line.slice(match[0].length);
    } else if (activeField) {
      fields[activeField] = `${fields[activeField]}\n${line}`.trim();
    }
  }
  return fields;
}

function composeStarAnswer(fields) {
  return STAR_FIELD_ORDER
    .filter((field) => fields[field]?.trim())
    .map((field) => `${STAR_SCORING_LABELS[field]}: ${fields[field].trim()}`)
    .join('\n');
}

function InterviewSession() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const online = useOnlineStatus();
  const {
    interview,
    questions,
    currentQuestion,
    currentIndex,
    answers,
    currentAnswer,
    loading,
    loadError,
    storageError,
    actionError,
    evaluationError,
    dailyStreakError,
    evaluations,
    saveStatus,
    savedOnDevice,
    requiresResume,
    elapsedSeconds,
    questionElapsedSeconds,
    overallRemainingSeconds,
    answeredCount,
    skippedCount,
    progress,
    setAnswerText,
    submitAnswer,
    skip,
    next,
    previous,
    start,
    pause,
    finish,
    enterInterview,
    retryLoad,
  } = useInterview();
  const speechPreferences = user?.preferences?.speech || {};
  const englishLocale = speechPreferences.englishLocale || user?.preferences?.englishLocale || 'en-IN';
  const speechRate = speechPreferences.rate ?? user?.preferences?.speechRate ?? 1;
  const speechRecognition = useSpeechRecognition({
    language: interview?.language || 'en',
    englishLocale,
    sessionKey: `${interview?.id || ''}:${currentIndex}`,
    initialTranscript: currentAnswer?.source === 'voice' ? currentAnswer.answerText || '' : '',
    initialMetrics: currentAnswer?.source === 'voice' ? currentAnswer.voiceMetrics || null : null,
  });
  const speechSynthesis = useSpeechSynthesis({
    language: interview?.language || 'en',
    englishLocale,
    rate: speechRate,
  });
  const [hint, setHint] = useState('');
  const [finishConfirmation, setFinishConfirmation] = useState(false);
  const [timeUp, setTimeUp] = useState(false);
  const [timeUpError, setTimeUpError] = useState(null);
  const [timerAnnouncement, setTimerAnnouncement] = useState('');
  const [speechReady, setSpeechReady] = useState(false);
  const [microphoneError, setMicrophoneError] = useState(null);
  const [showMicrophoneHelp, setShowMicrophoneHelp] = useState(false);
  const [starFields, setStarFields] = useState(() => parseStarAnswer(currentAnswer?.answerText));
  const textareaRef = useRef(null);
  const lastAnnouncement = useRef(overallRemainingSeconds);
  const autoAdvanceKey = useRef(null);
  const autoFinishRef = useRef(null);
  const finishRef = useRef(finish);

  const active = interview?.status === 'in_progress' || interview?.status === 'paused';
  const shouldBlockNavigation = useCallback(({ currentLocation, nextLocation }) => (
    active
    && (saveStatus === 'saving' || saveStatus === 'error' || interview?.status === 'in_progress' || interview?.status === 'paused')
    && currentLocation.pathname !== nextLocation.pathname
  ), [active, interview?.status, saveStatus]);
  const blocker = useBlocker(shouldBlockNavigation);

  useEffect(() => {
    if (!active) return undefined;
    const warnBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = '';
      return '';
    };
    window.addEventListener('beforeunload', warnBeforeUnload);
    return () => window.removeEventListener('beforeunload', warnBeforeUnload);
  }, [active]);

  useEffect(() => {
    textareaRef.current?.focus();
    setHint('');
  }, [currentIndex]);

  const isPractice = interview?.practiceType === 'practice';
  const isStrict = interview?.style === 'strict';
  const showOverallTimer = !isPractice;
  const questionTimerEnabled = interview?.practiceType === 'timed' || interview?.style === 'rapid-fire';
  const questionLimit = interview?.style === 'rapid-fire'
    ? Math.min(Number(currentQuestion?.timeLimitSeconds) || 45, 45)
    : Number(currentQuestion?.timeLimitSeconds) || Math.ceil((Number(interview?.duration) || 15) * 60 / Math.max(1, questions.length));
  const questionRemaining = Math.max(0, questionLimit - questionElapsedSeconds);
  const totalDurationSeconds = (Number(interview?.duration) || 0) * 60;
  const remainingRatio = totalDurationSeconds ? overallRemainingSeconds / totalDurationSeconds : 1;
  const timerTone = remainingRatio <= 0.1 ? 'text-danger' : remainingRatio <= 0.2 ? 'text-warning' : 'text-slate-800 dark:text-slate-100';
  const answerText = currentAnswer?.answerText || '';
  const isVoice = interview?.mode === 'voice';
  const fillerCount = countFillerWords(isVoice ? speechRecognition.transcript || answerText : answerText);

  useEffect(() => {
    if (interview?.practiceDrill === 'star') setStarFields(parseStarAnswer(currentAnswer?.answerText));
  }, [currentIndex, interview?.id, interview?.practiceDrill]);

  const updateStarField = (field, value) => {
    const updated = { ...starFields, [field]: value };
    setStarFields(updated);
    setAnswerText(composeStarAnswer(updated), { source: 'text' });
  };

  const voiceAnswer = () => {
    const stopped = speechRecognition.listening ? speechRecognition.stop() : null;
    const transcript = stopped?.transcript ?? speechRecognition.transcript;
    const spokenAnswer = currentAnswer?.source === 'voice' || speechRecognition.listening;
    return {
      answerText: spokenAnswer ? transcript || answerText : answerText,
      source: spokenAnswer ? 'voice' : 'text',
      ...(spokenAnswer
        ? { voiceMetrics: stopped?.voiceMetrics ?? speechRecognition.voiceMetrics ?? currentAnswer?.voiceMetrics ?? null }
        : {}),
      timeTakenSeconds: questionElapsedSeconds,
    };
  };

  useEffect(() => {
    finishRef.current = async () => finish({
      answerOverride: interview?.mode === 'voice' && (answerText || speechRecognition.transcript)
        ? { ...voiceAnswer(), questionIndex: currentIndex }
        : undefined,
    });
  }, [answerText, currentAnswer?.source, currentIndex, finish, interview?.mode, questionElapsedSeconds, speechRecognition]);

  useEffect(() => {
    if (!loading && interview?.mode === 'voice') {
      speechRecognition.setTranscript(
        currentAnswer?.source === 'voice' ? currentAnswer.answerText || '' : '',
        currentAnswer?.source === 'voice' ? currentAnswer.voiceMetrics || null : null,
      );
    }
  // Hydrate once per question; answer edits are managed by the editor and recognition callbacks.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, interview?.id, loading]);

  useEffect(() => {
    if (interview?.mode !== 'voice' || interview.status !== 'in_progress' || requiresResume || !currentQuestion) {
      speechSynthesis.cancel();
      speechRecognition.stop();
      setSpeechReady(false);
      return undefined;
    }
    let cancelled = false;
    setSpeechReady(false);
    setMicrophoneError(null);
    void speechSynthesis.speak(currentQuestion.text).then((spoken) => {
      if (!cancelled) setSpeechReady(Boolean(spoken) || !speechSynthesis.voiceAvailable);
    });
    return () => {
      cancelled = true;
      speechSynthesis.cancel();
      speechRecognition.stop();
    };
  }, [
    currentIndex,
    currentQuestion?.questionId,
    currentQuestion?.text,
    interview?.mode,
    requiresResume,
    interview?.status,
    speechSynthesis.voiceAvailable,
    speechRecognition.stop,
    speechSynthesis.cancel,
    speechSynthesis.speak,
  ]);

  useEffect(() => {
    if (interview?.mode === 'voice' && speechRecognition.listening) {
      setAnswerText(speechRecognition.transcript, {
        source: 'voice',
        voiceMetrics: speechRecognition.voiceMetrics,
      });
    }
  }, [interview?.mode, setAnswerText, speechRecognition.listening, speechRecognition.transcript, speechRecognition.voiceMetrics]);

  const startRecording = async () => {
    setMicrophoneError(null);
    if (!online) {
      setMicrophoneError(new Error(t('interview.voiceErrors.network')));
      return;
    }
    if (!speechReady || speechSynthesis.speaking) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      const started = speechRecognition.start();
      if (!started) setMicrophoneError(new Error(t(`interview.speechErrors.${speechRecognition.error || 'unknown'}`)));
    } catch (error) {
      const errorKey = error?.name === 'NotAllowedError' || error?.name === 'SecurityError'
        ? 'notAllowed'
        : error?.name === 'NotFoundError' || error?.name === 'DevicesNotFoundError'
          ? 'audioCapture'
          : 'unknown';
      setMicrophoneError(new Error(t(`interview.speechErrors.${errorKey}`)));
      setShowMicrophoneHelp(true);
    }
  };

  const toggleRecording = async () => {
    if (!speechRecognition.listening) {
      await startRecording();
      return;
    }
    const recorded = speechRecognition.stop();
    setAnswerText(recorded.transcript, { source: 'voice', voiceMetrics: recorded.voiceMetrics });
  };

  const retryRecording = () => {
    speechRecognition.reset();
    setAnswerText('', { source: 'voice', voiceMetrics: null });
    setMicrophoneError(null);
  };

  const repeatQuestion = async () => {
    setSpeechReady(false);
    const spoken = await speechSynthesis.speak(currentQuestion?.text || '');
    setSpeechReady(Boolean(spoken) || !speechSynthesis.voiceAvailable);
  };

  useEffect(() => {
    if (!showOverallTimer || interview?.status !== 'in_progress') {
      lastAnnouncement.current = overallRemainingSeconds;
      return;
    }
    if (lastAnnouncement.current > 60 && overallRemainingSeconds <= 60 && overallRemainingSeconds > 10) {
      setTimerAnnouncement(t('interview.oneMinuteAnnouncement'));
    } else if (lastAnnouncement.current > 10 && overallRemainingSeconds <= 10 && overallRemainingSeconds > 0) {
      setTimerAnnouncement(t('interview.tenSecondAnnouncement'));
    }
    lastAnnouncement.current = overallRemainingSeconds;
  }, [interview?.status, overallRemainingSeconds, showOverallTimer, t]);

  useEffect(() => {
    if (!showOverallTimer || interview?.status !== 'in_progress' || overallRemainingSeconds > 0) return undefined;
    if (autoFinishRef.current) return undefined;
    setTimeUp(true);
    autoFinishRef.current = window.setTimeout(() => {
      autoFinishRef.current = null;
      void finishRef.current().catch((error) => setTimeUpError(error));
    }, 5000);
    return () => {
      if (interview?.status !== 'in_progress') {
        window.clearTimeout(autoFinishRef.current);
        autoFinishRef.current = null;
      }
    };
  }, [interview?.status, overallRemainingSeconds, showOverallTimer]);

  useEffect(() => () => {
    if (autoFinishRef.current) window.clearTimeout(autoFinishRef.current);
  }, []);

  useEffect(() => {
    if (!questionTimerEnabled || interview?.status !== 'in_progress' || questionRemaining > 0 || !currentQuestion) return undefined;
    const key = `${currentIndex}:${currentQuestion.questionId}`;
    if (autoAdvanceKey.current === key) return undefined;
    autoAdvanceKey.current = key;
    void (async () => {
      try {
        const voicePayload = interview?.mode === 'voice' ? voiceAnswer() : {};
        await submitAnswer({
          status: 'answered',
          ...voicePayload,
          answerText: voicePayload.answerText ?? answerText,
          timeTakenSeconds: questionLimit,
        });
        if (currentIndex < questions.length - 1) {
          await next();
        } else {
          setFinishConfirmation(true);
        }
      } catch (error) {
        setTimeUpError(error);
      }
    })();
    return undefined;
  }, [
    answerText,
    currentIndex,
    currentQuestion,
    interview?.mode,
    interview?.status,
    next,
    questionLimit,
    questionRemaining,
    questionTimerEnabled,
    questions.length,
    submitAnswer,
  ]);

  const submitAndNext = async () => {
    const voicePayload = interview?.mode === 'voice' ? voiceAnswer() : {};
    await submitAnswer(voicePayload);
    if (currentIndex < questions.length - 1) await next();
    else setFinishConfirmation(true);
  };

  const skipCurrent = async () => {
    const voicePayload = interview?.mode === 'voice' ? voiceAnswer() : {};
    const moved = await skip(voicePayload);
    if (!moved && currentIndex === questions.length - 1) setFinishConfirmation(true);
  };

  const confirmFinish = async () => {
    const voicePayload = interview?.mode === 'voice' && answerText ? voiceAnswer() : undefined;
    await finish({
      answerOverride: voicePayload ? { ...voicePayload, questionIndex: currentIndex } : undefined,
    });
    setFinishConfirmation(false);
  };

  const pauseInterview = async () => {
    const voicePayload = interview?.mode === 'voice' ? voiceAnswer() : undefined;
    await pause({
      answerOverride: voicePayload ? { ...voicePayload, questionIndex: currentIndex } : undefined,
    });
  };

  const submitFromKeyboard = (event) => {
    if (event.ctrlKey && event.key === 'Enter' && interview?.status === 'in_progress') {
      event.preventDefault();
      void submitAndNext().catch(() => undefined);
    }
  };

  if (loading) {
    return <main className="mx-auto max-w-4xl"><Skeleton className="h-10 w-2/3" /><Skeleton className="mt-4 h-64 w-full" /></main>;
  }
  if (loadError) {
    return (
      <main className="mx-auto max-w-4xl">
        <ErrorState title={t('interview.loadErrorTitle')} message={loadError.message} retryLabel={t('common.retry')} onRetry={() => { void retryLoad(); }} />
      </main>
    );
  }
  if (!interview) {
    return <main className="mx-auto max-w-4xl"><ErrorState title={t('interview.loadErrorTitle')} message={t('interview.notFound')} /></main>;
  }
  if (!questions.length) {
    return <main className="mx-auto max-w-4xl"><ErrorState title={t('interview.loadErrorTitle')} message={t('interview.noQuestions')} /></main>;
  }

  if (interview.status === 'completed') {
    const evaluationMethod = evaluations.find((item) => item.evaluation?.method)?.evaluation?.method
      || Object.values(answers).find((answer) => answer.evaluation?.method)?.evaluation?.method;
    const localEvaluation = evaluationMethod === 'local-rule-based-v1';
    return (
      <main className="mx-auto max-w-4xl">
        <Card>
          <p className="text-sm font-semibold text-primary">{t('interview.completeEyebrow')}</p>
          <h1 className="mt-1 text-3xl font-bold">{t('interview.completeTitle')}</h1>
          <p className="mt-2 text-muted dark:text-muted-dark">{t('interview.completeDescription')}</p>
          <dl className="mt-6 grid gap-4 rounded-xl bg-slate-50 p-4 sm:grid-cols-3 dark:bg-slate-800">
            <div><dt className="text-sm text-muted dark:text-muted-dark">{t('interview.totalScore')}</dt><dd className="text-2xl font-bold">{interview.totalScore == null ? t('interview.notScored') : `${interview.totalScore}%`}</dd></div>
            <div><dt className="text-sm text-muted dark:text-muted-dark">{t('interview.answered')}</dt><dd className="text-2xl font-bold">{answeredCount}</dd></div>
            <div><dt className="text-sm text-muted dark:text-muted-dark">{t('interview.skipped')}</dt><dd className="text-2xl font-bold">{skippedCount}</dd></div>
          </dl>
          {evaluationMethod && (
            <div className="mt-4">
              <Badge tone={localEvaluation ? 'warning' : 'success'}>
                {t(localEvaluation ? 'interview.scoredLocal' : 'interview.scoredServer')}
              </Badge>
            </div>
          )}
          {evaluationError && <p role="status" className="mt-4 text-sm text-warning">{t('interview.evaluationUnavailable')} {evaluationError.message}</p>}
          {dailyStreakError && <p role="status" className="mt-4 text-sm text-warning">{t('practice.streakSaveError')} {dailyStreakError.message}</p>}
          <Button
            className="mt-6"
            variant="secondary"
            onClick={() => navigate(ROUTES.REPORT_DETAIL.replace(':id', encodeURIComponent(interview.reportId || `${interview.id}-report`)))}
          >
            {t('interview.viewDetailedResults')}
          </Button>
          <h2 className="mt-7 text-xl font-semibold">{t('interview.answerReview')}</h2>
          <ol className="mt-3 space-y-3">
            {questions.map((question, index) => {
              const answer = answers[String(index)];
              const evaluation = evaluations.find((item) => item.questionIndex === index)?.evaluation || answer?.evaluation;
              return (
                <li key={question.questionId || index} className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                  <p className="font-medium">{t('interview.questionNumber', { number: index + 1, total: questions.length })}: {question.text}</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-muted dark:text-muted-dark">{answer?.answerText || t(`interview.answerStatuses.${answer?.status || 'unanswered'}`)}</p>
                  {evaluation && <p className="mt-2 text-sm">{t('interview.answerScore', { score: evaluation.score })}</p>}
                </li>
              );
            })}
          </ol>
          <Button className="mt-4" onClick={() => navigate(ROUTES.INTERVIEW_SETUP, { state: { setup: interview } })}>
            {t('interview.startAnother')}
          </Button>
        </Card>
      </main>
    );
  }

  const isLastQuestion = currentIndex === questions.length - 1;
  const showHintButton = !isStrict && (isPractice || interview.style === 'friendly');
  const hintValue = currentQuestion?.keywords?.[0] || currentQuestion?.evaluationCriteria?.[0] || t('interview.noHint');

  if (requiresResume) {
    return (
      <main className="mx-auto max-w-3xl">
        <Card>
          <p className="text-sm font-semibold text-primary">{t('interview.resumeEyebrow')}</p>
          <h1 className="mt-1 text-2xl font-bold">{t('interview.resumeTitle')}</h1>
          <p className="mt-2 text-muted dark:text-muted-dark">{t('interview.resumeDescription', { count: answeredCount, total: questions.length, elapsed: formatTime(elapsedSeconds) })}</p>
          {storageError && <p role="alert" className="mt-4 text-sm text-danger">{t('interview.storageError')} {storageError.message}</p>}
          <Button className="mt-6" onClick={() => { void enterInterview().catch(() => undefined); }}>
            {t('interview.resumeButton')}
          </Button>
        </Card>
      </main>
    );
  }

  if (interview.status === 'draft') {
    return (
      <main className="mx-auto max-w-3xl">
        <Card>
          <h1 className="text-2xl font-bold">{t('interview.draftTitle')}</h1>
          <p className="mt-2 text-muted dark:text-muted-dark">{t('interview.draftDescription')}</p>
          <Button className="mt-6" onClick={() => { void start().catch(() => undefined); }}>{t('interview.begin')}</Button>
        </Card>
        {actionError && <p role="alert" className="mt-4 text-sm text-danger">{actionError.message}</p>}
      </main>
    );
  }

  const timerControls = (
    <>
      {interview.status === 'in_progress' && (
        <Button variant="secondary" onClick={() => { void pauseInterview().catch(() => undefined); }}>
          <Pause aria-hidden="true" className="h-4 w-4" />{t('interview.pause')}
        </Button>
      )}
      <Button variant="ghost" onClick={() => setFinishConfirmation(true)}>{t('interview.finish')}</Button>
    </>
  );

  return (
    <main className="mx-auto max-w-5xl">
      <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap gap-2">
            <Badge tone="primary">{t(`questionBank.categories.${interview.category}`)}</Badge>
            {interview.jobRole && <Badge>{interview.jobRole}</Badge>}
            <Badge>{t(`questionBank.difficulties.${interview.difficulty}`)}</Badge>
          </div>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-950 dark:text-white">{t('interview.title')}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {showOverallTimer ? (
            <div className={`rounded-lg bg-slate-100 px-3 py-2 text-lg font-bold tabular-nums dark:bg-slate-800 ${timerTone}`} aria-label={t('interview.timeRemaining')}>
              {formatTime(overallRemainingSeconds)}
            </div>
          ) : <Badge>{t('interview.practiceNoTimer')}</Badge>}
          {timerControls}
        </div>
      </header>

      <p className="sr-only" aria-live="polite">{timerAnnouncement}</p>
      {timeUp && <p role="status" className="mb-4 rounded-lg bg-danger-light p-3 text-sm text-danger">{t('interview.timeIsUp')}</p>}
      {timeUpError && <p role="alert" className="mb-4 text-sm text-danger">{timeUpError.message}</p>}
      {storageError && <p role="alert" className="mb-4 rounded-lg bg-warning-light p-3 text-sm">{t('interview.storageError')} {storageError.message}</p>}
      {actionError && <p role="alert" className="mb-4 rounded-lg bg-danger-light p-3 text-sm text-danger">{actionError.message}</p>}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium">{t('interview.questionNumber', { number: currentIndex + 1, total: questions.length })}</p>
        <div className="flex items-center gap-3 text-sm">
          {questionTimerEnabled && <span className={questionRemaining <= 10 ? 'font-semibold text-danger' : 'tabular-nums'}>{t('interview.questionTimeRemaining')} {formatTime(questionRemaining)}</span>}
          <span aria-live="polite">{savedOnDevice ? t('interview.savedOnDevice') : t(`interview.saveStates.${saveStatus}`)}</span>
        </div>
      </div>
      <ProgressBar value={progress} label={t('interview.progress')} />

      {interview.status === 'paused' ? (
        <Card className="mt-5 text-center">
          <Pause aria-hidden="true" className="mx-auto h-8 w-8 text-primary" />
          <h2 className="mt-3 text-xl font-semibold">{t('interview.pausedTitle')}</h2>
          <p className="mt-2 text-muted dark:text-muted-dark">{t('interview.pausedDescription')}</p>
          <div className="mt-5 flex justify-center gap-3">
            <Button onClick={() => { void enterInterview().catch(() => undefined); }}><Play aria-hidden="true" className="h-4 w-4" />{t('interview.resumeButton')}</Button>
            {timerControls}
          </div>
        </Card>
      ) : (
        <Card className="mt-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-primary">{currentQuestion?.skill}</p>
              <h2 className="mt-2 text-xl font-semibold leading-8 text-slate-950 dark:text-white">{currentQuestion?.text}</h2>
            </div>
            {interview.practiceDrill && (
              <p className="mt-4 rounded-lg bg-primary-light p-3 text-sm dark:bg-indigo-950">
                {t(`practice.tips.${interview.practiceDrill}`)}
              </p>
            )}
            {currentQuestion?.difficulty && <Badge>{t(`questionBank.difficulties.${currentQuestion.difficulty}`)}</Badge>}
          </div>

          {showHintButton && (
            <div className="mt-5">
              <Button variant="ghost" onClick={() => setHint((current) => current ? '' : hintValue)}>
                {hint ? t('interview.hideHint') : t('interview.hint')}
              </Button>
              {hint && <p className="mt-2 rounded-lg bg-primary-light p-3 text-sm dark:bg-indigo-950"><strong>{t('interview.hintLabel')}:</strong> {hint}</p>}
            </div>
          )}

          {isVoice && (
            <section aria-label={t('interview.voiceControls')} className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
              <div className="flex flex-wrap gap-3">
                <Button
                  disabled={!speechRecognition.supported
                    || !online
                    || !speechReady
                    || speechSynthesis.speaking
                    || interview.status !== 'in_progress'
                    || (currentAnswer?.source === 'text' && Boolean(answerText))}
                  onClick={() => { void toggleRecording(); }}
                  aria-pressed={speechRecognition.listening}
                  title={!online
                    ? t('interview.voiceNeedsInternet')
                    : currentAnswer?.source === 'text' && answerText
                      ? t('interview.clearTypedToRecord')
                      : undefined}
                >
                  {speechRecognition.listening
                    ? <span aria-hidden="true" className="h-3 w-3 rounded-full bg-danger motion-reduce:animate-none animate-pulse" />
                    : <Mic aria-hidden="true" className="h-4 w-4" />}
                  {t(speechRecognition.listening ? 'interview.stopRecording' : 'interview.startRecording')}
                </Button>
                <Button variant="secondary" disabled={!answerText && !speechRecognition.transcript} onClick={retryRecording}>
                  <RotateCcw aria-hidden="true" className="h-4 w-4" />{t('interview.retryRecording')}
                </Button>
                <Button variant="secondary" disabled={speechSynthesis.speaking} onClick={() => { void repeatQuestion(); }}>
                  <Volume2 aria-hidden="true" className="h-4 w-4" />{t('interview.repeatQuestion')}
                </Button>
                <Button variant="ghost" onClick={() => setShowMicrophoneHelp(true)}>{t('interview.microphoneHelpButton')}</Button>
              </div>
              <p className="mt-3 text-sm text-muted dark:text-muted-dark">
                {t(speechRecognition.listening ? 'interview.recording' : speechReady ? 'interview.voiceReady' : 'interview.waitingForSpeech')}
              </p>
              <p className="mt-1 text-xs text-muted dark:text-muted-dark">{t('interview.voicePrivacy')}</p>
              {!online && <p role="status" className="mt-3 text-sm text-warning">{t('interview.voiceNeedsInternet')}</p>}
              {!speechRecognition.supported && (
                <p role="status" className="mt-3 flex items-start gap-2 text-sm text-warning">
                  <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                  {t('interview.speechErrors.unsupported')}
                </p>
              )}
              {speechSynthesis.error && <p role="status" className="mt-3 text-sm text-warning">{t(`interview.speechErrors.${speechSynthesis.error}`)}</p>}
              {speechRecognition.error && <p role="alert" className="mt-3 text-sm text-danger">{t(`interview.speechErrors.${speechRecognition.error}`)}</p>}
              {microphoneError && <p role="alert" className="mt-3 text-sm text-danger">{microphoneError.message || t('interview.microphoneHelp')}</p>}
              {speechRecognition.voiceMetrics && speechRecognition.transcript && (
                <p className="mt-2 text-sm">{t('interview.voiceMetricSummary', {
                  words: speechRecognition.voiceMetrics.wordCount,
                  pace: speechRecognition.voiceMetrics.wordsPerMinute,
                  pauses: speechRecognition.voiceMetrics.pauseCount,
                })}</p>
              )}
              {interview.practiceDrill === 'pace' && (
                <p className="mt-2 text-sm" role="status">
                  {speechRecognition.voiceMetrics
                    ? t('practice.paceResult', { pace: speechRecognition.voiceMetrics.wordsPerMinute })
                    : t('practice.paceWaiting')}
                </p>
              )}
            </section>
          )}

          <div className="mt-5">
            {interview.practiceDrill === 'star' ? (
              <>
                <p className="mb-3 text-sm text-muted dark:text-muted-dark">
                  {t('practice.starProgress', {
                    completed: Object.values(starFields).filter((value) => value.trim()).length,
                    total: STAR_FIELD_ORDER.length,
                  })}
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  {STAR_FIELD_ORDER.map((field) => (
                    <Textarea
                      key={field}
                      label={t(`practice.starFields.${field}`)}
                      value={starFields[field]}
                      maxLength={1250}
                      onChange={(event) => updateStarField(field, event.target.value)}
                    />
                  ))}
                </div>
              </>
            ) : (
              <Textarea
                ref={textareaRef}
                label={t('interview.answerLabel')}
                value={answerText}
                maxLength={5000}
                onChange={(event) => setAnswerText(event.target.value, isVoice
                  ? { source: 'text', voiceMetrics: null }
                  : undefined)}
                onKeyDown={submitFromKeyboard}
                hint={t('interview.answerCount', { words: wordCount(answerText), characters: answerText.length, limit: 5000 })}
              />
            )}
            {interview.practiceDrill === 'filler' && (
              <p role="status" className="mt-3 rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800">
                {t('practice.fillerCount', { count: fillerCount })}
              </p>
            )}
            <Button
              className="mt-2"
              size="sm"
              variant="ghost"
              disabled={!answerText}
              onClick={() => {
                if (interview.practiceDrill === 'star') {
                  const emptyFields = Object.fromEntries(STAR_FIELD_ORDER.map((field) => [field, '']));
                  setStarFields(emptyFields);
                  setAnswerText('');
                } else {
                  setAnswerText('', isVoice ? { source: 'text', voiceMetrics: null } : undefined);
                }
              }}
            >
              {t('interview.clearAnswer')}
            </Button>
          </div>

          <div className="mt-6 flex flex-wrap justify-between gap-3 border-t border-slate-200 pt-5 dark:border-slate-700">
            <div className="flex flex-wrap gap-2">
              {isPractice && !isStrict && (
                <Button variant="secondary" disabled={currentIndex === 0} onClick={() => { void previous(); }}>
                  <ArrowLeft aria-hidden="true" className="h-4 w-4" />{t('interview.previous')}
                </Button>
              )}
              <Button variant="secondary" disabled={isStrict} onClick={() => { void skipCurrent().catch(() => undefined); }}>
                <SkipForward aria-hidden="true" className="h-4 w-4" />{t('interview.skip')}
              </Button>
            </div>
            <Button disabled={interview.status !== 'in_progress'} onClick={() => { void submitAndNext().catch(() => undefined); }}>
              <Send aria-hidden="true" className="h-4 w-4" />{t(isLastQuestion ? 'interview.submitAndFinish' : 'interview.submitAndNext')}
            </Button>
          </div>
          {interview.style === 'friendly' && <p className="mt-4 text-sm text-success">{t('interview.encouragement')}</p>}
        </Card>
      )}

      <Modal
        open={showMicrophoneHelp}
        onClose={() => setShowMicrophoneHelp(false)}
        title={t('interview.microphoneHelpTitle')}
        description={t('interview.microphoneHelp')}
        closeLabel={t('common.close')}
      >
        <p className="text-sm">{t('interview.microphonePrivacyDetails')}</p>
        <div className="mt-5 flex justify-end">
          <Button onClick={() => setShowMicrophoneHelp(false)}>{t('common.close')}</Button>
        </div>
      </Modal>

      <Modal
        open={finishConfirmation}
        onClose={() => setFinishConfirmation(false)}
        title={t('interview.finishConfirmTitle')}
        description={t('interview.finishConfirmDescription')}
      >
        <p className="text-sm">{t('interview.finishCounts', { answered: answeredCount, skipped: skippedCount, remaining: Math.max(0, questions.length - answeredCount - skippedCount) })}</p>
        <div className="mt-5 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setFinishConfirmation(false)}>{t('common.cancel')}</Button>
          <Button onClick={() => { void confirmFinish().catch(() => undefined); }}>{t('interview.confirmFinish')}</Button>
        </div>
      </Modal>

      <Modal
        open={blocker.state === 'blocked'}
        onClose={() => blocker.reset?.()}
        title={t('interview.leaveTitle')}
        description={t('interview.leaveDescription')}
      >
        <div className="mt-5 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => blocker.reset?.()}>{t('interview.stay')}</Button>
          <Button onClick={() => blocker.proceed?.()}>{t('interview.leave')}</Button>
        </div>
      </Modal>
    </main>
  );
}

export default function InterviewPage() {
  const { id } = useParams();
  return (
    <InterviewProvider key={id}>
      <InterviewSession />
    </InterviewProvider>
  );
}
