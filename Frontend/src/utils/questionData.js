export function normalizeOption(option) {
  if (typeof option === 'string') return { value: option, label: option };
  const value = option?.value ?? option?.id ?? option?.key ?? option?.name ?? option?.slug
    ?? option?.category ?? option?.jobRole ?? option?.skill;
  const label = option?.label ?? option?.name ?? option?.title ?? value;
  return value == null ? null : { ...option, value: String(value), label: String(label) };
}

export function normalizeOptions(options) {
  return Array.isArray(options) ? options.map(normalizeOption).filter(Boolean) : [];
}

export function filterQuestions(questions, filters = {}) {
  const search = String(filters.search || '').trim().toLocaleLowerCase();
  return questions.filter((question) => {
    if (filters.isActive !== undefined && String(question.isActive !== false) !== String(filters.isActive)) return false;
    if (question.isActive === false && filters.includeInactive !== true && filters.isActive === undefined) return false;
    if (filters.category && question.category !== filters.category) return false;
    if (filters.jobRole && question.jobRole !== filters.jobRole) return false;
    if (filters.difficulty && question.difficulty !== filters.difficulty) return false;
    if (filters.skill && question.skill !== filters.skill) return false;
    if (filters.language && question.language !== filters.language) return false;
    if (search) {
      const searchable = [question.text, question.category, question.jobRole, question.skill, ...(question.tags || [])]
        .join(' ')
        .toLocaleLowerCase();
      if (!searchable.includes(search)) return false;
    }
    return true;
  });
}

export function paginateQuestions(questions, page = 1, limit = 20) {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.max(1, Number(limit) || 20);
  const total = questions.length;
  const pages = Math.ceil(total / safeLimit);
  const currentPage = pages ? Math.min(safePage, pages) : 1;
  const start = (currentPage - 1) * safeLimit;
  return {
    items: questions.slice(start, start + safeLimit),
    pagination: { page: currentPage, limit: safeLimit, total, pages },
  };
}

export function uniqueQuestionValues(questions, field) {
  return [...new Set(questions.map((question) => question[field]).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

export function chooseRandomQuestions(questions, count) {
  const shuffled = [...questions];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled.slice(0, Math.max(1, Math.min(20, Number(count) || 1)));
}
