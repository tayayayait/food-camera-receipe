import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { RecipeMemory } from '../types';
import { BookOpenIcon, FlameIcon, TrashIcon, ClipboardIcon, MoreVerticalIcon } from './icons';
import { useLanguage } from '../context/LanguageContext';

const dataUrlToBlob = (dataUrl: string): Blob => {
  const [metadata, base64Data] = dataUrl.split(',', 2);
  if (!metadata || !base64Data) {
    throw new Error('Invalid data URL');
  }

  const mimeMatch = metadata.match(/data:(.*?);base64/);
  const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
  const binary = atob(base64Data);
  const length = binary.length;
  const buffer = new Uint8Array(length);
  for (let index = 0; index < length; index += 1) {
    buffer[index] = binary.charCodeAt(index);
  }
  return new Blob([buffer], { type: mimeType });
};

const hashString = (value: string) => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
};

const placeholderPalettes: [string, string, string][] = [
  ['#FDE68A', '#FDBA74', '#F97316'],
  ['#DBEAFE', '#A5B4FC', '#6366F1'],
  ['#E0F2FE', '#7DD3FC', '#0EA5E9'],
  ['#FCE7F3', '#F9A8D4', '#EC4899'],
  ['#DCFCE7', '#86EFAC', '#16A34A'],
  ['#FFE4E6', '#FDA4AF', '#F43F5E'],
  ['#E2E8F0', '#CBD5F5', '#64748B'],
];

const buildPlaceholderStyle = (seed: string) => {
  const palette = placeholderPalettes[hashString(seed) % placeholderPalettes.length];
  const accentIndex = hashString(`${seed}-accent`) % palette.length;
  const accent = palette[accentIndex];
  return {
    style: {
      backgroundImage: `radial-gradient(circle at 0% 0%, ${palette[0]} 0%, transparent 70%), radial-gradient(circle at 100% 100%, ${palette[1]} 0%, transparent 72%), linear-gradient(135deg, ${palette[0]} 0%, ${palette[2]} 100%)`,
    } as React.CSSProperties,
    accent,
  };
};

const getInitials = (name: string) => {
  const trimmed = name.trim();
  if (!trimmed) {
    return '??';
  }

  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
};

interface RecipeJournalProps {
  entries: RecipeMemory[];
  onUpdate: (id: string, updates: Partial<RecipeMemory>) => void;
  onDelete: (id: string) => void;
  onRegeneratePreview: (id: string) => void;
  onMarkCooked: (id: string) => void;
  onOpenDetails: (id: string) => void;
  highlightedId?: string | null;
  pendingPreviewIds: ReadonlySet<string>;
}

const RecipeJournal: React.FC<RecipeJournalProps> = ({
  entries,
  onUpdate,
  onDelete,
  onRegeneratePreview,
  onMarkCooked,
  onOpenDetails,
  highlightedId,
  pendingPreviewIds,
}) => {
  const { t } = useLanguage();
  const [draftNotes, setDraftNotes] = useState<Record<string, string>>({});
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  const previewObjectUrlCache = useRef<Map<string, { source: string; url: string }>>(new Map());

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
    const nextUrls: Record<string, string> = {};
    const seen = new Set<string>();

    entries.forEach(entry => {
      seen.add(entry.id);
      const source = entry.journalPreviewImage;
      const cached = previewObjectUrlCache.current.get(entry.id);

      if (!source) {
        if (cached) {
          URL.revokeObjectURL(cached.url);
          previewObjectUrlCache.current.delete(entry.id);
        }
        return;
      }

      if (/^(https?:|blob:)/i.test(source)) {
        if (cached) {
          URL.revokeObjectURL(cached.url);
          previewObjectUrlCache.current.delete(entry.id);
        }
        nextUrls[entry.id] = source;
        return;
      }

      if (/^data:/i.test(source)) {
        if (!cached || cached.source !== source) {
          if (cached) {
            URL.revokeObjectURL(cached.url);
          }
          try {
            const blob = dataUrlToBlob(source);
            const objectUrl = URL.createObjectURL(blob);
            previewObjectUrlCache.current.set(entry.id, { source, url: objectUrl });
            nextUrls[entry.id] = objectUrl;
          } catch (error) {
            console.error('Failed to create preview object URL', error);
            previewObjectUrlCache.current.delete(entry.id);
          }
        } else {
          nextUrls[entry.id] = cached.url;
        }
        return;
      }

      if (cached) {
        URL.revokeObjectURL(cached.url);
        previewObjectUrlCache.current.delete(entry.id);
      }
      nextUrls[entry.id] = source;
    });

    Array.from(previewObjectUrlCache.current.entries()).forEach(([id, value]) => {
      if (!seen.has(id)) {
        URL.revokeObjectURL(value.url);
        previewObjectUrlCache.current.delete(id);
      }
    });

    setPreviewUrls(nextUrls);
  }, [entries]);

  useEffect(() => {
    return () => {
      previewObjectUrlCache.current.forEach(({ url }) => URL.revokeObjectURL(url));
      previewObjectUrlCache.current.clear();
    };
  }, []);

  useEffect(() => {
    if (openMenuId && !entries.some(entry => entry.id === openMenuId)) {
      setOpenMenuId(null);
    }
  }, [entries, openMenuId]);

  useEffect(() => {
    if (!openMenuId) {
      return;
    }

    const handleOutsideClick = () => setOpenMenuId(null);
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, [openMenuId]);

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

  const handleMenuToggle = (event: React.MouseEvent<HTMLButtonElement>, id: string) => {
    event.stopPropagation();
    setOpenMenuId(current => (current === id ? null : id));
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
            const previewUrl = previewUrls[entry.id] ?? entry.journalPreviewImage ?? null;
            const placeholderVisual = buildPlaceholderStyle(`${entry.id}-${entry.recipeName}`);
            const initials = getInitials(entry.recipeName);
            const altText = t('journalPreviewAlt', { name: entry.recipeName });
            const isAwaitingPreview = pendingPreviewIds.has(entry.id);
            return (
              <article
                key={entry.id}
                className={`border rounded-2xl p-4 sm:p-5 transition-shadow bg-white ${
                  isHighlighted ? 'border-brand-orange shadow-lg ring-2 ring-brand-orange/40' : 'border-gray-200 shadow-sm'
                }`}
              >
                <div className="flex flex-col gap-4 sm:flex-row">
                  <div className="sm:w-40 md:w-48 flex-shrink-0">
                    <div
                      className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-gray-200 bg-gray-100 shadow-inner"
                      style={previewUrl ? undefined : placeholderVisual.style}
                    >
                      {previewUrl ? (
                        <img
                          src={previewUrl}
                          alt={altText}
                          loading="lazy"
                          className="h-full w-full object-cover transition-transform duration-300 hover:scale-[1.02]"
                        />
                      ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
                          <span
                            className="text-2xl font-bold tracking-[0.4em] drop-shadow-[0_6px_12px_rgba(15,23,42,0.28)]"
                            style={{ color: placeholderVisual.accent }}
                          >
                            {initials}
                          </span>
                          <span className="mt-2 text-[10px] font-semibold uppercase tracking-[0.45em] opacity-80">
                            {t('journalPreviewPlaceholder')}
                          </span>
                        </div>
                      )}
                      {isAwaitingPreview && (
                        <span className="absolute bottom-2 left-2 rounded-full bg-black/40 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.4em] text-white backdrop-blur">
                          {t('journalPreviewGenerating')}
                        </span>
                      )}
                      <div className="absolute top-2 right-2 z-10">
                        <button
                          type="button"
                          onClick={event => handleMenuToggle(event, entry.id)}
                          aria-label={t('journalPreviewMenuLabel')}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-gray-500 shadow-sm backdrop-blur transition hover:bg-white"
                        >
                          <MoreVerticalIcon />
                        </button>
                        {openMenuId === entry.id && (
                          <div
                            className="absolute right-0 mt-2 w-48 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl"
                            onClick={event => event.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setOpenMenuId(null);
                                onRegeneratePreview(entry.id);
                              }}
                              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                            >
                              {t('journalPreviewRegenerate')}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex-1 space-y-4">
                    <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-1">
                        <h3 className="text-xl font-semibold text-gray-800">{entry.recipeName}</h3>
                        <p className="text-xs text-gray-500">
                          {t('journalCreatedAt', { date: formatter.format(new Date(entry.createdAt)) })}
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
                      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <button
                          type="button"
                          onClick={() => handleSaveNote(entry.id)}
                          className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-blue text-white px-4 py-2 text-sm font-semibold shadow hover:bg-blue-600 transition"
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
