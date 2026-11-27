import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { CheckCircle2, CircleAlert, Mic, Volume2 } from 'lucide-react';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { ErrorState } from '../components/ui/ErrorState';
import { ProgressBar } from '../components/ui/ProgressBar';
import { Skeleton } from '../components/ui/Skeleton';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useTranslation } from '../context/LanguageContext';
import { interviewsApi } from '../services/api/interviewsApi';
import { getInterviewSnapshot } from '../services/offline/localInterviewStore';
import { ROUTES } from '../config/routes';
import { getSpeechCapabilities } from '../utils/speechCapabilities';

function ReadinessItem({ ready, label }) {
  const Icon = ready ? CheckCircle2 : CircleAlert;
  return (
    <li className="flex items-center gap-2">
      <Icon aria-hidden="true" className={`h-5 w-5 ${ready ? 'text-success' : 'text-warning'}`} />
      <span>{label}</span>
    </li>
  );
}

export default function InterviewReadinessPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const online = useOnlineStatus();
  const [interview, setInterview] = useState(location.state?.interview || null);
  const [loading, setLoading] = useState(!location.state?.interview);
  const [loadError, setLoadError] = useState(null);
  const [storageError, setStorageError] = useState(location.state?.storageError || null);
  const [startError, setStartError] = useState(null);
  const [starting, setStarting] = useState(false);
  const [started, setStarted] = useState(location.state?.interview?.status === 'in_progress');
  const [micStatus, setMicStatus] = useState('idle');
  const [micLevel, setMicLevel] = useState(0);
  const [micError, setMicError] = useState(null);
  const streamRef = useRef(null);
  const audioContextRef = useRef(null);
  const animationRef = useRef(null);

  const loadInterview = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    setStorageError(null);
    try {
      const saved = await interviewsApi.get(id);
      let snapshot = null;
      try {
        snapshot = await getInterviewSnapshot(id);
      } catch (error) {
        setStorageError(error);
      }
      const restored = {
        ...saved,
        ...(snapshot?.interview?.practiceDrill ? { practiceDrill: snapshot.interview.practiceDrill } : {}),
      };
      setInterview(restored);
      setStarted(restored.status === 'in_progress');
    } catch (error) {
      setLoadError(error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (!interview || interview.id !== id) void loadInterview();
  }, [id, interview, loadInterview]);

  const stopMicrophone = useCallback(() => {
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    animationRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      void audioContextRef.current.close();
    }
    audioContextRef.current = null;
    setMicLevel(0);
  }, []);

  useEffect(() => () => stopMicrophone(), [stopMicrophone]);

  const testMicrophone = async () => {
    setMicStatus('requesting');
    setMicError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const AudioContextType = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextType) throw new Error(t('readiness.audioMeterUnsupported'));
      const audioContext = new AudioContextType();
      audioContextRef.current = audioContext;
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      audioContext.createMediaStreamSource(stream).connect(analyser);
      const samples = new Uint8Array(analyser.frequencyBinCount);
      const measureLevel = () => {
        analyser.getByteTimeDomainData(samples);
        const average = samples.reduce((sum, sample) => sum + Math.abs(sample - 128), 0) / samples.length;
        setMicLevel(Math.min(100, Math.round(average * 2.5)));
        animationRef.current = requestAnimationFrame(measureLevel);
      };
      measureLevel();
      setMicStatus('ready');
    } catch (error) {
      stopMicrophone();
      setMicStatus('denied');
      setMicError(error);
    }
  };

  const testSpeaker = () => {
    if (!speechCapabilities.synthesis) return;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new window.SpeechSynthesisUtterance(t('readiness.speakerTestPhrase')));
  };

  const beginInterview = async () => {
    setStarting(true);
    setStartError(null);
    try {
      const result = await interviewsApi.start(id);
      const updated = {
        ...result,
        ...(interview.practiceDrill ? { practiceDrill: interview.practiceDrill } : {}),
      };
      setInterview(updated);
      setStarted(true);
      stopMicrophone();
      navigate(`/interview/${encodeURIComponent(id)}`, {
        state: { interview: updated, enterInterview: true },
      });
    } catch (error) {
      setStartError(error);
    } finally {
      setStarting(false);
    }
  };

  if (loading) {
    return <main className="mx-auto max-w-3xl"><Skeleton className="h-10 w-2/3" /><Skeleton className="mt-4 h-40 w-full" /></main>;
  }
  if (loadError) {
    return <main className="mx-auto max-w-3xl"><ErrorState title={t('readiness.loadErrorTitle')} message={loadError.message} retryLabel={t('common.retry')} onRetry={() => { void loadInterview(); }} /></main>;
  }
  if (!interview) {
    return <main className="mx-auto max-w-3xl"><ErrorState title={t('readiness.loadErrorTitle')} message={t('readiness.notFound')} /></main>;
  }

  const questionsLoaded = Array.isArray(interview.questions) && interview.questions.length > 0;
  const isVoice = interview.mode === 'voice';
  const speechCapabilities = getSpeechCapabilities();
  const speechSupported = speechCapabilities.recognition;
  const microphoneApiSupported = speechCapabilities.microphone;
  const audioMeterSupported = typeof window !== 'undefined' && Boolean(window.AudioContext || window.webkitAudioContext);
  const canBegin = questionsLoaded && (!isVoice
    || (online && speechCapabilities.voice && audioMeterSupported && micStatus === 'ready'));

  if (started) {
    return (
      <main className="mx-auto max-w-3xl">
        <Card>
          <div className="flex items-center gap-3">
            <CheckCircle2 aria-hidden="true" className="h-8 w-8 text-success" />
            <div>
              <h1 className="text-2xl font-bold">{t('readiness.startedTitle')}</h1>
              <p className="mt-1 text-muted dark:text-muted-dark">{t('readiness.startedDescription')}</p>
            </div>
          </div>
          <InterviewSummary interview={interview} t={t} />
          <Button className="mt-5" onClick={() => navigate(`/interview/${encodeURIComponent(id)}`, {
            state: { interview, enterInterview: true },
          })}>
            {t('readiness.continueInterview')}
          </Button>
          <Link to={ROUTES.DASHBOARD} className="mt-6 inline-flex min-h-touch items-center rounded-lg bg-primary px-4 text-sm font-medium text-white hover:bg-primary-dark">
            {t('readiness.dashboard')}
          </Link>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl">
      <header className="mb-6">
        <p className="text-sm font-semibold text-primary">{t('readiness.eyebrow')}</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950 dark:text-white">{t('readiness.title')}</h1>
        <p className="mt-2 text-muted dark:text-muted-dark">{t('readiness.description')}</p>
      </header>
      <Card>
        <InterviewSummary interview={interview} t={t} />
        {storageError && <p role="status" className="mt-4 text-sm text-warning">{t('readiness.storageWarning')} {storageError.message}</p>}
        <ul className="mt-6 space-y-3">
          <ReadinessItem ready={online} label={online ? t('readiness.online') : t('readiness.offline')} />
          <ReadinessItem ready={questionsLoaded} label={questionsLoaded ? t('readiness.questionsReady', { count: interview.questions.length }) : t('readiness.questionsMissing')} />
          {isVoice && (
            <>
              <ReadinessItem ready={speechSupported} label={t('readiness.speechSupport')} />
              <ReadinessItem ready={speechCapabilities.synthesis} label={t('readiness.synthesisSupport')} />
              {!online && <ReadinessItem ready={false} label={t('readiness.voiceNeedsInternet')} />}
              {!speechCapabilities.synthesis && <ReadinessItem ready={false} label={t('readiness.speakerUnsupported')} />}
              <ReadinessItem ready={micStatus === 'ready'} label={micStatus === 'ready' ? t('readiness.microphoneReady') : t('readiness.microphoneRequired')} />
            </>
          )}
        </ul>

        {isVoice && (
          <section aria-labelledby="readiness-microphone" className="mt-7 border-t border-slate-200 pt-5 dark:border-slate-700">
            <h2 id="readiness-microphone" className="text-lg font-semibold">{t('readiness.voiceChecks')}</h2>
            <div className="mt-4 flex flex-wrap gap-3">
              <Button
                variant="secondary"
                disabled={!microphoneApiSupported || !audioMeterSupported}
                title={!microphoneApiSupported || !audioMeterSupported ? t('readiness.microphoneUnsupported') : undefined}
                loading={micStatus === 'requesting'}
                onClick={testMicrophone}
              >
                <Mic aria-hidden="true" className="h-4 w-4" />{micStatus === 'ready' ? t('readiness.testMicrophoneAgain') : t('readiness.testMicrophone')}
              </Button>
              <Button
                variant="secondary"
                disabled={!speechCapabilities.synthesis}
                title={!speechCapabilities.synthesis ? t('readiness.speakerUnsupported') : undefined}
                onClick={testSpeaker}
              >
                <Volume2 aria-hidden="true" className="h-4 w-4" />{t('readiness.testSpeaker')}
              </Button>
              {micStatus === 'ready' && <Button variant="ghost" onClick={() => { stopMicrophone(); setMicStatus('idle'); }}>{t('readiness.stopMicrophone')}</Button>}
            </div>
            {micStatus === 'ready' && <ProgressBar value={micLevel} label={t('readiness.microphoneLevel')} className="mt-4" />}
            {micStatus === 'denied' && (
              <div role="alert" className="mt-4 rounded-lg border border-danger/30 bg-danger-light p-4 text-sm text-danger">
                <p className="font-semibold">{t('readiness.microphoneDenied')}</p>
                <p className="mt-1">{micError?.message || t('readiness.microphoneHelp')}</p>
                <p className="mt-2">{t('readiness.microphoneHelp')}</p>
              </div>
            )}
            {(!microphoneApiSupported || !audioMeterSupported) && (
              <p role="status" className="mt-4 text-sm text-warning">{t('readiness.microphoneUnsupported')}</p>
            )}
          </section>
        )}

        {isVoice && !online && <p role="status" className="mt-5 text-sm text-warning">{t('readiness.voiceNeedsInternet')}</p>}
        {isVoice && !speechSupported && <p role="status" className="mt-5 text-sm text-warning">{t('readiness.speechUnsupported')}</p>}
        {isVoice && !speechCapabilities.synthesis && <p role="status" className="mt-5 text-sm text-warning">{t('readiness.speakerUnsupported')}</p>}
        {startError && <p role="alert" className="mt-5 text-sm text-danger">{startError.message}</p>}
        <div className="mt-7 flex flex-wrap justify-between gap-3 border-t border-slate-200 pt-5 dark:border-slate-700">
          <Button variant="secondary" onClick={() => navigate(ROUTES.INTERVIEW_SETUP, { state: { setup: interview } })}>{t('readiness.editSetup')}</Button>
          {isVoice && !canBegin && (
            <Button variant="secondary" onClick={() => navigate(ROUTES.INTERVIEW_SETUP, {
              state: { setup: { ...interview, mode: 'text' } },
            })}>
              {t('readiness.useTextMode')}
            </Button>
          )}
          <Button disabled={!canBegin} loading={starting} onClick={() => { void beginInterview(); }}>
            {t('readiness.beginInterview')}
          </Button>
        </div>
      </Card>
    </main>
  );
}

function InterviewSummary({ interview, t }) {
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <Badge tone="primary">{t(`questionBank.categories.${interview.category}`)}</Badge>
        {interview.jobRole && <Badge>{interview.jobRole}</Badge>}
        <Badge>{t(`questionBank.difficulties.${interview.difficulty}`)}</Badge>
      </div>
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div><dt className="text-muted dark:text-muted-dark">{t('interviewSetup.summaryDuration')}</dt><dd className="font-medium">{t('interviewSetup.minutes', { count: interview.duration })}</dd></div>
        <div><dt className="text-muted dark:text-muted-dark">{t('interviewSetup.summaryCount')}</dt><dd className="font-medium">{interview.questions?.length || interview.questionCount}</dd></div>
        <div><dt className="text-muted dark:text-muted-dark">{t('interviewSetup.summaryMode')}</dt><dd className="font-medium">{t(`interviewSetup.${interview.mode}Mode`)}</dd></div>
        <div><dt className="text-muted dark:text-muted-dark">{t('interviewSetup.summaryLanguage')}</dt><dd className="font-medium">{t(`questionBank.languages.${interview.language}`)}</dd></div>
      </dl>
    </div>
  );
}
