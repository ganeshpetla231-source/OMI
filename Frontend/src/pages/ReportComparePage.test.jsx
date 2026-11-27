import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LanguageProvider } from '../context/LanguageContext';
import { reportsApi } from '../services/api/reportsApi';
import ReportComparePage from './ReportComparePage';

vi.mock('../services/api/reportsApi', () => ({
  reportsApi: { get: vi.fn() },
}));

function renderComparison() {
  const router = createMemoryRouter([{ path: '/reports/compare', element: <ReportComparePage /> }], {
    initialEntries: ['/reports/compare?ids=report-1,report-2'],
    future: { v7_startTransition: true, v7_relativeSplatPath: true },
  });
  render(<LanguageProvider><RouterProvider router={router} /></LanguageProvider>);
}

describe('ReportComparePage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows side-by-side scores for two reports in the same category', async () => {
    reportsApi.get
      .mockResolvedValueOnce({ report: { id: 'report-1', title: 'First interview', category: 'technical', scores: { total: 70, content: 68, communication: 75 } } })
      .mockResolvedValueOnce({ report: { id: 'report-2', title: 'Second interview', category: 'technical', scores: { total: 84, content: 80, communication: 90 } } });
    renderComparison();

    expect(await screen.findByText('Compare interviews')).toBeInTheDocument();
    expect(screen.getByText('First interview')).toBeInTheDocument();
    expect(screen.getByText('Second interview')).toBeInTheDocument();
    expect(screen.getByText('84% · Strong')).toBeInTheDocument();
  });
});
