import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '../context/AuthContext';
import { LanguageProvider } from '../context/LanguageContext';
import { answersApi } from '../services/api/answersApi';
import { interviewsApi } from '../services/api/interviewsApi';
import { getInterviewSnapshot, saveInterviewSnapshot } from '../services/offline/localInterviewStore';
import InterviewPage from './InterviewPage';

vi.mock('../services/api/interviewsApi', () => ({
  interviewsApi: {
    get: vi.fn(),
    update: vi.fn(),
    start: vi.fn(),
    pause: vi.fn(),
    complete: vi.fn(),
  },
}));

vi.mock('../services/api/answersApi', () => ({
  answersApi: {
    list: vi.fn(),
    submit: vi.fn(),
    evaluate: vi.fn(),
  },
}));

vi.mock('../services/offline/localInterviewStore', () => ({
  getInterviewIdMapping: vi.fn().mockResolvedValue(null),
  getInterviewSnapshot: vi.fn(),
  saveInterviewSnapshot: vi.fn(),
}));

const interview = {
  id: 'voice-interview-1',
  category: 'general',
  jobRole: 'Any role',
  difficulty: 'beginner',
  duration: 5,
  questions: [
    { questionId: 'question-1', text: 'Describe a challenge you solved.', skill: 'Problem solving' },
    { questionId: 'question-2', text: 'How do you organize your work?', skill: 'Organization' },
  ],
  status: 'in_progress',
  currentIndex: 0,
  elapsedSeconds: 0,
  startedAt: new Date().toISOString(),
  lastResumedAt: new Date().toISOString(),
  mode: 'voice',
  practiceType: 'practice',
  style: 'standard',
  language: 'en',
};

let originalDescriptors;
let eventOrder;
let recognition;
let utterances;

class MockSpeechRecognition {
  constructor() {
    recognition = this;
    this.start = vi.fn(() => eventOrder.push('recognition-start'));
    this.stop = vi.fn(() => this.onend?.());
    this.abort = vi.fn(() => this.onend?.());
  }
}

class MockUtterance {
  constructor(text) {
    this.text = text;
  }
}

function renderVoiceInterview() {
  const router = createMemoryRouter([
    { path: '/interview/:id', element: <InterviewPage /> },
    { path: '/dashboard', element: <h1>Dashboard</h1> },
  ], {
    initialEntries: [{ pathname: `/interview/${interview.id}`, state: { interview, enterInterview: true } }],
  });
  render(
    <AuthContext.Provider value={{ user: null }}>
      <LanguageProvider>
        <RouterProvider router={router} />
      </LanguageProvider>
    </AuthContext.Provider>,
  );
}

describe('voice interview flow', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    eventOrder = [];
    recognition = null;
    utterances = [];
    getInterviewSnapshot.mockResolvedValue(null);
    saveInterviewSnapshot.mockResolvedValue({});
    answersApi.list.mockResolvedValue({ items: [], offline: false });
    answersApi.submit.mockImplementation(async (_id, answer) => ({ answer: { ...answer }, offline: false }));
    answersApi.evaluate.mockResolvedValue({ items: [], totalScore: 0 });
    interviewsApi.get.mockResolvedValue(interview);
    interviewsApi.update.mockImplementation(async (_id, updates) => ({ ...interview, ...updates }));

    originalDescriptors = {
      SpeechRecognition: Object.getOwnPropertyDescriptor(globalThis, 'SpeechRecognition'),
      SpeechSynthesisUtterance: Object.getOwnPropertyDescriptor(globalThis, 'SpeechSynthesisUtterance'),
      speechSynthesis: Object.getOwnPropertyDescriptor(globalThis, 'speechSynthesis'),
      mediaDevices: Object.getOwnPropertyDescriptor(navigator, 'mediaDevices'),
      windowSynthesis: Object.getOwnPropertyDescriptor(window, 'speechSynthesis'),
      windowUtterance: Object.getOwnPropertyDescriptor(window, 'SpeechSynthesisUtterance'),
      windowRecognition: Object.getOwnPropertyDescriptor(window, 'SpeechRecognition'),
    };
  });

  afterEach(() => {
    cleanup();
    Object.entries(originalDescriptors).forEach(([key, descriptor]) => {
      const target = key === 'mediaDevices' ? navigator : key.startsWith('window') ? window : globalThis;
      const targetKey = key === 'windowSynthesis'
        ? 'speechSynthesis'
        : key === 'windowUtterance'
          ? 'SpeechSynthesisUtterance'
          : key === 'windowRecognition'
            ? 'SpeechRecognition'
            : key;
      if (descriptor) Object.defineProperty(target, targetKey, descriptor);
      else delete target[targetKey];
    });
  });

  it('speaks the question before enabling recording and submits the real transcript with metrics', async () => {
    const synthesis = {
      getVoices: () => [{ lang: 'en-IN' }],
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      cancel: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      speak: vi.fn((utterance) => {
        eventOrder.push('speak');
        utterances.push(utterance);
      }),
    };
    Object.defineProperty(globalThis, 'SpeechRecognition', { configurable: true, value: MockSpeechRecognition });
    Object.defineProperty(globalThis, 'SpeechSynthesisUtterance', { configurable: true, value: MockUtterance });
    Object.defineProperty(globalThis, 'speechSynthesis', { configurable: true, value: synthesis });
    Object.defineProperty(window, 'SpeechRecognition', { configurable: true, value: MockSpeechRecognition });
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, value: MockUtterance });
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: synthesis });
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: vi.fn() }] }) },
    });

    renderVoiceInterview();
    const startButton = await screen.findByRole('button', { name: 'Start recording' });
    await waitFor(() => expect(synthesis.speak).toHaveBeenCalled());
    expect(startButton).toBeDisabled();
    expect(utterances[0].text).toBe(interview.questions[0].text);

    act(() => { utterances[0].onend(); });
    await waitFor(() => expect(startButton).toBeEnabled());
    fireEvent.click(startButton);
    await waitFor(() => expect(recognition?.start).toHaveBeenCalled());
    expect(eventOrder.indexOf('speak')).toBeLessThan(eventOrder.indexOf('recognition-start'));

    act(() => {
      recognition.onstart();
      recognition.onresult({
        resultIndex: 0,
        results: [{ 0: { transcript: 'I planned the work and solved it.' }, isFinal: true }],
      });
    });
    expect(screen.getByLabelText('Your answer')).toHaveValue('I planned the work and solved it.');
    fireEvent.click(screen.getByRole('button', { name: 'Stop recording' }));
    fireEvent.click(screen.getByRole('button', { name: 'Submit & next' }));

    await waitFor(() => expect(answersApi.submit).toHaveBeenCalledWith(
      interview.id,
      expect.objectContaining({
        answerText: 'I planned the work and solved it.',
        source: 'voice',
        voiceMetrics: expect.objectContaining({ wordCount: 7 }),
      }),
    ));
  });

  it('keeps typed answers usable when speech APIs are unavailable', async () => {
    renderVoiceInterview();
    const answer = await screen.findByLabelText('Your answer');
    fireEvent.change(answer, { target: { value: 'I can type my answer instead.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Submit & next' }));

    await waitFor(() => expect(answersApi.submit).toHaveBeenCalledWith(
      interview.id,
      expect.objectContaining({
        answerText: 'I can type my answer instead.',
        source: 'text',
      }),
    ));
  });
});
