import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  RecipeRecommendation,
  NutritionSummary,
  NutritionContext,
  RecipeVideo,
  VideoRecipeState,
} from '../types';
import { UtensilsIcon, PulseIcon } from './icons';
import { useLanguage } from '../context/LanguageContext';
import { formatMacro } from '../services/nutritionService';
import {
  clearRecipePreviewCache,
  fetchRecipePreviewImage,
  getRecipePreviewCacheKey,
} from '../services/designPreviewService';

const extractStepSummary = (instruction: string) => {
  const cleaned = instruction.trim();
  if (!cleaned) {
    return { summary: '', details: '' };
  }

  const prioritySeparators = [':', ' - ', ' – ', ' — '];
  for (const separator of prioritySeparators) {
    const index = cleaned.indexOf(separator);
    if (index > 0) {
      const summary = cleaned.slice(0, index).trim();
      const details = cleaned.slice(index + separator.length).trim();
      if (summary) {
        return { summary, details };
      }
    }
  }

  const sentenceMatch = cleaned.match(/^(.*?[.!?])\s+(.*)$/);
  if (sentenceMatch) {
    const [, firstSentence, rest] = sentenceMatch;
    return {
      summary: firstSentence.trim(),
      details: rest.trim(),
    };
  }

  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length > 8) {
    const summary = words.slice(0, 6).join(' ');
    const details = words.slice(6).join(' ');
    return {
      summary: `${summary}…`,
      details,
    };
  }

  return { summary: cleaned, details: '' };
};

type PreviewState = {
  status: 'idle' | 'loading' | 'success' | 'error';
  image?: string;
};

interface PreviewRequestOptions {
  force?: boolean;
  clearImage?: boolean;
  skipStatePriming?: boolean;
}

const PREVIEW_REFRESH_DEBOUNCE_MS = 900;

interface RecipeModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipes: RecipeRecommendation[];
  isLoading: boolean;
  error: string | null;
  ingredients: string[];
  onSaveRecipeToJournal: (recipe: RecipeRecommendation) => { id: string; isNew: boolean };
  savedRecipeNames: string[];
  nutritionSummary?: NutritionSummary | null;
  nutritionContext?: NutritionContext | null;
  onViewRecipeNutrition: (recipe: RecipeRecommendation) => void;
  onApplyDetectedIngredients: (ingredients: string[]) => Promise<string[]>;
  onVideoSelect: (video: RecipeVideo, recipe: RecipeRecommendation) => void;
  videoRecipeState: VideoRecipeState;
}

const LoadingSkeleton: React.FC = () => (
  <div className="animate-pulse space-y-4 bg-white border border-gray-100 rounded-2xl p-4">
    <div className="h-6 bg-gray-200 rounded w-3/4"></div>
    <div className="h-4 bg-gray-200 rounded w-full"></div>
    <div className="h-4 bg-gray-200 rounded w-5/6"></div>
    <div className="h-40 bg-gray-100 rounded-xl"></div>
  </div>
);

const RecipeModal: React.FC<RecipeModalProps> = ({
  isOpen,
  onClose,
  recipes,
  isLoading,
  error,
  ingredients,
  onSaveRecipeToJournal,
  savedRecipeNames,
  nutritionSummary,
  nutritionContext,
  onViewRecipeNutrition,
  onApplyDetectedIngredients,
  onVideoSelect,
  videoRecipeState,
}) => {
  const { t } = useLanguage();
  if (!isOpen) return null;

  const [justSavedState, setJustSavedState] = useState<{ name: string; isNew: boolean } | null>(null);
  const [previews, setPreviews] = useState<Record<string, PreviewState>>({});
  const previewsRef = useRef<Record<string, PreviewState>>({});
  const refreshTimeoutsRef = useRef<Record<string, number>>({});
  const isMountedRef = useRef(true);
  const [isEditingIngredients, setIsEditingIngredients] = useState(false);
  const [ingredientsEditorValue, setIngredientsEditorValue] = useState(() => ingredients.join('\n'));
  const [ingredientsEditorError, setIngredientsEditorError] = useState<string | null>(null);
  const [isApplyingIngredientEdits, setIsApplyingIngredientEdits] = useState(false);
  const [ingredientUpdateFeedback, setIngredientUpdateFeedback] = useState<string | null>(null);

  useEffect(() => {
    previewsRef.current = previews;
  }, [previews]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      Object.values(refreshTimeoutsRef.current).forEach(timeoutId => window.clearTimeout(timeoutId));
    };
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setJustSavedState(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!justSavedState) {
      return;
    }

    const timeout = window.setTimeout(() => setJustSavedState(null), 2200);
    return () => window.clearTimeout(timeout);
  }, [justSavedState]);

  useEffect(() => {
    if (!isEditingIngredients) {
      setIngredientsEditorValue(ingredients.join('\n'));
    }
  }, [ingredients, isEditingIngredients]);

  useEffect(() => {
    if (!ingredientUpdateFeedback) {
      return;
    }

    const timeout = window.setTimeout(() => setIngredientUpdateFeedback(null), 2200);
    return () => window.clearTimeout(timeout);
  }, [ingredientUpdateFeedback]);

  const savedRecipeNamesSet = useMemo(
    () => new Set(savedRecipeNames.map(name => name.trim().toLowerCase())),
    [savedRecipeNames]
  );

  const nutritionContextLabel = nutritionContext
    ? nutritionContext.type === 'scan'
      ? t('nutritionContextScan')
      : nutritionContext.type === 'recipe'
        ? t('nutritionContextRecipe', { name: nutritionContext.label })
        : t('nutritionContextMemory', { name: nutritionContext.label })
    : null;

  const previewKeyForRecipe = useCallback((recipe: RecipeRecommendation) => getRecipePreviewCacheKey(recipe), []);

  useEffect(() => {
    if (!isOpen) {
      setPreviews({});
      return;
    }

    setPreviews(prev => {
      const allowedKeys = new Set(recipes.map(previewKeyForRecipe));
      const next: Record<string, PreviewState> = {};
      let hasChanges = Object.keys(prev).length !== allowedKeys.size;

      allowedKeys.forEach(key => {
        if (prev[key]) {
          next[key] = prev[key];
        } else {
          hasChanges = true;
        }
      });

      return hasChanges ? next : prev;
    });
  }, [isOpen, previewKeyForRecipe, recipes]);

  const requestPreview = useCallback(
    (recipe: RecipeRecommendation, options?: PreviewRequestOptions) => {
      const { force = false, clearImage = false, skipStatePriming = false } = options ?? {};
      const key = previewKeyForRecipe(recipe);
      const current = previewsRef.current[key];

      if (!force && current && (current.status === 'loading' || current.status === 'success')) {
        return;
      }

      if (!skipStatePriming) {
        setPreviews(prev => ({
          ...prev,
          [key]: {
            status: 'loading',
            image: clearImage ? undefined : prev[key]?.image,
          },
        }));
      }

      fetchRecipePreviewImage(recipe)
        .then(image => {
          if (!isMountedRef.current) {
            return;
          }
          setPreviews(prev => ({
            ...prev,
            [key]: {
              status: 'success',
              image,
            },
          }));
        })
        .catch(error => {
          if (!isMountedRef.current) {
            return;
          }
          console.error('Failed to fetch recipe preview image', error);
          setPreviews(prev => ({
            ...prev,
            [key]: {
              status: 'error',
              image: prev[key]?.image,
            },
          }));
        });
    },
    [previewKeyForRecipe]
  );

  useEffect(() => {
    if (!isOpen || recipes.length === 0) {
      return;
    }

    recipes.forEach(recipe => {
      requestPreview(recipe);
    });
  }, [isOpen, recipes, requestPreview]);

  const handleRefreshPreview = useCallback(
    (recipe: RecipeRecommendation) => {
      const key = previewKeyForRecipe(recipe);
      clearRecipePreviewCache(recipe);

      setPreviews(prev => ({
        ...prev,
        [key]: {
          status: 'loading',
          image: undefined,
        },
      }));

      if (refreshTimeoutsRef.current[key]) {
        window.clearTimeout(refreshTimeoutsRef.current[key]);
      }

      refreshTimeoutsRef.current[key] = window.setTimeout(() => {
        requestPreview(recipe, { force: true, clearImage: true, skipStatePriming: true });
        delete refreshTimeoutsRef.current[key];
      }, PREVIEW_REFRESH_DEBOUNCE_MS);
    },
    [previewKeyForRecipe, requestPreview]
  );

  const handleSaveToJournal = (recipe: RecipeRecommendation) => {
    const result = onSaveRecipeToJournal(recipe);
    setJustSavedState({ name: recipe.recipeName, isNew: result.isNew });
  };

  const handleToggleIngredientEditor = () => {
    setIsEditingIngredients(current => {
      const next = !current;
      if (next) {
        setIngredientsEditorValue(ingredients.join('\n'));
      }
      setIngredientsEditorError(null);
      return next;
    });
  };

  const handleCancelIngredientEdit = () => {
    setIsEditingIngredients(false);
    setIngredientsEditorValue(ingredients.join('\n'));
    setIngredientsEditorError(null);
  };

  const handleApplyIngredientEdits = async () => {
    const parsed = ingredientsEditorValue
      .split(/[\n,]/)
      .map(entry => entry.trim())
      .filter(Boolean);

    if (parsed.length === 0) {
      setIngredientsEditorError(t('recipeModalEditIngredientsError'));
      return;
    }

    setIsApplyingIngredientEdits(true);
    try {
      const updated = await onApplyDetectedIngredients(parsed);
      setIngredientsEditorValue(updated.join('\n'));
      setIsEditingIngredients(false);
      setIngredientsEditorError(null);
      setIngredientUpdateFeedback(t('recipeModalEditIngredientsSuccess'));
    } catch (error) {
      const messageKey = error instanceof Error ? error.message : 'errorUnknown';
      setIngredientsEditorError(t(messageKey as any));
    } finally {
      setIsApplyingIngredientEdits(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-center z-50 p-4" onClick={onClose}>
      <div className="bg-gray-50 rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="p-6 md:p-8 border-b border-gray-200 bg-white">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-brand-orange/10 text-brand-orange">
              <UtensilsIcon />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-800">{t('recipeModalTitle')}</h2>
              {ingredients.length > 0 ? (
                <p className="text-sm text-gray-500">{t('recipeModalBasedOn')} {ingredients.join(', ')}</p>
              ) : (
                <p className="text-sm text-gray-500">{t('recipeModalAddMore')}</p>
              )}
            </div>
          </div>
        </div>

        <div className="p-6 md:p-8 overflow-y-auto flex-grow space-y-6">
          {nutritionSummary && (
            <div className="bg-brand-blue/5 border border-brand-blue/20 rounded-2xl p-5 space-y-4">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-brand-blue shadow-sm">
                    <PulseIcon />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-brand-blue">
                      {t('recipeModalNutritionSnapshotTitle')}
                    </p>
                    <p className="text-xs text-brand-blue/70">
                      {t('recipeModalNutritionSnapshotSubtitle', { count: nutritionSummary.detectedCount })}
                    </p>
                    {nutritionContextLabel && (
                      <p className="text-xs text-brand-blue/60">
                        {nutritionContextLabel}
                      </p>
                    )}
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
                      className="rounded-xl bg-white/70 px-3 py-2 text-center shadow-sm border border-white/40"
                    >
                      <p className="text-[11px] uppercase tracking-wide text-brand-blue/60">{stat.label}</p>
                      <p className="text-sm font-semibold text-brand-blue">{stat.value}</p>
                    </div>
                  ))}
                </div>
              </div>
              <p className="text-xs text-brand-blue/60">
                {t('recipeModalNutritionSnapshotHint')}
              </p>
            </div>
          )}

          {ingredients.length > 0 && (
            <section className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-gray-700">
                    {t('recipeModalDetectedIngredientsTitle')}
                  </p>
                  <p className="text-xs text-gray-500">
                    {t('recipeModalDetectedIngredientsDescription')}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center rounded-full bg-brand-blue/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.35em] text-brand-blue/70">
                    {t('nutritionCardDetectedLabel', { count: ingredients.length })}
                  </span>
                  <button
                    type="button"
                    onClick={isEditingIngredients ? handleCancelIngredientEdit : handleToggleIngredientEditor}
                    className="inline-flex items-center gap-2 rounded-full border border-brand-blue/20 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.35em] text-brand-blue shadow-sm transition hover:bg-brand-blue/10"
                  >
                    {isEditingIngredients
                      ? t('recipeModalEditIngredientsClose')
                      : t('recipeModalEditIngredientsButton')}
                  </button>
                </div>
              </div>
              {ingredientUpdateFeedback && !isEditingIngredients && (
                <p className="text-xs font-semibold text-emerald-600">{ingredientUpdateFeedback}</p>
              )}
              {isEditingIngredients ? (
                <div className="space-y-3">
                  <textarea
                    className="w-full rounded-2xl border border-brand-blue/20 bg-white px-4 py-3 text-sm text-gray-700 shadow-sm focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
                    rows={3}
                    value={ingredientsEditorValue}
                    onChange={event => {
                      setIngredientsEditorValue(event.target.value);
                      if (ingredientsEditorError) {
                        setIngredientsEditorError(null);
                      }
                    }}
                    placeholder={t('recipeModalEditIngredientsPlaceholder')}
                    disabled={isApplyingIngredientEdits}
                  />
                  <p className="text-xs text-gray-500">{t('recipeModalEditIngredientsHint')}</p>
                  {ingredientsEditorError && (
                    <p className="text-xs font-semibold text-red-500">{ingredientsEditorError}</p>
                  )}
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={handleCancelIngredientEdit}
                      className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-1.5 text-xs font-semibold text-gray-600 shadow-sm hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={isApplyingIngredientEdits}
                    >
                      {t('recipeModalEditIngredientsCancel')}
                    </button>
                    <button
                      type="button"
                      onClick={handleApplyIngredientEdits}
                      className="inline-flex items-center gap-2 rounded-full bg-brand-blue px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-70"
                      disabled={isApplyingIngredientEdits}
                    >
                      {isApplyingIngredientEdits
                        ? t('recipeModalEditIngredientsSaving')
                        : t('recipeModalEditIngredientsApply')}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {ingredients.map(ingredient => (
                    <span
                      key={`detected-${ingredient}`}
                      className="inline-flex items-center rounded-full bg-brand-blue/10 px-3 py-1 text-xs font-medium text-brand-blue"
                    >
                      {ingredient}
                    </span>
                  ))}
                </div>
              )}
            </section>
          )}

          {isLoading && (
            <div className="space-y-6">
              <LoadingSkeleton />
              <LoadingSkeleton />
            </div>
          )}

          {error && !isLoading && (
            <div className="bg-red-50 border border-red-100 text-red-600 rounded-2xl p-6 text-center text-sm">
              {error}
            </div>
          )}

          {!isLoading && !error && recipes.length > 0 && (
            <div className="space-y-6">
              {recipes.map((recipe, index) => {
                const normalizedName = recipe.recipeName.trim().toLowerCase();
                const normalizedVideoBaseName = videoRecipeState.baseRecipeName?.trim().toLowerCase() ?? null;
                const isSaved = savedRecipeNamesSet.has(normalizedName);
                const isJustSaved = justSavedState?.name === recipe.recipeName;
                const previewKey = previewKeyForRecipe(recipe);
                const previewState = previews[previewKey] ?? { status: 'idle', image: undefined };
                const isPreviewLoading = previewState.status === 'loading';
                const isPreviewError = previewState.status === 'error';
                const previewImage = previewState.status === 'success' ? previewState.image : undefined;
                const providerVideos = recipe.videos;
                const isVideoContextActive = normalizedVideoBaseName === normalizedName;
                const selectedVideoForRecipe = isVideoContextActive ? videoRecipeState.video : null;
                const resolvedRecipeName =
                  isVideoContextActive && videoRecipeState.recipe?.recipeName
                    ? videoRecipeState.recipe.recipeName
                    : recipe.recipeName;
                const resolvedDescription =
                  isVideoContextActive && videoRecipeState.recipe?.description
                    ? videoRecipeState.recipe.description
                    : recipe.description;
                const resolvedInstructions =
                  isVideoContextActive && videoRecipeState.recipe?.instructions?.length
                    ? videoRecipeState.recipe.instructions
                    : recipe.instructions;
                const resolvedIngredientsNeeded =
                  isVideoContextActive && videoRecipeState.recipe?.ingredientsNeeded?.length
                    ? videoRecipeState.recipe.ingredientsNeeded
                    : recipe.ingredientsNeeded;

                const providerByChannel = providerVideos.reduce<RecipeVideo[]>((acc, video) => {
                  if (!video.channelTitle) {
                    acc.push(video);
                    return acc;
                  }
                  const exists = acc.find(entry => entry.channelTitle === video.channelTitle);
                  if (!exists) {
                    acc.push(video);
                  }
                  return acc;
                }, []);

                return (
                  <article key={index} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-5">
                    <div className="space-y-5">
                      <div className="relative overflow-hidden rounded-2xl border border-gray-100 bg-gray-100">
                        {isPreviewLoading && (
                          <div className="flex h-48 w-full items-center justify-center bg-gradient-to-br from-gray-100 via-gray-200 to-gray-100 animate-pulse text-xs font-medium text-gray-500">
                            {t('recipeModalPreviewLoading')}
                          </div>
                        )}
                        {previewImage && !isPreviewLoading && (
                          <img
                            src={previewImage}
                            alt={`${recipe.recipeName} plating preview`}
                            className="h-48 w-full object-cover"
                          />
                        )}
                        {isPreviewError && !previewImage && !isPreviewLoading && (
                          <div className="flex h-48 w-full flex-col items-center justify-center gap-2 bg-gray-50 text-center text-sm text-gray-500">
                            <p>{t('recipeModalPreviewError')}</p>
                            <button
                              type="button"
                              onClick={() => handleRefreshPreview(recipe)}
                              className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-gray-600 shadow-sm ring-1 ring-gray-200 transition hover:bg-gray-100"
                            >
                              {t('recipeModalPreviewRetry')}
                            </button>
                          </div>
                        )}
                        {!previewImage && !isPreviewLoading && !isPreviewError && (
                          <div className="flex h-48 w-full items-center justify-center bg-gray-100 text-xs font-medium text-gray-500">
                            {t('recipeModalPreviewLoading')}
                          </div>
                        )}
                        <div className="absolute right-3 top-3 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleRefreshPreview(recipe)}
                            disabled={isPreviewLoading}
                            className="inline-flex items-center gap-1.5 rounded-full bg-white/85 px-3 py-1 text-[11px] font-semibold text-gray-600 shadow-sm ring-1 ring-white transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                            aria-label={t('recipeModalPreviewRefresh')}
                          >
                            ↻ {t('recipeModalPreviewRefresh')}
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                        <div className="space-y-4 flex-1">
                          <div className="space-y-2">
                            <h3 className="text-xl font-semibold text-gray-800">{resolvedRecipeName}</h3>
                            <p className="text-sm text-gray-600 leading-relaxed">{resolvedDescription}</p>
                          </div>

                          <div className="rounded-2xl border border-brand-blue/15 bg-brand-blue/5 p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div>
                              <p className="text-sm font-semibold text-brand-blue">{t('recipeModalJournalTitle')}</p>
                              <p className="text-xs text-brand-blue/70">{t('recipeModalJournalSubtitle')}</p>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              <button
                                type="button"
                                onClick={() => handleSaveToJournal(recipe)}
                                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold shadow transition ${
                                  isSaved
                                    ? 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                                    : 'bg-brand-blue text-white hover:bg-blue-600'
                                }`}
                              >
                                {isSaved ? t('recipeModalSaveButtonSaved') : t('recipeModalSaveButton')}
                              </button>
                              {isJustSaved ? (
                                <p className={`text-xs ${justSavedState?.isNew ? 'text-emerald-600' : 'text-gray-500'}`}>
                                  {justSavedState?.isNew
                                    ? t('recipeModalSaveNewSuccess')
                                    : t('recipeModalSaveExisting')}
                                </p>
                              ) : (
                                isSaved && (
                                  <p className="text-xs text-gray-500">{t('recipeModalSaveExisting')}</p>
                                )
                              )}
                            </div>
                          </div>

                          <section className="space-y-3">
                            <div className="flex flex-col gap-2">
                              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                                <h4 className="text-sm font-semibold text-gray-700">{t('recipeModalWatchVideos')}</h4>
                                <p className="text-xs text-gray-500">{t('recipeModalWatchVideosHint')}</p>
                              </div>
                              {providerVideos.length > 0 ? (
                                <div className="grid gap-3 sm:grid-cols-2">
                                  {providerVideos.map(video => {
                                    const isSelected = selectedVideoForRecipe?.id === video.id;
                                    return (
                                      <button
                                        type="button"
                                        key={video.id}
                                        onClick={() => onVideoSelect(video, recipe)}
                                        aria-pressed={isSelected}
                                        className={`group relative overflow-hidden rounded-xl border bg-white text-left shadow-sm transition focus:outline-none focus:ring-2 focus:ring-brand-blue/60 focus:ring-offset-2 ${
                                          isSelected
                                            ? 'border-brand-blue ring-2 ring-brand-blue/60'
                                            : 'border-gray-200 hover:shadow-md'
                                        }`}
                                      >
                                        <div className="relative aspect-video overflow-hidden">
                                          <img
                                            src={video.thumbnailUrl}
                                            alt={video.title}
                                            className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                                          />
                                          <span className="absolute bottom-2 left-2 rounded-full bg-black/70 px-2 py-1 text-[11px] font-semibold text-white">
                                            YouTube
                                          </span>
                                          {isSelected && (
                                            <span className="absolute right-2 top-2 rounded-full bg-brand-blue px-2 py-1 text-[11px] font-semibold uppercase tracking-widest text-white">
                                              {t('recipeModalVideoSelected')}
                                            </span>
                                          )}
                                        </div>
                                        <div className="p-4 space-y-1">
                                          <p className="text-sm font-semibold text-gray-800 leading-snug">{video.title}</p>
                                          <p className="text-xs text-gray-500">{video.channelTitle}</p>
                                        </div>
                                      </button>
                                    );
                                  })}
                                </div>
                              ) : (
                                <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-5 text-sm text-gray-500">
                                  {t('recipeModalNoVideos')}
                                </div>
                              )}
                            </div>

                            {providerByChannel.length > 0 && (
                              <div className="space-y-2">
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                                  {t('recipeModalVideoProvidersLabel')}
                                </p>
                                <div className="flex flex-wrap gap-2">
                                  {providerByChannel.map(video => {
                                    const isChannelSelected = selectedVideoForRecipe?.channelTitle === video.channelTitle;
                                    return (
                                      <button
                                        type="button"
                                        key={`${recipe.recipeName}-${video.channelTitle ?? video.id}`}
                                        onClick={() => onVideoSelect(video, recipe)}
                                        className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                                          isChannelSelected
                                            ? 'bg-brand-blue text-white shadow'
                                            : 'bg-white text-brand-blue border border-brand-blue/30 hover:bg-brand-blue/10'
                                        }`}
                                      >
                                        {video.channelTitle || t('recipeModalProviderYoutubeLabel')}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </section>

                          {isVideoContextActive && (
                            <section className="space-y-3 rounded-2xl border border-brand-blue/20 bg-brand-blue/5 p-4">
                              <div className="flex flex-col gap-1 md:flex-row md:items-start md:justify-between">
                                <div>
                                  <p className="text-sm font-semibold text-brand-blue">{t('recipeModalVideoRecipeTitle')}</p>
                                  <p className="text-xs text-brand-blue/70">
                                    {selectedVideoForRecipe
                                      ? t('recipeModalVideoRecipeSubtitle', {
                                          channel: selectedVideoForRecipe.channelTitle,
                                        })
                                      : t('recipeModalVideoRecipeSubtitleIdle')}
                                  </p>
                                </div>
                                {selectedVideoForRecipe && (
                                  <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-blue/70 md:text-right">
                                    {selectedVideoForRecipe.title}
                                  </p>
                                )}
                              </div>

                              {videoRecipeState.isLoading && (
                                <div className="flex items-center gap-2 text-brand-blue">
                                  <span className="inline-flex h-5 w-5 animate-spin rounded-full border-2 border-brand-blue/30 border-t-brand-blue"></span>
                                  <span className="text-sm font-medium">{t('recipeModalVideoRecipeLoading')}</span>
                                </div>
                              )}

                              {!videoRecipeState.isLoading && videoRecipeState.error && (
                                <div className="rounded-xl border border-red-100 bg-white px-4 py-3 text-sm text-red-600">
                                  {videoRecipeState.error}
                                </div>
                              )}

                              {!videoRecipeState.isLoading && !videoRecipeState.error && videoRecipeState.recipe && (
                                <div className="space-y-4">
                                  {videoRecipeState.recipe.description && (
                                    <p className="text-sm text-gray-600 leading-relaxed">
                                      {videoRecipeState.recipe.description}
                                    </p>
                                  )}
                                  <div className="space-y-2">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-brand-blue/70">
                                      {t('recipeModalVideoRecipeIngredients')}
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                      {videoRecipeState.recipe.ingredientsNeeded.map(ingredient => (
                                        <span
                                          key={`${recipe.recipeName}-video-ingredient-${ingredient}`}
                                          className="inline-flex items-center rounded-full bg-white px-3 py-1 text-xs font-medium text-brand-blue border border-brand-blue/30"
                                        >
                                          {ingredient}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                  <div className="space-y-2">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-brand-blue/70">
                                      {t('recipeModalVideoRecipeSteps')}
                                    </p>
                                    <ol className="space-y-2">
                                      {videoRecipeState.recipe.instructions.map((instruction, instructionIndex) => {
                                        const { summary, details } = extractStepSummary(instruction);
                                        return (
                                          <li
                                            key={`${recipe.recipeName}-video-instruction-${instructionIndex}`}
                                            className="rounded-2xl border border-brand-blue/15 bg-white px-3 py-2 shadow-sm"
                                          >
                                            <div className="flex items-start gap-2">
                                              <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-blue text-xs font-semibold text-white">
                                                {instructionIndex + 1}
                                              </span>
                                              <div className="space-y-1">
                                                <p className="text-sm font-semibold text-gray-800">{summary}</p>
                                                {details && <p className="text-xs text-gray-600 leading-relaxed">{details}</p>}
                                              </div>
                                            </div>
                                          </li>
                                        );
                                      })}
                                    </ol>
                                  </div>
                                </div>
                              )}
                            </section>
                          )}

                          {resolvedInstructions.length > 0 && (
                            <div className="rounded-2xl border border-brand-orange/30 bg-gradient-to-br from-brand-orange/5 via-white to-brand-orange/10 p-5 shadow-sm">
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                  <p className="text-sm font-semibold text-brand-orange">{t('recipeModalStepByStepTitle')}</p>
                                  <p className="text-xs text-brand-orange/70">{t('recipeModalStepByStepSubtitle')}</p>
                                </div>
                              </div>
                              <div className="mt-4 grid gap-3 md:grid-cols-2">
                                {resolvedInstructions.map((instruction, instructionIndex) => {
                                  const { summary, details } = extractStepSummary(instruction);
                                  return (
                                    <div
                                      key={`${recipe.recipeName}-instruction-${instructionIndex}`}
                                      className="relative overflow-hidden rounded-2xl border border-brand-orange/20 bg-white/80 p-4 shadow-sm"
                                    >
                                      <div className="flex items-start gap-3">
                                        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-orange text-sm font-semibold text-white">
                                          {instructionIndex + 1}
                                        </span>
                                        <div className="space-y-1">
                                          <p className="text-sm font-semibold text-gray-800">{summary}</p>
                                          {details && <p className="text-xs text-gray-600 leading-relaxed">{details}</p>}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                              <p className="mt-4 text-right text-[11px] font-semibold uppercase tracking-wide text-brand-orange/80">
                                {t('recipeModalStepByStepHint')}
                              </p>
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col items-start md:items-end gap-2 w-full md:w-72">
                          <span
                            className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
                              recipe.isFullyMatched
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-amber-50 text-amber-700'
                            }`}
                          >
                            {recipe.isFullyMatched
                              ? t('recipeModalBadgeReady')
                              : t('recipeModalBadgeMissing', { count: recipe.missingIngredients.length })}
                          </span>
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                            {t('recipeModalSearchProvidersLabel')}
                          </p>
                          <div className="flex w-full flex-col gap-2 md:items-end">
                            {providerVideos.length > 0 ? (
                              providerVideos.map(video => {
                                const isSelected = selectedVideoForRecipe?.id === video.id;
                                return (
                                  <button
                                    type="button"
                                    key={`${video.id}-${recipe.recipeName}`}
                                    onClick={() => onVideoSelect(video, recipe)}
                                    className={`flex w-full flex-col items-start gap-1 rounded-xl px-3 py-2 text-left text-xs font-semibold transition md:items-end md:text-right ${
                                      isSelected
                                        ? 'bg-brand-blue text-white shadow'
                                        : 'bg-brand-blue/10 text-brand-blue shadow-sm hover:bg-brand-blue/20'
                                    }`}
                                  >
                                    <span className="flex items-center gap-1 md:justify-end">
                                      {t('recipeModalProviderYoutubeLabel')}
                                      {video.channelTitle && (
                                        <span
                                          className={`text-[10px] font-normal ${
                                            isSelected ? 'text-white/80' : 'text-brand-blue/70'
                                          }`}
                                        >
                                          · {video.channelTitle}
                                        </span>
                                      )}
                                    </span>
                                    <span
                                      className={`text-[11px] font-normal ${
                                        isSelected ? 'text-white/90' : 'text-brand-blue/90'
                                      }`}
                                    >
                                      {video.title}
                                    </span>
                                  </button>
                                );
                              })
                            ) : (
                              <div className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs text-gray-500 shadow-sm md:text-right">
                                {t('recipeModalProviderNoVideos')}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="bg-gray-50 rounded-xl p-4">
                        <h4 className="text-sm font-semibold text-gray-700">{t('recipeModalNeededIngredients')}</h4>
                        {resolvedIngredientsNeeded.length === 0 ? (
                          <p className="text-xs text-gray-500 mt-2 italic">{t('recipeModalNoExtraIngredients')}</p>
                        ) : recipe.isFullyMatched ? (
                          <p className="text-xs font-semibold text-emerald-600 mt-2">{t('recipeModalAllIngredientsOnHand')}</p>
                        ) : (
                          <div className="mt-3 space-y-3">
                            <div>
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">{t('recipeModalMissingIngredientsLabel')}</p>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {recipe.missingIngredients.map(ingredient => (
                                  <span
                                    key={`missing-${recipe.recipeName}-${ingredient}`}
                                    className="inline-flex items-center rounded-full bg-white px-3 py-1 text-xs font-medium text-amber-700 shadow-sm border border-amber-100"
                                  >
                                    {ingredient}
                                  </span>
                                ))}
                              </div>
                            </div>
                            {recipe.matchedIngredients.length > 0 && (
                              <div>
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{t('recipeModalMatchedIngredientsLabel')}</p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {recipe.matchedIngredients.map(ingredient => (
                                    <span
                                      key={`matched-${recipe.recipeName}-${ingredient}`}
                                      className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 border border-emerald-100"
                                    >
                                      {ingredient}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-brand-blue/5 border border-brand-blue/15 px-3 py-2">
                        <p className="text-xs text-brand-blue/70">{t('recipeModalRecipeNutritionHint')}</p>
                        <button
                          type="button"
                          onClick={() => onViewRecipeNutrition(recipe)}
                          className="inline-flex items-center gap-2 rounded-xl bg-brand-blue text-white px-3 py-1.5 text-xs font-semibold shadow-sm hover:bg-blue-600 transition"
                        >
                          <PulseIcon /> {t('recipeModalRecipeNutritionButton')}
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {!isLoading && !error && recipes.length === 0 && (
            <p className="text-gray-500 text-center py-10">{t('recipeModalNoResults')}</p>
          )}
        </div>

        <div className="bg-white px-6 py-4 border-t border-gray-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-brand-blue text-white border border-transparent rounded-xl shadow-sm hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-blue text-sm font-semibold"
          >
            {t('recipeModalClose')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RecipeModal;
