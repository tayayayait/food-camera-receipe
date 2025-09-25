import React from 'react';
import type { PantryItem } from '../types';
import { Category } from '../types';
import PantryItemCard from './PantryItemCard';
import { useLanguage } from '../context/LanguageContext';

interface PantryListProps {
  items: PantryItem[];
}

const CATEGORY_ORDER: Category[] = [
  Category.Vegetable,
  Category.Fruit,
  Category.Meat,
  Category.Dairy,
  Category.Pantry,
  Category.Other,
];

const PantryList: React.FC<PantryListProps> = ({ items }) => {
  const { t } = useLanguage();

  if (items.length === 0) {
    return (
      <div className="text-center py-12 px-6 bg-gradient-to-br from-gray-50 to-white rounded-2xl border border-dashed border-gray-200">
        <h3 className="text-2xl font-semibold text-gray-700">{t('pantryEmptyTitle')}</h3>
        <p className="text-gray-500 mt-2">{t('pantryEmptyDescription')}</p>
      </div>
    );
  }

  const grouped = CATEGORY_ORDER.map(category => ({
    category,
    items: items
      .filter(item => item.category === category)
      .sort((a, b) => a.name.localeCompare(b.name, 'ko')),
  })).filter(group => group.items.length > 0);

  return (
    <div className="space-y-8">
      {grouped.map(group => (
        <section key={group.category} className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand-blue/10 text-brand-blue font-semibold">
              {group.category.charAt(0)}
            </span>
            <h3 className="text-xl font-semibold text-gray-800">{group.category}</h3>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {group.items.map(item => (
              <PantryItemCard
                key={item.id}
                item={item}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
};

export default PantryList;
