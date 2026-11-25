import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../components/ui/Toast';
import { LanguageProvider } from '../context/LanguageContext';
import { answersApi } from '../services/api/answersApi';
import { reportsApi } from '../services/api/reportsApi';
import ReportDetailsPage from './ReportDetailsPage';

vi.mock('../services/api/answersApi', () => ({
  answersApi: { retry: vi.fn() },
}));

vi.mock('../services/api/reportsApi', () => ({
  reportsApi: { get: vi.fn(), download: vi.fn() },
}));

const originalEvaluation = {
  score: 55,
  contentScore: 50,
  communicationScore: 80,
  method: 'rule-based-v1',
  breakdown: { relevance: 50, keywordCoverage: 60, completeness: 40, clarity: 45, communication: 80, fillerCount: 0 },
  matchedKeywords: ['impact'],
  missingKeywords: ['result'],
  explanation: 'The answer needs a clearer result.',
  sampleAnswer: 'Explain the outcome.',
  suggestions: ['Add a measurable result.'],
};

const report = (method = 'rule-based-v1') => ({
  id: 'report-1',
  interviewId: 'interview-1',
  title: 'Technical interview',
  category: 'technical',
  method,
  scores: { total: 55, content: 50, communication: 80 },
  strengths: ['Clear reasoning'],
  weaknesses: ['Missing result'],
  suggestions: ['Quantify the outcome.'],
  questionResults: [{
    answerId: 'answer-1',
    questionId: 'question-1',
    questionIndex: 0,
    questionText: 'How did you solve the problem?',
    answerText: 'I improved the system.',
    evaluation: originalEvaluation,
  }],
  createdAt: '2026-11-25T10:00:00.000Z',
});

function renderReport() {
  const router = createMemoryRouter([{ path: '/reports/:id', element: <ReportDetailsPage /> }], {
    initialEntries: ['/reports/report-1'],
    future: { v7_startTransition: true, v7_relativeSplatPath: true },
  });
  render(
    <LanguageProvider>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </LanguageProvider>,
  );
}

describe('ReportDetailsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    reportsApi.get.mockResolvedValue({ report: report(), offline: false });
  });

  it('retries an answer, compares its previous score, and updates report totals', async () => {
    const newEvaluation = { ...originalEvaluation, score: 85, contentScore: 86 };
    answersApi.retry.mockResolvedValue({
      answer: { id: 'answer-1', answerText: 'I improved response time by 30 percent.', evaluation: newEvaluation },
      previousEvaluation: originalEvaluation,
      offline: true,
    });
    renderReport();

    fireEvent.click(await screen.findByText(/Question 1\./));
    fireEvent.click(screen.getByRole('button', { name: 'Retry answer' }));
    fireEvent.change(screen.getByLabelText('Your answer'), { target: { value: 'I improved response time by 30 percent.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Submit retry' }));

    await waitFor(() => expect(screen.getByText('Previous 55% · New 85% · up 30 points')).toBeInTheDocument());
    expect(answersApi.retry).toHaveBeenCalledWith('interview-1', 'answer-1', {
      questionId: 'question-1',
      questionIndex: 0,
      answerText: 'I improved response time by 30 percent.',
    });
    expect(screen.getByText('I improved response time by 30 percent.')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Total score: 85%' })).toBeInTheDocument();
  });

  it('explains that voice metrics are unavailable for a text-only report', async () => {
    renderReport();
    expect(await screen.findByText(/This interview has no voice metrics/)).toBeInTheDocument();
    expect(screen.queryByText('Speaking pace')).not.toBeInTheDocument();
  });

  it('shows recorded pace, fillers, and longest pause for voice answers', async () => {
    const voiceReport = report();
    voiceReport.questionResults[0].voiceMetrics = {
      wordsPerMinute: 125,
      fillerWords: { um: 1 },
      pauseCount: 2,
      longestPauseSeconds: 2.5,
    };
    reportsApi.get.mockResolvedValue({ report: voiceReport, offline: true });
    renderReport();

    expect(await screen.findByText('Speaking pace')).toBeInTheDocument();
    expect(screen.getByText('125')).toBeInTheDocument();
    expect(screen.getByText('2.5')).toBeInTheDocument();
    expect(screen.getByText('Longest pause')).toBeInTheDocument();
  });

  it('surfaces PDF download errors in a toast', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => {});
    reportsApi.download.mockRejectedValue(new Error('PDF service unavailable'));
    renderReport();
    fireEvent.click(await screen.findByRole('button', { name: 'Download PDF' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not download the report PDF: PDF service unavailable');
    expect(print).not.toHaveBeenCalled();
    print.mockRestore();
  });

  it('uses the print dialog for a locally scored report', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => {});
    reportsApi.get.mockResolvedValue({ report: report('local-rule-based-v1'), offline: true });
    renderReport();
    fireEvent.click(await screen.findByRole('button', { name: 'Download PDF' }));

    expect(print).toHaveBeenCalledOnce();
    expect(reportsApi.download).not.toHaveBeenCalled();
    print.mockRestore();
  });
});
