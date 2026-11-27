import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../components/ui/Toast';
import { LanguageProvider } from '../context/LanguageContext';
import { reportsApi } from '../services/api/reportsApi';
import ReportHistoryPage from './ReportHistoryPage';

vi.mock('../services/api/reportsApi', () => ({
  reportsApi: { list: vi.fn(), remove: vi.fn() },
}));

function renderHistory() {
  const router = createMemoryRouter([{ path: '/reports', element: <ReportHistoryPage /> }], {
    initialEntries: ['/reports'],
  });
  render(
    <LanguageProvider>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </LanguageProvider>,
  );
}

describe('ReportHistoryPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows loading and then the friendly empty state', async () => {
    let resolveList;
    reportsApi.list.mockImplementation(() => new Promise((resolve) => { resolveList = resolve; }));
    renderHistory();

    expect(screen.getByLabelText('Loading reports')).toBeInTheDocument();
    resolveList({ items: [], pagination: { page: 1, pages: 0, total: 0 } });

    expect(await screen.findByText('No reports yet')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start an interview' })).toBeInTheDocument();
  });

  it('offers retry for a list error and recovers when the request succeeds', async () => {
    reportsApi.list
      .mockRejectedValueOnce(new Error('Reports unavailable'))
      .mockResolvedValueOnce({ items: [], pagination: { page: 1, pages: 0, total: 0 } });
    renderHistory();

    expect(await screen.findByRole('alert')).toHaveTextContent('Reports unavailable');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => expect(screen.getByText('No reports yet')).toBeInTheDocument());
    expect(reportsApi.list).toHaveBeenCalledTimes(2);
  });

  it('requires confirmation before deleting a report and its interview data', async () => {
    reportsApi.list
      .mockResolvedValueOnce({
        items: [{ id: 'report-1', title: 'Round one', category: 'technical', createdAt: '2026-11-25', scores: { total: 72 }, method: 'rule-based-v1' }],
        pagination: { page: 1, pages: 1, total: 1 },
      })
      .mockResolvedValueOnce({ items: [], pagination: { page: 1, pages: 0, total: 0 } });
    reportsApi.remove.mockResolvedValue({ id: 'report-1' });
    renderHistory();

    fireEvent.click(await screen.findByRole('button', { name: 'Delete report: Round one' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('The interview record will also be removed');
    fireEvent.click(screen.getByRole('button', { name: 'Delete report' }));

    expect(await screen.findByText('No reports yet')).toBeInTheDocument();
    expect(reportsApi.remove).toHaveBeenCalledWith('report-1');
  });
});
