import React from 'react';
import type { NutritionContext, NutritionSummary, RecipeRecommendation, RecipeVideo } from '../types';
import type { TranscriptPromptStatus } from '../services/geminiService';
import { UtensilsIcon } from './icons';
import { useLanguage } from '../context/LanguageContext';

export type VideoRecipeState = {
  recipe: RecipeRecommendation | null;
  selectedVideo: RecipeVideo | null;
  targetRecipeName: string | null;
  isLoading: boolean;
  error: string | null;
  transcript: { status: TranscriptPromptStatus['status'] | 'idle' | 'loading'; messageKey: string | null };
};

export interface RecipeModalProps {
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
  onVideoSelect: (recipe: RecipeRecommendation, video: RecipeVideo) => void;
  videoRecipeState: VideoRecipeState;
  activeVideoGuideRecipeName?: string | null;
  shouldHideRecipeDetails?: boolean;
}

const RecipeModal: React.FC<RecipeModalProps> = props => {
  const {
    isOpen,
    onClose,
    recipes,
    isLoading,
    error,
    videoAvailabilityNotice,
    onVideoSelect,
    videoRecipeState,
    activeVideoGuideRecipeName = null,
    shouldHideRecipeDetails = false,
  } = props;
  const { t } = useLanguage();

  if (!isOpen) {
    return null;
  }

  const renderVideoCards = (recipe: RecipeRecommendation) => {
    const enhancedRecipe =
      videoRecipeState.recipe?.recipeName === recipe.recipeName
        ? videoRecipeState.recipe
        : null;
    const videos = enhancedRecipe?.videos?.length ? enhancedRecipe.videos : recipe.videos;

    if (!videos.length) {
      return <p className="text-sm text-gray-500">{t('videoModalEmptyVideos')}</p>;
    }

    return (
      <div className="grid gap-4 md:grid-cols-2">
        {videos.map(video => {
          const isSelected =
            videoRecipeState.selectedVideo?.id === video.id &&
            (videoRecipeState.recipe?.recipeName ?? videoRecipeState.targetRecipeName) === recipe.recipeName;
          const isGuideActive =
            activeVideoGuideRecipeName === recipe.recipeName && videoRecipeState.selectedVideo?.id === video.id;
          const isLoadingSelection =
            videoRecipeState.isLoading &&
            videoRecipeState.targetRecipeName === recipe.recipeName &&
            videoRecipeState.selectedVideo?.id === video.id;

          return (
            <button
              key={`${recipe.recipeName}-${video.id}`}
              type="button"
              onClick={() => onVideoSelect(recipe, video)}
              className={`group flex h-full flex-col overflow-hidden rounded-2xl border bg-white text-left shadow-sm transition focus:outline-none focus:ring-2 focus:ring-brand-blue/40 ${
                isSelected ? 'border-brand-blue/60 ring-2 ring-brand-blue/40' : 'border-gray-200 hover:shadow-md'
              } ${isGuideActive ? 'ring-brand-orange/40 border-brand-orange/50' : ''}`}
              disabled={isLoadingSelection}
            >
              <div className="relative aspect-video w-full overflow-hidden bg-gray-100">
                <img
                  src={video.thumbnailUrl}
                  alt={video.title}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                {isSelected && (
                  <span className="absolute left-3 top-3 inline-flex items-center rounded-full bg-brand-blue px-3 py-1 text-xs font-semibold text-white shadow">
                    {t('videoModalSelectedBadge')}
                  </span>
                )}
                {isLoadingSelection && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                    <span className="h-8 w-8 animate-spin rounded-full border-2 border-white/60 border-t-transparent" />
                  </div>
                )}
              </div>
              <div className="flex flex-1 flex-col gap-2 p-4">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-gray-800">{video.title}</p>
                  <p className="text-xs text-gray-500">{video.channelTitle}</p>
                </div>
                <div className="mt-auto flex items-center justify-between text-xs text-brand-blue">
                  <span>{t('videoModalWatchAction')}</span>
                  {isGuideActive && (
                    <span className="font-semibold text-brand-orange">{t('videoModalGuideOpen')}</span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6" onClick={onClose}>
      <div
        className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
        onClick={event => event.stopPropagation()}
      >
        <div className="border-b border-gray-200 bg-white px-6 py-5">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-brand-orange/10 text-brand-orange">
              <UtensilsIcon />
            </span>
            <div>
              <h2 className="text-2xl font-semibold text-gray-800">{t('videoModalTitle')}</h2>
              <p className="text-sm text-gray-500">{t('videoModalSubtitle')}</p>
            </div>
          </div>
          {videoAvailabilityNotice && (
            <p className="mt-3 rounded-2xl border border-brand-blue/20 bg-brand-blue/5 px-4 py-2 text-xs text-brand-blue/80">
              {videoAvailabilityNotice}
            </p>
          )}
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
          {isLoading && (
            <div className="space-y-4">
              {[0, 1].map(index => (
                <div key={index} className="animate-pulse space-y-3 rounded-2xl border border-gray-100 bg-gray-50 p-5">
                  <div className="h-6 w-3/4 rounded bg-gray-200" />
                  <div className="h-4 w-full rounded bg-gray-200" />
                  <div className="h-40 rounded-2xl bg-gray-100" />
                </div>
              ))}
            </div>
          )}

          {error && !isLoading && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
          )}

          {shouldHideRecipeDetails && !isLoading && !error && (
            <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-600">
              {t('videoModalPlaceholder')}
            </div>
          )}

          {!shouldHideRecipeDetails && !isLoading && !error && recipes.length === 0 && (
            <p className="py-10 text-center text-sm text-gray-500">{t('videoModalEmptyState')}</p>
          )}

          {!shouldHideRecipeDetails && !isLoading && !error && recipes.length > 0 && (
            <div className="space-y-6">
              {recipes.map(recipe => {
                const isTargeted = videoRecipeState.targetRecipeName === recipe.recipeName;
                const hasError = isTargeted && videoRecipeState.error;
                const statusMessage = isTargeted
                  ? videoRecipeState.isLoading
                    ? t('videoModalSyncing')
                    : hasError
                      ? videoRecipeState.error
                      : null
                  : null;

                return (
                  <article
                    key={recipe.recipeName}
                    className="space-y-4 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm"
                  >
                    <div className="space-y-2">
                      <h3 className="text-xl font-semibold text-gray-800">{recipe.recipeName}</h3>
                      {recipe.description && (
                        <p className="text-sm text-gray-600">{recipe.description}</p>
                      )}
                      <p className="text-xs uppercase tracking-[0.25em] text-brand-blue/60">
                        {t('videoModalListHeading')}
                      </p>
                    </div>

                    {statusMessage && (
                      <div
                        className={`rounded-xl border px-4 py-2 text-sm ${
                          hasError
                            ? 'border-red-200 bg-red-50 text-red-600'
                            : 'border-brand-blue/20 bg-brand-blue/5 text-brand-blue'
                        }`}
                      >
                        {statusMessage}
                      </div>
                    )}

                    {renderVideoCards(recipe)}
                  </article>
                );
              })}
            </div>
          )}
        </div>

        <div className="border-t border-gray-200 bg-white px-6 py-4 text-right">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-xl bg-brand-blue px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-600"
          >
            {t('videoModalClose')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RecipeModal;
