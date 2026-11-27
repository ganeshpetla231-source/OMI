import { getAllRecords, getRecord, putRecord, deleteRecord } from './db';
import { listLocalQuestions, randomLocalQuestions } from './localQuestions';
import { generateQuestionsFromNote, generateQuestionsFromResume } from './notesProcessor';

function createId(prefix = '') {
  const uuid = globalThis.crypto?.randomUUID?.()
    || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}${uuid}`;
}

function toQuestionSnapshot(question) {
  return {
    questionId: question.id || question.questionId,
    text: question.text,
    expectedAnswer: question.expectedAnswer || '',
    keywords: question.keywords || [],
    evaluationCriteria: question.evaluationCriteria || [],
    timeLimitSeconds: question.timeLimitSeconds,
    skill: question.skill,
    difficulty: question.difficulty,
    source: question.source || 'bank',
  };
}

function createTemplateQuestion(payload, index) {
  const skill = payload.skills?.[index % Math.max(1, payload.skills.length)] || payload.skill || payload.category;
  return {
    questionId: `template-${payload.category || 'general'}-${index + 1}`,
    text: `Describe how you would approach a ${skill} challenge and measure the result.`,
    expectedAnswer: 'Explain the context, your approach, the actions you took, and the outcome.',
    keywords: ['approach', 'action', 'result'],
    evaluationCriteria: ['Explain a clear approach', 'Describe the outcome'],
    timeLimitSeconds: 120,
    skill,
    difficulty: payload.difficulty || 'beginner',
    source: 'template',
  };
}

export async function createLocalInterview(payload, prefix = 'local_') {
  const count = Number(payload.questionCount) || 5;
  const filters = {
    category: payload.category,
    jobRole: payload.jobRole,
    difficulty: payload.difficulty,
    language: payload.language,
  };
  let selected;
  if (payload.source === 'notes') {
    const generated = await generateQuestionsFromNote(payload.noteId, { ...filters, count });
    selected = generated.items.map(toQuestionSnapshot);
  } else if (payload.source === 'resume') {
    if (prefix !== 'mock_') {
      const error = new Error('Resume-based interviews require an internet connection.');
      error.code = 'RESUME_ONLINE_REQUIRED';
      throw error;
    }
    const generated = await generateQuestionsFromResume(payload.resumeId, { ...filters, count });
    selected = generated.items.map(toQuestionSnapshot);
  } else {
    const allMatching = await listLocalQuestions({ ...filters, page: 1, limit: Number.MAX_SAFE_INTEGER });
    const preferredQuestion = payload.preferredQuestionId
      ? allMatching.items.find((question) => question.id === payload.preferredQuestionId)
      : null;
    if (preferredQuestion) {
      selected = [toQuestionSnapshot(preferredQuestion)];
    } else {
      const selectedSkills = Array.isArray(payload.skills) ? payload.skills : [];
      const candidates = selectedSkills.length
        ? allMatching.items.filter((question) => selectedSkills.includes(question.skill))
        : allMatching.items;
      const chosen = await randomLocalQuestions({
        ...filters,
        count,
        ...(selectedSkills.length ? { skill: selectedSkills[0] } : {}),
      });
      const selectedById = new Map(chosen.items.map((question) => [question.id, question]));
      if (selectedSkills.length) {
        for (const question of candidates) {
          if (selectedById.size >= count) break;
          selectedById.set(question.id, question);
        }
      }
      selected = [...selectedById.values()].slice(0, count).map(toQuestionSnapshot);
    }
  }
  while (selected.length < count) selected.push(createTemplateQuestion(payload, selected.length));

  const now = new Date().toISOString();
  const interview = {
    id: createId(prefix),
    clientId: createId(),
    ...payload,
    questions: selected,
    status: 'draft',
    currentIndex: 0,
    elapsedSeconds: 0,
    createdAt: now,
    updatedAt: now,
  };
  await saveInterviewSnapshot({
    interview,
    answers: {},
    currentIndex: 0,
    elapsedSeconds: 0,
    questionElapsedSeconds: 0,
  });
  return interview;
}

export async function saveInterviewSnapshot(snapshot) {
  if (!snapshot?.interview?.id) throw new Error('An interview ID is required to save offline progress.');
  const record = {
    ...snapshot,
    id: snapshot.interview.id,
    savedAt: new Date().toISOString(),
  };
  await putRecord('interviews', record);
  return record;
}

export async function getInterviewSnapshot(interviewId) {
  return (await getRecord('interviews', interviewId)) || null;
}

export async function listInterviewSnapshots() {
  return getAllRecords('interviews');
}

export async function removeInterviewSnapshot(interviewId) {
  await deleteRecord('interviews', interviewId);
}

export async function removeLocalInterviewData(interviewId, reportId) {
  await deleteRecord('interviews', interviewId);
  for (const answer of await listLocalAnswers(interviewId)) await deleteRecord('answers', answer.id);
  for (const report of await listLocalReports()) {
    if (report.id === reportId || report.interviewId === interviewId) await deleteRecord('reports', report.id);
  }
  for (const entry of await getAllRecords('syncQueue')) {
    if (entry.localId === interviewId) await deleteRecord('syncQueue', entry.id);
  }
  await deleteRecord('settings', `interview-map:${interviewId}`);
}

function answerRecordId(interviewId, answer) {
  return `${interviewId}:${answer.questionIndex}`;
}

export async function saveLocalAnswer(interviewId, answer) {
  const record = {
    ...answer,
    id: answer.id || answerRecordId(interviewId, answer),
    interviewId,
    savedAt: new Date().toISOString(),
  };
  await putRecord('answers', record);
  return record;
}

export async function listLocalAnswers(interviewId) {
  return (await getAllRecords('answers')).filter((answer) => answer.interviewId === interviewId);
}

export async function getLocalAnswer(interviewId, answerId) {
  const direct = await getRecord('answers', answerId);
  const answer = direct?.interviewId === interviewId
    ? direct
    : (await listLocalAnswers(interviewId)).find((item) => item.id === answerId);
  if (!answer) {
    const error = new Error('Answer not found.');
    error.status = 404;
    error.code = 'ANSWER_NOT_FOUND';
    throw error;
  }
  return answer;
}

export async function queueAnswerForSync(interviewId, answer) {
  const record = {
    ...answer,
    id: `answers:${answerRecordId(interviewId, answer)}`,
    type: 'answers.submit',
    localId: interviewId,
    payload: { localId: interviewId, answers: [answer] },
    createdAt: new Date().toISOString(),
    attempts: 0,
    status: 'pending',
  };
  await putRecord('syncQueue', record);
  return record;
}

export async function markAnswerSynced(interviewId, answer) {
  const questionIndex = Number(answer.questionIndex);
  for (const entry of await getAllRecords('syncQueue')) {
    if (entry.id === `answers:${answerRecordId(interviewId, answer)}`) {
      await deleteRecord('syncQueue', entry.id);
      continue;
    }
    if (entry.type !== 'answers.submit' || entry.localId !== interviewId || !Array.isArray(entry.payload?.answers)) continue;
    const remaining = entry.payload.answers.filter((queuedAnswer) => Number(queuedAnswer.questionIndex) !== questionIndex);
    if (remaining.length === entry.payload.answers.length) continue;
    if (!remaining.length) await deleteRecord('syncQueue', entry.id);
    else await putRecord('syncQueue', { ...entry, payload: { ...entry.payload, answers: remaining } });
  }
}

export async function listQueuedAnswers() {
  return (await getAllRecords('syncQueue')).filter((item) => item.type === 'answers.submit' || item.interviewId);
}

export async function saveLocalReport(report) {
  if (!report?.id) throw new Error('A report ID is required to save an offline report.');
  await putRecord('reports', report);
  return report;
}

export async function getLocalReport(reportId) {
  return getRecord('reports', reportId);
}

export async function listLocalReports() {
  return getAllRecords('reports');
}

export async function getInterviewIdMapping(localId) {
  const mapping = await getRecord('settings', `interview-map:${localId}`);
  return mapping?.serverId || null;
}

export async function replaceLocalInterview(localId, serverInterview) {
  if (!serverInterview?.id) throw new Error('The server interview ID is required for synchronization.');
  const localSnapshot = await getInterviewSnapshot(localId);
  const serverSnapshot = {
    ...(localSnapshot || {}),
    id: serverInterview.id,
    interview: serverInterview,
    savedAt: new Date().toISOString(),
  };
  if (localSnapshot?.answers) serverSnapshot.answers = localSnapshot.answers;
  await putRecord('interviews', serverSnapshot);
  await putRecord('settings', { key: `interview-map:${localId}`, serverId: serverInterview.id });

  for (const answer of await listLocalAnswers(localId)) {
    await saveLocalAnswer(serverInterview.id, {
      ...answer,
      id: `${serverInterview.id}-answer-${answer.questionIndex}`,
      interviewId: serverInterview.id,
    });
    await deleteRecord('answers', answer.id);
  }
  for (const report of await listLocalReports()) {
    if (report.interviewId === localId) {
      await putRecord('reports', { ...report, interviewId: serverInterview.id, id: serverInterview.reportId || report.id });
      if (report.id !== serverInterview.reportId) await deleteRecord('reports', report.id);
    }
  }
  if (localId !== serverInterview.id) await deleteRecord('interviews', localId);
}
