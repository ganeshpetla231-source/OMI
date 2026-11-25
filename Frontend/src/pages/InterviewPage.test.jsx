import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '../context/AuthContext';
import { LanguageProvider } from '../context/LanguageContext';
import { answersApi } from '../services/api/answersApi';
import { interviewsApi } from '../services/api/interviewsApi';
import { getInterviewSnapshot, saveInterviewSnapshot } from '../services/offline/localInterviewStore';
import InterviewPage from './InterviewPage';

vi.mock('../services/api/interviewsApi', () => ({
  interviewsApi: {
    get: vi.fn(),
    update: vi.fn(),
    start: vi.fn(),
    pause: vi.fn(),
    complete: vi.fn(),
  },
}));

vi.mock('../services/api/answersApi', () => ({
  answersApi: {
    list: vi.fn(),
    submit: vi.fn(),
    evaluate: vi.fn(),
  },
}));

vi.mock('../services/offline/localInterviewStore', () => ({
  getInterviewIdMapping: vi.fn().mockResolvedValue(null),
  getInterviewSnapshot: vi.fn(),
  saveInterviewSnapshot: vi.fn(),
}));

function makeInterview(overrides = {}) {
  const startedAt = new Date(Date.now() - 15_000).toISOString();
  return {
    id: 'mock-interview-1',
    category: 'general',
    jobRole: 'Any role',
    difficulty: 'beginner',
    duration: 5,
    questionCount: 2,
    questions: [
      { questionId: 'question-1', text: 'Describe a challenge you solved.', skill: 'Problem solving', keywords: ['plan'], timeLimitSeconds: 30 },
      { questionId: 'question-2', text: 'How do you organize your work?', skill: 'Organization', keywords: ['prioritize'], timeLimitSeconds: 30 },
    ],
    status: 'in_progress',
    currentIndex: 0,
    elapsedSeconds: 0,
    startedAt,
    lastResumedAt: startedAt,
    updatedAt: startedAt,
    mode: 'text',
    practiceType: 'practice',
    style: 'standard',
    language: 'en',
    ...overrides,
  };
}

function renderInterview({ interview = makeInterview(), state, initialPath } = {}) {
  const entry = {
    pathname: initialPath || `/interview/${interview.id}`,
    ...(state === undefined ? {} : { state }),
  };
  const router = createMemoryRouter([
    { path: '/interview/:id', element: <InterviewPage /> },
    { path: '/dashboard', element: <h1>Dashboard destination</h1> },
  ], { initialEntries: [entry] });
  render(
    <AuthContext.Provider value={{ user: null }}>
      <LanguageProvider>
        <RouterProvider router={router} />
      </LanguageProvider>
    </AuthContext.Provider>,
  );
  return router;
}

describe('InterviewPage', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    getInterviewSnapshot.mockResolvedValue(null);
    saveInterviewSnapshot.mockResolvedValue({});
    answersApi.list.mockResolvedValue({ items: [], offline: false });
    answersApi.submit.mockImplementation(async (_id, answer) => ({ answer: { ...answer, id: 'saved-answer' }, offline: false }));
    answersApi.evaluate.mockResolvedValue({ items: [], totalScore: 75 });
    interviewsApi.get.mockImplementation(async (id) => makeInterview({ id }));
    interviewsApi.update.mockImplementation(async (id, updates) => ({ ...makeInterview({ id }), ...updates }));
    interviewsApi.start.mockImplementation(async (id) => makeInterview({ id, status: 'in_progress' }));
    interviewsApi.pause.mockImplementation(async (id, updates) => makeInterview({ id, ...updates, status: 'paused' }));
    interviewsApi.complete.mockImplementation(async (id, updates) => makeInterview({ id, ...updates, status: 'completed', totalScore: 75 }));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('restores a saved answer after reload and autosaves edits to IndexedDB', async () => {
    const interview = makeInterview({ updatedAt: new Date(Date.now() - 30_000).toISOString() });
    getInterviewSnapshot.mockResolvedValue({
      interview,
      answers: {
        '0': {
          questionIndex: 0,
          questionId: 'question-1',
          answerText: 'My saved answer',
          status: 'answered',
          updatedAt: new Date().toISOString(),
        },
      },
      currentIndex: 0,
      elapsedSeconds: 20,
      questionElapsedSeconds: 7,
      savedAt: new Date().toISOString(),
    });
    interviewsApi.get.mockResolvedValue(interview);

    renderInterview({ interview });

    fireEvent.click(await screen.findByRole('button', { name: 'Resume interview' }));
    const answerBox = await screen.findByLabelText('Your answer');
    expect(answerBox).toHaveValue('My saved answer');
    fireEvent.change(answerBox, { target: { value: 'Edited answer saved locally' } });

    await waitFor(() => {
      expect(saveInterviewSnapshot).toHaveBeenCalledWith(expect.objectContaining({
        answers: expect.objectContaining({
          '0': expect.objectContaining({ answerText: 'Edited answer saved locally' }),
        }),
      }));
    }, { timeout: 2500 });
  });

  it('calculates the countdown from timestamps rather than interval tick counts', async () => {
    vi.useFakeTimers();
    const startTime = new Date('2026-11-25T10:00:00.000Z');
    vi.setSystemTime(startTime);
    const interview = makeInterview({
      duration: 5,
      practiceType: 'timed',
      startedAt: startTime.toISOString(),
      lastResumedAt: startTime.toISOString(),
      updatedAt: startTime.toISOString(),
    });
    interviewsApi.get.mockResolvedValue(interview);

    renderInterview({ interview });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Resume interview' }));
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByLabelText('Time remaining')).toHaveTextContent('05:00');

    await act(async () => { vi.advanceTimersByTime(3100); });
    expect(screen.getByLabelText('Time remaining')).toHaveTextContent('04:57');
  });

  it('submits the current answer and advances when a timed question expires', async () => {
    vi.useFakeTimers();
    const startTime = new Date('2026-11-25T10:00:00.000Z');
    vi.setSystemTime(startTime);
    const interview = makeInterview({
      practiceType: 'timed',
      questions: [
        { questionId: 'question-1', text: 'Describe a challenge you solved.', timeLimitSeconds: 2 },
        { questionId: 'question-2', text: 'How do you organize your work?', timeLimitSeconds: 30 },
      ],
      startedAt: startTime.toISOString(),
      lastResumedAt: startTime.toISOString(),
      updatedAt: startTime.toISOString(),
    });
    interviewsApi.get.mockResolvedValue(interview);

    renderInterview({ interview });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Resume interview' }));
    await act(async () => { await Promise.resolve(); });
    fireEvent.change(screen.getByLabelText('Your answer'), { target: { value: 'I made a plan.' } });

    await act(async () => {
      vi.advanceTimersByTime(2000);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByText('How do you organize your work?')).toBeInTheDocument();
    expect(answersApi.submit).toHaveBeenCalledWith(interview.id, expect.objectContaining({
      answerText: 'I made a plan.',
      status: 'answered',
      timeTakenSeconds: 2,
    }));
  });

  it('disables skip and hides hints and previous navigation for strict interviews', async () => {
    const interview = makeInterview({ style: 'strict', practiceType: 'practice' });
    renderInterview({ interview, state: { interview, enterInterview: true } });

    expect(await screen.findByRole('button', { name: 'Skip' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Hint' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Previous' })).not.toBeInTheDocument();
  });

  it('asks before finishing and shows the answer review on completion', async () => {
    const interview = makeInterview();
    answersApi.list.mockResolvedValue({
      items: [
        { questionIndex: 0, questionId: 'question-1', answerText: 'I made a plan.', status: 'answered' },
        { questionIndex: 1, questionId: 'question-2', answerText: '', status: 'skipped' },
      ],
      offline: false,
    });
    interviewsApi.complete.mockResolvedValue({ ...interview, status: 'completed', totalScore: 75 });
    answersApi.evaluate.mockResolvedValue({ items: [], totalScore: 75 });
    renderInterview({ interview, state: { interview, enterInterview: true } });

    fireEvent.click(await screen.findByRole('button', { name: 'Finish' }));
    expect(await screen.findByRole('dialog', { name: 'Finish this interview?' })).toHaveTextContent('1 answered · 1 skipped · 0 remaining');
    fireEvent.click(screen.getByRole('button', { name: 'Finish interview' }));

    expect(await screen.findByRole('heading', { name: 'Interview finished' })).toBeInTheDocument();
    expect(screen.getByText('75%')).toBeInTheDocument();
    expect(interviewsApi.complete).toHaveBeenCalledWith(interview.id, expect.objectContaining({ elapsedSeconds: expect.any(Number) }));
  });

  it('submits locally saved draft answers before completing', async () => {
    const interview = makeInterview();
    renderInterview({ interview, state: { interview, enterInterview: true } });

    fireEvent.change(await screen.findByLabelText('Your answer'), { target: { value: 'A final saved response.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Finish' }));
    expect(await screen.findByRole('dialog', { name: 'Finish this interview?' })).toHaveTextContent('0 answered · 0 skipped · 2 remaining');
    fireEvent.click(screen.getByRole('button', { name: 'Finish interview' }));

    await screen.findByRole('heading', { name: 'Interview finished' });
    expect(answersApi.submit).toHaveBeenCalledWith(interview.id, expect.objectContaining({
      answerText: 'A final saved response.',
      questionIndex: 0,
      status: 'answered',
    }));
    expect(interviewsApi.complete).toHaveBeenCalled();
  });

  it('combines all four guided STAR fields into the normal submitted answer', async () => {
    const interview = makeInterview({
      category: 'communication',
      practiceDrill: 'star',
      questionCount: 1,
      questions: [{
        questionId: 'star-question',
        text: 'Describe a challenge using STAR.',
        keywords: ['situation', 'task', 'action', 'result'],
        timeLimitSeconds: 120,
      }],
    });
    renderInterview({ interview, state: { interview, enterInterview: true } });

    fireEvent.change(await screen.findByLabelText('Situation'), { target: { value: 'A project was delayed.' } });
    fireEvent.change(screen.getByLabelText('Task'), { target: { value: 'I owned the delivery plan.' } });
    fireEvent.change(screen.getByLabelText('Action'), { target: { value: 'I reorganized the work.' } });
    fireEvent.change(screen.getByLabelText('Result'), { target: { value: 'We shipped on schedule.' } });
    expect(screen.getByText('STAR sections completed: 4 of 4. Each section is checked in your score.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Submit & finish' }));
    await waitFor(() => {
      expect(answersApi.submit).toHaveBeenCalledWith(interview.id, expect.objectContaining({
        answerText: expect.stringContaining('Situation: A project was delayed.'),
        status: 'answered',
      }));
    });
    expect(answersApi.submit.mock.calls[0][1].answerText).toContain('Task: I owned the delivery plan.');
    expect(answersApi.submit.mock.calls[0][1].answerText).toContain('Action: I reorganized the work.');
    expect(answersApi.submit.mock.calls[0][1].answerText).toContain('Result: We shipped on schedule.');
  });

  it('updates the filler-word count while the user types', async () => {
    const interview = makeInterview({
      category: 'communication',
      practiceDrill: 'filler',
    });
    renderInterview({ interview, state: { interview, enterInterview: true } });
    fireEvent.change(await screen.findByLabelText('Your answer'), {
      target: { value: 'Um, I would, like, pause before continuing.' },
    });

    expect(screen.getByText('Filler words so far: 2. Try a short pause instead.')).toBeInTheDocument();
  });

  it('blocks route navigation while the interview is in progress', async () => {
    const interview = makeInterview();
    const router = renderInterview({ interview, state: { interview, enterInterview: true } });

    await screen.findByText('Interview in progress');
    await act(async () => { await router.navigate('/dashboard'); });

    expect(await screen.findByRole('dialog', { name: 'Leave this interview?' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Stay here' }));
    expect(screen.getByText('Interview in progress')).toBeInTheDocument();
  });
});
