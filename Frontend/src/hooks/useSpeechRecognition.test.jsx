import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mapSpeechRecognitionError, useSpeechRecognition } from './useSpeechRecognition';

let recognitionInstance;
let originalRecognition;
let originalOnline;

class MockSpeechRecognition {
  constructor() {
    recognitionInstance = this;
    this.start = vi.fn();
    this.stop = vi.fn(() => this.onend?.());
    this.abort = vi.fn(() => this.onend?.());
  }
}

describe('useSpeechRecognition', () => {
  beforeEach(() => {
    originalRecognition = Object.getOwnPropertyDescriptor(globalThis, 'SpeechRecognition');
    originalOnline = Object.getOwnPropertyDescriptor(navigator, 'onLine');
    Object.defineProperty(globalThis, 'SpeechRecognition', { configurable: true, value: MockSpeechRecognition });
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    recognitionInstance = null;
  });

  afterEach(() => {
    if (originalRecognition) Object.defineProperty(globalThis, 'SpeechRecognition', originalRecognition);
    else delete globalThis.SpeechRecognition;
    if (originalOnline) Object.defineProperty(navigator, 'onLine', originalOnline);
    else delete navigator.onLine;
  });

  it('keeps interim/final transcripts and returns metrics when recording stops', () => {
    const { result } = renderHook(() => useSpeechRecognition({ language: 'te' }));

    act(() => { result.current.start(); });
    expect(recognitionInstance.lang).toBe('te-IN');
    act(() => {
      recognitionInstance.onstart();
      recognitionInstance.onresult({
        resultIndex: 0,
        results: [{ 0: { transcript: 'Hello there' }, isFinal: true }],
      });
    });

    expect(result.current.transcript).toBe('Hello there');
    expect(result.current.listening).toBe(true);
    let stopped;
    act(() => { stopped = result.current.stop(); });
    expect(stopped.transcript).toBe('Hello there');
    expect(stopped.voiceMetrics.wordCount).toBe(2);
  });

  it('maps browser errors to stable user-facing keys and blocks recognition offline', () => {
    expect(mapSpeechRecognitionError('not-allowed')).toBe('notAllowed');
    expect(mapSpeechRecognitionError('language-not-supported')).toBe('languageNotSupported');
    expect(mapSpeechRecognitionError('unexpected')).toBe('unknown');

    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    const { result } = renderHook(() => useSpeechRecognition());
    let started;
    act(() => { started = result.current.start(); });
    expect(started).toBe(false);
    expect(result.current.error).toBe('network');
    expect(recognitionInstance).toBeNull();
  });
});
