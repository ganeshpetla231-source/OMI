import seedQuestions from '../../assets/seed/questions.en.json';
import { deleteRecord, getAllRecords, getRecord, putRecord } from './db';
import { chooseRandomQuestions, filterQuestions, paginateQuestions, uniqueQuestionValues } from '../../utils/questionData';

const SEED_VERSION = 3;

let initializationPromise;

function toMetadata(questionList) {
  return {
    categories: uniqueQuestionValues(questionList, 'category'),
    roles: uniqueQuestionValues(questionList, 'jobRole'),
    skills: uniqueQuestionValues(questionList, 'skill'),
  };
}

export async function initializeQuestionCache() {
  if (!initializationPromise) {
    initializationPromise = (async () => {
      const seedMarker = await getRecord('meta', 'seedVersion');
      if (seedMarker?.value === SEED_VERSION && (await getAllRecords('questions')).length) return;
      for (const question of seedQuestions) await putRecord('questions', question);
      const metadata = toMetadata(seedQuestions);
      for (const [key, items] of Object.entries(metadata)) await putRecord('meta', { key, items });
      await putRecord('meta', { key: 'seedVersion', value: SEED_VERSION });
    })().catch((error) => {
      initializationPromise = null;
      throw error;
    });
  }
  return initializationPromise;
}

async function getQuestionsStore() {
  await initializeQuestionCache();
  return getAllRecords('questions');
}

export async function cacheQuestions(questionList) {
  await getQuestionsStore();
  for (const question of questionList) if (question?.id) await putRecord('questions', question);
  const allQuestions = await getAllRecords('questions');
  const metadata = toMetadata(allQuestions);
  for (const [key, items] of Object.entries(metadata)) await putRecord('meta', { key, items });
}

export async function removeCachedQuestion(id) {
  await getQuestionsStore();
  await deleteRecord('questions', id);
  const metadata = toMetadata(await getAllRecords('questions'));
  for (const [key, items] of Object.entries(metadata)) await putRecord('meta', { key, items });
}

export async function cacheQuestionOptions(key, items) {
  await getQuestionsStore();
  await putRecord('meta', { key, items });
}

async function readQuestionOptions(key, field) {
  const questions = await getQuestionsStore();
  const saved = await getRecord('meta', key);
  if (saved?.items) return saved.items;
  return uniqueQuestionValues(questions, field);
}

export async function listLocalQuestions(filters = {}) {
  const allQuestions = await getQuestionsStore();
  const filtered = filterQuestions(allQuestions, filters);
  return paginateQuestions(filtered, filters.page, filters.limit);
}

export async function randomLocalQuestions(filters = {}) {
  const matching = filterQuestions(await getQuestionsStore(), filters);
  const items = chooseRandomQuestions(matching, filters.count);
  return {
    items,
    pagination: { page: 1, limit: items.length, total: matching.length, pages: matching.length ? 1 : 0 },
  };
}

export async function getLocalQuestionById(id) {
  await getQuestionsStore();
  const question = await getRecord('questions', id);
  if (question) return question;
  const error = new Error('Question not found in saved questions.');
  error.status = 404;
  error.code = 'QUESTION_NOT_FOUND';
  throw error;
}

export async function getLocalCategories() {
  return readQuestionOptions('categories', 'category');
}

export async function getLocalRoles(category) {
  if (category) {
    const cached = await getRecord('meta', `roles:${category}`);
    if (cached?.items) return cached.items;
  }
  const roles = await readQuestionOptions('roles', 'jobRole');
  if (!category) return roles;
  const questions = await listLocalQuestions({ category, limit: Number.MAX_SAFE_INTEGER });
  return uniqueQuestionValues(questions.items, 'jobRole');
}

export async function getLocalSkills({ category, jobRole } = {}) {
  const cached = await getRecord('meta', `skills:${category || '*'}:${jobRole || '*'}`);
  if (cached?.items) return cached.items;
  const skills = await readQuestionOptions('skills', 'skill');
  if (!category && !jobRole) return skills;
  const questions = await listLocalQuestions({ category, jobRole, limit: Number.MAX_SAFE_INTEGER });
  return uniqueQuestionValues(questions.items, 'skill');
}
