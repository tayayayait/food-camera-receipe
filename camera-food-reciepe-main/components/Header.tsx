import React from 'react';
import { FridgeIcon } from './icons';
import { useLanguage } from '../context/LanguageContext';

type HeaderView = 'pantry' | 'recipes' | 'nutrition' | 'journal';

interface HeaderProps {
  activeView: HeaderView;
  onNavigate: (view: HeaderView) => void;
}

const Header: React.FC<HeaderProps> = ({ activeView, onNavigate }) => {
  const { t } = useLanguage();

  const navItems: { key: HeaderView; label: string }[] = [
    { key: 'pantry', label: t('navPantry') },
    { key: 'recipes', label: t('navRecipes') },
    { key: 'nutrition', label: t('navNutrition') },
    { key: 'journal', label: t('navJournal') },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-[#7CB7FF]/30 bg-[#EBF5FF]/80 backdrop-blur-xl">
      <div className="container mx-auto max-w-5xl px-4 py-4 md:py-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#7CB7FF]/20 text-[#1F2E4C]">
              <FridgeIcon />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-black tracking-tight text-[#1C2B4B] uppercase">
                냉장플래너
              </h1>
              <p className="text-sm text-[#1C2B4B]/70">{t('headerSubtitle')}</p>
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 md:justify-end">
            <div className="hidden sm:flex items-center gap-3 text-[11px] uppercase tracking-[0.35em] text-[#1C2B4B]/60">
              <span>{t('headerScan')}</span>
              <span className="h-1 w-1 rounded-full bg-[#7CB7FF]/50" />
              <span>{t('headerPlan')}</span>
              <span className="h-1 w-1 rounded-full bg-[#7CB7FF]/50" />
              <span>{t('headerCook')}</span>
            </div>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {navItems.map(item => {
            const isActive = activeView === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onNavigate(item.key)}
                className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                  isActive
                    ? 'border-[#7CB7FF] bg-white text-[#1C2B4B] shadow-lg shadow-[#7CB7FF]/25'
                    : 'border-transparent bg-white/40 text-[#1C2B4B]/75 hover:bg-white/70 hover:border-[#7CB7FF]/40'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};

export default Header;
