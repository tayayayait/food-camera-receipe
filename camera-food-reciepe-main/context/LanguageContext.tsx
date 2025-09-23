import React, { createContext, useContext, useEffect, useCallback } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import * as en from '../locales/en';
import * as ko from '../locales/ko';

type Language = 'en' | 'ko';
type TranslationKey = keyof typeof en;

const translations = { en, ko };

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey, options?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [persistedLang, setPersistedLang] = useLocalStorage<Language>('fridge-buddy-lang', 'en');

  useEffect(() => {
    if (!localStorage.getItem('fridge-buddy-lang')) {
        const browserLang = navigator.language.split(/[-_]/)[0];
        setPersistedLang(browserLang === 'ko' ? 'ko' : 'en');
    }
  }, [setPersistedLang]);

  const setLanguage = (lang: Language) => {
    setPersistedLang(lang);
  };

  const t = useCallback((key: TranslationKey, options?: Record<string, string | number>): string => {
    let text = translations[persistedLang][key] || translations.en[key];
    if (options) {
      Object.keys(options).forEach(optKey => {
        text = text.replace(new RegExp(`{{${optKey}}}`, 'g'), String(options[optKey]));
      });
    }
    return text;
  }, [persistedLang]);

  return (
    <LanguageContext.Provider value={{ language: persistedLang, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
