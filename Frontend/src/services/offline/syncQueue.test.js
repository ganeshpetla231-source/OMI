import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { TOKEN_KEY, GUEST_MODE_KEY } from '../../utils/authStorage';
import { clearStore, getRecord } from './db';
import {
  enqueueSyncOperation,
  getSyncQueue,
  processSyncQueue,
} from './syncQueue';
import {
  getInterviewIdMapping,
  getInterviewSnapshot,
  listLocalAnswers,
  saveInterviewSnapshot,
  saveLocalAnswer,
} from './localInterviewStore';

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());
afterEach(() => server.resetHandlers());

beforeEach(async () => {
  localStorage.clear();
  localStorage.setItem(TOKEN_KEY, 'test-token');
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  await Promise.all(['interviews', 'answers', 'reports', 'syncQueue', 'settings'].map(clearStore));
});

describe('offline sync queue', () => {
  it('sends operations in dependency order, maps server IDs, and replaces the local interview', async () => {
    const calls = [];
    server.use(
      http.post('/api/interviews', async ({ request }) => {
        calls.push('create');
        const body = await request.json();
        expect(body.clientId).toBe('client-1');
        return HttpResponse.json({ success: true, data: { interview: { id: 'server-1', status: 'draft' } } });
      }),
      http.post('/api/interviews/server-1/start', () => {
        calls.push('start');
        return HttpResponse.json({ success: true, data: { interview: { id: 'server-1', status: 'in_progress' } } });
      }),
      http.post('/api/interviews/server-1/answers', () => {
        calls.push('answer');
        return HttpResponse.json({ success: true, data: { answers: [] } });
      }),
      http.post('/api/interviews/server-1/complete', () => {
        calls.push('complete');
        return HttpResponse.json({
          success: true,
          data: {
            interview: { id: 'server-1', status: 'completed', reportId: 'report-1' },
            report: { id: 'report-1', interviewId: 'server-1', totalScore: 80 },
          },
        });
      }),
    );

    const localInterview = {
      id: 'local_interview-1',
      clientId: 'client-1',
      status: 'draft',
      questions: [{ questionId: 'q1', text: 'Question one' }],
    };
    await saveInterviewSnapshot({ interview: localInterview, answers: {}, currentIndex: 0 });
    const answer = await saveLocalAnswer(localInterview.id, {
      id: `${localInterview.id}-answer-0`,
      questionIndex: 0,
      answerText: 'An answer',
    });

    await enqueueSyncOperation('interview.create', { interview: localInterview }, {
      localId: localInterview.id,
      clientId: localInterview.clientId,
    });
    await enqueueSyncOperation('interview.start', { request: {} }, {
      localId: localInterview.id,
      clientId: localInterview.clientId,
    });
    await enqueueSyncOperation('answers.submit', { answers: [answer] }, {
      localId: localInterview.id,
      clientId: localInterview.clientId,
    });
    await enqueueSyncOperation('interview.complete', { request: {} }, {
      localId: localInterview.id,
      clientId: localInterview.clientId,
    });

    const result = await processSyncQueue();

    expect(calls).toEqual(['create', 'start', 'answer', 'complete']);
    expect(result).toMatchObject({ synced: 4, pending: 0, failed: 0 });
    expect(await getInterviewIdMapping(localInterview.id)).toBe('server-1');
    expect(await getInterviewSnapshot(localInterview.id)).toBeNull();
    expect(await getInterviewSnapshot('server-1')).toMatchObject({
      interview: { id: 'server-1', status: 'completed' },
    });
    expect(await listLocalAnswers('server-1')).toEqual([
      expect.objectContaining({ answerText: 'An answer', interviewId: 'server-1' }),
    ]);
    expect(await getRecord('reports', 'report-1')).toMatchObject({ totalScore: 80 });
    expect((await getSyncQueue()).every((entry) => entry.status === 'synced')).toBe(true);
  });

  it('deduplicates idempotency keys and retries retryable server failures', async () => {
    let attempts = 0;
    server.use(http.post('/api/interviews/server-2/answers', () => {
      attempts += 1;
      if (attempts === 1) return HttpResponse.json({ message: 'Unavailable' }, { status: 500 });
      return HttpResponse.json({ success: true, data: { answers: [] } });
    }));

    const operation = {
      localId: 'server-2',
      clientId: 'client-2',
      payload: { answers: [{ questionIndex: 0, answerText: 'Answer' }] },
    };
    await enqueueSyncOperation('answers.submit', operation.payload, {
      localId: operation.localId,
      clientId: operation.clientId,
      idempotencyKey: 'answer-once',
    });
    await enqueueSyncOperation('answers.submit', operation.payload, {
      localId: operation.localId,
      clientId: operation.clientId,
      idempotencyKey: 'answer-once',
    });

    expect(await getSyncQueue()).toHaveLength(1);
    const failedAttempt = await processSyncQueue();
    expect(failedAttempt).toMatchObject({ synced: 0, pending: 1, failed: 0 });
    expect(await getSyncQueue()).toEqual([
      expect.objectContaining({ id: 'answer-once', status: 'pending', attempts: 1, nextAttemptAt: expect.any(Number) }),
    ]);
    expect(attempts).toBe(1);

    await processSyncQueue();
    expect(attempts).toBe(1);
    const retry = await processSyncQueue({ force: true });
    expect(retry).toMatchObject({ synced: 1, pending: 0, failed: 0 });
    expect(attempts).toBe(2);
  });

  it('treats a 409 conflict as already synchronized', async () => {
    server.use(http.post('/api/interviews/server-3/answers', () => (
      HttpResponse.json({ success: false, code: 'CONFLICT', message: 'Already submitted' }, { status: 409 })
    )));
    await enqueueSyncOperation('answers.submit', { answers: [{ questionIndex: 0 }] }, {
      localId: 'server-3',
      clientId: 'client-3',
    });

    const result = await processSyncQueue();

    expect(result).toMatchObject({ synced: 1, pending: 0, failed: 0 });
    expect(await getSyncQueue()).toEqual([expect.objectContaining({ status: 'synced' })]);
  });

  it('does not queue or upload guest data', async () => {
    let requests = 0;
    server.use(http.post('/api/interviews', () => {
      requests += 1;
      return HttpResponse.json({ success: true, data: { interview: { id: 'server-guest' } } });
    }));
    localStorage.setItem(GUEST_MODE_KEY, 'true');

    expect(await enqueueSyncOperation('interview.create', { interview: { id: 'local_guest' } }, {
      localId: 'local_guest',
    })).toBeNull();
    expect(await processSyncQueue()).toMatchObject({ synced: 0, pending: 0, failed: 0 });
    expect(await getSyncQueue()).toEqual([]);
    expect(requests).toBe(0);
  });
});
