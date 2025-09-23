import React, { useState, useEffect } from 'react';
import type { PantryItem } from '../types';
import { Category } from '../types';
import { useLanguage } from '../context/LanguageContext';

interface AddItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (item: Omit<PantryItem, 'id' | 'acquiredAt' | 'status'> | PantryItem) => void;
  itemToEdit: PantryItem | null;
}

const AddItemModal: React.FC<AddItemModalProps> = ({ isOpen, onClose, onSave, itemToEdit }) => {
  const { t } = useLanguage();
  const [name, setName] = useState('');
  const [category, setCategory] = useState<Category>(Category.Other);
  const [error, setError] = useState('');

  useEffect(() => {
    if (itemToEdit) {
      setName(itemToEdit.name);
      setCategory(itemToEdit.category);
    } else {
      setName('');
      setCategory(Category.Pantry);
    }
    setError('');
  }, [itemToEdit, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError(t('addItemModalErrorName'));
      return;
    }

    const itemData = {
      name: name.trim(),
      category,
    };

    if (itemToEdit) {
      onSave({ ...itemToEdit, ...itemData });
    } else {
      onSave(itemData);
    }

    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-800">
                {itemToEdit ? t('addItemModalEditTitle') : t('addItemModalAddTitle')}
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                {t('addItemModalDescription')}
              </p>
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <div className="space-y-4">
              <div>
                <label htmlFor="itemName" className="block text-sm font-medium text-gray-700">{t('addItemModalNameLabel')}</label>
                <input
                  type="text"
                  id="itemName"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="mt-2 block w-full px-4 py-3 border border-gray-200 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-blue focus:border-brand-blue text-sm"
                  placeholder={t('addItemModalNamePlaceholder')}
                />
              </div>
              <div>
                <label htmlFor="category" className="block text-sm font-medium text-gray-700">{t('addItemModalCategoryLabel')}</label>
                <select
                  id="category"
                  value={category}
                  onChange={e => setCategory(e.target.value as Category)}
                  className="mt-2 block w-full pl-4 pr-10 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-blue focus:border-brand-blue bg-gray-50"
                >
                  {Object.values(Category).map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div className="bg-blue-50 border border-blue-100 text-sm text-blue-700 rounded-xl p-4">
                <p className="font-semibold">{t('addItemModalTipTitle')}</p>
                <p className="mt-1 leading-relaxed">
                  {t('addItemModalTipDescription')}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3 rounded-b-2xl">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white text-gray-700 border border-gray-200 rounded-xl shadow-sm hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-300 text-sm font-medium"
            >
              {t('addItemModalCancel')}
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-brand-blue text-white rounded-xl shadow-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-blue text-sm font-semibold"
            >
              {itemToEdit ? t('addItemModalSave') : t('addItemModalAdd')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddItemModal;
