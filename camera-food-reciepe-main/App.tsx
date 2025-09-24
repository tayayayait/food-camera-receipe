import React, { useState } from 'react';
import { useLocalStorage } from './hooks/useLocalStorage';
import type { PantryItem, Recipe, RecipeRecommendation, RecipeWithVideos } from './types';
import { ItemStatus, type RecommendationMode } from './types';
import { v4 as uuidv4 } from 'uuid';
import AddItemModal from './components/AddItemModal';
import PantryList from './components/PantryList';
import Header from './components/Header';
import RecipeModal from './components/RecipeModal';
import CameraCapture from './components/CameraCapture';
import { getRecipeSuggestions } from './services/geminiService';
import { analyzeIngredientsFromImage } from './services/visionService';
import { getRecipeVideos } from './services/videoService';
import { PlusIcon, SparklesIcon, CameraIcon } from './components/icons';
import { useLanguage } from './context/LanguageContext';

const App: React.FC = () => {
  const { language, t } = useLanguage();
  const [items, setItems] = useLocalStorage<PantryItem[]>('pantryItems', []);
  const [isAddItemModalOpen, setAddItemModalOpen] = useState(false);
  const [isRecipeModalOpen, setRecipeModalOpen] = useState(false);
  const [itemToEdit, setItemToEdit] = useState<PantryItem | null>(null);
  const [recipes, setRecipes] = useState<RecipeRecommendation[]>([]);
  const [isLoadingRecipes, setIsLoadingRecipes] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCameraOpen, setCameraOpen] = useState(false);
  const [isAnalyzingPhoto, setIsAnalyzingPhoto] = useState(false);
  const [selectedIngredients, setSelectedIngredients] = useState<string[]>([]);
  const [recommendationMode, setRecommendationMode] = useState<RecommendationMode>('fridgeFirst');

  const normalizeIngredientName = (ingredient: string) => ingredient.trim().toLowerCase();

  const handleAddItem = (item: Omit<PantryItem, 'id' | 'acquiredAt' | 'status'>) => {
    const newItem: PantryItem = {
      ...item,
      id: uuidv4(),
      acquiredAt: new Date().toISOString(),
      status: ItemStatus.Active,
    };
    setItems([...items, newItem]);
  };

  const handleEditItem = (updatedItem: PantryItem) => {
    setItems(items.map(item => (item.id === updatedItem.id ? updatedItem : item)));
  };

  const handleOpenAddItemModal = (item: PantryItem | null = null) => {
    setItemToEdit(item);
    setAddItemModalOpen(true);
  };

  const handleUpdateItemStatus = (id: string, status: ItemStatus) => {
    setItems(items.map(item => (item.id === id ? { ...item, status } : item)));
  };

  const handleDeleteItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  const openRecipeModalFor = (ingredients: string[]) => {
    setSelectedIngredients(ingredients);
    setRecipeModalOpen(true);
  };

  const enrichRecipesWithVideos = async (
    suggestions: Recipe[],
    ingredients: string[]
  ): Promise<RecipeWithVideos[]> => {
    const enriched = await Promise.all(
      suggestions.map(async suggestion => {
        try {
          const videos = await getRecipeVideos(suggestion.recipeName, ingredients);
          return { ...suggestion, videos };
        } catch (videoError) {
          console.error('Unable to fetch recipe videos', videoError);
          return { ...suggestion, videos: [] };
        }
      })
    );

    return enriched;
  };

  const fetchRecipesForIngredients = async (ingredients: string[], availableIngredientNames: string[]) => {
    setError(null);
    setIsLoadingRecipes(true);

    try {
      const suggestions = await getRecipeSuggestions(ingredients, language);
      if (!suggestions.length) {
        setRecipes([]);
        setError(t('errorNoRecipes'));
        setRecommendationMode('fridgeFirst');
        return;
      }
      const enriched = await enrichRecipesWithVideos(suggestions, ingredients);
      const availableSet = new Set(availableIngredientNames.map(normalizeIngredientName));
      const recommendations: RecipeRecommendation[] = enriched
        .map(recipe => {
          const missingIngredients = recipe.ingredientsNeeded.filter(
            ingredient => !availableSet.has(normalizeIngredientName(ingredient))
          );
          const matchedIngredients = recipe.ingredientsNeeded.filter(ingredient =>
            availableSet.has(normalizeIngredientName(ingredient))
          );

          return {
            ...recipe,
            missingIngredients,
            matchedIngredients,
            isFullyMatched: missingIngredients.length === 0,
          };
        })
        .sort((a, b) => Number(a.isFullyMatched) === Number(b.isFullyMatched)
          ? a.missingIngredients.length - b.missingIngredients.length
          : Number(b.isFullyMatched) - Number(a.isFullyMatched));

      setRecipes(recommendations);
      setRecommendationMode('fridgeFirst');
    } catch (err) {
      const messageKey = err instanceof Error ? err.message : 'errorUnknown';
      setRecipes([]);
      setError(t(messageKey as any));
      setRecommendationMode('fridgeFirst');
    } finally {
      setIsLoadingRecipes(false);
    }
  };

  const handleGetRecipes = async () => {
    const activeItems = items.filter(item => item.status === ItemStatus.Active);
    const allActiveNames = activeItems.map(item => item.name);
    const topIngredients = activeItems
      .sort((a, b) => a.name.localeCompare(b.name, language))
      .slice(0, 8)
      .map(item => item.name);

    if (topIngredients.length === 0) {
      setSelectedIngredients([]);
      setRecipes([]);
      setError(t('errorAddItemsPrompt'));
      setRecipeModalOpen(true);
      return;
    }

    openRecipeModalFor(topIngredients);
    await fetchRecipesForIngredients(topIngredients, allActiveNames);
  };

  const handleCameraCapture = async (photo: Blob) => {
    setIsAnalyzingPhoto(true);

    try {
      setError(null);
      const detectedIngredients = await analyzeIngredientsFromImage(photo);
      if (!detectedIngredients || detectedIngredients.length === 0) {
        throw new Error('errorNoIngredientsFound');
      }
      openRecipeModalFor(detectedIngredients);
      const activeIngredientNames = items
        .filter(item => item.status === ItemStatus.Active)
        .map(item => item.name);
      const availableIngredientNames = Array.from(
        new Set([...activeIngredientNames, ...detectedIngredients])
      );
      await fetchRecipesForIngredients(detectedIngredients, availableIngredientNames);
    } catch (err) {
      const messageKey = err instanceof Error ? err.message : 'errorPhotoAnalysis';
      setSelectedIngredients([]);
      setRecipes([]);
      setError(t(messageKey as any));
      setRecipeModalOpen(true);
      setRecommendationMode('fridgeFirst');
    } finally {
      setIsAnalyzingPhoto(false);
      setCameraOpen(false);
    }
  };

  const activeItems = items.filter(item => item.status === ItemStatus.Active);

  const handleCloseRecipeModal = () => {
    setRecipeModalOpen(false);
    setRecommendationMode('fridgeFirst');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 via-white to-gray-100 font-sans text-gray-900">
      <Header />
      <main className="container mx-auto p-4 md:p-6 max-w-5xl space-y-6">
        <section className="bg-brand-blue text-white rounded-3xl shadow-2xl overflow-hidden">
          <div className="p-8 md:p-10 grid gap-6 md:grid-cols-[2fr,1fr] items-center">
            <div className="space-y-4">
              <p className="text-sm uppercase tracking-widest text-white/80">{t('heroSectionTagline')}</p>
              <h2 className="text-3xl md:text-4xl font-bold leading-tight">
                {t('heroSectionTitle')}
              </h2>
              <p className="text-base text-white/80 max-w-xl">
                {t('heroSectionDescription')}
              </p>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => setCameraOpen(true)}
                  className="inline-flex items-center gap-2 bg-white text-brand-blue font-semibold px-4 py-2 rounded-full shadow-lg hover:shadow-xl transition-all"
                >
                  <CameraIcon /> {t('heroSectionScanButton')}
                </button>
                <button
                  onClick={handleGetRecipes}
                  className="inline-flex items-center gap-2 bg-brand-orange text-white font-semibold px-4 py-2 rounded-full shadow-lg hover:shadow-xl transition-all"
                >
                  <SparklesIcon /> {t('heroSectionSuggestButton')}
                </button>
              </div>
            </div>
            <div className="bg-white/15 backdrop-blur-lg rounded-2xl p-6 space-y-4 text-sm">
              <h3 className="text-lg font-semibold text-white">{t('heroSectionHowItWorksTitle')}</h3>
              <ol className="space-y-3 text-white/80 list-decimal list-inside">
                <li>{t('heroSectionHowItWorksStep1')}</li>
                <li>{t('heroSectionHowItWorksStep2')}</li>
                <li>{t('heroSectionHowItWorksStep3')}</li>
              </ol>
            </div>
          </div>
        </section>

        <section className="bg-white rounded-3xl shadow-xl p-6 md:p-8 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold text-gray-800">{t('pantrySectionTitle')}</h2>
              <p className="text-sm text-gray-500">{t('pantrySectionDescription')}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => setCameraOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition"
              >
                <CameraIcon /> {t('pantrySectionScanButton')}
              </button>
              <button
                onClick={() => handleOpenAddItemModal()}
                className="inline-flex items-center gap-2 px-4 py-2 bg-brand-blue text-white rounded-xl shadow-md hover:bg-blue-600 transition"
              >
                <PlusIcon /> {t('pantrySectionAddButton')}
              </button>
            </div>
          </div>

          <PantryList
            items={activeItems}
            onEdit={handleOpenAddItemModal}
            onUpdateStatus={handleUpdateItemStatus}
            onDelete={handleDeleteItem}
          />
        </section>
      </main>

      <button
        onClick={() => handleOpenAddItemModal()}
        className="fixed bottom-6 right-6 bg-brand-orange hover:bg-orange-500 text-white rounded-full p-4 shadow-xl transition-transform transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-400"
        aria-label={t('fabAriaLabel')}
      >
        <PlusIcon />
      </button>

      {isAddItemModalOpen && (
        <AddItemModal
          isOpen={isAddItemModalOpen}
          onClose={() => setAddItemModalOpen(false)}
          onSave={itemToEdit ? handleEditItem : handleAddItem}
          itemToEdit={itemToEdit}
        />
      )}

      {isRecipeModalOpen && (
        <RecipeModal
          isOpen={isRecipeModalOpen}
          onClose={handleCloseRecipeModal}
          recipes={recipes}
          isLoading={isLoadingRecipes}
          error={error}
          ingredients={selectedIngredients}
          recommendationMode={recommendationMode}
          onChangeRecommendationMode={setRecommendationMode}
        />
      )}

      {isCameraOpen && (
        <CameraCapture
          isOpen={isCameraOpen}
          onClose={() => setCameraOpen(false)}
          onCapture={handleCameraCapture}
          isProcessing={isAnalyzingPhoto || isLoadingRecipes}
        />
      )}
    </div>
  );
};

export default App;