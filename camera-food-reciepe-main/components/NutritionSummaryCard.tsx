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
  const macroTotal = summary.total.protein + summary.total.carbs + summary.total.fat;
  const macroRows = [
    {
      key: 'protein' as const,
      label: t('nutritionCardProtein'),
      value: summary.total.protein,
      accent: 'bg-emerald-500',
      track: 'bg-emerald-100',
      text: 'text-emerald-700',
    },
    {
      key: 'carbs' as const,
      label: t('nutritionCardCarbs'),
      value: summary.total.carbs,
      accent: 'bg-amber-500',
      track: 'bg-amber-100',
      text: 'text-amber-700',
    },
    {
      key: 'fat' as const,
      label: t('nutritionCardFat'),
      value: summary.total.fat,
      accent: 'bg-rose-500',
      track: 'bg-rose-100',
      text: 'text-rose-700',
    },
  ];

  return (
    <section className="rounded-[36px] border border-[#7CB7FF]/30 bg-white/90 backdrop-blur-xl shadow-[0_28px_60px_rgba(124,183,255,0.22)] overflow-hidden">
      <div className="relative bg-[#7CB7FF] text-white p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="pointer-events-none absolute -top-20 -left-24 h-48 w-48 rounded-full bg-[#E2F0FF]/40 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 -right-16 h-40 w-40 rounded-full bg-[#EBF5FF]/40 blur-3xl" />
        <div className="relative flex items-start gap-3">
          <span className="inline-flex items-center justify-center h-12 w-12 rounded-2xl bg-white/25 text-[#1C2B4B]">
            <SparklesIcon />
          </span>
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.35em] text-white/75 font-semibold">
              {t('nutritionCardTagline')}
            </p>
            <h2 className="text-2xl font-bold leading-tight drop-shadow-[0_10px_18px_rgba(28,43,75,0.25)]">
              {t('nutritionCardTitle')}
            </h2>
            <p className="text-sm text-white/85 max-w-xl">{t('nutritionCardSubtitle')}</p>
          </div>
        </div>
        {onClear && (
          <button
            type="button"
            onClick={onClear}
            className="relative text-xs font-semibold uppercase tracking-[0.35em] rounded-full px-4 py-2 bg-white/20 text-white hover:bg-white/30 transition"
          >
            {t('nutritionCardDismiss')}
          </button>
        )}
      </div>
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-2xl border border-[#7CB7FF]/30 bg-[#EBF5FF] p-4 flex flex-col">
            <span className="text-xs font-semibold uppercase tracking-wide text-[#1C2B4B]/70">
              {t('nutritionCardCalories')}
            </span>
            <span className="text-2xl font-bold text-[#1C2B4B] mt-1">
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

        {macroTotal > 0 && (
          <div className="bg-white border border-[#E2F0FF] rounded-2xl p-5 space-y-4">
            <div className="flex flex-col gap-1">
              <h3 className="text-sm font-semibold text-[#1C2B4B]">
                {t('nutritionCardMacroSplitTitle')}
              </h3>
              <p className="text-xs text-[#1C2B4B]/60">{t('nutritionCardMacroSplitHint')}</p>
            </div>
            <div className="space-y-3">
              {macroRows.map(row => {
                const percent = Math.round((row.value / macroTotal) * 100);
                return (
                  <div key={row.key} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-semibold uppercase tracking-wide ${row.text}`}>
                        {row.label}
                      </span>
                      <span className="text-sm font-semibold text-[#1C2B4B]">
                        {formatMacro(row.value, 'g')}
                      </span>
                    </div>
                    <div className={`h-2 w-full rounded-full ${row.track}`}>
                      <div
                        className={`h-full rounded-full ${row.accent}`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-[#1C2B4B]/60">
                      {t('nutritionCardMacroPercent', { percent })}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="bg-[#EBF5FF]/60 border border-[#E2F0FF] rounded-2xl p-5 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-[#1C2B4B]">
                {t('nutritionCardDetectedLabel', { count: summary.detectedCount })}
              </h3>
              <p className="text-xs text-[#1C2B4B]/60">{ingredients.join(', ')}</p>
            </div>
            <span className="inline-flex items-center rounded-full bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.35em] text-[#1C2B4B]/70">
              {t('nutritionCardServingHint')}
            </span>
          </div>

          <div className="space-y-3">
            {summary.breakdown.map(entry => (
              <div
                key={`${entry.ingredient}-${entry.confidence}`}
                className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 bg-white rounded-xl border border-[#E2F0FF] p-4 shadow-sm"
              >
                <div>
                  <p className="text-sm font-semibold text-[#1C2B4B] capitalize">{entry.ingredient}</p>
                  <p className="text-xs text-[#1C2B4B]/60">
                    {t('nutritionCardBreakdown', {
                      protein: formatMacro(entry.profile.protein, 'g'),
                      carbs: formatMacro(entry.profile.carbs, 'g'),
                      fat: formatMacro(entry.profile.fat, 'g'),
                    })}
                  </p>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-sm font-bold text-[#1C2B4B]">
                    {formatMacro(entry.profile.calories, 'kcal')}
                  </span>
                  <span className="text-[11px] font-semibold uppercase tracking-[0.35em] text-[#1C2B4B]/40">
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
