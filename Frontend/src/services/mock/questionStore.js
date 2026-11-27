import seedQuestions from '../../assets/seed/questions.en.json';

const QUESTION_OVERRIDES_KEY = 'talkready_mock_question_overrides';

function readOverrides() {
  const saved = localStorage.getItem(QUESTION_OVERRIDES_KEY);
  if (!saved) return [];
  const overrides = JSON.parse(saved);
  if (!Array.isArray(overrides) || overrides.some((question) => !question?.id)) {
    throw new Error('Saved mock question data is invalid.');
  }
  return overrides;
}

export function getMockQuestionBank() {
  const overrides = readOverrides();
  const byId = new Map(overrides.map((question) => [question.id, question]));
  const merged = seedQuestions.map((question) => byId.get(question.id) || question);
  const seedIds = new Set(seedQuestions.map((question) => question.id));
  return [...merged, ...overrides.filter((question) => !seedIds.has(question.id))];
}

export function saveMockQuestion(question) {
  const current = readOverrides();
  const existing = current.find((item) => item.id === question.id);
  const saved = {
    ...(existing || {}),
    ...question,
    updatedAt: new Date().toISOString(),
  };
  const next = existing
    ? current.map((item) => item.id === saved.id ? saved : item)
    : [...current, saved];
  localStorage.setItem(QUESTION_OVERRIDES_KEY, JSON.stringify(next));
  return saved;
}

export function deleteMockQuestion(id) {
  const question = getMockQuestionBank().find((item) => item.id === id);
  if (!question) {
    const error = new Error('Question not found.');
    error.status = 404;
    error.code = 'QUESTION_NOT_FOUND';
    throw error;
  }
  const deletedQuestion = saveMockQuestion({ ...question, isActive: false });
  return {
    question: deletedQuestion,
    softDeleted: true,
    message: 'Question deactivated. It remains available in saved interview history.',
  };
}
