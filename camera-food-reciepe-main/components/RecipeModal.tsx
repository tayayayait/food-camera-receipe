import React from 'react';
import type { RecipeRecommendation, RecommendationMode } from '../types';
import { UtensilsIcon } from './icons';
import { useLanguage } from '../context/LanguageContext';

interface RecipeModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipes: RecipeRecommendation[];
  isLoading: boolean;
  error: string | null;
  ingredients: string[];
  recommendationMode: RecommendationMode;
  onChangeRecommendationMode: (mode: RecommendationMode) => void;
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
  recommendationMode,
  onChangeRecommendationMode,
}) => {
  const { t } = useLanguage();
  if (!isOpen) return null;

  const filteredRecipes =
    recommendationMode === 'fridgeFirst'
      ? recipes.filter(recipe => recipe.isFullyMatched)
      : recipes;

  const noMatchesWithFilter =
    !isLoading && !error && filteredRecipes.length === 0 && recipes.length > 0 && recommendationMode === 'fridgeFirst';

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
          <div className="bg-white border border-gray-200 rounded-2xl p-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-gray-700">{t('recipeModalModeTitle')}</p>
              <p className="text-xs text-gray-500">{t('recipeModalModeDescription')}</p>
            </div>
            <div className="inline-flex items-stretch rounded-xl bg-gray-100 p-1">
              <button
                type="button"
                onClick={() => onChangeRecommendationMode('fridgeFirst')}
                className={`px-3 py-2 text-xs font-semibold rounded-lg transition-colors ${
                  recommendationMode === 'fridgeFirst'
                    ? 'bg-white text-brand-blue shadow'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <span className="block text-left">
                  {t('recipeModalModeFridgeFirst')}
                  <span className="block text-[11px] font-normal text-gray-500">
                    {t('recipeModalModeFridgeFirstHint')}
                  </span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => onChangeRecommendationMode('openKitchen')}
                className={`px-3 py-2 text-xs font-semibold rounded-lg transition-colors ${
                  recommendationMode === 'openKitchen'
                    ? 'bg-white text-brand-orange shadow'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <span className="block text-left">
                  {t('recipeModalModeOpenKitchen')}
                  <span className="block text-[11px] font-normal text-gray-500">
                    {t('recipeModalModeOpenKitchenHint')}
                  </span>
                </span>
              </button>
            </div>
          </div>

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

          {!isLoading && !error && filteredRecipes.length > 0 && (
            <div className="space-y-6">
              {filteredRecipes.map((recipe, index) => (
                <article key={index} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    <div className="space-y-2 flex-1">
                      <h3 className="text-xl font-semibold text-gray-800">{recipe.recipeName}</h3>
                      <p className="text-sm text-gray-600 leading-relaxed">{recipe.description}</p>
                    </div>
                    <div className="flex flex-col items-start md:items-end gap-2">
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
                      <a
                        href={`https://www.allrecipes.com/search?q=${encodeURIComponent(recipe.recipeName)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-semibold text-brand-blue hover:text-blue-600"
                      >
                        {t('recipeModalViewRecipe')}
                      </a>
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

                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-gray-700">{t('recipeModalWatchVideos')}</h4>
                    {recipe.videos.length > 0 ? (
                      <div className="grid gap-4 md:grid-cols-2">
                        {recipe.videos.map(video => (
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
                      <p className="text-sm text-gray-400">{t('recipeModalNoVideos')}</p>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}

          {!isLoading && !error && noMatchesWithFilter && (
            <p className="text-gray-500 text-center py-10">{t('recipeModalNoFridgeMatches')}</p>
          )}

          {!isLoading && !error && filteredRecipes.length === 0 && !noMatchesWithFilter && (
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
