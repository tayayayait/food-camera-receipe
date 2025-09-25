import React from 'react';
import { CameraIcon, SparklesIcon, PlusIcon, BookOpenIcon } from './icons';
import { useLanguage } from '../context/LanguageContext';

interface BottomToolbarProps {
  onOpenCamera: () => void;
  onSuggestRecipes: () => void;
  onAddIngredient: () => void;
  onOpenJournal: () => void;
}

const BottomToolbar: React.FC<BottomToolbarProps> = ({
  onOpenCamera,
  onSuggestRecipes,
  onAddIngredient,
  onOpenJournal,
}) => {
  const { t } = useLanguage();

  const actions = [
    {
      label: t('toolbarScan'),
      description: t('toolbarScanHint'),
      icon: <CameraIcon />, 
      onClick: onOpenCamera,
    },
    {
      label: t('toolbarSuggest'),
      description: t('toolbarSuggestHint'),
      icon: <SparklesIcon />, 
      onClick: onSuggestRecipes,
    },
    {
      label: t('toolbarAdd'),
      description: t('toolbarAddHint'),
      icon: <PlusIcon />, 
      onClick: onAddIngredient,
    },
    {
      label: t('toolbarJournal'),
      description: t('toolbarJournalHint'),
      icon: <BookOpenIcon />, 
      onClick: onOpenJournal,
    },
  ];

  return (
    <nav className="fixed inset-x-4 bottom-6 z-40">
      <div className="rounded-3xl bg-white/95 backdrop-blur shadow-2xl border border-gray-200 px-3 py-2 grid grid-cols-2 sm:grid-cols-4 gap-2">
        {actions.map(action => (
          <button
            key={action.label}
            type="button"
            onClick={action.onClick}
            className="group flex items-center gap-3 rounded-2xl px-3 py-3 transition hover:bg-gray-100"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gray-100 text-brand-blue group-hover:bg-brand-blue group-hover:text-white transition">
              {action.icon}
            </span>
            <span className="flex flex-col items-start">
              <span className="text-sm font-semibold text-gray-800">{action.label}</span>
              <span className="text-xs text-gray-500">{action.description}</span>
            </span>
          </button>
        ))}
      </div>
    </nav>
  );
};

export default BottomToolbar;
