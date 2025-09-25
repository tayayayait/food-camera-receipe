import React, { useMemo } from 'react';
import type { RecipeMemory } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { estimateNutritionSummary, formatMacro } from '../services/nutritionService';
import { PulseIcon, FlameIcon, UtensilsIcon } from './icons';

interface RecipeExperienceModalProps {
  entry: RecipeMemory;
  onClose: () => void;
  onCook: () => void;
  onViewNutrition: () => void;
}

const RecipeExperienceModal: React.FC<RecipeExperienceModalProps> = ({ entry, onClose, onCook, onViewNutrition }) => {
  const { t } = useLanguage();

  const ingredients = useMemo(() => {
    if (entry.ingredients && entry.ingredients.length > 0) {
      return entry.ingredients;
    }
    const fallback = [
      ...(entry.matchedIngredients ?? []),
      ...(entry.missingIngredients ?? []),
    ].filter(Boolean);
    return fallback;
  }, [entry.ingredients, entry.matchedIngredients, entry.missingIngredients]);

  const instructions = entry.instructions ?? [];
  const videos = entry.videos ?? [];

  const nutritionSummary = useMemo(() => {
    if (!ingredients.length) {
      return null;
    }
    return estimateNutritionSummary(ingredients);
  }, [ingredients]);

  const handleViewNutrition = () => {
    onViewNutrition();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="max-w-4xl w-full bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={event => event.stopPropagation()}
      >
        <header className="px-6 py-5 border-b border-gray-200 flex flex-col gap-3 md:flex-row md:items-center md:justify-between bg-gray-50">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-orange/10 text-brand-orange">
              <UtensilsIcon />
            </span>
            <div className="space-y-1">
              <h2 className="text-2xl font-semibold text-gray-800">{entry.recipeName}</h2>
              <p className="text-xs uppercase tracking-[0.35em] text-gray-400">
                {t('experienceModalHeaderTagline')}
              </p>
              {entry.timesCooked > 0 && (
                <p className="text-xs text-gray-500">{t('journalTimesCooked', { count: entry.timesCooked })}</p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-500 hover:bg-gray-100 transition"
            >
              {t('experienceModalClose')}
            </button>
            <button
              type="button"
              onClick={onCook}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-orange text-white px-4 py-2 text-sm font-semibold shadow hover:bg-orange-500 transition"
            >
              <FlameIcon />
              {t('experienceModalCookButton')}
            </button>
            {ingredients.length > 0 && (
              <button
                type="button"
                onClick={handleViewNutrition}
                className="inline-flex items-center gap-2 rounded-xl border border-brand-blue/30 text-brand-blue px-4 py-2 text-sm font-semibold hover:bg-brand-blue/10 transition"
              >
                <PulseIcon />
                {t('experienceModalNutritionAction')}
              </button>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
          {entry.description && (
            <p className="text-sm text-gray-600 leading-relaxed bg-gray-50 border border-gray-200 rounded-2xl p-4">
              {entry.description}
            </p>
          )}

          {nutritionSummary && (
            <section className="bg-brand-blue/5 border border-brand-blue/15 rounded-2xl p-5 space-y-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-brand-blue shadow-sm">
                    <PulseIcon />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-brand-blue">{t('experienceModalNutritionTitle')}</p>
                    <p className="text-xs text-brand-blue/70">
                      {t('experienceModalNutritionSubtitle', { count: nutritionSummary.detectedCount })}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 flex-1">
                  {[
                    { label: t('nutritionCardCalories'), value: formatMacro(nutritionSummary.total.calories, 'kcal') },
                    { label: t('nutritionCardProtein'), value: formatMacro(nutritionSummary.total.protein, 'g') },
                    { label: t('nutritionCardCarbs'), value: formatMacro(nutritionSummary.total.carbs, 'g') },
                    { label: t('nutritionCardFat'), value: formatMacro(nutritionSummary.total.fat, 'g') },
                  ].map(stat => (
                    <div
                      key={stat.label}
                      className="rounded-xl bg-white/80 px-3 py-2 text-center shadow-sm border border-white/50"
                    >
                      <p className="text-[11px] uppercase tracking-wide text-brand-blue/60">{stat.label}</p>
                      <p className="text-sm font-semibold text-brand-blue">{stat.value}</p>
                    </div>
                  ))}
                </div>
              </div>
              <p className="text-xs text-brand-blue/60">
                {t('experienceModalNutritionHint')}
              </p>
            </section>
          )}

          {ingredients.length > 0 && (
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-widest">
                {t('experienceModalIngredientsTitle')}
              </h3>
              <div className="flex flex-wrap gap-2">
                {ingredients.map(ingredient => (
                  <span
                    key={`${entry.id}-${ingredient}`}
                    className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600"
                  >
                    {ingredient}
                  </span>
                ))}
              </div>
            </section>
          )}

          <section className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-widest">
                {t('experienceModalStepsTitle')}
              </h3>
              <p className="text-xs text-gray-500">{t('experienceModalStepsSubtitle')}</p>
            </div>
            {instructions.length > 0 ? (
              <div className="grid gap-3 md:grid-cols-2">
                {instructions.map((instruction, index) => {
                  const text = instruction.trim();
                  return (
                    <div key={`${entry.id}-step-${index}`} className="rounded-2xl border border-gray-200 bg-white p-4 space-y-2 shadow-sm">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand-orange text-white text-sm font-semibold">
                          {index + 1}
                        </span>
                        <p className="text-sm font-semibold text-gray-800">{text}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-gray-500">{t('experienceModalStepsEmpty')}</p>
            )}
          </section>

          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-widest">
              {t('experienceModalVideosTitle')}
            </h3>
            {videos.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2">
                {videos.map(video => (
                  <a
                    key={video.id}
                    href={video.videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group block bg-gray-100 rounded-xl overflow-hidden shadow-sm hover:shadow-lg transition-shadow"
                  >
                    <div className="relative aspect-video overflow-hidden">
                      <img src={video.thumbnailUrl} alt={video.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                      <span className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded-full">YouTube</span>
                    </div>
                    <div className="p-4 space-y-1">
                      <p className="text-sm font-semibold text-gray-800">{video.title}</p>
                      <p className="text-xs text-gray-500">{video.channelTitle}</p>
                    </div>
                  </a>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">{t('experienceModalVideosEmpty')}</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

export default RecipeExperienceModal;
