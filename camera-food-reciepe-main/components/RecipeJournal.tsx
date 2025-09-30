import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { RecipeMemory } from '../types';
import { BookOpenIcon, FlameIcon, TrashIcon, ClipboardIcon, MoreVerticalIcon } from './icons';
import { useLanguage } from '../context/LanguageContext';

interface RecipeJournalProps {
  entries: RecipeMemory[];
  onUpdate: (id: string, updates: Partial<RecipeMemory>) => void;
  onDelete: (id: string) => void;
  onMarkCooked: (id: string) => void;
  onOpenDetails: (id: string) => void;
  onRegeneratePreview: (id: string) => void;
  previewStatuses?: Record<string, 'idle' | 'loading' | 'error' | 'unsupported'>;
  highlightedId?: string | null;
}

const RecipeJournal: React.FC<RecipeJournalProps> = ({
  entries,
  onUpdate,
  onDelete,
  onMarkCooked,
  onOpenDetails,
  onRegeneratePreview,
  previewStatuses,
  highlightedId,
}) => {
  const { t } = useLanguage();
  const [draftNotes, setDraftNotes] = useState<Record<string, string>>({});
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [thumbnailUrls, setThumbnailUrls] = useState<Record<string, string>>({});

  type ThumbnailCacheEntry = { source: string; url: string; revoke: boolean };
  const thumbnailCacheRef = useRef<Record<string, ThumbnailCacheEntry>>({});

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

  useEffect(() => {
    if (openMenuId && !entries.some(entry => entry.id === openMenuId)) {
      setOpenMenuId(null);
    }
  }, [entries, openMenuId]);

  useEffect(() => {
    if (!openMenuId) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('[data-journal-menu]')) {
        return;
      }
      setOpenMenuId(null);
    };

    window.addEventListener('pointerdown', handlePointerDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [openMenuId]);

  useEffect(() => {
    let isActive = true;
    const previousCache = thumbnailCacheRef.current;
    const nextCache: Record<string, ThumbnailCacheEntry> = {};

    const tasks = entries.map(async entry => {
      const source = entry.journalPreviewImage ?? '';
      if (!source) {
        return;
      }

      const cached = previousCache[entry.id];
      if (cached && cached.source === source) {
        nextCache[entry.id] = cached;
        return;
      }

      if (cached?.revoke) {
        URL.revokeObjectURL(cached.url);
      }

      if (source.startsWith('data:')) {
        try {
          const response = await fetch(source);
          const blob = await response.blob();
          const url = URL.createObjectURL(blob);
          nextCache[entry.id] = { source, url, revoke: true };
        } catch (error) {
          console.error('Failed to hydrate journal preview image', error);
        }
        return;
      }

      nextCache[entry.id] = { source, url: source, revoke: false };
    });

    Promise.all(tasks).then(() => {
      if (!isActive) {
        Object.values(nextCache).forEach((entry: ThumbnailCacheEntry) => {
          if (entry.revoke) {
            URL.revokeObjectURL(entry.url);
          }
        });
        return;
      }

      Object.keys(previousCache).forEach(id => {
        if (!nextCache[id]) {
          const cached = previousCache[id];
          if (cached?.revoke) {
            URL.revokeObjectURL(cached.url);
          }
        }
      });

      thumbnailCacheRef.current = nextCache;
      setThumbnailUrls(
        Object.fromEntries(
          Object.entries(nextCache).map(([id, entry]) => [id, entry.url])
        )
      );
    });

    return () => {
      isActive = false;
    };
  }, [entries]);

  useEffect(() => {
    return () => {
      const cache = thumbnailCacheRef.current;
      Object.values(cache).forEach((entry: ThumbnailCacheEntry) => {
        if (entry.revoke) {
          URL.revokeObjectURL(entry.url);
        }
      });
      thumbnailCacheRef.current = {};
    };
  }, []);

  const formatter = useMemo(() => {
    return new Intl.DateTimeFormat('ko-KR', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  }, []);

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
            const previewStatus = previewStatuses?.[entry.id] ?? 'idle';
            const isLoading = previewStatus === 'loading';
            const isError = previewStatus === 'error';
            const isUnsupported = previewStatus === 'unsupported';
            const hydratedThumbnail = thumbnailUrls[entry.id];
            const fallbackThumbnail =
              entry.journalPreviewImage && !entry.journalPreviewImage.startsWith('data:')
                ? entry.journalPreviewImage
                : undefined;
            const thumbnailSrc = hydratedThumbnail ?? fallbackThumbnail;
            const createdAtLabel = formatter.format(new Date(entry.createdAt));
            const lastCookedLabel = entry.lastCookedAt
              ? formatter.format(new Date(entry.lastCookedAt))
              : null;

            return (
              <article
                key={entry.id}
                className={`border rounded-3xl p-4 sm:p-5 transition-shadow bg-white ${
                  isHighlighted
                    ? 'border-brand-orange shadow-lg ring-2 ring-brand-orange/40'
                    : 'border-gray-200 shadow-sm'
                }`}
              >
                <div className="flex flex-col gap-5 sm:flex-row">
                  <div className="sm:w-48 md:w-56 flex-shrink-0">
                    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[28px] border border-gray-200 bg-gray-50 shadow-inner">
                      {thumbnailSrc ? (
                        <>
                          <img
                            src={thumbnailSrc}
                            alt={t('journalPreviewAlt', { name: entry.recipeName })}
                            className="h-full w-full object-cover"
                          />
                          {isUnsupported && !isLoading && !isError && (
                            <div className="pointer-events-none absolute inset-x-4 bottom-4 rounded-xl bg-white/85 px-3 py-2 text-center text-xs font-semibold text-gray-600 shadow-sm backdrop-blur">
                              {t('journalPreviewUnsupported')}
                            </div>
                          )}
                        </>
                      ) : (
                        <div
                          className="absolute inset-0"
                          style={{
                            background:
                              'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 45%, #f8fafc 100%), radial-gradient(circle at 20% 20%, rgba(251, 191, 36, 0.25), transparent 60%), radial-gradient(circle at 80% 10%, rgba(96, 165, 250, 0.25), transparent 55%), radial-gradient(circle at 15% 85%, rgba(74, 222, 128, 0.18), transparent 60%)',
                            backgroundBlendMode: 'normal, screen, screen, screen',
                          }}
                        />
                      )}

                      {isUnsupported && !thumbnailSrc && !isLoading && !isError && (
                        <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-6 text-center text-sm font-medium text-gray-600">
                          {t('journalPreviewUnsupported')}
                        </div>
                      )}

                      <div className="absolute top-2 right-2" data-journal-menu>
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() =>
                              setOpenMenuId(current => (current === entry.id ? null : entry.id))
                            }
                            className={`inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/85 text-gray-600 shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/40 ${
                              isLoading ? 'cursor-not-allowed opacity-60' : 'hover:bg-white'
                            }`}
                            aria-haspopup="menu"
                            aria-expanded={openMenuId === entry.id}
                            aria-label={t('journalPreviewMenuLabel')}
                            disabled={isLoading}
                          >
                            <MoreVerticalIcon />
                          </button>
                          {openMenuId === entry.id && (
                            <div
                              className="absolute right-0 mt-3 w-48 overflow-hidden rounded-2xl border border-gray-200 bg-white/95 text-sm text-gray-700 shadow-xl backdrop-blur"
                              role="menu"
                            >
                              <button
                                type="button"
                                className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-gray-100"
                                onClick={() => {
                                  setOpenMenuId(null);
                                  onRegeneratePreview(entry.id);
                                }}
                                role="menuitem"
                              >
                                {t('journalPreviewRegenerate')}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {isLoading && (
                        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gray-900/35 text-white">
                          <span className="inline-flex h-8 w-8 animate-spin rounded-full border-2 border-white/40 border-t-transparent" />
                          <span className="px-4 text-[11px] font-semibold uppercase tracking-[0.24em] text-center">
                            {t('journalPreviewGenerating')}
                          </span>
                        </div>
                      )}

                      {isError && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gray-900/45 px-4 text-center text-white">
                          <span className="text-xs font-semibold uppercase tracking-[0.2em]">
                            {t('journalPreviewError')}
                          </span>
                          <button
                            type="button"
                            onClick={() => onRegeneratePreview(entry.id)}
                            className="rounded-full border border-white/60 bg-white/10 px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] hover:bg-white/20"
                          >
                            {t('journalPreviewRetry')}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex-1 space-y-5">
                    <header className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-1">
                        <h3 className="text-xl font-semibold text-gray-800">{entry.recipeName}</h3>
                        <p className="text-xs text-gray-500">
                          {t('journalCreatedAt', { date: createdAtLabel })}
                        </p>
                        {entry.timesCooked > 0 && (
                          <p className="text-xs text-emerald-600 font-semibold">
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
                        onChange={event =>
                          setDraftNotes(current => ({ ...current, [entry.id]: event.target.value }))
                        }
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
                      {lastCookedLabel && (
                        <p className="text-[11px] uppercase tracking-widest font-semibold text-gray-400">
                          {t('journalLastCooked', { date: lastCookedLabel })}
                        </p>
                      )}
                    </div>
                  </div>
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
