import React from 'react';
import type { PantryItem } from '../types';
import { useLanguage } from '../context/LanguageContext';

interface PantryItemCardProps {
  item: PantryItem;
}

const PantryItemCard: React.FC<PantryItemCardProps> = ({ item }) => {
  const { language, t } = useLanguage();

  const addedDate = item.acquiredAt ? new Date(item.acquiredAt) : null;
  const addedLabel = addedDate && !Number.isNaN(addedDate.getTime())
    ? addedDate.toLocaleDateString(language === 'ko' ? 'ko-KR' : 'en-US', { month: 'short', day: 'numeric' })
    : t('itemCardRecently');

  return (
    <div className="relative bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-md transition-shadow p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-lg font-semibold text-gray-900 capitalize">{item.name}</p>
          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-brand-blue/10 text-brand-blue font-medium">
              {item.category}
            </span>
            <span className="text-gray-400">•</span>
            <span>{t('itemCardAdded')} {addedLabel}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PantryItemCard;
