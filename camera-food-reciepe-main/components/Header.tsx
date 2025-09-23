import React from 'react';
import { FridgeIcon } from './icons';
import { useLanguage } from '../context/LanguageContext';

const Header: React.FC = () => {
  const { language, setLanguage, t } = useLanguage();

  return (
    <header className="bg-white/90 backdrop-blur border-b border-gray-100 sticky top-0 z-40">
      <div className="container mx-auto px-4 py-4 md:py-5 max-w-5xl">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <FridgeIcon />
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Fridge Buddy</h1>
              <p className="text-sm text-gray-500">{t('headerSubtitle')}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-3 text-xs text-gray-400 uppercase tracking-widest">
              <span>{t('headerScan')}</span>
              <span className="w-1 h-1 rounded-full bg-gray-300"></span>
              <span>{t('headerPlan')}</span>
              <span className="w-1 h-1 rounded-full bg-gray-300"></span>
              <span>{t('headerCook')}</span>
            </div>
            <button
              onClick={() => setLanguage(language === 'en' ? 'ko' : 'en')}
              className="text-sm font-medium text-gray-600 hover:text-brand-blue transition-colors px-3 py-1 rounded-md bg-gray-100 hover:bg-gray-200"
            >
              {t('langToggle')}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
