const {
  normalizeText,
  tokenize,
  countFillerWords,
  countRepeatedWords,
  scoreAnswer
} = require("../services/scoringService");

describe("deterministic rule-based scoring", () => {
  const question = {
    text: "Explain polymorphism, inheritance, and encapsulation in object-oriented programming.",
    difficulty: "medium",
    keywords: ["polymorphism", "inheritance", "encapsulation", "abstraction"],
    expectedAnswer: "Polymorphism allows objects to use common interfaces. Inheritance shares behavior and encapsulation hides state."
  };

  test("same answer produces the same score", () => {
    const answer = "Polymorphism lets objects behave differently. Inheritance shares behavior and encapsulation protects state.";
    expect(scoreAnswer(question, answer)).toEqual(scoreAnswer(question, answer));
  });

  test("empty answer receives zero", () => {
    const result = scoreAnswer(question, "");
    expect(result.score).toBe(0);
    expect(result.method).toBe("rule-based-v1");
  });

  test("strong answer scores noticeably higher than vague answer", () => {
    const strong = "Polymorphism allows objects to use a common interface, inheritance reuses behavior, and encapsulation protects state. Abstraction hides implementation details.";
    const vague = "It is about objects.";
    expect(scoreAnswer(question, strong).score).toBeGreaterThan(scoreAnswer(question, vague).score + 20);
  });

  test("keyword boost and missing keyword reporting", () => {
    const strong = "Polymorphism uses interfaces. Inheritance shares behavior. Encapsulation protects state. Abstraction hides details.";
    const result = scoreAnswer(question, strong);
    expect(result.matchedKeywords).toHaveLength(4);
    expect(result.missingKeywords).toHaveLength(0);
  });

  test("too-short answers are penalized", () => {
    const result = scoreAnswer(question, "Objects.");
    expect(result.weaknesses).toContain("The answer is too short for this difficulty.");
  });

  test("filler and repeated-word detection", () => {
    const answer = "Um, actually, so we need like like like validation.";
    expect(countFillerWords(answer)).toBeGreaterThanOrEqual(4);
    expect(countRepeatedWords(answer)).toBeGreaterThanOrEqual(1);
  });

  test("WPM range affects communication score", () => {
    const answer = "Polymorphism is useful because it allows a common interface.";
    const slow = scoreAnswer(question, answer, { voiceMetrics: { wpm: 60 } });
    const normal = scoreAnswer(question, answer, { voiceMetrics: { wpm: 120 } });
    expect(slow.communicationScore).toBeLessThan(normal.communicationScore);
  });

  test("STAR structure is recognized for HR answers", () => {
    const hrQuestion = {
      difficulty: "medium",
      keywords: ["situation", "task", "action", "result"],
      expectedAnswer: "Explain the situation, task, action, and result.",
      category: "hr"
    };
    const result = scoreAnswer(hrQuestion, "The situation was difficult. My task was clear. I took action and achieved a result.");
    expect(result.strengths).toContain("The answer includes a STAR-style structure.");
  });

  test("Telugu and Hindi use exact token matching without stemming", () => {
    expect(tokenize("సమస్యను పరిష్కరించండి", "te")).toContain("సమస్యను");
    expect(normalizeText("समस्या समाधान", "hi")).toBe("समस्या समाधान");
  });
});
