import { getAllRecords } from '../offline/db';
import { getMockQuestionBank, saveMockQuestion, deleteMockQuestion } from './questionStore';

function readMockUsers() {
  const raw = localStorage.getItem('talkready_mock_users');
  if (!raw) return [];
  const users = JSON.parse(raw);
  if (!Array.isArray(users)) throw new Error('Saved mock account data is invalid.');
  return users;
}

function questionFromPayload(payload) {
  return payload?.question || payload?.item || payload;
}

export const mockAdminApi = {
  async getDashboard() {
    const [users, interviews] = await Promise.all([
      Promise.resolve(readMockUsers()),
      getAllRecords('interviews'),
    ]);
    const questions = getMockQuestionBank();
    const recentUsers = users
      .map(({ passwordDigest, passwordSalt, ...user }) => user)
      .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))
      .slice(0, 5);
    const recentInterviews = interviews
      .map((record) => record.interview || record)
      .filter((interview) => interview?.id)
      .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))
      .slice(0, 5);
    const questionsByCategory = [...new Set(questions.map((question) => question.category))]
      .map((category) => ({
        category,
        count: questions.filter((question) => question.category === category && question.isActive !== false).length,
      }));
    return {
      usersCount: users.length,
      interviewsCount: interviews.length,
      questionsCount: questions.filter((question) => question.isActive !== false).length,
      questionsByCategory,
      recentUsers,
      recentInterviews,
    };
  },

  async createQuestion(payload) {
    const question = questionFromPayload(payload);
    const saved = saveMockQuestion({
      ...question,
      id: question.id || `mock-question-${globalThis.crypto.randomUUID()}`,
      isActive: question.isActive !== false,
      createdAt: question.createdAt || new Date().toISOString(),
    });
    return { question: saved };
  },

  async updateQuestion(id, payload) {
    const existing = getMockQuestionBank().find((question) => question.id === id);
    if (!existing) {
      const error = new Error('Question not found.');
      error.status = 404;
      error.code = 'QUESTION_NOT_FOUND';
      throw error;
    }
    return { question: saveMockQuestion({ ...existing, ...questionFromPayload(payload), id }) };
  },

  async deleteQuestion(id) {
    return deleteMockQuestion(id);
  },
};
