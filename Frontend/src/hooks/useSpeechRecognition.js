import { useCallback, useEffect, useRef, useState } from 'react';
import { getSpeechRecognitionConstructor, isOnline, speechLanguage, supportsSpeechRecognition } from '../utils/speechCapabilities';
import { calculateVoiceMetrics } from '../utils/voiceMetrics';

const MAX_SILENCE_RESTARTS = 3;

const SPEECH_ERRORS = {
  'not-allowed': 'notAllowed',
  'service-not-allowed': 'notAllowed',
  'no-speech': 'noSpeech',
  network: 'network',
  'audio-capture': 'audioCapture',
  'language-not-supported': 'languageNotSupported',
  aborted: 'aborted',
};

function elapsedDuration(totalMilliseconds, segmentStartedAt, now) {
  const currentSegment = segmentStartedAt ? Math.max(0, now - segmentStartedAt) : 0;
  return (totalMilliseconds + currentSegment) / 1000;
}

export function mapSpeechRecognitionError(error) {
  return SPEECH_ERRORS[error] || 'unknown';
}

export function useSpeechRecognition({
  language = 'en',
  englishLocale = 'en-IN',
  sessionKey = '',
  initialTranscript = '',
  initialMetrics = null,
} = {}) {
  const recognitionRef = useRef(null);
  const shouldListenRef = useRef(false);
  const restartCountRef = useRef(0);
  const finalTranscriptRef = useRef('');
  const transcriptRef = useRef('');
  const startedAtRef = useRef(null);
  const segmentStartedAtRef = useRef(null);
  const totalDurationMsRef = useRef(0);
  const timestampsRef = useRef([]);
  const initialTranscriptRef = useRef(initialTranscript);
  const initialMetricsRef = useRef(initialMetrics);
  const [transcript, setTranscriptState] = useState(initialTranscript);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState(null);
  const [voiceMetrics, setVoiceMetrics] = useState(null);
  const supported = supportsSpeechRecognition();

  initialTranscriptRef.current = initialTranscript;
  initialMetricsRef.current = initialMetrics;

  const refreshMetrics = useCallback((at = Date.now()) => {
    const duration = elapsedDuration(totalDurationMsRef.current, segmentStartedAtRef.current, at);
    const metrics = calculateVoiceMetrics(transcriptRef.current, {
      startedAt: startedAtRef.current ? new Date(startedAtRef.current).toISOString() : null,
      endedAt: new Date(at).toISOString(),
      timestamps: timestampsRef.current,
      speakingDurationSeconds: duration,
    });
    setVoiceMetrics(metrics);
    return metrics;
  }, []);

  const setTranscript = useCallback((value, metrics = null) => {
    const text = String(value || '');
    finalTranscriptRef.current = text;
    transcriptRef.current = text;
    setTranscriptState(text);
    if (metrics) {
      startedAtRef.current = Number.isFinite(Date.parse(metrics.startedAt)) ? Date.parse(metrics.startedAt) : null;
      segmentStartedAtRef.current = null;
      totalDurationMsRef.current = Math.max(0, Number(metrics.speakingDurationSeconds) || 0) * 1000;
      timestampsRef.current = Array.isArray(metrics.speechTimestamps) ? [...metrics.speechTimestamps] : [];
      setVoiceMetrics(metrics);
    } else {
      refreshMetrics();
    }
  }, [refreshMetrics]);

  const start = useCallback(() => {
    if (!supported) {
      setError('unsupported');
      return false;
    }
    if (!isOnline()) {
      setError('network');
      return false;
    }
    setError(null);
    restartCountRef.current = 0;
    shouldListenRef.current = true;
    const now = Date.now();
    startedAtRef.current ||= now;
    segmentStartedAtRef.current = now;
    if (!recognitionRef.current) {
      const Recognition = getSpeechRecognitionConstructor();
      const recognition = new Recognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = speechLanguage(language, englishLocale);
      recognition.onstart = () => setListening(true);
      recognition.onresult = (event) => {
        let interim = '';
        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          const result = event.results[index];
          const phrase = result[0]?.transcript?.trim() || '';
          if (result.isFinal && phrase) {
            finalTranscriptRef.current = `${finalTranscriptRef.current} ${phrase}`.trim();
            timestampsRef.current.push(Date.now());
          } else {
            interim = `${interim} ${phrase}`.trim();
          }
        }
        const nextTranscript = `${finalTranscriptRef.current} ${interim}`.trim();
        transcriptRef.current = nextTranscript;
        setTranscriptState(nextTranscript);
        restartCountRef.current = 0;
        setError(null);
        refreshMetrics();
      };
      recognition.onerror = (event) => {
        const mapped = mapSpeechRecognitionError(event.error);
        setError(mapped);
        if (mapped !== 'noSpeech' && mapped !== 'aborted') {
          shouldListenRef.current = false;
          setListening(false);
          if (segmentStartedAtRef.current) {
            totalDurationMsRef.current += Date.now() - segmentStartedAtRef.current;
            segmentStartedAtRef.current = null;
          }
          refreshMetrics();
        }
      };
      recognition.onend = () => {
        if (shouldListenRef.current && restartCountRef.current < MAX_SILENCE_RESTARTS) {
          restartCountRef.current += 1;
          window.setTimeout(() => {
            if (!shouldListenRef.current) return;
            try {
              recognition.start();
              segmentStartedAtRef.current = Date.now();
            } catch {
              shouldListenRef.current = false;
              setListening(false);
            }
          }, 200);
          return;
        }
        if (shouldListenRef.current) {
          shouldListenRef.current = false;
          setError('noSpeech');
        }
        setListening(false);
        if (segmentStartedAtRef.current) {
          totalDurationMsRef.current += Date.now() - segmentStartedAtRef.current;
          segmentStartedAtRef.current = null;
        }
        refreshMetrics();
      };
      recognitionRef.current = recognition;
    } else {
      recognitionRef.current.lang = speechLanguage(language, englishLocale);
    }
    try {
      recognitionRef.current.start();
      return true;
    } catch (startError) {
      shouldListenRef.current = false;
      setListening(false);
      setError(mapSpeechRecognitionError(startError?.name === 'NotAllowedError' ? 'not-allowed' : startError?.name));
      return false;
    }
  }, [englishLocale, language, refreshMetrics, supported]);

  const stop = useCallback(() => {
    shouldListenRef.current = false;
    restartCountRef.current = 0;
    const now = Date.now();
    if (segmentStartedAtRef.current) {
      totalDurationMsRef.current += Math.max(0, now - segmentStartedAtRef.current);
      segmentStartedAtRef.current = null;
    }
    setListening(false);
    try {
      recognitionRef.current?.stop();
    } catch (stopError) {
      if (stopError?.name !== 'InvalidStateError') setError('unknown');
    }
    const metrics = refreshMetrics(now);
    return { transcript: transcriptRef.current, voiceMetrics: metrics };
  }, [refreshMetrics]);

  const reset = useCallback(() => {
    shouldListenRef.current = false;
    try {
      recognitionRef.current?.abort();
    } catch {
      setError('unknown');
    }
    segmentStartedAtRef.current = null;
    startedAtRef.current = null;
    totalDurationMsRef.current = 0;
    timestampsRef.current = [];
    finalTranscriptRef.current = '';
    transcriptRef.current = '';
    restartCountRef.current = 0;
    setTranscriptState('');
    setListening(false);
    setError(null);
    setVoiceMetrics(null);
  }, []);

  useEffect(() => {
    shouldListenRef.current = false;
    try {
      recognitionRef.current?.abort();
    } catch {
      setError('unknown');
    }
    segmentStartedAtRef.current = null;
    startedAtRef.current = null;
    totalDurationMsRef.current = 0;
    timestampsRef.current = [];
    finalTranscriptRef.current = initialTranscriptRef.current || '';
    transcriptRef.current = finalTranscriptRef.current;
    setTranscriptState(finalTranscriptRef.current);
    setListening(false);
    setError(null);
    const restoredMetrics = initialMetricsRef.current;
    if (restoredMetrics) {
      startedAtRef.current = Number.isFinite(Date.parse(restoredMetrics.startedAt)) ? Date.parse(restoredMetrics.startedAt) : null;
      totalDurationMsRef.current = Math.max(0, Number(restoredMetrics.speakingDurationSeconds) || 0) * 1000;
      timestampsRef.current = Array.isArray(restoredMetrics.speechTimestamps) ? [...restoredMetrics.speechTimestamps] : [];
      setVoiceMetrics(restoredMetrics);
    } else {
      setVoiceMetrics(null);
    }
  }, [sessionKey]);

  useEffect(() => () => {
    shouldListenRef.current = false;
    try {
      recognitionRef.current?.abort();
    } catch {
      return;
    }
  }, []);

  return {
    supported,
    listening,
    transcript,
    error,
    voiceMetrics,
    start,
    stop,
    reset,
    setTranscript,
  };
}
