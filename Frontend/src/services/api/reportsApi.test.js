import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { TOKEN_KEY } from '../../utils/authStorage';

vi.mock('./client', () => ({
  apiClient: { get: vi.fn(), delete: vi.fn() },
}));

describe('reportsApi', () => {
  let reportsApi;
  let saveLocalReport;
  let getLocalReport;
  let apiClient;

  beforeEach(async () => {
    vi.stubGlobal('indexedDB', new IDBFactory());
    vi.stubEnv('VITE_USE_MOCK', 'false');
    vi.resetModules();
    localStorage.clear();
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    ({ reportsApi } = await import('./reportsApi'));
    ({ saveLocalReport, getLocalReport } = await import('../offline/localInterviewStore'));
    ({ apiClient } = await import('./client'));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  });

  it('filters and paginates locally saved reports', async () => {
    await saveLocalReport({ id: 'report-a', interviewId: 'local-a', category: 'technical', createdAt: '2026-11-25T10:00:00Z', scores: { total: 80 } });
    await saveLocalReport({ id: 'report-b', interviewId: 'local-b', category: 'general', createdAt: '2026-11-24T10:00:00Z', scores: { total: 60 } });
    await saveLocalReport({ id: 'report-c', interviewId: 'local-c', category: 'technical', createdAt: '2026-11-20T10:00:00Z', scores: { total: 90 } });

    const result = await reportsApi.list({ category: 'technical', from: '2026-11-25', to: '2026-11-25', page: 1, limit: 5 });

    expect(result.items.map((report) => report.id)).toEqual(['report-a']);
    expect(result.pagination).toMatchObject({ total: 1, page: 1, pages: 1 });
    expect(result.offline).toBe(true);
  });

  it('zero-fills local weekly and monthly progress periods', async () => {
    await saveLocalReport({
      id: 'report-current',
      interviewId: 'local-current',
      createdAt: new Date().toISOString(),
      scores: { total: 82, content: 80, communication: 90 },
    });

    const weekly = await reportsApi.progress({ period: 'weekly' });
    const monthly = await reportsApi.progress({ period: 'monthly' });

    expect(weekly.points).toHaveLength(8);
    expect(monthly.points).toHaveLength(12);
    expect(weekly.points.at(-1)).toMatchObject({ total: 82, content: 80, communication: 90, interviews: 1 });
    expect(weekly.points.filter((point) => point.interviews === 0)).toHaveLength(7);
    expect(monthly.points.filter((point) => point.interviews === 0)).toHaveLength(11);
  });

  it('reads the PDF filename from the response Content-Disposition header', async () => {
    localStorage.setItem(TOKEN_KEY, 'account-token');
    apiClient.get.mockResolvedValue({
      data: new Blob(['pdf']),
      headers: { 'content-disposition': "attachment; filename*=UTF-8''practice%20report.pdf" },
    });

    await expect(reportsApi.download('server-report')).resolves.toMatchObject({
      filename: 'practice report.pdf',
      offline: false,
    });
    expect(apiClient.get).toHaveBeenCalledWith('/reports/server-report/pdf', { responseType: 'blob' });
  });

  it('caches online report details so they remain available offline', async () => {
    localStorage.setItem(TOKEN_KEY, 'account-token');
    apiClient.get.mockResolvedValue({
      data: { report: { id: 'server-cached', interviewId: 'interview-cached', title: 'Cached report', scores: { total: 76 } } },
    });

    await reportsApi.get('server-cached');
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });

    await expect(reportsApi.get('server-cached')).resolves.toMatchObject({
      report: { id: 'server-cached', title: 'Cached report' },
      offline: true,
    });
  });

  it('fills missing periods in server progress responses with zero scores', async () => {
    localStorage.setItem(TOKEN_KEY, 'account-token');
    apiClient.get.mockResolvedValue({
      data: {
        points: [{
          date: new Date().toISOString(),
          averageScore: 73,
          contentScore: 70,
          communicationScore: 80,
          count: 1,
        }],
      },
    });

    const result = await reportsApi.progress({ period: 'monthly' });

    expect(result.points).toHaveLength(12);
    expect(result.points.at(-1)).toMatchObject({ total: 73, content: 70, communication: 80, interviews: 1 });
    expect(result.points.filter((point) => point.interviews === 0)).toHaveLength(11);
  });

  it('falls back to a saved local report when the server is unreachable', async () => {
    localStorage.setItem(TOKEN_KEY, 'account-token');
    await saveLocalReport({ id: 'server-report', interviewId: 'server-interview', title: 'Saved report' });
    apiClient.get.mockRejectedValue(Object.assign(new Error('Network failed'), { code: 'NETWORK_ERROR' }));

    await expect(reportsApi.get('server-report')).resolves.toMatchObject({
      report: { id: 'server-report', title: 'Saved report' },
      offline: true,
    });
  });

  it('removes a local report and its saved interview data', async () => {
    await saveLocalReport({ id: 'local_report-delete', interviewId: 'local_delete', title: 'Delete me' });

    await reportsApi.remove('local_report-delete');

    await expect(getLocalReport('local_report-delete')).resolves.toBeUndefined();
  });
});
