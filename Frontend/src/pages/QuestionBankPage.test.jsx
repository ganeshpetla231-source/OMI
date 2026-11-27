import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LanguageProvider } from '../context/LanguageContext';
import { questionsApi } from '../services/api/questionsApi';
import QuestionBankPage from './QuestionBankPage';

vi.mock('../hooks/useQuestionOptions', () => ({
  useQuestionOptions: () => ({
    categories: { items: ['coding', 'general'], loading: false, error: null, offline: true },
    roles: { items: ['Backend Developer'], loading: false, error: null, offline: true },
    skills: { items: ['Arrays'], loading: false, error: null, offline: true },
    retry: vi.fn(),
  }),
}));

vi.mock('../services/api/questionsApi', () => ({
  questionsApi: {
    list: vi.fn(),
    getById: vi.fn(),
    random: vi.fn(),
  },
}));

const question = {
  id: 'question-1',
  text: 'How do hash maps work?',
  category: 'coding',
  jobRole: 'Backend Developer',
  difficulty: 'beginner',
  language: 'en',
  skill: 'Arrays',
  tags: ['data structures'],
};

function LocationOutput() {
  const location = useLocation();
  return <output data-testid="setup-state">{JSON.stringify(location.state)}</output>;
}

function renderQuestionBank() {
  return render(
    <LanguageProvider>
      <MemoryRouter initialEntries={['/questions']}>
        <Routes>
          <Route path="/questions" element={<QuestionBankPage />} />
          <Route path="/interview/setup" element={<LocationOutput />} />
        </Routes>
      </MemoryRouter>
    </LanguageProvider>,
  );
}

describe('QuestionBankPage', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    questionsApi.list.mockResolvedValue({
      items: [question],
      pagination: { page: 1, limit: 8, total: 1, pages: 1 },
      offline: true,
    });
    questionsApi.getById.mockResolvedValue({
      item: { ...question, expectedAnswer: 'Use a hash function to map keys to buckets.', keywords: ['key', 'bucket'], timeLimitSeconds: 60 },
      offline: true,
    });
    questionsApi.random.mockResolvedValue({ items: [question], offline: true });
  });

  it('shows cached questions, details, and an unscored random practice prompt', async () => {
    renderQuestionBank();

    expect(await screen.findByText(question.text)).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Offline – showing saved questions');
    fireEvent.click(screen.getByRole('button', { name: 'View details' }));
    expect(await screen.findByText('Use a hash function to map keys to buckets.')).toBeInTheDocument();
    expect(screen.getByText('key')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    fireEvent.click(screen.getByRole('button', { name: 'Random question' }));

    expect(await screen.findByLabelText('Your practice notes')).toBeInTheDocument();
    expect(screen.getByText('This practice question is not scored.')).toBeInTheDocument();
    expect(questionsApi.random).toHaveBeenCalledWith(expect.objectContaining({ count: 1 }));
  });

  it('maps category filters into question requests and forwards them to interview setup', async () => {
    renderQuestionBank();
    await screen.findByText(question.text);
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'coding' } });

    await waitFor(() => {
      expect(questionsApi.list).toHaveBeenLastCalledWith(expect.objectContaining({
        category: 'coding',
        page: 1,
        limit: 8,
      }));
    });
    fireEvent.change(screen.getByLabelText('Skill'), { target: { value: 'Arrays' } });
    fireEvent.click(screen.getByRole('button', { name: 'Practice these filters' }));

    expect(await screen.findByTestId('setup-state')).toHaveTextContent(JSON.stringify({
      category: 'coding',
      jobRole: '',
      skill: 'Arrays',
      difficulty: '',
      language: '',
      skills: ['Arrays'],
    }));
  });
});
