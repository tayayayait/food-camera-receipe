import React, { useEffect, useMemo, useState } from 'react';
import type {
  RecipeRecommendation,
  NutritionSummary,
  NutritionContext,
  RecipeVideo,
} from '../types';
import { UtensilsIcon, PulseIcon } from './icons';
import { useLanguage } from '../context/LanguageContext';
import { formatMacro } from '../services/nutritionService';
import { parseIngredientInput } from '../services/ingredientParser';
import { generateInstructionsFromVideo } from '../services/geminiService';

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

type VideoInstructionsState = {
  status: 'idle' | 'loading' | 'success' | 'error';
  videoId: string | null;
  steps: string[];
  errorMessage?: string;
};

interface RecipeModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipes: RecipeRecommendation[];
  isLoading: boolean;
  error: string | null;
  ingredients: string[];
  onSaveRecipeToJournal: (
    recipe: RecipeRecommendation,
    selectedVideoId: string | null
  ) => { id: string; isNew: boolean };
  savedRecipeNames: string[];
  nutritionSummary?: NutritionSummary | null;
  nutritionContext?: NutritionContext | null;
  onViewRecipeNutrition: (recipe: RecipeRecommendation) => void;
  onApplyDetectedIngredients: (ingredients: string[]) => Promise<string[]>;
  videoAvailabilityNotice?: string | null;
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
  videoAvailabilityNotice,
}) => {
  const { t } = useLanguage();
  if (!isOpen) return null;

  const [justSavedState, setJustSavedState] = useState<{ name: string; isNew: boolean } | null>(null);
  const [isEditingIngredients, setIsEditingIngredients] = useState(false);
  const [ingredientsEditorValue, setIngredientsEditorValue] = useState(() => ingredients.join('\n'));
  const [ingredientsEditorError, setIngredientsEditorError] = useState<string | null>(null);
  const [isApplyingIngredientEdits, setIsApplyingIngredientEdits] = useState(false);
  const [ingredientUpdateFeedback, setIngredientUpdateFeedback] = useState<string | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<RecipeVideo | null>(null);
  const [videoInstructionStates, setVideoInstructionStates] = useState<Record<string, VideoInstructionsState>>({});

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

  const handleSaveToJournal = (recipe: RecipeRecommendation) => {
    const instructionsState = videoInstructionStates[recipe.recipeName];
    const enrichedInstructions =
      instructionsState?.status === 'success' ? instructionsState.steps : recipe.instructions;
    const recipeForSaving =
      instructionsState?.status === 'success'
        ? { ...recipe, instructions: enrichedInstructions }
        : recipe;
    const selectedVideoIdForRecipe = selectedVideo &&
      recipe.videos.some(video => video.id === selectedVideo.id)
        ? selectedVideo.id
        : null;
    const result = onSaveRecipeToJournal(recipeForSaving, selectedVideoIdForRecipe);
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
    const parsed = parseIngredientInput(ingredientsEditorValue);

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

  const handleSelectVideo = (recipe: RecipeRecommendation, video: RecipeVideo) => {
    setSelectedVideo(video);
    if (typeof window !== 'undefined') {
      window.open(video.videoUrl, '_blank', 'noopener,noreferrer');
    }

    const recipeKey = recipe.recipeName;
    const existingState = videoInstructionStates[recipeKey];

    if (existingState?.status === 'success' && existingState.videoId === video.id) {
      return;
    }

    setVideoInstructionStates(prev => ({
      ...prev,
      [recipeKey]: {
        status: 'loading',
        videoId: video.id,
        steps:
          existingState?.status === 'success' && existingState.videoId === video.id
            ? existingState.steps
            : recipe.instructions,
      },
    }));

    (async () => {
      try {
        const steps = await generateInstructionsFromVideo(video, ingredients, recipe);
        setVideoInstructionStates(prev => {
          const current = prev[recipeKey];
          if (!current || current.videoId !== video.id) {
            return prev;
          }
          return {
            ...prev,
            [recipeKey]: {
              status: 'success',
              videoId: video.id,
              steps,
            },
          };
        });
      } catch (error) {
        console.error('Failed to generate instructions for selected video', error);
        const fallbackMessage = t('error_gemini_fetch' as any);
        const translatedMessage =
          error instanceof Error && error.message ? t(error.message as any) : '';
        const errorMessage = translatedMessage || fallbackMessage;
        setVideoInstructionStates(prev => {
          const current = prev[recipeKey];
          if (!current || current.videoId !== video.id) {
            return prev;
          }
          return {
            ...prev,
            [recipeKey]: {
              status: 'error',
              videoId: video.id,
              steps: recipe.instructions,
              errorMessage,
            },
          };
        });
      }
    })();
  };

  useEffect(() => {
    if (!selectedVideo) {
      return;
    }

    const stillAvailable = recipes.some(recipe =>
      recipe.videos.some(video => video.id === selectedVideo.id)
    );

    if (!stillAvailable) {
      setSelectedVideo(null);
    }
  }, [recipes, selectedVideo]);

  useEffect(() => {
    setVideoInstructionStates(current => {
      const allowedNames = new Set(recipes.map(recipe => recipe.recipeName));
      const entries = Object.entries(current).filter(([name]) => allowedNames.has(name));
      if (entries.length === Object.keys(current).length) {
        return current;
      }
      return entries.reduce<Record<string, VideoInstructionsState>>((acc, [name, state]) => {
        acc[name] = state;
        return acc;
      }, {});
    });
  }, [recipes]);

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
                const isSaved = savedRecipeNamesSet.has(normalizedName);
                const isJustSaved = justSavedState?.name === recipe.recipeName;
                const providerVideos = recipe.videos;
                const instructionsState = videoInstructionStates[recipe.recipeName];
                const instructionsToDisplay =
                  instructionsState?.status === 'success'
                    ? instructionsState.steps
                    : recipe.instructions;
                const showLoadingInstructions = instructionsState?.status === 'loading';
                const showErrorInstructions = instructionsState?.status === 'error';
                const shouldRenderInstructions =
                  instructionsToDisplay.length > 0 || showLoadingInstructions || showErrorInstructions;
                const recipeSelectedVideo =
                  selectedVideo && recipe.videos.some(video => video.id === selectedVideo.id)
                    ? selectedVideo
                    : null;
                const videoSectionHeading = recipeSelectedVideo
                  ? t('recipeModalWatchVideosHeadingSelected', {
                      title: recipeSelectedVideo.title,
                    })
                  : t('recipeModalWatchVideosHeadingDefault');
                const videoSectionSubtitle = recipeSelectedVideo
                  ? t('recipeModalWatchVideosSubtitleSelected', {
                      title: recipeSelectedVideo.title,
                      channel: recipeSelectedVideo.channelTitle,
                    })
                  : t('recipeModalWatchVideosSubtitleDefault');

                return (
                  <article key={index} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
                    <div className="space-y-4">
                      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                        <div className="space-y-3 flex-1">
                          <h3 className="text-xl font-semibold text-gray-800">{recipe.recipeName}</h3>
                          <p className="text-sm text-gray-600 leading-relaxed">{recipe.description}</p>

                          <div className="mt-2 rounded-2xl border border-brand-blue/15 bg-brand-blue/5 p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
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

                          {shouldRenderInstructions && (
                            <div className="rounded-2xl border border-brand-orange/30 bg-gradient-to-br from-brand-orange/5 via-white to-brand-orange/10 p-5 shadow-sm">
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                  <p className="text-sm font-semibold text-brand-orange">{t('recipeModalStepByStepTitle')}</p>
                                  <p className="text-xs text-brand-orange/70">{t('recipeModalStepByStepSubtitle')}</p>
                                </div>
                              </div>
                              {showLoadingInstructions ? (
                                <div className="mt-4 rounded-2xl border border-dashed border-brand-orange/40 bg-white/60 p-4 text-center text-xs font-semibold text-brand-orange">
                                  {t('recipeModalVideoInstructionsLoading')}
                                </div>
                              ) : (
                                <div className="mt-4 grid gap-3 md:grid-cols-2">
                                  {instructionsToDisplay.map((instruction, instructionIndex) => {
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
                              )}
                              {showErrorInstructions && (
                                <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-3 text-xs text-red-600">
                                  <p className="font-semibold">{t('recipeModalVideoInstructionsError')}</p>
                                  {instructionsState?.errorMessage && (
                                    <p className="mt-1 leading-relaxed">{instructionsState.errorMessage}</p>
                                  )}
                                </div>
                              )}
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
                              providerVideos.map(video => (
                                <a
                                  key={`${video.id}-${recipe.recipeName}`}
                                  href={video.videoUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex w-full flex-col items-start gap-1 rounded-xl bg-brand-blue/10 px-3 py-2 text-left text-xs font-semibold text-brand-blue shadow-sm transition hover:bg-brand-blue/20 md:items-end md:text-right"
                                >
                                  <span className="flex items-center gap-1 md:justify-end">
                                    {t('recipeModalProviderYoutubeLabel')}
                                    {video.channelTitle && (
                                      <span className="text-[10px] font-normal text-brand-blue/60">· {video.channelTitle}</span>
                                    )}
                                  </span>
                                  <span className="text-[11px] font-normal text-brand-blue/70">{video.title}</span>
                                </a>
                              ))
                            ) : (
                              <div className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs text-gray-500 shadow-sm md:text-right">
                                {videoAvailabilityNotice ?? t('recipeModalProviderNoVideos')}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="bg-gray-50 rounded-xl p-4">
                        <h4 className="text-sm font-semibold text-gray-700">{t('recipeModalNeededIngredients')}</h4>
                        {recipe.ingredientsNeeded.length === 0 ? (
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

                      <div className="space-y-3">
                        <div className="space-y-1">
                          <h4 className="text-sm font-semibold text-gray-700">{videoSectionHeading}</h4>
                          <p className="text-xs text-gray-500">{videoSectionSubtitle}</p>
                        </div>
                        {recipe.videos.length > 0 ? (
                          <div className="grid gap-4 md:grid-cols-2">
                            {recipe.videos.map(video => (
                              <button
                                key={video.id}
                                type="button"
                                onClick={() => {
                                  handleSelectVideo(recipe, video);
                                }}
                                className={`group block w-full text-left rounded-xl overflow-hidden bg-gray-100 shadow-sm transition-shadow focus:outline-none focus:ring-2 focus:ring-brand-blue/40 border ${
                                  recipeSelectedVideo?.id === video.id
                                    ? 'border-brand-blue/40 ring-2 ring-brand-blue shadow-lg'
                                    : 'border-transparent hover:shadow-lg'
                                }`}
                              >
                                <div className="relative aspect-video overflow-hidden">
                                  <img
                                    src={video.thumbnailUrl}
                                    alt={video.title}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                  />
                                  <span className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded-full">YouTube</span>
                                </div>
                                <div className="p-4 space-y-1 bg-gray-100">
                                  <p className="text-sm font-semibold text-gray-800">{video.title}</p>
                                  <p className="text-xs text-gray-500">{video.channelTitle}</p>
                                </div>
                              </button>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-400">
                            {videoAvailabilityNotice ?? t('recipeModalNoVideos')}
                          </p>
                        )}
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
