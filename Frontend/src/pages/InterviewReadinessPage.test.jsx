import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LanguageProvider } from '../context/LanguageContext';
import { interviewsApi } from '../services/api/interviewsApi';
import InterviewReadinessPage from './InterviewReadinessPage';

vi.mock('../hooks/useOnlineStatus', () => ({ useOnlineStatus: () => true }));
vi.mock('../services/api/interviewsApi', () => ({
  interviewsApi: {
    get: vi.fn(),
    start: vi.fn(),
  },
}));

const interview = {
  id: 'local-interview-1',
  category: 'general',
  jobRole: 'Any role',
  difficulty: 'beginner',
  duration: 15,
  language: 'en',
  mode: 'text',
  questions: [{ questionId: 'question-1', text: 'Tell me about yourself.' }],
  status: 'draft',
};

function renderReadiness(savedInterview = interview) {
  return render(
    <LanguageProvider>
      <MemoryRouter initialEntries={[{
        pathname: `/interview/${savedInterview.id}/check`,
        state: { interview: savedInterview },
      }]}>
        <Routes>
          <Route path="/interview/:id/check" element={<InterviewReadinessPage />} />
          <Route path="/interview/:id" element={<h1>Interview workspace</h1>} />
          <Route path="/dashboard" element={<h1>Dashboard destination</h1>} />
        </Routes>
      </MemoryRouter>
    </LanguageProvider>,
  );
}

describe('InterviewReadinessPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    interviewsApi.start.mockResolvedValue({ ...interview, status: 'in_progress' });
  });

  it('starts text interviews without requesting microphone access', async () => {
    renderReadiness();

    expect(screen.getByText('Internet connection available')).toBeInTheDocument();
    expect(screen.getByText('1 questions are loaded')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Test microphone' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Begin interview' }));

    expect(await screen.findByRole('heading', { name: 'Interview workspace' })).toBeInTheDocument();
    expect(interviewsApi.start).toHaveBeenCalledWith(interview.id);
  });

  it('does not allow starting an interview with no loaded questions', () => {
    renderReadiness({ ...interview, questions: [] });

    expect(screen.getByRole('button', { name: 'Begin interview' })).toBeDisabled();
    expect(interviewsApi.start).not.toHaveBeenCalled();
  });

  it('offers text mode when voice capabilities are unavailable', () => {
    renderReadiness({ ...interview, mode: 'voice' });

    expect(screen.getByText('Speech recognition is not available in this browser. Choose Text mode.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Begin interview' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Continue with Text mode' })).toBeInTheDocument();
    expect(interviewsApi.start).not.toHaveBeenCalled();
  });
});
