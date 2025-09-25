import React, { useEffect, useMemo, useState } from 'react';
import type { RecipeRecommendation, RecommendationMode } from '../types';
import { UtensilsIcon } from './icons';
import { useLanguage } from '../context/LanguageContext';

const parseIngredientsInput = (text: string) =>
  text
    .split(/[\n,]/)
    .map(part => part.trim())
    .filter(Boolean);

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

interface RecipeModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipes: RecipeRecommendation[];
  isLoading: boolean;
  error: string | null;
  ingredients: string[];
  recommendationMode: RecommendationMode;
  onChangeRecommendationMode: (mode: RecommendationMode) => void;
  onUpdateIngredients: (ingredients: string[]) => void | Promise<void>;
  onSaveRecipeToJournal: (recipe: RecipeRecommendation) => { id: string; isNew: boolean };
  savedRecipeNames: string[];
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
  onUpdateIngredients,
  onSaveRecipeToJournal,
  savedRecipeNames,
}) => {
  const { language, t } = useLanguage();
  if (!isOpen) return null;

  const filteredRecipes =
    recommendationMode === 'fridgeFirst'
      ? recipes.filter(recipe => recipe.isFullyMatched)
      : recipes;

  const noMatchesWithFilter =
    !isLoading && !error && filteredRecipes.length === 0 && recipes.length > 0 && recommendationMode === 'fridgeFirst';

  const [ingredientsText, setIngredientsText] = useState(() => ingredients.join(', '));
  const [justSavedState, setJustSavedState] = useState<{ name: string; isNew: boolean } | null>(null);

  useEffect(() => {
    setIngredientsText(ingredients.join(', '));
  }, [ingredients]);

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

  const previewIngredients = useMemo(() => parseIngredientsInput(ingredientsText), [ingredientsText]);
  const savedRecipeNamesSet = useMemo(
    () => new Set(savedRecipeNames.map(name => name.trim().toLowerCase())),
    [savedRecipeNames]
  );

  const recipeSearchProviders = useMemo(
    () =>
      language === 'ko'
        ? [
            {
              name: '만개의 레시피',
              buildUrl: (query: string) =>
                `https://www.10000recipe.com/recipe/list.html?q=${encodeURIComponent(query)}`,
            },
            {
              name: '네이버 레시피',
              buildUrl: (query: string) =>
                `https://search.naver.com/search.naver?query=${encodeURIComponent(`${query} 레시피`)}`,
            },
            {
              name: 'YouTube',
              buildUrl: (query: string) =>
                `https://www.youtube.com/results?search_query=${encodeURIComponent(`${query} 요리`)}`,
            },
          ]
        : [
            {
              name: 'Allrecipes',
              buildUrl: (query: string) =>
                `https://www.allrecipes.com/search?q=${encodeURIComponent(query)}`,
            },
            {
              name: 'Serious Eats',
              buildUrl: (query: string) =>
                `https://www.seriouseats.com/search?q=${encodeURIComponent(query)}`,
            },
            {
              name: 'YouTube',
              buildUrl: (query: string) =>
                `https://www.youtube.com/results?search_query=${encodeURIComponent(`${query} recipe`)}`,
            },
          ],
    [language]
  );

  const handleSubmitIngredients = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await onUpdateIngredients(previewIngredients);
  };

  const handleSaveToJournal = (recipe: RecipeRecommendation) => {
    const result = onSaveRecipeToJournal(recipe);
    setJustSavedState({ name: recipe.recipeName, isNew: result.isNew });
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
          <form onSubmit={handleSubmitIngredients} className="bg-white border border-gray-200 rounded-2xl p-4 space-y-4">
            <div className="space-y-2">
              <label htmlFor="ingredients-editor" className="text-sm font-semibold text-gray-700">
                {t('recipeModalEditIngredientsLabel')}
              </label>
              <textarea
                id="ingredients-editor"
                value={ingredientsText}
                onChange={event => setIngredientsText(event.target.value)}
                rows={3}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
                placeholder={t('recipeModalEditIngredientsPlaceholder')}
              />
              <p className="text-xs text-gray-500">{t('recipeModalEditIngredientsHint')}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {previewIngredients.length > 0 ? (
                previewIngredients.map(ingredient => (
                  <span
                    key={ingredient}
                    className="inline-flex items-center rounded-full bg-brand-blue/10 px-3 py-1 text-xs font-medium text-brand-blue"
                  >
                    {ingredient}
                  </span>
                ))
              ) : (
                <span className="text-xs text-gray-400">{t('recipeModalEditIngredientsEmpty')}</span>
              )}
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-xl bg-brand-orange px-4 py-2 text-sm font-semibold text-white shadow hover:bg-orange-500 transition disabled:opacity-60"
                disabled={isLoading || previewIngredients.length === 0}
              >
                {isLoading ? t('recipeModalEditIngredientsUpdating') : t('recipeModalEditIngredientsButton')}
              </button>
            </div>
          </form>

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
              {filteredRecipes.map((recipe, index) => {
                const normalizedName = recipe.recipeName.trim().toLowerCase();
                const isSaved = savedRecipeNamesSet.has(normalizedName);
                const isJustSaved = justSavedState?.name === recipe.recipeName;

                return (
                  <article key={index} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
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

                        {recipe.instructions.length > 0 && (
                          <div className="rounded-2xl border border-brand-orange/30 bg-gradient-to-br from-brand-orange/5 via-white to-brand-orange/10 p-5 shadow-sm">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-brand-orange">{t('recipeModalStepByStepTitle')}</p>
                                <p className="text-xs text-brand-orange/70">{t('recipeModalStepByStepSubtitle')}</p>
                              </div>
                            </div>
                            <div className="mt-4 grid gap-3 md:grid-cols-2">
                              {recipe.instructions.map((instruction, instructionIndex) => {
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
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                          {t('recipeModalSearchProvidersLabel')}
                        </p>
                        <div className="flex flex-wrap gap-2 md:justify-end">
                          {recipeSearchProviders.map(provider => (
                            <a
                              key={`${provider.name}-${recipe.recipeName}`}
                              href={provider.buildUrl(recipe.recipeName)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center rounded-full bg-brand-blue/10 px-3 py-1 text-xs font-semibold text-brand-blue hover:bg-brand-blue/20 transition"
                            >
                              {provider.name}
                            </a>
                          ))}
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
                );
              })}
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
