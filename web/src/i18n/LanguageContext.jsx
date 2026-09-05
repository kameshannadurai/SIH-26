import React, { createContext, useContext, useState, useEffect } from 'react';
import { TRANSLATIONS, SUPPORTED_LANGUAGES } from './translations';

const LanguageContext = createContext({
  lang: 'en',
  setLang: () => {},
  t: (key, params) => key,
  languages: SUPPORTED_LANGUAGES,
  currentLanguageName: 'English',
});

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    try {
      return localStorage.getItem('lm_lang') || 'en';
    } catch {
      return 'en';
    }
  });

  const setLang = (newLang) => {
    if (SUPPORTED_LANGUAGES.some((l) => l.code === newLang)) {
      setLangState(newLang);
      try {
        localStorage.setItem('lm_lang', newLang);
        document.documentElement.setAttribute('lang', newLang);
      } catch {}
    }
  };

  useEffect(() => {
    try {
      document.documentElement.setAttribute('lang', lang);
    } catch {}
  }, [lang]);

  const t = (key, params = {}) => {
    const langDict = TRANSLATIONS[lang] || TRANSLATIONS.en;
    let text = langDict[key] || TRANSLATIONS.en[key] || key;

    if (params && typeof params === 'object') {
      Object.entries(params).forEach(([k, v]) => {
        text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), v !== undefined && v !== null ? v : '');
      });
    }
    return text;
  };

  const currentLanguageName =
    SUPPORTED_LANGUAGES.find((l) => l.code === lang)?.nativeName || 'English';

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, languages: SUPPORTED_LANGUAGES, currentLanguageName }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useTranslation() {
  return useContext(LanguageContext);
}
