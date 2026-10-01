import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  type LanguageCode,
  type LanguageInfo,
  type TranslationKey,
  SUPPORTED_LANGUAGES,
  TRANSLATIONS,
} from '../locales/translations';

interface LanguageContextType {
  language: LanguageCode;
  setLanguage: (lang: LanguageCode) => void;
  t: (key: TranslationKey | string, fallback?: string) => string;
  currentLanguageInfo: LanguageInfo;
  supportedLanguages: LanguageInfo[];
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const STORAGE_KEY = 'nagardrishti_preferred_lang';

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<LanguageCode>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as LanguageCode | null;
      if (saved && SUPPORTED_LANGUAGES.some((l) => l.code === saved)) {
        return saved;
      }
    } catch (e) {
      console.warn('Could not read saved language', e);
    }
    return 'en';
  });

  const setLanguage = (lang: LanguageCode) => {
    setLanguageState(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch (e) {
      console.warn('Could not save language', e);
    }
  };

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const t = (key: TranslationKey | string, fallback?: string): string => {
    const langDict = TRANSLATIONS[language] as Record<string, string> | undefined;
    if (langDict && langDict[key]) {
      return langDict[key];
    }
    const defaultDict = TRANSLATIONS.en as Record<string, string> | undefined;
    if (defaultDict && defaultDict[key]) {
      return defaultDict[key];
    }
    return fallback || key;
  };

  const currentLanguageInfo =
    SUPPORTED_LANGUAGES.find((l) => l.code === language) || SUPPORTED_LANGUAGES[0];

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        t,
        currentLanguageInfo,
        supportedLanguages: SUPPORTED_LANGUAGES,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
