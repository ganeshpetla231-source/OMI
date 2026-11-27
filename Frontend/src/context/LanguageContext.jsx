import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Language } from '../config/constants';
import en from '../i18n/en.json';
import hi from '../i18n/hi.json';
import te from '../i18n/te.json';

const LanguageContext = createContext(null);
const dictionaries = { en, hi, te };
const LANGUAGE_KEY = 'talkready_language';

function readTranslation(dictionary, key) {
  return key.split('.').reduce((value, part) => value?.[part], dictionary);
}

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(() => {
    const saved = localStorage.getItem(LANGUAGE_KEY);
    return Object.values(Language).includes(saved) ? saved : Language.ENGLISH;
  });
  const updateLanguage = useCallback((nextLanguage) => {
    if (!Object.values(Language).includes(nextLanguage)) {
      throw new Error(`Unsupported application language: ${nextLanguage}`);
    }
    setLanguage(nextLanguage);
    localStorage.setItem(LANGUAGE_KEY, nextLanguage);
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const value = useMemo(() => ({ language, setLanguage: updateLanguage }), [language]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useTranslation() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useTranslation must be used within LanguageProvider');
  const dictionary = dictionaries[context.language] || en;
  const t = useCallback((key, values = {}) => {
    const translation = readTranslation(dictionary, key) ?? readTranslation(en, key) ?? key;
    if (typeof translation !== 'string') return translation;
    return translation.replace(/\{(\w+)\}/g, (placeholder, name) => (
      values[name] === undefined ? placeholder : String(values[name])
    ));
  }, [dictionary]);
  return { t, language: context.language, setLanguage: context.setLanguage };
}
