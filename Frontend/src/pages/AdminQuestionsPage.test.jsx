import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../components/ui/Toast';
import { LanguageProvider } from '../context/LanguageContext';
import { adminApi } from '../services/api/adminApi';
import { questionsApi } from '../services/api/questionsApi';
import AdminQuestionsPage from './AdminQuestionsPage';

const question = {
  id: 'question-1',
  text: 'How do you solve a difficult problem?',
  category: 'technical',
  jobRole: 'Software Engineer',
  difficulty: 'beginner',
  language: 'en',
  skill: 'Problem solving',
  tags: ['analysis'],
  expectedAnswer: 'Describe a clear approach and explain the result.',
  keywords: ['approach'],
  evaluationCriteria: ['Explain the steps'],
  timeLimitSeconds: 120,
  isActive: true,
};

vi.mock('../hooks/useQuestionOptions', () => ({
  useQuestionOptions: () => ({
    categories: { items: ['technical', 'general'], loading: false, error: null },
    roles: { items: ['Software Engineer', 'Any role'], loading: false, error: null },
    skills: { items: ['Problem solving', 'Communication'], loading: false, error: null },
    retry: vi.fn(),
  }),
}));

vi.mock('../services/api/adminApi', () => ({
  adminApi: {
    getDashboard: vi.fn(),
    createQuestion: vi.fn(),
    updateQuestion: vi.fn(),
    deleteQuestion: vi.fn(),
  },
}));

vi.mock('../services/api/questionsApi', () => ({
  questionsApi: {
    list: vi.fn(),
    getCategories: vi.fn(),
    getRoles: vi.fn(),
    getSkills: vi.fn(),
  },
}));

function renderPage() {
  return render(
    <ToastProvider>
      <LanguageProvider>
        <MemoryRouter><AdminQuestionsPage /></MemoryRouter>
      </LanguageProvider>
    </ToastProvider>,
  );
}

describe('AdminQuestionsPage', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    questionsApi.list.mockResolvedValue({
      items: [question],
      pagination: { page: 1, limit: 10, total: 1, pages: 1 },
    });
    adminApi.createQuestion.mockResolvedValue({ question: { ...question, id: 'question-2' } });
    adminApi.updateQuestion.mockResolvedValue({ question: { ...question, text: 'Updated question text' } });
    adminApi.deleteQuestion.mockResolvedValue({ softDeleted: true, message: 'Question deactivated by server.' });
  });

  it('uses the question API to apply active-state filters', async () => {
    renderPage();
    await screen.findByText(question.text);
    fireEvent.change(screen.getByLabelText('Active status'), { target: { value: 'inactive' } });

    await waitFor(() => {
      expect(questionsApi.list).toHaveBeenLastCalledWith(expect.objectContaining({
        isActive: false,
        includeInactive: true,
        page: 1,
      }));
    });
  });

  it('validates required fields before creating a question', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Add question' }));
    const dialog = await screen.findByRole('dialog', { name: 'Create a question' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add question' }));

    expect(within(dialog).getAllByRole('alert').length).toBeGreaterThan(0);
    expect(adminApi.createQuestion).not.toHaveBeenCalled();
  });

  it('creates a fully populated question from the form', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Add question' }));
    const dialog = await screen.findByRole('dialog', { name: 'Create a question' });
    fireEvent.change(within(dialog).getByLabelText('Question'), {
      target: { value: 'How do you solve a difficult problem?' },
    });
    fireEvent.change(within(dialog).getByLabelText('Expected answer'), {
      target: { value: 'Describe a clear approach and explain the result.' },
    });
    fireEvent.change(within(dialog).getByLabelText('Category'), { target: { value: 'technical' } });
    fireEvent.change(within(dialog).getByLabelText('Job role'), { target: { value: 'Software Engineer' } });
    fireEvent.change(within(dialog).getByLabelText('Skill'), { target: { value: 'Problem solving' } });
    fireEvent.change(within(dialog).getByLabelText('Keywords'), { target: { value: 'approach' } });
    fireEvent.keyDown(within(dialog).getByLabelText('Keywords'), { key: 'Enter', code: 'Enter' });
    fireEvent.change(within(dialog).getByLabelText('Evaluation criteria'), { target: { value: 'Explain the steps' } });
    fireEvent.keyDown(within(dialog).getByLabelText('Evaluation criteria'), { key: 'Enter', code: 'Enter' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add question' }));

    await waitFor(() => expect(adminApi.createQuestion).toHaveBeenCalledWith(expect.objectContaining({
      category: 'technical',
      jobRole: 'Software Engineer',
      skill: 'Problem solving',
      keywords: ['approach'],
      evaluationCriteria: ['Explain the steps'],
      timeLimitSeconds: 120,
    })));
  });

  it('edits and soft-deletes a question while showing the server deletion result', async () => {
    renderPage();
    const edit = await screen.findByRole('button', { name: `Edit question: ${question.text}` });
    fireEvent.click(edit);
    const dialog = await screen.findByRole('dialog', { name: 'Edit question' });
    fireEvent.change(within(dialog).getByLabelText('Question'), { target: { value: 'Updated question text' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(adminApi.updateQuestion).toHaveBeenCalledWith('question-1', expect.objectContaining({ text: 'Updated question text' })));

    fireEvent.click(await screen.findByRole('button', { name: `Delete question: ${question.text}` }));
    const confirmDialog = await screen.findByRole('dialog', { name: 'Delete this question?' });
    fireEvent.click(within(confirmDialog).getByRole('button', { name: 'Delete question' }));
    expect(await screen.findByRole('dialog', { name: 'Question deactivated' })).toBeInTheDocument();
    expect(adminApi.deleteQuestion).toHaveBeenCalledWith('question-1');
    expect(screen.getByText('Question deactivated by server.')).toBeInTheDocument();
  });

  it('duplicates a question through the create endpoint', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: `Duplicate question: ${question.text}` }));
    const dialog = await screen.findByRole('dialog', { name: 'Duplicate question' });
    expect(within(dialog).getByLabelText('Question')).toHaveValue(`${question.text} (copy)`);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add question' }));

    await waitFor(() => expect(adminApi.createQuestion).toHaveBeenCalledWith(expect.objectContaining({
      text: `${question.text} (copy)`,
    })));
  });

  it('imports valid JSON questions through the API and reports invalid entries', async () => {
    renderPage();
    const importFile = new File([JSON.stringify({ questions: [question, { text: '' }] })], 'questions.json', {
      type: 'application/json',
    });
    fireEvent.change(screen.getByLabelText('Import JSON'), { target: { files: [importFile] } });

    await waitFor(() => {
      expect(adminApi.createQuestion).toHaveBeenCalledWith(expect.objectContaining({
        text: question.text,
        category: question.category,
      }));
      expect(screen.getByText('Import issues (1)')).toBeInTheDocument();
    });
  });
});
