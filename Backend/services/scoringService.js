const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "but", "by", "for", "from",
  "had", "has", "have", "he", "her", "his", "in", "is", "it", "its",
  "of", "on", "or", "our", "she", "that", "the", "their", "them",
  "there", "this", "to", "was", "were", "with", "you", "i", "we"
]);

const FILLER_WORDS = ["um", "uh", "like", "actually", "basically", "you know", "so"];

function normalizeText(text, language = "en") {
  if (!text || typeof text !== "string") return "";
  let normalized = text.toLowerCase();
  if (language === "te" || language === "hi") return normalized.replace(/\s+/g, " ").trim();
  normalized = normalized
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(\w+)(ing|ed|s)\b/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
  return normalized;
}

function tokenize(text, language = "en") {
  const normalized = normalizeText(text, language);
  if (!normalized) return [];
  const words = normalized.split(/\s+/).filter(Boolean);
  if (language === "te" || language === "hi") return words;
  return words.filter((word) => !STOP_WORDS.has(word) && word.length > 1);
}

function countFillerWords(text) {
  const normalized = normalizeText(text, "en");
  let count = 0;
  for (const filler of FILLER_WORDS) {
    const pattern = new RegExp(`(^|\\s)${filler.replace(/\s+/g, "\\s+")}(?=\\s|$)`, "g");
    const matches = normalized.match(pattern);
    count += matches ? matches.length : 0;
  }
  return count;
}

function countRepeatedWords(text) {
  const words = tokenize(text, "en");
  const counts = new Map();
  for (const word of words) counts.set(word, (counts.get(word) || 0) + 1);
  return [...counts.values()].filter((count) => count > 2).length;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function scoreAnswer(question, answerText, options = {}) {
  const text = typeof answerText === "string" ? answerText.trim() : "";
  const style = options.interviewStyle || "standard";
  const language = options.language || "en";

  if (!text) {
    return buildEvaluation(0, 0, 0, [], question.keywords || [], {
      strengths: [],
      weaknesses: ["No answer was provided."],
      suggestions: ["Provide a complete answer with a relevant example."],
      explanation: "Skipped or empty answers receive 0 marks.",
      sampleAnswer: question.expectedAnswer || "",
      style
    });
  }

  const words = tokenize(text, language);
  const answerSet = new Set(words);
  const keywords = (question.keywords || []).filter(Boolean);
  const matchedKeywords = [];
  const missingKeywords = [];

  for (const keyword of keywords) {
    const keywordTokens = tokenize(String(keyword), language);
    const matched = keywordTokens.length
      ? keywordTokens.every((token) => answerSet.has(token))
      : answerSet.has(String(keyword).toLowerCase());
    (matched ? matchedKeywords : missingKeywords).push(keyword);
  }

  const keywordCoverage = keywords.length
    ? (matchedKeywords.length / keywords.length) * 100
    : 50;

  const answerTextLower = text.toLowerCase();
  let relevanceMatches = 0;
  const sampleWords = new Set(tokenize(question.expectedAnswer || "", language));
  for (const word of words) {
    if (sampleWords.has(word)) relevanceMatches += 1;
  }
  const relevance = words.length
    ? clamp((relevanceMatches / Math.max(words.length, 1)) * 220, 0, 100)
    : 0;

  const ranges = {
    easy: [25, 100],
    medium: [50, 180],
    hard: [80, 260]
  };
  const [minimumWords, maximumWords] = ranges[question.difficulty] || ranges.medium;
  let completeness = words.length >= minimumWords
    ? clamp(100 - Math.max(0, words.length - maximumWords) * 0.5, 60, 100)
    : clamp((words.length / minimumWords) * 70, 0, 70);

  const sentences = text.split(/[.!?]+/).filter((sentence) => sentence.trim()).length;
  const connectors = ["because", "therefore", "however", "first", "then", "finally", "so"];
  const connectorCount = connectors.filter((word) =>
    new RegExp(`(^|\\s)${word}(\\s|$)`, "i").test(answerTextLower)
  ).length;
  const hasStar = /\b(situation|task|action|result)\b/i.test(answerTextLower);
  let clarity = clamp((sentences >= 2 ? 50 : 25) + Math.min(connectorCount * 10, 30) + (hasStar ? 20 : 0), 0, 100);

  const fillerCount = countFillerWords(text);
  const repeatedCount = countRepeatedWords(text);
  let communication = clamp(100 - fillerCount * 8 - repeatedCount * 7, 0, 100);

  if (options.voiceMetrics) {
    const wpm = Number(options.voiceMetrics.wpm || 0);
    if (wpm > 0) {
      if (wpm < 90) communication -= 10;
      else if (wpm > 180) communication -= 15;
    }
  }
  communication = clamp(communication, 0, 100);

  const contentScore = clamp(
    keywordCoverage * 0.5 + relevance * 0.3 + completeness * 0.2,
    0,
    100
  );
  const communicationScore = clamp(
    clarity * 0.6 + communication * 0.4,
    0,
    100
  );
  const score = clamp(contentScore * 0.7 + communicationScore * 0.3, 0, 100);

  const strengths = [];
  const weaknesses = [];
  const suggestions = [];

  if (matchedKeywords.length) strengths.push(`Covered ${matchedKeywords.length} of ${keywords.length} key terms.`);
  if (!matchedKeywords.length && keywords.length) weaknesses.push("Key concepts were not clearly covered.");
  if (words.length < minimumWords) weaknesses.push("The answer is too short for this difficulty.");
  if (fillerCount) weaknesses.push(`Used ${fillerCount} filler phrase(s).`);
  if (clarity >= 70) strengths.push("The answer has a clear structure.");
  if (hasStar) strengths.push("The answer includes a STAR-style structure.");
  if (!strengths.length) strengths.push("A response was provided and can be developed further.");

  if (missingKeywords.length) suggestions.push(`Address missing terms: ${missingKeywords.slice(0, 5).join(", ")}.`);
  if (words.length < minimumWords) suggestions.push("Expand the answer with a specific example and result.");
  if (fillerCount) suggestions.push("Reduce filler words and pause instead.");
  if (!connectorCount && suggestions.length < 3) suggestions.push("Use transition words to improve structure.");

  let explanation = `Covered ${matchedKeywords.length} of ${keywords.length} key terms (+${clamp(keywordCoverage * 0.5, 0, 50)} content points).`;
  if (missingKeywords.length) explanation += ` Missing: ${missingKeywords.join(", ")}.`;
  if (language === "te" || language === "hi") {
    explanation += " Exact-token matching was used for this language.";
  }

  return buildEvaluation(score, contentScore, communicationScore, matchedKeywords, missingKeywords, {
    strengths,
    weaknesses,
    suggestions,
    explanation,
    sampleAnswer: question.expectedAnswer || "",
    style,
    breakdown: {
      keywordCoverage: clamp(keywordCoverage, 0, 100),
      relevance: clamp(relevance, 0, 100),
      completeness: clamp(completeness, 0, 100),
      clarity: clamp(clarity, 0, 100),
      communication: clamp(communication, 0, 100),
      weights: {
        content: 70,
        communication: 30
      }
    },
    fillerCount,
    repeatedCount,
    wordCount: words.length,
    wpm: options.voiceMetrics?.wpm
  });
}

function buildEvaluation(score, contentScore, communicationScore, matchedKeywords, missingKeywords, details) {
  const breakdown = {
    keywordCoverage: details.breakdown?.keywordCoverage || 0,
    relevance: details.breakdown?.relevance || 0,
    completeness: details.breakdown?.completeness || 0,
    clarity: details.breakdown?.clarity || 0,
    communication: details.breakdown?.communication || 0,
    weights: details.breakdown?.weights || { content: 70, communication: 30 },
    fillerCount: details.fillerCount || 0,
    repeatedCount: details.repeatedCount || 0,
    wordCount: details.wordCount || 0,
    wpm: details.wpm
  };

  return {
    score,
    contentScore,
    communicationScore,
    method: "rule-based-v1",
    breakdown,
    matchedKeywords,
    missingKeywords,
    strengths: details.strengths,
    weaknesses: details.weaknesses,
    suggestions: details.suggestions,
    explanation: details.explanation,
    sampleAnswer: details.sampleAnswer
  };
}

module.exports = {
  normalizeText,
  tokenize,
  countFillerWords,
  countRepeatedWords,
  scoreAnswer
};
