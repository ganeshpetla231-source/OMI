import { getLocalNote } from './localNotes';
import { getRecord } from './db';

const STOP_WORDS = new Set([
  'about', 'after', 'also', 'been', 'before', 'being', 'between', 'could', 'from', 'have',
  'into', 'more', 'most', 'other', 'over', 'should', 'that', 'their', 'there', 'these',
  'they', 'this', 'through', 'under', 'using', 'very', 'were', 'what', 'when', 'where',
  'which', 'while', 'with', 'would', 'your', 'and', 'are', 'for', 'the', 'was', 'you',
  'not', 'but', 'can', 'has', 'its', 'our', 'than', 'then', 'them', 'use',
]);

function frequentTerms(text) {
  const counts = new Map();
  for (const word of text.toLocaleLowerCase().match(/[a-z][a-z0-9-]{3,}/g) || []) {
    if (!STOP_WORDS.has(word)) counts.set(word, (counts.get(word) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([word]) => word);
}

function questionFrom(note, index, details, filters) {
  const { prompt, answer, keywords, skill } = details;
  return {
    id: `note_${encodeURIComponent(note.id)}_${index + 1}`,
    text: prompt,
    category: filters.category || 'general',
    jobRole: filters.jobRole || 'Any role',
    skill,
    difficulty: filters.difficulty || 'beginner',
    language: filters.language || 'en',
    expectedAnswer: answer,
    keywords,
    tags: [...new Set([note.topic, ...note.tags].filter(Boolean))],
    source: 'notes',
    timeLimitSeconds: 120,
    evaluationCriteria: { keywords, completeness: answer },
  };
}

export async function generateQuestionsFromNote(noteId, filters = {}) {
  if (!noteId) throw new Error('Choose a note before generating questions.');
  const note = await getLocalNote(noteId);
  const content = String(note.content || '').trim();
  if (!content) {
    const error = new Error('Add some content to this note before generating practice questions.');
    error.code = 'NOTE_CONTENT_REQUIRED';
    throw error;
  }

  const definitions = [];
  for (const line of content.split(/\r?\n/)) {
    const match = line.trim().match(/^(?:[-*]\s*)?(.{2,80}?)\s+is\s+(.{12,})$/i);
    if (match) {
      definitions.push({
        prompt: `Explain ${match[1].trim()}.`,
        answer: `${match[1].trim()} is ${match[2].trim()}`,
        keywords: [match[1].trim(), ...frequentTerms(match[2]).slice(0, 3)],
        skill: note.topic || match[1].trim(),
      });
    }
  }

  const headings = content.split(/\r?\n/)
    .map((line) => line.trim().replace(/^#{1,6}\s*/, ''))
    .filter((line) => line.length > 3 && line.length < 90 && !/[.!?]$/.test(line));
  const terms = frequentTerms(content);
  const snippets = content.split(/(?<=[.!?])\s+/).filter((line) => line.length > 25);
  const candidates = [
    ...definitions,
    ...[...new Set(headings)].map((heading) => ({
      prompt: `What are the key ideas behind ${heading}?`,
      answer: snippets.find((line) => line.toLocaleLowerCase().includes(heading.toLocaleLowerCase())) || content.slice(0, 240),
      keywords: [heading, ...terms.slice(0, 3)],
      skill: note.topic || heading,
    })),
    ...terms.slice(0, 8).map((term, index) => ({
      prompt: index % 2
        ? `How would you apply ${term} in a practical situation?`
        : `Describe the role of ${term} in this topic.`,
      answer: snippets.find((line) => line.toLocaleLowerCase().includes(term)) || content.slice(0, 240),
      keywords: [term, ...terms.filter((candidate) => candidate !== term).slice(0, 2)],
      skill: note.topic || term,
    })),
  ];

  if (!candidates.length) {
    candidates.push({
      prompt: `Summarize the main points in "${note.title}".`,
      answer: content.slice(0, 500),
      keywords: terms.slice(0, 5),
      skill: note.topic || 'Study notes',
    });
  }

  const count = Math.max(1, Math.min(20, Number(filters.count) || 5));
  const promptVariants = [
    'How would you explain {skill} to a teammate?',
    'What challenge might arise when applying {skill}, and how would you handle it?',
    'How would you assess whether an approach to {skill} was successful?',
    'What is one important principle to remember about {skill}?',
  ];
  while (candidates.length < count) {
    const index = candidates.length;
    const base = candidates[index % Math.max(1, candidates.length)];
    const skill = base.skill || note.topic || terms[index % Math.max(1, terms.length)] || note.title;
    candidates.push({
      ...base,
      prompt: promptVariants[index % promptVariants.length].replace('{skill}', skill),
      skill,
    });
  }
  const items = candidates.slice(0, count).map((details, index) => questionFrom(note, index, details, filters));
  return {
    items,
    pagination: { page: 1, limit: count, total: items.length, pages: items.length ? 1 : 0 },
    offline: true,
  };
}

export async function generateQuestionsFromResume(resumeId, filters = {}) {
  const resume = await getRecord('resumes', resumeId);
  if (!resume) {
    const error = new Error('The selected resume is not available on this device.');
    error.status = 404;
    throw error;
  }
  const skills = resume.extracted?.skills || [];
  const usableSkills = skills.map((skill) => typeof skill === 'string' ? skill : skill.name).filter(Boolean);
  if (!usableSkills.length) {
    const error = new Error('No extracted skills are available to generate questions.');
    error.code = 'RESUME_SKILLS_UNAVAILABLE';
    throw error;
  }
  const count = Math.max(1, Math.min(20, Number(filters.count) || 5));
  const items = usableSkills.slice(0, count).map((skill, index) => ({
    id: `resume_${encodeURIComponent(resumeId)}_${index + 1}`,
    text: `Describe your experience with ${skill} and how you have applied it.`,
    category: filters.category || 'general',
    jobRole: filters.jobRole || 'Any role',
    skill,
    difficulty: filters.difficulty || 'beginner',
    language: filters.language || 'en',
    expectedAnswer: `Explain your practical experience, the decisions you made, and the outcome when using ${skill}.`,
    keywords: [skill, 'experience', 'outcome'],
    tags: ['resume', skill],
    timeLimitSeconds: 120,
    evaluationCriteria: { keywords: [skill, 'experience', 'outcome'] },
  }));
  return {
    items,
    pagination: { page: 1, limit: count, total: items.length, pages: items.length ? 1 : 0 },
    offline: false,
  };
}
