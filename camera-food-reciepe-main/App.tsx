import React, { useEffect, useRef, useState } from 'react';
import { useLocalStorage } from './hooks/useLocalStorage';
import type {
  PantryItem,
  Recipe,
  RecipeRecommendation,
  RecipeWithVideos,
  RecipeMemory,
  NutritionSummary,
} from './types';
import { ItemStatus, type RecommendationMode } from './types';
import { v4 as uuidv4 } from 'uuid';
import AddItemModal from './components/AddItemModal';
import PantryList from './components/PantryList';
import Header from './components/Header';
import RecipeModal from './components/RecipeModal';
import CameraCapture from './components/CameraCapture';
import RecipeJournal from './components/RecipeJournal';
import NutritionSummaryCard from './components/NutritionSummaryCard';
import BottomToolbar from './components/BottomToolbar';
import { getRecipeSuggestions } from './services/geminiService';
import { analyzeIngredientsFromImage } from './services/visionService';
import { getRecipeVideos } from './services/videoService';
import { PlusIcon, SparklesIcon, CameraIcon } from './components/icons';
import { useLanguage } from './context/LanguageContext';
import { estimateNutritionSummary } from './services/nutritionService';

const App: React.FC = () => {
  const { language, t } = useLanguage();
  const [items, setItems] = useLocalStorage<PantryItem[]>('pantryItems', []);
  const [recipeMemories, setRecipeMemories] = useLocalStorage<RecipeMemory[]>('recipeMemories', []);
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
  const [highlightedMemoryId, setHighlightedMemoryId] = useState<string | null>(null);
  const [nutritionSummary, setNutritionSummary] = useState<NutritionSummary | null>(null);
  const [nutritionIngredients, setNutritionIngredients] = useState<string[]>([]);

  const pantrySectionRef = useRef<HTMLDivElement | null>(null);
  const journalSectionRef = useRef<HTMLDivElement | null>(null);

  const normalizeIngredientName = (ingredient: string) => ingredient.trim().toLowerCase();

  const sanitizeIngredients = (rawIngredients: string[]) => {
    const seen = new Set<string>();
    const sanitized: string[] = [];

    rawIngredients.forEach(ingredient => {
      const trimmed = ingredient.trim();
      if (!trimmed) return;
      const key = trimmed.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      sanitized.push(trimmed);
    });

    return sanitized;
  };

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

  const handleScrollToPantry = () => {
    pantrySectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleScrollToJournal = () => {
    journalSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleToolbarAddIngredient = () => {
    handleScrollToPantry();
    handleOpenAddItemModal();
  };

  const openCameraModal = () => {
    setCameraOpen(true);
  };

  const handleUpdateItemStatus = (id: string, status: ItemStatus) => {
    setItems(items.map(item => (item.id === id ? { ...item, status } : item)));
  };

  const handleDeleteItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  const handleSaveRecipeMemory = (recipe: RecipeRecommendation) => {
    const normalizedName = recipe.recipeName.trim().toLowerCase();
    const existing = recipeMemories.find(
      memory => memory.recipeName.trim().toLowerCase() === normalizedName
    );

    if (existing) {
      setHighlightedMemoryId(existing.id);
      return { id: existing.id, isNew: false } as const;
    }

    const newMemory: RecipeMemory = {
      id: uuidv4(),
      recipeName: recipe.recipeName,
      description: recipe.description,
      createdAt: new Date().toISOString(),
      note: '',
      matchedIngredients: recipe.matchedIngredients,
      missingIngredients: recipe.missingIngredients,
      lastCookedAt: null,
      timesCooked: 0,
    };

    setRecipeMemories(current => [newMemory, ...current]);
    setHighlightedMemoryId(newMemory.id);
    return { id: newMemory.id, isNew: true } as const;
  };

  const handleUpdateRecipeMemory = (id: string, updates: Partial<RecipeMemory>) => {
    setRecipeMemories(current =>
      current.map(memory => (memory.id === id ? { ...memory, ...updates } : memory))
    );
  };

  const handleDeleteRecipeMemory = (id: string) => {
    setRecipeMemories(current => current.filter(memory => memory.id !== id));
    setHighlightedMemoryId(current => (current === id ? null : current));
  };

  const handleMarkRecipeCooked = (id: string) => {
    setRecipeMemories(current =>
      current.map(memory =>
        memory.id === id
          ? {
              ...memory,
              timesCooked: memory.timesCooked + 1,
              lastCookedAt: new Date().toISOString(),
            }
          : memory
      )
    );
    setHighlightedMemoryId(id);
  };

  useEffect(() => {
    if (!highlightedMemoryId) {
      return;
    }

    const timeout = window.setTimeout(() => setHighlightedMemoryId(null), 2400);
    return () => window.clearTimeout(timeout);
  }, [highlightedMemoryId]);

  const handleClearNutrition = () => {
    setNutritionSummary(null);
    setNutritionIngredients([]);
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
      const sanitizedDetectedIngredients = sanitizeIngredients(detectedIngredients ?? []);
      if (!sanitizedDetectedIngredients || sanitizedDetectedIngredients.length === 0) {
        throw new Error('errorNoIngredientsFound');
      }
      setNutritionIngredients(sanitizedDetectedIngredients);
      setNutritionSummary(estimateNutritionSummary(sanitizedDetectedIngredients));
      openRecipeModalFor(sanitizedDetectedIngredients);
      const activeIngredientNames = items
        .filter(item => item.status === ItemStatus.Active)
        .map(item => item.name);
      const availableIngredientNames = Array.from(
        new Set([...activeIngredientNames, ...sanitizedDetectedIngredients])
      );
      await fetchRecipesForIngredients(sanitizedDetectedIngredients, availableIngredientNames);
    } catch (err) {
      const messageKey = err instanceof Error ? err.message : 'errorPhotoAnalysis';
      setSelectedIngredients([]);
      setRecipes([]);
      setError(t(messageKey as any));
      setRecipeModalOpen(true);
      setRecommendationMode('fridgeFirst');
      setNutritionSummary(null);
      setNutritionIngredients([]);
    } finally {
      setIsAnalyzingPhoto(false);
      setCameraOpen(false);
    }
  };

  const activeItems = items.filter(item => item.status === ItemStatus.Active);

  const handleUpdateIngredientsFromModal = async (rawIngredients: string[]) => {
    const sanitized = sanitizeIngredients(rawIngredients);

    if (sanitized.length === 0) {
      setSelectedIngredients([]);
      setRecipes([]);
      setError(t('errorAddItemsPrompt'));
      setRecommendationMode('fridgeFirst');
      return;
    }

    setSelectedIngredients(sanitized);
    const activeIngredientNames = items
      .filter(item => item.status === ItemStatus.Active)
      .map(item => item.name);
    const availableIngredientNames = Array.from(new Set([...activeIngredientNames, ...sanitized]));

    await fetchRecipesForIngredients(sanitized, availableIngredientNames);
  };

  const handleCloseRecipeModal = () => {
    setRecipeModalOpen(false);
    setRecommendationMode('fridgeFirst');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 via-white to-gray-100 font-sans text-gray-900">
      <Header />
      <main className="container mx-auto p-4 md:p-6 max-w-5xl space-y-6 pb-28">
        <section className="bg-brand-blue text-white rounded-3xl shadow-2xl overflow-hidden relative">
          <div className="absolute -bottom-24 -right-16 h-48 w-48 rounded-full bg-brand-orange/30 blur-3xl opacity-60 pointer-events-none" />
          <div className="p-8 md:p-10 grid gap-6 md:grid-cols-[2fr,1fr] items-center relative">
            <div className="space-y-5">
              <p className="text-sm uppercase tracking-[0.4em] text-white/70 font-semibold">
                {t('heroSectionTagline')}
              </p>
              <h2 className="text-3xl md:text-4xl font-bold leading-tight max-w-xl">
                {t('heroSectionTitle')}
              </h2>
              <p className="text-base text-white/85 max-w-xl leading-relaxed">
                {t('heroSectionDescription')}
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center rounded-full border border-white/30 bg-white/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-white">
                  {t('heroHighlightNutrition')}
                </span>
                <span className="inline-flex items-center rounded-full border border-white/30 bg-white/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-white">
                  {t('heroHighlightJournal')}
                </span>
                <span className="inline-flex items-center rounded-full border border-white/30 bg-white/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-white">
                  {t('heroHighlightSmart')}
                </span>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={openCameraModal}
                  className="inline-flex items-center gap-2 bg-white text-brand-blue font-semibold px-5 py-2.5 rounded-full shadow-lg hover:shadow-xl transition-all"
                >
                  <CameraIcon /> {t('heroSectionScanButton')}
                </button>
                <button
                  onClick={handleGetRecipes}
                  className="inline-flex items-center gap-2 bg-brand-orange text-white font-semibold px-5 py-2.5 rounded-full shadow-lg hover:shadow-xl transition-all"
                >
                  <SparklesIcon /> {t('heroSectionSuggestButton')}
                </button>
              </div>
            </div>
            <div className="bg-white/15 backdrop-blur-lg rounded-2xl p-6 space-y-4 text-sm border border-white/20 shadow-inner">
              <h3 className="text-lg font-semibold text-white">{t('heroSectionHowItWorksTitle')}</h3>
              <ol className="space-y-3 text-white/80 list-decimal list-inside">
                <li>{t('heroSectionHowItWorksStep1')}</li>
                <li>{t('heroSectionHowItWorksStep2')}</li>
                <li>{t('heroSectionHowItWorksStep3')}</li>
              </ol>
            </div>
          </div>
        </section>

        {nutritionSummary && (
          <NutritionSummaryCard
            summary={nutritionSummary}
            ingredients={nutritionIngredients}
            onClear={handleClearNutrition}
          />
        )}

        <section
          ref={pantrySectionRef}
          className="bg-white rounded-3xl shadow-xl p-6 md:p-8 space-y-6 border border-gray-100"
        >
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold text-gray-800">{t('pantrySectionTitle')}</h2>
              <p className="text-sm text-gray-500">{t('pantrySectionDescription')}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={openCameraModal}
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

        <div ref={journalSectionRef}>
          <RecipeJournal
            entries={recipeMemories}
            onUpdate={handleUpdateRecipeMemory}
            onDelete={handleDeleteRecipeMemory}
            onMarkCooked={handleMarkRecipeCooked}
            highlightedId={highlightedMemoryId}
          />
        </div>
      </main>

      <BottomToolbar
        onOpenCamera={openCameraModal}
        onSuggestRecipes={handleGetRecipes}
        onAddIngredient={handleToolbarAddIngredient}
        onOpenJournal={handleScrollToJournal}
      />

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
          onUpdateIngredients={handleUpdateIngredientsFromModal}
          onSaveRecipeToJournal={handleSaveRecipeMemory}
          savedRecipeNames={recipeMemories.map(memory => memory.recipeName)}
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