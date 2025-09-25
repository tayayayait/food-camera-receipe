import React, { useMemo, useState } from 'react';
import type { CookingLog } from '../types';
import { TrashIcon } from './icons';
import { useLanguage } from '../context/LanguageContext';

interface CookingLogbookProps {
  logs: CookingLog[];
  onAddLog: (log: Omit<CookingLog, 'id' | 'createdAt'>) => void;
  onDeleteLog: (id: string) => void;
}

const CookingLogbook: React.FC<CookingLogbookProps> = ({ logs, onAddLog, onDeleteLog }) => {
  const { t } = useLanguage();
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [recipeName, setRecipeName] = useState('');

  const isSubmitDisabled = useMemo(() => {
    return !title.trim() && !notes.trim();
  }, [title, notes]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitDisabled) {
      return;
    }

    onAddLog({
      title: title.trim(),
      notes: notes.trim(),
      recipeName: recipeName.trim() || undefined,
    });

    setTitle('');
    setNotes('');
    setRecipeName('');
  };

  const formatter = useMemo(() => {
    try {
      return new Intl.DateTimeFormat('ko-KR', {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
    } catch (error) {
      console.warn('Falling back to default date formatting', error);
      return new Intl.DateTimeFormat('ko-KR', {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
    }
  }, []);

  return (
    <section className="bg-white rounded-3xl shadow-xl p-6 md:p-8 space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold text-gray-800">{t('logbookSectionTitle')}</h2>
        <p className="text-sm text-gray-500">{t('logbookSectionDescription')}</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-gray-50 border border-gray-200 rounded-2xl p-4 space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="log-title" className="text-sm font-semibold text-gray-700">
              {t('logbookFormTitleLabel')}
            </label>
            <input
              id="log-title"
              value={title}
              onChange={event => setTitle(event.target.value)}
              placeholder={t('logbookFormTitlePlaceholder')}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="log-recipe" className="text-sm font-semibold text-gray-700">
              {t('logbookFormRecipeLabel')}
            </label>
            <input
              id="log-recipe"
              value={recipeName}
              onChange={event => setRecipeName(event.target.value)}
              placeholder={t('logbookFormRecipePlaceholder')}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
            />
          </div>
        </div>
        <div className="space-y-2">
          <label htmlFor="log-notes" className="text-sm font-semibold text-gray-700">
            {t('logbookFormNotesLabel')}
          </label>
          <textarea
            id="log-notes"
            value={notes}
            onChange={event => setNotes(event.target.value)}
            rows={4}
            placeholder={t('logbookFormNotesPlaceholder')}
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
          />
        </div>
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSubmitDisabled}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-orange px-4 py-2 text-sm font-semibold text-white shadow hover:bg-orange-500 transition disabled:opacity-60"
          >
            {t('logbookFormAddButton')}
          </button>
        </div>
      </form>

      {logs.length === 0 ? (
        <p className="text-sm text-gray-400 text-center italic">{t('logbookEmptyState')}</p>
      ) : (
        <ul className="space-y-4">
          {logs.map(log => (
            <li key={log.id} className="bg-gray-50 border border-gray-200 rounded-2xl p-4 space-y-3">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">{log.title || t('logbookUntitledEntry')}</h3>
                  <p className="text-xs text-gray-500">{formatter.format(new Date(log.createdAt))}</p>
                </div>
                <button
                  type="button"
                  onClick={() => onDeleteLog(log.id)}
                  className="inline-flex items-center gap-2 rounded-lg border border-red-100 bg-white px-3 py-2 text-xs font-semibold text-red-600 shadow-sm hover:bg-red-50 transition"
                >
                  <TrashIcon />
                  {t('logbookDeleteButton')}
                </button>
              </div>
              {log.recipeName && (
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-blue">
                  {t('logbookRecipeTag', { recipe: log.recipeName })}
                </p>
              )}
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                {log.notes || t('logbookNoNotesFallback')}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export default CookingLogbook;
