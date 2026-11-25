export function getSpeechRecognitionConstructor(scope = globalThis) {
  return scope.SpeechRecognition || scope.webkitSpeechRecognition || null;
}

export function supportsSpeechRecognition(scope = globalThis) {
  return Boolean(getSpeechRecognitionConstructor(scope));
}

export function supportsSpeechSynthesis(scope = globalThis) {
  return Boolean(
    scope.SpeechSynthesisUtterance
    && typeof scope.speechSynthesis?.getVoices === 'function'
    && typeof scope.speechSynthesis?.speak === 'function'
    && typeof scope.speechSynthesis?.cancel === 'function',
  );
}

export function supportsMicrophone(scope = globalThis) {
  return typeof scope.navigator?.mediaDevices?.getUserMedia === 'function';
}

export function isOnline(scope = globalThis) {
  return scope.navigator?.onLine !== false;
}

export function getSpeechCapabilities(scope = globalThis) {
  const recognition = supportsSpeechRecognition(scope);
  const synthesis = supportsSpeechSynthesis(scope);
  const microphone = supportsMicrophone(scope);
  const online = isOnline(scope);
  return {
    recognition,
    synthesis,
    microphone,
    online,
    voice: recognition && synthesis && microphone && online,
  };
}

export function speechLanguage(language, englishLocale = 'en-IN') {
  if (language === 'te') return 'te-IN';
  if (language === 'hi') return 'hi-IN';
  return ['en-IN', 'en-US'].includes(englishLocale) ? englishLocale : 'en-IN';
}
