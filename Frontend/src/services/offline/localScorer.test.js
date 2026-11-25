import { describe, expect, it } from 'vitest';
import { aggregateInterview, evaluateAnswer } from './localScorer';

const question = {
  questionId: 'cache-1',
  text: 'Why use a cache between an application and its database?',
  category: 'technical',
  difficulty: 'beginner',
  language: 'en',
  expectedAnswer: 'Caching keeps frequently requested data close to the application, reducing repeated database work and latency.',
  keywords: ['caching', 'database', 'latency'],
};

const strongAnswer = [
  'We added caching because the same product data was requested repeatedly. First, the service checked the cache and returned fresh values without asking the database each time.',
  'As a result, database load and response latency fell. We also set a short expiration and invalidated entries after updates, so users did not receive stale information.',
].join(' ');

describe('local rule-based scorer', () => {
  it('is deterministic and scores a detailed answer above a vague answer', () => {
    const first = evaluateAnswer(question, strongAnswer);
    const repeated = evaluateAnswer(question, strongAnswer);
    const vague = evaluateAnswer(question, 'Caching is useful.');

    expect(repeated).toEqual(first);
    expect(first.method).toBe('local-rule-based-v1');
    expect(first.score).toBeGreaterThanOrEqual(75);
    expect(first.score).toBeLessThanOrEqual(100);
    expect(vague.score).toBeLessThan(first.score);
    expect(vague.score).toBeGreaterThanOrEqual(0);
    expect(vague.score).toBeLessThanOrEqual(60);
  });

  it('returns zero for empty and skipped answers', () => {
    expect(evaluateAnswer(question, '').score).toBe(0);
    expect(evaluateAnswer(question, 'A response', { status: 'skipped' }).score).toBe(0);
  });

  it('penalizes too-short responses, fillers, and out-of-range speaking pace', () => {
    const concise = evaluateAnswer(question, 'Caching reduces database latency.');
    const detailed = evaluateAnswer(question, strongAnswer);
    const clean = evaluateAnswer(question, strongAnswer, { voiceMetrics: { wordsPerMinute: 140 } });
    const fillerHeavy = evaluateAnswer(question, `Um, uh, like, ${strongAnswer}`, { voiceMetrics: { wordsPerMinute: 220 } });

    expect(detailed.breakdown.completeness).toBeGreaterThan(concise.breakdown.completeness);
    expect(clean.communicationScore).toBeGreaterThan(fillerHeavy.communicationScore);
    expect(fillerHeavy.breakdown.fillerCount).toBeGreaterThan(0);
    expect(clean.breakdown.wordsPerMinute).toBe(140);
  });

  it('scores STAR structure for behavioral categories and documents non-English matching', () => {
    const behavioralQuestion = { ...question, category: 'hr', language: 'en' };
    const starAnswer = 'Situation: the release was late. Task: I owned the launch. Action: I reorganized the work. Result: we shipped safely.';
    const plainAnswer = 'The release was late and I helped the team ship it safely.';
    const teluguResult = evaluateAnswer({ ...question, language: 'te' }, 'క్యాష్ డేటాబేస్ వేగం', { language: 'te' });

    expect(evaluateAnswer(behavioralQuestion, starAnswer).breakdown.clarity)
      .toBeGreaterThan(evaluateAnswer(behavioralQuestion, plainAnswer).breakdown.clarity);
    expect(teluguResult.explanation).toContain('exact token matching');
  });

  it('aggregates skipped responses as zero into the local report', () => {
    const result = aggregateInterview([
      { questionIndex: 0, status: 'answered', evaluation: { score: 80, contentScore: 70, communicationScore: 90 } },
      { questionIndex: 1, status: 'skipped', evaluation: { score: 0, contentScore: 0, communicationScore: 0 } },
    ], { id: 'local-1', jobRole: 'Engineer' });

    expect(result.totalScore).toBe(40);
    expect(result.report).toMatchObject({
      interviewId: 'local-1',
      method: 'local-rule-based-v1',
      scores: { total: 40, content: 35, communication: 45 },
    });
  });
});
