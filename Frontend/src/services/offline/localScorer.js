const ENGLISH_STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'been', 'but', 'by', 'for', 'from', 'has', 'have',
  'i', 'in', 'is', 'it', 'of', 'on', 'or', 'our', 'that', 'the', 'their', 'this', 'to', 'was',
  'we', 'were', 'with', 'you', 'your',
]);
const FILLER_PHRASES = ['you know', 'um', 'uh', 'like', 'actually', 'basically', 'so'];
const CONNECTORS = ['because', 'however', 'therefore', 'first', 'then', 'finally', 'for example', 'as a result'];
const SCORE_WEIGHTS = {
  keywordCoverage: 30,
  relevance: 25,
  completeness: 15,
  clarity: 15,
  communication: 15,
};
const WORD_RANGES = {
  beginner: { minimum: 25, target: 75 },
  intermediate: { minimum: 45, target: 120 },
  advanced: { minimum: 70, target: 180 },
};

function stem(token) {
  if (token.length > 5 && token.endsWith('ing')) return token.slice(0, -3);
  if (token.length > 4 && token.endsWith('ed')) return token.slice(0, -2);
  if (token.length > 4 && token.endsWith('ies')) return `${token.slice(0, -3)}y`;
  if (token.length > 4 && token.endsWith('es')) return token.slice(0, -2);
  if (token.length > 3 && token.endsWith('s')) return token.slice(0, -1);
  return token;
}

function tokens(text, language) {
  const words = String(text || '').toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
  if (language && language !== 'en') return words;
  return words.filter((word) => !ENGLISH_STOP_WORDS.has(word)).map(stem);
}

function clamp(value, minimum = 0, maximum = 100) {
  return Math.max(minimum, Math.min(maximum, Math.round(value)));
}

function hasPhrase(answerTokens, phraseTokens) {
  if (!phraseTokens.length) return false;
  return answerTokens.some((_, index) => phraseTokens.every((word, offset) => answerTokens[index + offset] === word));
}

function scoreKeywords(question, answerTokens, language) {
  const keywords = Array.isArray(question.keywords) ? question.keywords : [];
  if (!keywords.length) return { score: answerTokens.length ? 70 : 0, matched: [], missing: [] };
  const matched = [];
  const missing = [];
  for (const keyword of keywords) {
    const keywordTokens = tokens(keyword, language);
    (hasPhrase(answerTokens, keywordTokens) ? matched : missing).push(keyword);
  }
  return { score: clamp((matched.length / keywords.length) * 100), matched, missing };
}

function scoreRelevance(question, answerTokens, language) {
  const expectedTokens = tokens(question.expectedAnswer, language);
  if (!expectedTokens.length) return answerTokens.length ? 70 : 0;
  const expected = new Set(expectedTokens);
  const overlap = new Set(answerTokens.filter((token) => expected.has(token)));
  return clamp((overlap.size / expected.size) * 100);
}

function scoreCompleteness(answerText, difficulty) {
  const words = String(answerText || '').trim().split(/\s+/).filter(Boolean).length;
  if (!words) return 0;
  const range = WORD_RANGES[difficulty] || WORD_RANGES.beginner;
  if (words < range.minimum) return clamp((words / range.minimum) * 60);
  if (words < range.target) return clamp(60 + ((words - range.minimum) / (range.target - range.minimum)) * 40);
  return 100;
}

function scoreClarity(answerText, category) {
  const text = String(answerText || '').trim();
  if (!text) return 0;
  const sentences = text.split(/[.!?]+/).map((item) => item.trim()).filter(Boolean);
  const lower = text.toLocaleLowerCase();
  const hasConnector = CONNECTORS.some((connector) => lower.includes(connector));
  const baseStructure = (sentences.length >= 2 ? 35 : 15) + (hasConnector ? 25 : 0);
  if (category !== 'hr' && category !== 'communication') {
    const averageWords = text.split(/\s+/).length / Math.max(1, sentences.length);
    return clamp(baseStructure + (averageWords <= 35 ? 40 : 20));
  }
  const starGroups = [
    ['situation', 'context', 'when'],
    ['task', 'goal', 'responsible'],
    ['action', 'I did', 'I decided', 'I built'],
    ['result', 'outcome', 'impact', 'learned'],
  ];
  const starPoints = starGroups.reduce(
    (score, group) => score + (group.some((term) => lower.includes(term)) ? 10 : 0),
    0,
  );
  return clamp(baseStructure + starPoints);
}

function countOccurrences(text, phrase) {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return (text.match(new RegExp(`\\b${escaped}\\b`, 'g')) || []).length;
}

function scoreCommunication(answerText, voiceMetrics) {
  const lower = String(answerText || '').toLocaleLowerCase();
  let score = 100;
  const fillerCount = FILLER_PHRASES.reduce((total, phrase) => total + countOccurrences(lower, phrase), 0);
  score -= Math.min(30, fillerCount * 5);
  const repeatedWords = lower.match(/\b([\p{L}\p{N}]+)\s+\1\b/gu) || [];
  score -= Math.min(20, repeatedWords.length * 5);
  const wordsPerMinute = Number(voiceMetrics?.wordsPerMinute);
  if (Number.isFinite(wordsPerMinute)) {
    if (wordsPerMinute < 80 || wordsPerMinute > 180) score -= 25;
    else if (wordsPerMinute < 110 || wordsPerMinute > 160) score -= 10;
  }
  return { score: clamp(score), fillerCount, repeatedWords: repeatedWords.length, wordsPerMinute: Number.isFinite(wordsPerMinute) ? wordsPerMinute : null };
}

export function evaluateAnswer(question = {}, answerText = '', options = {}) {
  const text = String(answerText || '');
  const language = options.language || question.language || 'en';
  const normalizedTokens = tokens(text, language);
  const keyword = scoreKeywords(question, normalizedTokens, language);
  const relevance = scoreRelevance(question, normalizedTokens, language);
  const completeness = scoreCompleteness(text, options.difficulty || question.difficulty);
  const clarity = scoreClarity(text, options.category || question.category);
  const communication = scoreCommunication(text, options.voiceMetrics);
  const skipped = options.status === 'skipped';
  const empty = !text.trim();
  const score = skipped || empty
    ? 0
    : clamp(
      keyword.score * SCORE_WEIGHTS.keywordCoverage / 100
      + relevance * SCORE_WEIGHTS.relevance / 100
      + completeness * SCORE_WEIGHTS.completeness / 100
      + clarity * SCORE_WEIGHTS.clarity / 100
      + communication.score * SCORE_WEIGHTS.communication / 100,
    );
  const contentScore = skipped || empty
    ? 0
    : clamp(
      (keyword.score * SCORE_WEIGHTS.keywordCoverage
        + relevance * SCORE_WEIGHTS.relevance
        + completeness * SCORE_WEIGHTS.completeness
        + clarity * SCORE_WEIGHTS.clarity)
      / (SCORE_WEIGHTS.keywordCoverage + SCORE_WEIGHTS.relevance + SCORE_WEIGHTS.completeness + SCORE_WEIGHTS.clarity),
    );
  const communicationScore = skipped || empty ? 0 : communication.score;
  const components = [
    ['Keyword coverage', keyword.score],
    ['Relevance', relevance],
    ['Completeness', completeness],
    ['Clarity and structure', clarity],
    ['Communication', communicationScore],
  ];
  const strengths = components.filter(([, value]) => value >= 70).map(([name]) => name);
  const weaknesses = components.filter(([, value]) => value < 50).map(([name]) => name);
  const suggestions = [
    ...(keyword.missing.length ? [`Include key terms: ${keyword.missing.join(', ')}.`] : []),
    ...(completeness < 60 ? ['Add more detail and explain the steps you took.'] : []),
    ...(communication.fillerCount ? ['Reduce filler words and use concise pauses.'] : []),
    ...(clarity < 60 ? ['Organize the response into clear steps and outcomes.'] : []),
  ];
  const explanation = [
    `Keyword coverage: ${keyword.matched.length} of ${keyword.matched.length + keyword.missing.length} terms (${keyword.score}%).`,
    keyword.missing.length ? `Missing: ${keyword.missing.join(', ')}.` : 'No expected key terms are missing.',
    `Relevance ${relevance}%, completeness ${completeness}%, clarity ${clarity}%, communication ${communicationScore}%.`,
    language === 'en' ? '' : 'Non-English scoring uses exact token matching without English stemming or stop-word removal.',
    options.style === 'friendly' ? 'Keep building on the strengths in this response.' : '',
    options.style === 'strict' ? 'Address the specific gaps listed above in your next response.' : '',
  ].filter(Boolean).join(' ');
  return {
    score,
    contentScore,
    communicationScore,
    method: 'local-rule-based-v1',
    breakdown: {
      keywordCoverage: keyword.score,
      relevance,
      completeness,
      clarity,
      communication: communicationScore,
      weights: { ...SCORE_WEIGHTS },
      fillerCount: communication.fillerCount,
      repeatedWords: communication.repeatedWords,
      wordsPerMinute: communication.wordsPerMinute,
    },
    matchedKeywords: keyword.matched,
    missingKeywords: keyword.missing,
    strengths,
    weaknesses,
    suggestions,
    explanation,
    sampleAnswer: question.expectedAnswer || '',
  };
}

export function aggregateInterview(answers, interview = {}) {
  const results = Array.isArray(answers) ? answers : [];
  const scored = results.map((answer) => answer.evaluation || evaluateAnswer(
    answer.question || {},
    answer.answerText,
    { ...answer.options, status: answer.status },
  ));
  const average = (selector) => scored.length
    ? Math.round(scored.reduce((total, evaluation) => total + Number(selector(evaluation) || 0), 0) / scored.length)
    : 0;
  const totalScore = average((evaluation) => evaluation.score);
  const contentScore = average((evaluation) => evaluation.contentScore);
  const communicationScore = average((evaluation) => evaluation.communicationScore);
  const now = new Date().toISOString();
  const report = {
    id: interview.reportId || `${interview.id || 'offline'}-report`,
    interviewId: interview.id,
    title: `Interview practice${interview.jobRole ? ` – ${interview.jobRole}` : ''}`,
    category: interview.category,
    jobRole: interview.jobRole,
    scores: { total: totalScore, content: contentScore, communication: communicationScore },
    questionResults: results.map((answer, index) => ({
      answerId: answer.id,
      questionId: answer.questionId,
      questionIndex: answer.questionIndex ?? index,
      skill: answer.question?.skill || answer.skill,
      category: answer.question?.category || answer.category,
      questionText: answer.question?.text || '',
      answerText: answer.answerText || '',
      status: answer.status || 'unanswered',
      voiceMetrics: answer.voiceMetrics,
      evaluation: scored[index],
    })),
    strengths: [...new Set(scored.flatMap((evaluation) => evaluation.strengths || []))],
    weaknesses: [...new Set(scored.flatMap((evaluation) => evaluation.weaknesses || []))],
    suggestions: [...new Set(scored.flatMap((evaluation) => evaluation.suggestions || []))],
    communicationAnalysis: {
      fillerCount: scored.reduce((sum, evaluation) => sum + Number(evaluation.breakdown?.fillerCount || 0), 0),
      fillerWords: results.reduce((totals, answer) => {
        Object.entries(answer.voiceMetrics?.fillerWords || {}).forEach(([word, count]) => {
          totals[word] = (totals[word] || 0) + Number(count || 0);
        });
        return totals;
      }, {}),
      wordsPerMinute: results.map((answer) => answer.voiceMetrics?.wordsPerMinute).filter(Number.isFinite),
      pauses: results.map((answer) => answer.voiceMetrics?.pauseCount ?? answer.voiceMetrics?.pauses).filter(Number.isFinite),
      longestPauseSeconds: results.map((answer) => answer.voiceMetrics?.longestPauseSeconds).filter(Number.isFinite),
    },
    method: 'local-rule-based-v1',
    createdAt: interview.completedAt || now,
    updatedAt: now,
  };
  return { totalScore, contentScore, communicationScore, items: results.map((answer, index) => ({ ...answer, evaluation: scored[index] })), report };
}
