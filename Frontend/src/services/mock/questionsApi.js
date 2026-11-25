import { chooseRandomQuestions, filterQuestions, paginateQuestions, uniqueQuestionValues } from '../../utils/questionData';
import { generateQuestionsFromNote, generateQuestionsFromResume } from '../offline/notesProcessor';
import { getMockQuestionBank } from './questionStore';

function listOptions(values, category) {
  const activeQuestions = getMockQuestionBank().filter((question) => question.isActive !== false);
  const questions = category ? activeQuestions.filter((question) => question.category === category) : activeQuestions;
  return uniqueQuestionValues(questions, values);
}

function findQuestion(id) {
  const question = getMockQuestionBank().find((item) => item.id === id);
  if (!question) {
    const error = new Error('Question not found.');
    error.status = 404;
    error.code = 'QUESTION_NOT_FOUND';
    throw error;
  }
  return question;
}

export const mockQuestionsApi = {
  async list(filters = {}) {
    const filtered = filterQuestions(getMockQuestionBank(), filters);
    return { ...paginateQuestions(filtered, filters.page, filters.limit), offline: false };
  },

  async getById(id) {
    return { item: findQuestion(id), offline: false };
  },

  async getCategories() {
    return { items: listOptions('category'), offline: false };
  },

  async getRoles({ category } = {}) {
    return { items: listOptions('jobRole', category), offline: false };
  },

  async getSkills({ category, jobRole } = {}) {
    const questions = getMockQuestionBank().filter((question) => question.isActive !== false && (
      (!category || question.category === category)
      && (!jobRole || question.jobRole === jobRole)
    ));
    return { items: uniqueQuestionValues(questions, 'skill'), offline: false };
  },

  async generate(filters = {}) {
    if (filters.noteId) return { ...(await generateQuestionsFromNote(filters.noteId, filters)), offline: false };
    if (filters.resumeId) return { ...(await generateQuestionsFromResume(filters.resumeId, filters)), offline: false };
    const { items } = await this.list({ ...filters, page: 1, limit: filters.count || 5 });
    if (!items.length) {
      const error = new Error('No questions match those filters.');
      error.status = 400;
      error.code = 'NO_QUESTIONS';
      throw error;
    }
    return { items, offline: false };
  },

  async random(filters = {}) {
    const matching = filterQuestions(getMockQuestionBank(), filters);
    const count = Math.max(1, Math.min(20, Number(filters.count) || 1));
    return { items: chooseRandomQuestions(matching, count), offline: false };
  },
};
