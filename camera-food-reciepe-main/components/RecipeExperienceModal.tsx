import React, { useMemo } from 'react';
import type { RecipeMemory } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { UtensilsIcon } from './icons';

interface RecipeExperienceModalProps {
  entry: RecipeMemory;
  onClose: () => void;
  onCook: () => void;
  onViewNutrition: () => void;
}

const formatter = new Intl.DateTimeFormat('ko-KR', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

const RecipeExperienceModal: React.FC<RecipeExperienceModalProps> = ({ entry, onClose, onCook }) => {
  const { t } = useLanguage();
  const videos = entry.videos ?? [];
  const selectedVideo = useMemo(
    () => (entry.selectedVideoId ? videos.find(video => video.id === entry.selectedVideoId) ?? null : null),
    [videos, entry.selectedVideoId]
  );
  const createdAtLabel = formatter.format(new Date(entry.createdAt));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6" onClick={onClose}>
      <div
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
        onClick={event => event.stopPropagation()}
      >
        <header className="flex flex-col gap-4 border-b border-gray-200 bg-gray-50 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-brand-orange/10 text-brand-orange">
              <UtensilsIcon />
            </span>
            <div className="space-y-1">
              <h2 className="text-xl font-semibold text-gray-800">{entry.recipeName}</h2>
              <p className="text-xs uppercase tracking-[0.3em] text-gray-400">{t('experienceModalHeaderTagline')}</p>
              <p className="text-xs text-gray-500">{t('experienceModalCreatedAt', { date: createdAtLabel })}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 transition hover:bg-gray-100"
            >
              {t('experienceModalClose')}
            </button>
            <button
              type="button"
              onClick={onCook}
              className="inline-flex items-center rounded-xl bg-brand-blue px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-600"
            >
              {t('experienceModalMarkWatched')}
            </button>
          </div>
        </header>

        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
          {entry.description && (
            <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-700">{t('experienceModalDescriptionTitle')}</h3>
              <p className="mt-2 text-sm text-gray-600">{entry.description}</p>
            </section>
          )}

          <section className="space-y-4">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-gray-700">{t('experienceModalVideosTitleSimple')}</h3>
              <p className="text-xs text-gray-500">{t('experienceModalVideosSubtitleSimple')}</p>
            </div>
            {videos.length === 0 ? (
              <p className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500">
                {t('experienceModalVideosEmpty')}
              </p>
            ) : (
              <div className="space-y-3">
                {videos.map(video => {
                  const isSelected = selectedVideo?.id === video.id;
                  return (
                    <a
                      key={video.id}
                      href={video.videoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`flex items-center justify-between rounded-2xl border px-4 py-3 transition ${
                        isSelected
                          ? 'border-brand-blue/60 bg-brand-blue/5 text-brand-blue'
                          : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <div className="space-y-1">
                        <p className="text-sm font-semibold">{video.title}</p>
                        <p className="text-xs text-gray-500">{video.channelTitle}</p>
                      </div>
                      <span className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-blue">
                        {t('experienceModalWatchExternal')}
                      </span>
                    </a>
                  );
                })}
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-700">{t('experienceModalNotesTitle')}</h3>
            {entry.note ? (
              <p className="rounded-2xl border border-gray-100 bg-white px-4 py-3 text-sm text-gray-700 shadow-sm">
                {entry.note}
              </p>
            ) : (
              <p className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500">
                {t('experienceModalNotesEmpty')}
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

export default RecipeExperienceModal;
