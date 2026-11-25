import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '../context/AuthContext';
import { LanguageProvider } from '../context/LanguageContext';
import { interviewsApi } from '../services/api/interviewsApi';
import { questionsApi } from '../services/api/questionsApi';
import { getDailyPracticeStreak } from '../services/offline/dailyPractice';
import { saveInterviewSnapshot } from '../services/offline/localInterviewStore';
import PracticePage from './PracticePage';

vi.mock('../services/api/interviewsApi', () => ({
  interviewsApi: { create: vi.fn() },
}));

vi.mock('../services/api/questionsApi', () => ({
  questionsApi: { list: vi.fn() },
}));

vi.mock('../services/offline/dailyPractice', () => ({
  getDailyPracticeStreak: vi.fn(),
}));

vi.mock('../services/offline/localInterviewStore', () => ({
  saveInterviewSnapshot: vi.fn(),
}));

const questions = [
  { id: 'intro-1', text: 'Introduce yourself to a hiring manager.', category: 'communication', jobRole: 'Any role', difficulty: 'beginner', language: 'en', skill: 'Self-introduction', tags: ['practice:intro'] },
  { id: 'star-1', text: 'Describe a challenge using STAR.', category: 'communication', jobRole: 'Any role', difficulty: 'beginner', language: 'en', skill: 'STAR method', tags: ['practice:star'] },
  { id: 'filler-1', text: 'Explain a familiar topic.', category: 'communication', jobRole: 'Any role', difficulty: 'beginner', language: 'en', skill: 'Clarity', tags: ['practice:filler'] },
  { id: 'pace-1', text: 'Describe a project at a steady pace.', category: 'communication', jobRole: 'Any role', difficulty: 'beginner', language: 'en', skill: 'Speaking pace', tags: ['practice:pace'] },
];

function LocationOutput() {
  const location = useLocation();
  return <output data-testid="practice-interview">{JSON.stringify(location.state?.interview)}</output>;
}

function renderPage() {
  return render(
    <AuthContext.Provider value={{ user: null, guestProfile: { name: 'Guest' }, isGuest: true }}>
      <LanguageProvider>
        <MemoryRouter initialEntries={['/practice']}>
          <Routes>
            <Route path="/practice" element={<PracticePage />} />
            <Route path="/interview/:id/check" element={<LocationOutput />} />
          </Routes>
        </MemoryRouter>
      </LanguageProvider>
    </AuthContext.Provider>,
  );
}

describe('PracticePage', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    questionsApi.list.mockResolvedValue({
      items: questions,
      pagination: { page: 1, limit: 100, total: questions.length, pages: 1 },
    });
    getDailyPracticeStreak.mockResolvedValue({ streakCount: 2, lastCompletedDate: '2026-01-01' });
    interviewsApi.create.mockResolvedValue({
      id: 'local-practice-1',
      status: 'draft',
      questions: [{ questionId: 'star-1', text: 'Describe a challenge using STAR.' }],
    });
    saveInterviewSnapshot.mockResolvedValue({});
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  });

  it('shows all communication drills and the saved daily streak', async () => {
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Self-introduction' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'STAR method' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Filler-word reduction' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Speaking pace' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Daily speaking challenge' })).toBeInTheDocument();
    expect(screen.getByText('Daily challenge streak: 2 days')).toBeInTheDocument();
  });

  it('starts a one-question STAR interview and saves its drill metadata locally', async () => {
    renderPage();
    await screen.findByRole('heading', { name: 'STAR method' });
    fireEvent.click(screen.getAllByRole('button', { name: 'Start one-question drill' })[1]);

    await waitFor(() => {
      expect(interviewsApi.create).toHaveBeenCalledWith(expect.objectContaining({
        category: 'communication',
        questionCount: 1,
        mode: 'text',
        skills: ['STAR method'],
        preferredQuestionId: 'star-1',
      }));
      expect(saveInterviewSnapshot).toHaveBeenCalledWith(expect.objectContaining({
        interview: expect.objectContaining({ practiceDrill: 'star' }),
      }));
    });
    expect(await screen.findByTestId('practice-interview')).toHaveTextContent('"practiceDrill":"star"');
  });

  it('explains why voice is unavailable and disables voice-only practice', async () => {
    renderPage();
    await screen.findByRole('heading', { name: 'Speaking pace' });

    expect(screen.getByRole('button', { name: 'Voice' })).toBeDisabled();
    expect(screen.getAllByText('Speech recognition is not supported in this browser. Use Text mode.').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: 'Start one-question drill' })[3]).toBeDisabled();
  });
});
