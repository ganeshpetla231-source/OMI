import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { answersApi } from '../services/api/answersApi';
import { interviewsApi } from '../services/api/interviewsApi';
import { getInterviewIdMapping, getInterviewSnapshot, saveInterviewSnapshot } from '../services/offline/localInterviewStore';
import { recordDailyPracticeCompletion } from '../services/offline/dailyPractice';

const InterviewContext = createContext(null);

function answerMapFrom(items = []) {
  return Object.fromEntries(items.map((answer) => [String(answer.questionIndex), answer]));
}

function mergeAnswers(localAnswers = {}, remoteAnswers = {}) {
  const merged = { ...remoteAnswers };
  Object.entries(localAnswers).forEach(([index, localAnswer]) => {
    const remoteAnswer = merged[index];
    const localDate = Date.parse(localAnswer.updatedAt || localAnswer.savedAt || 0);
    const remoteDate = Date.parse(remoteAnswer?.updatedAt || 0);
    if (!remoteAnswer || !Number.isFinite(remoteDate) || localDate >= remoteDate) merged[index] = localAnswer;
  });
  return merged;
}

function elapsedAt(interview, now) {
  const base = Math.max(0, Number(interview?.elapsedSeconds) || 0);
  if (interview?.status !== 'in_progress') return base;
  const anchor = Date.parse(interview.lastResumedAt || interview.startedAt || '');
  if (!Number.isFinite(anchor)) return base;
  return base + Math.max(0, Math.floor((now - anchor) / 1000));
}

function questionElapsedAt(status, anchorValue, accumulatedSeconds, now) {
  const base = Math.max(0, Number(accumulatedSeconds) || 0);
  if (status !== 'in_progress' || !anchorValue) return base;
  const anchor = Date.parse(anchorValue);
  if (!Number.isFinite(anchor)) return base;
  return base + Math.max(0, Math.floor((now - anchor) / 1000));
}

function errorFromStorage(error) {
  return error instanceof Error ? error : new Error('Could not save your interview on this device.');
}

export function InterviewProvider({ children }) {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const providedInterview = location.state?.interview;
  const [interview, setInterview] = useState(null);
  const [answers, setAnswers] = useState({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [questionElapsedSeconds, setQuestionElapsedSeconds] = useState(0);
  const [questionStartedAt, setQuestionStartedAt] = useState(null);
  const [clockNow, setClockNow] = useState(Date.now());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [storageError, setStorageError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [evaluationError, setEvaluationError] = useState(null);
  const [dailyStreakError, setDailyStreakError] = useState(null);
  const [evaluations, setEvaluations] = useState([]);
  const [saveStatus, setSaveStatus] = useState('saved');
  const [savedOnDevice, setSavedOnDevice] = useState(false);
  const [entered, setEntered] = useState(Boolean(location.state?.enterInterview));
  const [recovered, setRecovered] = useState(false);
  const activeLoad = useRef(0);
  const readyRef = useRef(false);

  const loadInterview = useCallback(async () => {
    const loadId = ++activeLoad.current;
    readyRef.current = false;
    setLoading(true);
    setLoadError(null);
    setStorageError(null);
    let snapshot = null;
    try {
      const mappedId = await getInterviewIdMapping(id);
      if (mappedId && mappedId !== id) {
        if (activeLoad.current === loadId) navigate(`/interview/${encodeURIComponent(mappedId)}`, { replace: true });
        return;
      }
      snapshot = await getInterviewSnapshot(id);
    } catch (error) {
      setStorageError(errorFromStorage(error));
    }

    let loadedInterview = providedInterview?.id === id ? providedInterview : null;
    if (!loadedInterview) {
      try {
        loadedInterview = await interviewsApi.get(id);
      } catch (error) {
        if (error.code === 'NETWORK_ERROR' && snapshot?.interview) {
          loadedInterview = snapshot.interview;
        } else {
          if (activeLoad.current === loadId) setLoadError(error);
          if (activeLoad.current === loadId) setLoading(false);
          return;
        }
      }
    }

    if (!loadedInterview) {
      setLoadError(new Error('Interview not found.'));
      setLoading(false);
      return;
    }

    let selectedInterview = loadedInterview;
    if (snapshot?.interview?.practiceDrill) {
      selectedInterview = { ...selectedInterview, practiceDrill: snapshot.interview.practiceDrill };
    }
    let selectedIndex = Number(loadedInterview.currentIndex) || 0;
    let selectedAnswers = {};
    let selectedQuestionElapsed = 0;
    let selectedQuestionStartedAt = null;
    let wasRecovered = false;

    if (snapshot?.interview) {
      selectedAnswers = snapshot.answers || {};
      const snapshotTime = Date.parse(snapshot.savedAt || '');
      const interviewTime = Date.parse(loadedInterview.updatedAt || '');
      const snapshotIsNewer = !Number.isFinite(interviewTime)
        || (Number.isFinite(snapshotTime) && snapshotTime >= interviewTime);
      if (snapshot.interview.status !== 'completed' && loadedInterview.status !== 'completed') {
        selectedInterview = {
          ...loadedInterview,
          ...(snapshot.interview.practiceDrill ? { practiceDrill: snapshot.interview.practiceDrill } : {}),
          ...(snapshotIsNewer ? {
            currentIndex: snapshot.currentIndex ?? loadedInterview.currentIndex ?? 0,
            elapsedSeconds: snapshot.elapsedSeconds ?? loadedInterview.elapsedSeconds ?? 0,
          } : {}),
          ...(snapshotIsNewer && snapshot.interview.status ? { status: snapshot.interview.status } : {}),
          ...(snapshotIsNewer && snapshot.interview.status === 'in_progress' && snapshot.savedAt
            ? { lastResumedAt: snapshot.savedAt }
            : {}),
        };
        selectedIndex = Number(selectedInterview.currentIndex) || 0;
        selectedQuestionElapsed = snapshotIsNewer ? Number(snapshot.questionElapsedSeconds) || 0 : 0;
        if (snapshotIsNewer && selectedInterview.status === 'in_progress') {
          selectedQuestionStartedAt = snapshot.savedAt || null;
          wasRecovered = true;
        }
      }
    }

    try {
      const answerResult = await answersApi.list(id);
      selectedAnswers = mergeAnswers(selectedAnswers, answerMapFrom(answerResult.items));
      if (answerResult.offline) setSavedOnDevice(true);
    } catch (error) {
      if (!Object.keys(selectedAnswers).length) setActionError(error);
    }

    if (activeLoad.current !== loadId) return;
    const maxIndex = Math.max(0, (selectedInterview.questions?.length || 1) - 1);
    selectedIndex = Math.min(maxIndex, Math.max(0, selectedIndex));
    setInterview(selectedInterview);
    setAnswers(selectedAnswers);
    setCurrentIndex(selectedIndex);
    setQuestionElapsedSeconds(selectedQuestionElapsed);
    setQuestionStartedAt(selectedQuestionStartedAt || new Date().toISOString());
    setRecovered(wasRecovered);
    setLoading(false);
    setClockNow(Date.now());
    readyRef.current = true;
  }, [id, navigate, providedInterview]);

  useEffect(() => {
    void loadInterview();
    return () => { activeLoad.current += 1; };
  }, [loadInterview]);

  useEffect(() => {
    if (!String(id).startsWith('local_') || interview?.status !== 'completed') return undefined;
    const redirectToServerInterview = async () => {
      const mappedId = await getInterviewIdMapping(id);
      if (mappedId) navigate(`/interview/${encodeURIComponent(mappedId)}`, { replace: true });
    };
    window.addEventListener('talkready:sync-complete', redirectToServerInterview);
    return () => window.removeEventListener('talkready:sync-complete', redirectToServerInterview);
  }, [id, interview?.status, navigate]);

  const elapsedSeconds = useMemo(() => elapsedAt(interview, clockNow), [interview, clockNow]);
  const questionElapsed = useMemo(
    () => questionElapsedAt(interview?.status, questionStartedAt, questionElapsedSeconds, clockNow),
    [interview?.status, questionStartedAt, questionElapsedSeconds, clockNow],
  );
  const currentQuestion = interview?.questions?.[currentIndex] || null;
  const currentAnswer = answers[String(currentIndex)] || null;
  const durationMinutes = Number(interview?.duration ?? interview?.durationMinutes) || 0;
  const overallRemainingSeconds = Math.max(0, durationMinutes * 60 - elapsedSeconds);
  const answeredCount = Object.values(answers).filter((answer) => answer.status === 'answered').length;
  const skippedCount = Object.values(answers).filter((answer) => answer.status === 'skipped').length;
  const progress = interview?.questions?.length
    ? Math.min(100, Math.round(((currentIndex + 1) / interview.questions.length) * 100))
    : 0;

  useEffect(() => {
    const refresh = () => setClockNow(Date.now());
    const timer = window.setInterval(refresh, 1000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);

  const persistSnapshot = useCallback(async ({
    nextInterview = interview,
    nextAnswers = answers,
    nextIndex = currentIndex,
    nextQuestionElapsed = questionElapsed,
  } = {}) => {
    if (!nextInterview) return;
    setSaveStatus('saving');
    try {
      const now = new Date();
      const elapsed = elapsedAt(nextInterview, now.getTime());
      const snapshotInterview = {
        ...nextInterview,
        elapsedSeconds: elapsed,
        ...(nextInterview.status === 'in_progress' ? { lastResumedAt: now.toISOString() } : {}),
      };
      await saveInterviewSnapshot({
        interview: snapshotInterview,
        answers: nextAnswers,
        currentIndex: nextIndex,
        elapsedSeconds: elapsed,
        questionElapsedSeconds: nextQuestionElapsed,
      });
      setStorageError(null);
      setSaveStatus('saved');
    } catch (error) {
      const normalized = errorFromStorage(error);
      setStorageError(normalized);
      setSaveStatus('error');
    }
  }, [answers, currentIndex, interview, questionElapsed]);

  useEffect(() => {
    if (!readyRef.current || !interview || interview.status === 'completed') return undefined;
    const timeout = window.setTimeout(() => { void persistSnapshot(); }, 800);
    return () => window.clearTimeout(timeout);
  }, [answers, currentIndex, elapsedSeconds, interview, persistSnapshot, questionElapsed]);

  const setAnswerText = useCallback((answerText, metadata = {}) => {
    setAnswers((current) => ({
      ...current,
      [String(currentIndex)]: {
        ...(current[String(currentIndex)] || {}),
        interviewId: id,
        questionId: currentQuestion?.questionId || currentQuestion?.id,
        questionIndex: currentIndex,
        answerText,
        status: 'draft',
        source: metadata.source || current[String(currentIndex)]?.source || 'text',
        ...(Object.prototype.hasOwnProperty.call(metadata, 'voiceMetrics')
          ? { voiceMetrics: metadata.voiceMetrics }
          : current[String(currentIndex)]?.voiceMetrics
            ? { voiceMetrics: current[String(currentIndex)].voiceMetrics }
            : {}),
        updatedAt: new Date().toISOString(),
      },
    }));
    setActionError(null);
    setSaveStatus('saving');
  }, [currentIndex, currentQuestion?.questionId, id]);

  const submitAnswer = useCallback(async ({ status = 'answered', answerText, timeTakenSeconds, source, voiceMetrics } = {}) => {
    if (!interview || !currentQuestion) return null;
    const text = answerText ?? currentAnswer?.answerText ?? '';
    const answer = {
      interviewId: id,
      questionId: currentQuestion.questionId || currentQuestion.id,
      questionIndex: currentIndex,
      answerText: status === 'skipped' ? '' : text,
      status,
      source: source || currentAnswer?.source || 'text',
      ...((voiceMetrics ?? currentAnswer?.voiceMetrics)
        ? { voiceMetrics: voiceMetrics ?? currentAnswer?.voiceMetrics }
        : {}),
      timeTakenSeconds: Math.max(0, Number(timeTakenSeconds ?? questionElapsed) || 0),
      updatedAt: new Date().toISOString(),
    };
    const nextAnswers = { ...answers, [String(currentIndex)]: answer };
    setAnswers(nextAnswers);
    setActionError(null);
    await persistSnapshot({ nextAnswers });
    try {
      const result = await answersApi.submit(id, answer);
      if (result.answer) {
        setAnswers((current) => ({ ...current, [String(currentIndex)]: result.answer }));
      }
      setSavedOnDevice(Boolean(result.offline || result.queued));
      return result;
    } catch (error) {
      setActionError(error);
      throw error;
    }
  }, [answers, currentAnswer?.answerText, currentAnswer?.source, currentAnswer?.voiceMetrics, currentIndex, currentQuestion, id, interview, persistSnapshot, questionElapsed]);

  const setQuestionIndex = useCallback(async (nextIndex) => {
    if (!interview?.questions?.length || nextIndex < 0 || nextIndex >= interview.questions.length) return false;
    const now = new Date().toISOString();
    const nextElapsed = nextIndex === currentIndex ? questionElapsed : 0;
    setCurrentIndex(nextIndex);
    setQuestionElapsedSeconds(nextElapsed);
    setQuestionStartedAt(now);
    setActionError(null);
    try {
      const updated = await interviewsApi.update(id, {
        currentIndex: nextIndex,
        elapsedSeconds,
      });
      setInterview((current) => ({ ...current, ...updated, elapsedSeconds, lastResumedAt: now }));
    } catch (error) {
      setActionError(error);
    }
    return true;
  }, [currentIndex, elapsedSeconds, id, interview?.questions?.length, questionElapsed]);

  const next = useCallback(() => setQuestionIndex(currentIndex + 1), [currentIndex, setQuestionIndex]);
  const previous = useCallback(() => setQuestionIndex(currentIndex - 1), [currentIndex, setQuestionIndex]);

  const skip = useCallback(async ({ source = 'text', voiceMetrics } = {}) => {
    if (interview?.style === 'strict') {
      const error = new Error('Skipping is disabled for strict interviews.');
      setActionError(error);
      return false;
    }
    await submitAnswer({ status: 'skipped', source, voiceMetrics });
    return currentIndex < (interview?.questions?.length || 0) - 1 ? next() : false;
  }, [currentIndex, interview?.questions?.length, interview?.style, next, submitAnswer]);

  const start = useCallback(async () => {
    if (!interview) return null;
    setActionError(null);
    try {
      const resumedAt = new Date().toISOString();
      const updated = await interviewsApi.start(id, { elapsedSeconds });
      const nextInterview = {
        ...interview,
        ...updated,
        status: 'in_progress',
        elapsedSeconds,
        lastResumedAt: updated.lastResumedAt || resumedAt,
      };
      setInterview(nextInterview);
      setQuestionStartedAt(resumedAt);
      setClockNow(Date.now());
      setEntered(true);
      return nextInterview;
    } catch (error) {
      setActionError(error);
      throw error;
    }
  }, [elapsedSeconds, id, interview]);

  const pause = useCallback(async ({ answerOverride } = {}) => {
    if (!interview || interview.status !== 'in_progress') return null;
    setActionError(null);
    try {
      if (answerOverride) {
        const index = String(answerOverride.questionIndex ?? currentIndex);
        const nextAnswers = {
          ...answers,
          [index]: {
            ...(answers[index] || {}),
            ...answerOverride,
            questionIndex: Number(index),
            interviewId: id,
            status: 'draft',
          },
        };
        setAnswers(nextAnswers);
        await persistSnapshot({ nextAnswers });
      }
      const updated = await interviewsApi.pause(id, { elapsedSeconds });
      const nextInterview = {
        ...interview,
        ...updated,
        status: 'paused',
        elapsedSeconds,
      };
      setInterview(nextInterview);
      setQuestionElapsedSeconds(questionElapsed);
      setQuestionStartedAt(null);
      setClockNow(Date.now());
      return nextInterview;
    } catch (error) {
      setActionError(error);
      throw error;
    }
  }, [answers, currentIndex, elapsedSeconds, id, interview, persistSnapshot, questionElapsed]);

  const finish = useCallback(async ({ answerOverride } = {}) => {
    if (!interview) return null;
    setActionError(null);
    setEvaluationError(null);
    try {
      const completedAnswers = { ...answers };
      if (answerOverride) {
        const index = String(answerOverride.questionIndex ?? currentIndex);
        completedAnswers[index] = {
          ...(completedAnswers[index] || {}),
          ...answerOverride,
          questionIndex: Number(index),
          interviewId: id,
          status: 'draft',
        };
      }
      for (const [index, draft] of Object.entries(completedAnswers)) {
        if (draft.status !== 'draft') continue;
        const result = await answersApi.submit(id, {
          ...draft,
          interviewId: id,
          questionIndex: Number(index),
          status: 'answered',
          source: draft.source || 'text',
          ...(draft.voiceMetrics ? { voiceMetrics: draft.voiceMetrics } : {}),
          timeTakenSeconds: Number(draft.timeTakenSeconds) || 0,
        });
        completedAnswers[index] = result.answer || { ...draft, status: 'answered' };
        if (result.offline || result.queued) setSavedOnDevice(true);
      }
      setAnswers(completedAnswers);
      const completed = await interviewsApi.complete(id, { elapsedSeconds });
      let nextInterview = { ...interview, ...completed, status: 'completed', elapsedSeconds };
      try {
        const evaluation = await answersApi.evaluate(id);
        setEvaluations(evaluation.items || []);
        if (nextInterview.totalScore == null && Number.isFinite(Number(evaluation.totalScore))) {
          nextInterview = { ...nextInterview, totalScore: Number(evaluation.totalScore) };
        }
      } catch (error) {
        setEvaluationError(error);
      }
      if (
        interview.practiceDrill === 'daily'
        && completedAnswers['0']?.status !== 'skipped'
        && String(completedAnswers['0']?.answerText || '').trim()
      ) {
        try {
          await recordDailyPracticeCompletion(id);
          setDailyStreakError(null);
        } catch (error) {
          setDailyStreakError(error);
        }
      }
      setInterview(nextInterview);
      await persistSnapshot({ nextInterview, nextAnswers: completedAnswers });
      return nextInterview;
    } catch (error) {
      setActionError(error);
      throw error;
    }
  }, [answers, currentIndex, elapsedSeconds, id, interview, persistSnapshot]);

  const enterInterview = useCallback(async () => {
    setEntered(true);
    if (interview?.status === 'paused' || interview?.status === 'draft') return start();
    return interview;
  }, [interview, start]);

  const value = useMemo(() => ({
    id,
    interview,
    questions: interview?.questions || [],
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
    recovered,
    entered,
    requiresResume: !loading && interview?.status === 'in_progress' && !entered,
    elapsedSeconds,
    questionElapsedSeconds: questionElapsed,
    durationMinutes,
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
    retryLoad: loadInterview,
    clearActionError: () => setActionError(null),
  }), [
    actionError,
    answeredCount,
    answers,
    currentAnswer,
    currentIndex,
    currentQuestion,
    durationMinutes,
    elapsedSeconds,
    entered,
    enterInterview,
    evaluationError,
    dailyStreakError,
    evaluations,
    finish,
    id,
    interview,
    loadError,
    loading,
    next,
    overallRemainingSeconds,
    pause,
    previous,
    progress,
    questionElapsed,
    loadInterview,
    recovered,
    savedOnDevice,
    saveStatus,
    setAnswerText,
    skip,
    start,
    storageError,
    submitAnswer,
    skippedCount,
  ]);

  return <InterviewContext.Provider value={value}>{children}</InterviewContext.Provider>;
}

export function useInterview() {
  const context = useContext(InterviewContext);
  if (!context) throw new Error('useInterview must be used within InterviewProvider.');
  return context;
}
