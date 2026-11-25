import { useCallback, useEffect, useRef, useState } from 'react';
import { speechLanguage, supportsSpeechSynthesis } from '../utils/speechCapabilities';

function voiceForLanguage(voices, language, englishLocale) {
  const preferred = speechLanguage(language, englishLocale).toLowerCase();
  const exact = voices.find((voice) => voice.lang?.toLowerCase() === preferred);
  if (exact) return exact;
  if (language === 'te' || language === 'hi') return null;
  return voices.find((voice) => voice.lang?.toLowerCase().startsWith('en-in'))
    || voices.find((voice) => voice.lang?.toLowerCase().startsWith('en-us'))
    || voices.find((voice) => voice.lang?.toLowerCase().startsWith('en-'))
    || null;
}

export function useSpeechSynthesis({ language = 'en', englishLocale = 'en-IN', rate = 1 } = {}) {
  const utteranceRef = useRef(null);
  const settleRef = useRef(null);
  const [voices, setVoices] = useState([]);
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState(null);
  const supported = supportsSpeechSynthesis();
  const selectedVoice = voiceForLanguage(voices, language, englishLocale);

  useEffect(() => {
    if (!supported) return undefined;
    const synthesis = window.speechSynthesis;
    const updateVoices = () => setVoices(synthesis.getVoices());
    updateVoices();
    synthesis.addEventListener?.('voiceschanged', updateVoices);
    return () => synthesis.removeEventListener?.('voiceschanged', updateVoices);
  }, [supported]);

  const cancel = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    utteranceRef.current = null;
    settleRef.current?.(false);
    settleRef.current = null;
    setSpeaking(false);
  }, [supported]);

  const speak = useCallback((text) => {
    if (!supported) {
      setError('synthesisUnsupported');
      return Promise.resolve(false);
    }
    if (!selectedVoice) {
      setError('voiceUnavailable');
      setSpeaking(false);
      return Promise.resolve(false);
    }
    cancel();
    setError(null);
    const utterance = new window.SpeechSynthesisUtterance(String(text || ''));
    utterance.lang = speechLanguage(language, englishLocale);
    utterance.voice = selectedVoice;
    utterance.rate = Math.min(1.5, Math.max(0.7, Number(rate) || 1));
    utterance.onend = () => {
      utteranceRef.current = null;
      settleRef.current?.(true);
      settleRef.current = null;
      setSpeaking(false);
    };
    utterance.onerror = (event) => {
      utteranceRef.current = null;
      settleRef.current?.(false);
      settleRef.current = null;
      setSpeaking(false);
      setError(event.error === 'canceled' ? null : 'synthesis');
    };
    utteranceRef.current = utterance;
    setSpeaking(true);
    return new Promise((resolve) => {
      settleRef.current = resolve;
      window.speechSynthesis.speak(utterance);
    });
  }, [cancel, englishLocale, language, rate, selectedVoice, supported]);

  const pause = useCallback(() => {
    if (supported) window.speechSynthesis.pause();
  }, [supported]);

  const resume = useCallback(() => {
    if (supported) window.speechSynthesis.resume();
  }, [supported]);

  useEffect(() => () => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    settleRef.current?.(false);
    settleRef.current = null;
  }, [supported]);

  return {
    supported,
    speaking,
    error,
    voiceAvailable: Boolean(selectedVoice),
    speak,
    cancel,
    pause,
    resume,
  };
}
