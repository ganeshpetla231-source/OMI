import { describe, expect, it } from 'vitest';
import {
  getSpeechCapabilities,
  speechLanguage,
} from './speechCapabilities';

describe('speech capabilities', () => {
  it('requires speech APIs, microphone access, and connectivity for voice mode', () => {
    const scope = {
      SpeechRecognition: function SpeechRecognition() {},
      SpeechSynthesisUtterance: function SpeechSynthesisUtterance() {},
      speechSynthesis: {
        getVoices() {},
        speak() {},
        cancel() {},
      },
      navigator: {
        onLine: true,
        mediaDevices: { getUserMedia() {} },
      },
    };

    expect(getSpeechCapabilities(scope)).toMatchObject({
      recognition: true,
      synthesis: true,
      microphone: true,
      online: true,
      voice: true,
    });
    expect(getSpeechCapabilities({ ...scope, navigator: { ...scope.navigator, onLine: false } }).voice).toBe(false);
  });

  it('maps supported languages to browser speech locales', () => {
    expect(speechLanguage('te')).toBe('te-IN');
    expect(speechLanguage('hi')).toBe('hi-IN');
    expect(speechLanguage('en', 'en-US')).toBe('en-US');
    expect(speechLanguage('en', 'fr-FR')).toBe('en-IN');
  });
});
