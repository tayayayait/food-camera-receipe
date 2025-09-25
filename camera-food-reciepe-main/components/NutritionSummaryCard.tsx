import React from 'react';
import type { NutritionSummary } from '../types';
import { formatMacro } from '../services/nutritionService';
import { useLanguage } from '../context/LanguageContext';
import { SparklesIcon } from './icons';

interface NutritionSummaryCardProps {
  summary: NutritionSummary;
  ingredients: string[];
  onClear?: () => void;
}

const confidenceLabelKey: Record<
  NutritionSummary['breakdown'][number]['confidence'],
  'nutritionConfidenceHigh' | 'nutritionConfidenceMedium' | 'nutritionConfidenceLow'
> = {
  high: 'nutritionConfidenceHigh',
  medium: 'nutritionConfidenceMedium',
  low: 'nutritionConfidenceLow',
};

const NutritionSummaryCard: React.FC<NutritionSummaryCardProps> = ({ summary, ingredients, onClear }) => {
  const { t } = useLanguage();

  return (
    <section className="bg-white rounded-3xl shadow-xl border border-brand-blue/10 overflow-hidden">
      <div className="bg-gradient-to-r from-brand-blue to-brand-blue/90 text-white p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="inline-flex items-center justify-center h-12 w-12 rounded-2xl bg-white/20">
            <SparklesIcon />
          </span>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-white/60 font-semibold">
              {t('nutritionCardTagline')}
            </p>
            <h2 className="text-2xl font-bold leading-tight">{t('nutritionCardTitle')}</h2>
            <p className="text-sm text-white/80">{t('nutritionCardSubtitle')}</p>
          </div>
        </div>
        {onClear && (
          <button
            type="button"
            onClick={onClear}
            className="text-xs font-semibold uppercase tracking-widest rounded-full px-4 py-2 bg-white/10 hover:bg-white/20 transition"
          >
            {t('nutritionCardDismiss')}
          </button>
        )}
      </div>
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-brand-blue/5 rounded-2xl p-4 flex flex-col">
            <span className="text-xs font-semibold uppercase tracking-wide text-brand-blue/70">
              {t('nutritionCardCalories')}
            </span>
            <span className="text-2xl font-bold text-brand-blue mt-1">
              {formatMacro(summary.total.calories, 'kcal')}
            </span>
          </div>
          <div className="bg-emerald-50 rounded-2xl p-4 flex flex-col">
            <span className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
              {t('nutritionCardProtein')}
            </span>
            <span className="text-2xl font-bold text-emerald-700 mt-1">
              {formatMacro(summary.total.protein, 'g')}
            </span>
          </div>
          <div className="bg-amber-50 rounded-2xl p-4 flex flex-col">
            <span className="text-xs font-semibold uppercase tracking-wide text-amber-700">
              {t('nutritionCardCarbs')}
            </span>
            <span className="text-2xl font-bold text-amber-700 mt-1">
              {formatMacro(summary.total.carbs, 'g')}
            </span>
          </div>
          <div className="bg-rose-50 rounded-2xl p-4 flex flex-col">
            <span className="text-xs font-semibold uppercase tracking-wide text-rose-700">
              {t('nutritionCardFat')}
            </span>
            <span className="text-2xl font-bold text-rose-700 mt-1">
              {formatMacro(summary.total.fat, 'g')}
            </span>
          </div>
        </div>

        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-gray-700">
                {t('nutritionCardDetectedLabel', { count: summary.detectedCount })}
              </h3>
              <p className="text-xs text-gray-500">{ingredients.join(', ')}</p>
            </div>
            <span className="inline-flex items-center rounded-full bg-gray-200 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-gray-600">
              {t('nutritionCardServingHint')}
            </span>
          </div>

          <div className="space-y-3">
            {summary.breakdown.map(entry => (
              <div
                key={`${entry.ingredient}-${entry.confidence}`}
                className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 bg-white rounded-xl border border-gray-200 p-4"
              >
                <div>
                  <p className="text-sm font-semibold text-gray-800 capitalize">{entry.ingredient}</p>
                  <p className="text-xs text-gray-500">
                    {t('nutritionCardBreakdown', {
                      protein: formatMacro(entry.profile.protein, 'g'),
                      carbs: formatMacro(entry.profile.carbs, 'g'),
                      fat: formatMacro(entry.profile.fat, 'g'),
                    })}
                  </p>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-sm font-bold text-brand-blue">
                    {formatMacro(entry.profile.calories, 'kcal')}
                  </span>
                  <span className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">
                    {t(confidenceLabelKey[entry.confidence])}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default NutritionSummaryCard;
