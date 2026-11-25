const FILLERS = ['um', 'uh', 'like', 'actually', 'basically', 'you know', 'so'];
const PAUSE_THRESHOLD_SECONDS = 1.5;

function countPhrase(text, phrase) {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  return (text.match(new RegExp(`\\b${escaped}\\b`, 'gi')) || []).length;
}

export function countFillerWords(transcript) {
  const text = String(transcript || '');
  return FILLERS.reduce((total, phrase) => total + countPhrase(text, phrase), 0);
}

export function calculateVoiceMetrics(transcript, {
  startedAt = null,
  endedAt = null,
  timestamps = [],
  speakingDurationSeconds,
} = {}) {
  const text = String(transcript || '').trim();
  const words = text.match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu) || [];
  const duration = Number.isFinite(Number(speakingDurationSeconds))
    ? Math.max(0, Number(speakingDurationSeconds))
    : Number.isFinite(Date.parse(startedAt)) && Number.isFinite(Date.parse(endedAt))
      ? Math.max(0, (Date.parse(endedAt) - Date.parse(startedAt)) / 1000)
      : 0;
  const fillerWords = Object.fromEntries(FILLERS.map((phrase) => [phrase, countPhrase(text, phrase)]));
  const orderedTimes = [...new Set(timestamps.map(Number).filter(Number.isFinite))].sort((left, right) => left - right);
  const pauseDurations = orderedTimes.slice(1).map((value, index) => (value - orderedTimes[index]) / 1000)
    .filter((seconds) => seconds >= PAUSE_THRESHOLD_SECONDS);

  return {
    wordCount: words.length,
    speakingDurationSeconds: Math.round(duration * 10) / 10,
    wordsPerMinute: duration > 0 ? Math.round((words.length / duration) * 60) : 0,
    fillerWords,
    fillerCount: Object.values(fillerWords).reduce((total, count) => total + count, 0),
    pauseCount: pauseDurations.length,
    longestPauseSeconds: pauseDurations.length ? Math.round(Math.max(...pauseDurations) * 10) / 10 : 0,
    ...(startedAt ? { startedAt } : {}),
    ...(endedAt ? { endedAt } : {}),
    speechTimestamps: orderedTimes,
  };
}
