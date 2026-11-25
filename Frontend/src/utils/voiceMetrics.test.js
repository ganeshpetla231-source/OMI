import { describe, expect, it } from 'vitest';
import { calculateVoiceMetrics, countFillerWords } from './voiceMetrics';

describe('calculateVoiceMetrics', () => {
  it('counts filler words in a typed transcript', () => {
    expect(countFillerWords('Um, this is, like, a simple example, you know?')).toBe(3);
  });

  it('calculates transcript pace, filler words, and pauses deterministically', () => {
    const metrics = calculateVoiceMetrics('Um, I like basically solve this. You know?', {
      speakingDurationSeconds: 30,
      timestamps: [1000, 2000, 4000, 10000],
    });

    expect(metrics).toMatchObject({
      wordCount: 8,
      speakingDurationSeconds: 30,
      wordsPerMinute: 16,
      fillerCount: 4,
      pauseCount: 2,
      longestPauseSeconds: 6,
      fillerWords: { um: 1, like: 1, basically: 1, 'you know': 1 },
    });
  });

  it('returns zero pace and no pauses when there is no measurable speaking time', () => {
    expect(calculateVoiceMetrics('A short answer')).toMatchObject({
      wordCount: 3,
      wordsPerMinute: 0,
      pauseCount: 0,
      longestPauseSeconds: 0,
    });
  });
});
