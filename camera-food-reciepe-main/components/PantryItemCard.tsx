import React, { useState } from 'react';
import type { PantryItem } from '../types';
import { ItemStatus } from '../types';
import { EditIcon, CheckCircleIcon, TrashIcon, MoreVerticalIcon } from './icons';
import { useLanguage } from '../context/LanguageContext';

interface PantryItemCardProps {
  item: PantryItem;
  onEdit: (item: PantryItem) => void;
  onUpdateStatus: (id: string, status: ItemStatus) => void;
  onDelete: (id: string) => void;
}

const PantryItemCard: React.FC<PantryItemCardProps> = ({ item, onEdit, onUpdateStatus, onDelete }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const { language, t } = useLanguage();

  const handleMenuToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpen(prev => !prev);
  };

  const addedDate = item.acquiredAt ? new Date(item.acquiredAt) : null;
  const addedLabel = addedDate && !Number.isNaN(addedDate.getTime())
    ? addedDate.toLocaleDateString(language === 'ko' ? 'ko-KR' : 'en-US', { month: 'short', day: 'numeric' })
    : t('itemCardRecently');

  return (
    <div className="group relative bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-lg transition-shadow p-4">
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-brand-blue/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
      <div className="relative flex items-start justify-between gap-4">
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
        <div className="relative">
          <button
            onClick={handleMenuToggle}
            className="p-2 rounded-full hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-blue"
            aria-label={t('itemCardAriaLabel')}
          >
            <MoreVerticalIcon />
          </button>
          {menuOpen && (
            <div
              className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-100 z-10 py-1"
              onMouseLeave={() => setMenuOpen(false)}
            >
              <button
                onClick={() => { onEdit(item); setMenuOpen(false); }}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
              >
                <EditIcon /> {t('itemCardEdit')}
              </button>
              <button
                onClick={() => { onUpdateStatus(item.id, ItemStatus.Used); setMenuOpen(false); }}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
              >
                <CheckCircleIcon /> {t('itemCardMarkAsUsed')}
              </button>
              <button
                onClick={() => { onDelete(item.id); setMenuOpen(false); }}
                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
              >
                <TrashIcon /> {t('itemCardDelete')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PantryItemCard;
