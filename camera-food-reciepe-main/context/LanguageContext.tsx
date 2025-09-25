import React, { createContext, useCallback, useContext } from 'react';
import * as ko from '../locales/ko';

type Language = 'ko';
type TranslationKey = keyof typeof ko;

interface LanguageContextType {
  language: Language;
  t: (key: TranslationKey, options?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const language: Language = 'ko';

  const t = useCallback((key: TranslationKey, options?: Record<string, string | number>): string => {
    let text = ko[key] ?? '';
    if (options) {
      Object.keys(options).forEach(optKey => {
        text = text.replace(new RegExp(`{{${optKey}}}`, 'g'), String(options[optKey]));
      });
    }
    return text;
  }, []);

  return <LanguageContext.Provider value={{ language, t }}>{children}</LanguageContext.Provider>;
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
