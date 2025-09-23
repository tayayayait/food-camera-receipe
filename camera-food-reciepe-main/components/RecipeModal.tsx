import React from 'react';
import type { RecipeWithVideos } from '../types';
import { UtensilsIcon } from './icons';
import { useLanguage } from '../context/LanguageContext';

interface RecipeModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipes: RecipeWithVideos[];
  isLoading: boolean;
  error: string | null;
  ingredients: string[];
}

const LoadingSkeleton: React.FC = () => (
  <div className="animate-pulse space-y-4 bg-white border border-gray-100 rounded-2xl p-4">
    <div className="h-6 bg-gray-200 rounded w-3/4"></div>
    <div className="h-4 bg-gray-200 rounded w-full"></div>
    <div className="h-4 bg-gray-200 rounded w-5/6"></div>
    <div className="h-40 bg-gray-100 rounded-xl"></div>
  </div>
);

const RecipeModal: React.FC<RecipeModalProps> = ({ isOpen, onClose, recipes, isLoading, error, ingredients }) => {
  const { t } = useLanguage();
  if (!isOpen) return null;

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
              {recipes.map((recipe, index) => (
                <article key={index} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                    <div className="space-y-2">
                      <h3 className="text-xl font-semibold text-gray-800">{recipe.recipeName}</h3>
                      <p className="text-sm text-gray-600 leading-relaxed">{recipe.description}</p>
                    </div>
                    <a
                      href={`https://www.allrecipes.com/search?q=${encodeURIComponent(recipe.recipeName)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-semibold text-brand-blue hover:text-blue-600 flex-shrink-0"
                    >
                      {t('recipeModalViewRecipe')}
                    </a>
                  </div>

                  <div className="bg-gray-50 rounded-xl p-4">
                    <h4 className="text-sm font-semibold text-gray-700">{t('recipeModalNeededIngredients')}</h4>
                    <p className="text-xs text-gray-500 mt-1 italic">
                      {recipe.ingredientsNeeded.join(', ')}
                    </p>
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
