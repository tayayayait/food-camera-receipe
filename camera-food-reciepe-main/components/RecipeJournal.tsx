import React, { useEffect, useMemo, useState } from 'react';
import type { RecipeMemory } from '../types';
import { BookOpenIcon, FlameIcon, TrashIcon, ClipboardIcon } from './icons';
import { useLanguage } from '../context/LanguageContext';

interface RecipeJournalProps {
  entries: RecipeMemory[];
  onUpdate: (id: string, updates: Partial<RecipeMemory>) => void;
  onDelete: (id: string) => void;
  onMarkCooked: (id: string) => void;
  onOpenDetails: (id: string) => void;
  highlightedId?: string | null;
}

const RecipeJournal: React.FC<RecipeJournalProps> = ({
  entries,
  onUpdate,
  onDelete,
  onMarkCooked,
  onOpenDetails,
  highlightedId,
}) => {
  const { language, t } = useLanguage();
  const [draftNotes, setDraftNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    setDraftNotes(prev => {
      const next: Record<string, string> = { ...prev };
      const entryIds = new Set(entries.map(entry => entry.id));

      Object.keys(next).forEach(id => {
        if (!entryIds.has(id)) {
          delete next[id];
        }
      });

      entries.forEach(entry => {
        if (!(entry.id in next)) {
          next[entry.id] = entry.note;
        }
      });

      return next;
    });
  }, [entries]);

  const formatter = useMemo(() => {
    const locale = language === 'ko' ? 'ko-KR' : 'en-US';
    return new Intl.DateTimeFormat(locale, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  }, [language]);

  const handleSaveNote = (id: string) => {
    const note = draftNotes[id] ?? '';
    onUpdate(id, { note });
  };

  return (
    <section className="bg-white rounded-3xl shadow-xl p-6 md:p-8 space-y-6 border border-gray-100">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="inline-flex items-center justify-center h-12 w-12 rounded-2xl bg-brand-orange/10 text-brand-orange">
            <BookOpenIcon />
          </span>
          <div>
            <h2 className="text-2xl font-semibold text-gray-800">{t('journalSectionTitle')}</h2>
            <p className="text-sm text-gray-500">{t('journalSectionDescription')}</p>
          </div>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-2xl px-4 py-2 text-xs text-gray-500">
          {t('journalSectionHint')}
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="text-center py-10 space-y-3">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-gray-100 text-gray-400">
            <ClipboardIcon />
          </div>
          <p className="text-sm text-gray-500">{t('journalEmptyState')}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {entries.map(entry => {
            const isHighlighted = entry.id === highlightedId;
            const draftNote = draftNotes[entry.id] ?? entry.note;
            return (
              <article
                key={entry.id}
                className={`border rounded-2xl p-5 space-y-4 transition-shadow bg-white ${
                  isHighlighted ? 'border-brand-orange shadow-lg ring-2 ring-brand-orange/40' : 'border-gray-200 shadow-sm'
                }`}
              >
                <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-800">{entry.recipeName}</h3>
                    <p className="text-xs text-gray-500">
                      {t('journalCreatedAt', { date: formatter.format(new Date(entry.createdAt)) })}
                    </p>
                    {entry.timesCooked > 0 && (
                      <p className="text-xs text-emerald-600 font-semibold mt-1">
                        {t('journalTimesCooked', { count: entry.timesCooked })}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-widest">
                    {entry.matchedIngredients && entry.matchedIngredients.length > 0 && (
                      <span className="inline-flex items-center rounded-full bg-emerald-50 text-emerald-700 px-3 py-1">
                        {t('journalMatchedBadge', { count: entry.matchedIngredients.length })}
                      </span>
                    )}
                    {entry.missingIngredients && entry.missingIngredients.length > 0 && (
                      <span className="inline-flex items-center rounded-full bg-amber-50 text-amber-700 px-3 py-1">
                        {t('journalMissingBadge', { count: entry.missingIngredients.length })}
                      </span>
                    )}
                  </div>
                </header>

                {entry.description && (
                  <p className="text-sm text-gray-600 leading-relaxed bg-gray-50 border border-gray-200 rounded-2xl p-4">
                    {entry.description}
                  </p>
                )}

                <div className="space-y-3">
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-widest">
                    {t('journalNoteLabel')}
                  </label>
                  <textarea
                    value={draftNote}
                    onChange={event => setDraftNotes(current => ({ ...current, [entry.id]: event.target.value }))}
                    rows={4}
                    placeholder={t('journalNotePlaceholder')}
                    className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
                  />
                  <div className="flex flex-wrap justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => handleSaveNote(entry.id)}
                      className="inline-flex items-center gap-2 rounded-xl bg-brand-blue text-white px-4 py-2 text-sm font-semibold shadow hover:bg-blue-600 transition"
                    >
                      {t('journalSaveNote')}
                    </button>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => onOpenDetails(entry.id)}
                        className="inline-flex items-center gap-2 rounded-xl bg-brand-orange text-white px-4 py-2 text-sm font-semibold shadow hover:bg-orange-500 transition"
                      >
                        <FlameIcon />
                        {t('journalOpenDetails')}
                      </button>
                      <button
                        type="button"
                        onClick={() => onMarkCooked(entry.id)}
                        className="inline-flex items-center gap-2 rounded-xl border border-brand-orange/30 text-brand-orange px-4 py-2 text-sm font-semibold hover:bg-brand-orange/10 transition"
                      >
                        {entry.lastCookedAt ? t('journalQuickLogAgain') : t('journalQuickLogFirst')}
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(entry.id)}
                        className="inline-flex items-center gap-2 rounded-xl border border-red-200 text-red-500 px-4 py-2 text-sm font-semibold hover:bg-red-50 transition"
                      >
                        <TrashIcon />
                        {t('journalDelete')}
                      </button>
                    </div>
                  </div>
                  {entry.lastCookedAt && (
                    <p className="text-[11px] uppercase tracking-widest font-semibold text-gray-400">
                      {t('journalLastCooked', { date: formatter.format(new Date(entry.lastCookedAt)) })}
                    </p>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default RecipeJournal;
