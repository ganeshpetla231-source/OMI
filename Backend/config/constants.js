const CONSTANTS = Object.freeze({
  ROLES: ["student", "admin"],
  CATEGORIES: ["hr", "technical", "general", "communication", "coding"],
  DIFFICULTIES: ["easy", "medium", "hard"],
  INTERVIEW_MODES: ["practice", "mock", "assessment"],
  INTERVIEW_STYLES: ["standard", "rapid-fire", "strict", "friendly"],
  INTERVIEW_STATUSES: ["draft", "in_progress", "paused", "completed"],
  LANGUAGES: ["en", "te", "hi"],
  THEMES: ["light", "dark", "system"],
  EVALUATION_METHODS: ["rule-based-v1"],
  ANSWER_STATUSES: ["answered", "skipped"],
  ANSWER_SOURCES: ["text", "voice"]
});

module.exports = CONSTANTS;
