import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '../context/AuthContext';
import { LanguageProvider } from '../context/LanguageContext';
import { interviewsApi } from '../services/api/interviewsApi';
import { notesApi } from '../services/api/notesApi';
import { questionsApi } from '../services/api/questionsApi';
import { resumesApi } from '../services/api/resumesApi';
import { settingsApi } from '../services/api/settingsApi';
import InterviewSetupPage from './InterviewSetupPage';

vi.mock('../hooks/useQuestionOptions', () => ({
  useQuestionOptions: (category = '', jobRole = '') => ({
    categories: {
      items: ['hr', 'technical', 'general', 'communication', 'coding'],
      loading: false,
      error: null,
      offline: false,
    },
    roles: {
      items: category === 'coding' ? ['Backend Developer', 'Software Engineer'] : ['Any role', 'Project Manager'],
      loading: false,
      error: null,
      offline: false,
      query: [category],
    },
    skills: {
      items: category === 'coding' ? ['Hash maps', 'Arrays'] : ['Problem solving'],
      loading: false,
      error: null,
      offline: false,
      query: [category, jobRole],
    },
    retry: vi.fn(),
  }),
}));

vi.mock('../services/api/questionsApi', () => ({
  questionsApi: {
    list: vi.fn(),
    generate: vi.fn(),
  },
}));

vi.mock('../services/api/notesApi', () => ({
  notesApi: { list: vi.fn() },
}));

vi.mock('../services/api/resumesApi', () => ({
  resumesApi: { list: vi.fn() },
}));

vi.mock('../services/api/interviewsApi', () => ({
  interviewsApi: {
    create: vi.fn(),
  },
}));

vi.mock('../services/api/settingsApi', () => ({
  settingsApi: { get: vi.fn() },
}));

function LocationOutput() {
  const location = useLocation();
  return <output data-testid="created-interview">{JSON.stringify(location.state?.interview)}</output>;
}

function renderSetup(state, auth = { user: null, guestProfile: { guestId: 'setup-test' }, isGuest: true }) {
  return render(
    <AuthContext.Provider value={auth}>
      <LanguageProvider>
        <MemoryRouter initialEntries={[{ pathname: '/interview/setup', state }]}>
          <Routes>
            <Route path="/interview/setup" element={<InterviewSetupPage />} />
            <Route path="/interview/:id/check" element={<LocationOutput />} />
          </Routes>
        </MemoryRouter>
      </LanguageProvider>
    </AuthContext.Provider>,
  );
}

describe('InterviewSetupPage', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();
    questionsApi.list.mockImplementation(async (filters = {}) => {
      const total = filters.category === 'coding' || (filters.language && filters.language !== 'en') ? 0 : 10;
      return {
        items: Array.from({ length: Math.min(total, filters.limit || 5) }, (_, index) => ({ id: `question-${index}` })),
        pagination: { page: 1, limit: filters.limit || 5, total, pages: Math.ceil(total / (filters.limit || 5)) },
      };
    });
    questionsApi.generate.mockResolvedValue({ items: [{ id: 'generated-1' }] });
    notesApi.list.mockResolvedValue({ items: [{ id: 'note-1', title: 'System design notes' }] });
    resumesApi.list.mockResolvedValue([{ id: 'resume-1', originalName: 'profile.pdf' }]);
    settingsApi.get.mockResolvedValue({
      interviewPreferences: {
        category: 'general',
        difficulty: 'beginner',
        duration: 15,
        questionCount: 5,
        style: 'standard',
        mode: 'text',
        language: 'en',
      },
    });
    interviewsApi.create.mockResolvedValue({
      id: 'local-interview-test',
      category: 'general',
      questions: [{ questionId: 'question-1' }],
    });
  });

  it('prefills category, role, and skills from router state', async () => {
    renderSetup({
      category: 'coding',
      jobRole: 'Backend Developer',
      difficulty: 'advanced',
      skill: 'Hash maps',
    });

    expect(await screen.findByDisplayValue('Backend Developer')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Coding/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('checkbox', { name: 'Hash maps' })).toBeChecked();
  });

  it('prefills defaults from saved settings when no route, draft, or profile preferences exist', async () => {
    questionsApi.list.mockImplementation(async (filters = {}) => ({
      items: [{ id: `${filters.language}-question` }],
      pagination: { page: 1, limit: 1, total: 10, pages: 10 },
    }));
    settingsApi.get.mockResolvedValue({
      interviewPreferences: {
        category: 'technical',
        difficulty: 'advanced',
        duration: 30,
        questionCount: 10,
        style: 'friendly',
        mode: 'text',
        language: 'hi',
      },
    });
    renderSetup();

    expect(await screen.findByRole('button', { name: /Technical/ })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByRole('button', { name: '30 minutes' })).toHaveClass('bg-primary');
    expect(screen.getByRole('button', { name: '10 questions' })).toHaveClass('bg-primary');
    expect(screen.getByLabelText('Hindi')).toBeChecked();
  });

  it('blocks the next step when the chosen category and role have no questions', async () => {
    renderSetup();

    fireEvent.click(screen.getByRole('button', { name: /Coding/ }));
    await screen.findByDisplayValue('Backend Developer');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('No questions are available for this combination.');
    expect(screen.getByRole('heading', { name: 'Choose a category' })).toBeInTheDocument();
  });

  it('disables languages with no matching questions', async () => {
    renderSetup();
    fireEvent.click(await screen.findByRole('button', { name: 'Next' }));

    expect(await screen.findByRole('heading', { name: 'Choose your practice preferences' })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByLabelText('Telugu')).toBeDisabled();
      expect(screen.getByLabelText('Hindi')).toBeDisabled();
      expect(screen.getByLabelText('English')).toBeEnabled();
    });
  });

  it('restores a saved setup draft after remounting', async () => {
    const firstRender = renderSetup();
    fireEvent.click(screen.getByRole('button', { name: /Coding/ }));
    expect(await screen.findByDisplayValue('Backend Developer')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Hash maps' }));
    firstRender.unmount();

    renderSetup();

    expect(screen.getByRole('button', { name: /Coding/ })).toHaveAttribute('aria-pressed', 'true');
    expect(await screen.findByRole('checkbox', { name: 'Hash maps' })).toBeChecked();
  });

  it('passes the selected note ID when creating an interview', async () => {
    renderSetup({ source: 'notes', noteId: 'note-1' });
    fireEvent.click(await screen.findByRole('button', { name: 'Next' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Next' }));
    expect(await screen.findByDisplayValue('System design notes')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Create interview' }));

    await waitFor(() => {
      expect(interviewsApi.create).toHaveBeenCalledWith(expect.objectContaining({
        source: 'notes',
        noteId: 'note-1',
        questionCount: 5,
      }));
    });
  });

  it('passes the selected resume ID when creating an authenticated online interview', async () => {
    renderSetup({ source: 'resume', resumeId: 'resume-1' }, {
      user: { id: 'student-1' },
      guestProfile: null,
      isAuthenticated: true,
      isGuest: false,
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Next' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Next' }));
    expect(await screen.findByDisplayValue('profile.pdf')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Create interview' }));

    await waitFor(() => {
      expect(interviewsApi.create).toHaveBeenCalledWith(expect.objectContaining({
        source: 'resume',
        resumeId: 'resume-1',
        questionCount: 5,
      }));
    });
  });
});
