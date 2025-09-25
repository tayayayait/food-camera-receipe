import React, { useEffect, useState } from 'react';
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
import { PlusIcon, SparklesIcon, CameraIcon, BookOpenIcon } from './components/icons';
import { useLanguage } from './context/LanguageContext';
import { estimateNutritionSummary } from './services/nutritionService';

type ActiveView = 'intro' | 'pantry' | 'recipes' | 'nutrition' | 'journal';

const IntroScreen: React.FC<{ onStart: () => void; onScan: () => void }> = ({ onStart, onScan }) => {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#EBF5FF] via-[#E2F0FF] to-[#7CB7FF]/40 flex items-center justify-center px-6 py-16">
      <div className="relative max-w-3xl w-full text-center space-y-10">
        <div className="pointer-events-none absolute -top-28 -left-32 h-64 w-64 rounded-full bg-[#E2F0FF]/70 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -right-24 h-48 w-48 rounded-full bg-[#7CB7FF]/30 blur-3xl" />
        <div className="relative inline-block">
          <span
            className="absolute inset-0 translate-x-3 translate-y-3 text-[#E2F0FF] blur-[6px] opacity-70 select-none"
            aria-hidden="true"
          >
            {t('introHeadline')}
          </span>
          <h1 className="relative text-5xl md:text-7xl font-black tracking-[0.35em] text-[#7CB7FF] drop-shadow-[0_24px_48px_rgba(124,183,255,0.55)] uppercase">
            {t('introHeadline')}
          </h1>
        </div>
        <p className="text-xs uppercase tracking-[0.55em] text-[#7CB7FF] font-semibold">{t('introBreath')}</p>
        <p className="text-base md:text-lg text-[#2A3B5F]/80 leading-relaxed max-w-2xl mx-auto">
          {t('introDescription')}
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            type="button"
            onClick={onStart}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-[#7CB7FF] px-6 py-3 text-white font-semibold shadow-[0_18px_30px_rgba(124,183,255,0.45)] hover:shadow-[0_24px_36px_rgba(124,183,255,0.5)] transition"
          >
            <SparklesIcon /> {t('introPrimaryAction')}
          </button>
          <button
            type="button"
            onClick={onScan}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-[#7CB7FF]/40 bg-white/70 px-6 py-3 text-[#1F2E4C] font-semibold shadow-sm hover:bg-[#EBF5FF] transition"
          >
            <CameraIcon /> {t('introSecondaryAction')}
          </button>
        </div>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const { language, t } = useLanguage();
  const [items, setItems] = useLocalStorage<PantryItem[]>('pantryItems', []);
  const [recipeMemories, setRecipeMemories] = useLocalStorage<RecipeMemory[]>('recipeMemories', []);
  const [activeView, setActiveView] = useState<ActiveView>('intro');
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

  const applyNutritionFrom = (
    ingredients: string[],
    options: { alreadySanitized?: boolean; focusView?: boolean } = {}
  ) => {
    const { alreadySanitized = false, focusView = false } = options;
    const list = alreadySanitized ? ingredients : sanitizeIngredients(ingredients);

    if (list.length === 0) {
      setNutritionSummary(null);
      setNutritionIngredients([]);
      if (focusView) {
        setActiveView(current => (current === 'nutrition' ? 'pantry' : current));
      }
      return list;
    }

    setNutritionIngredients(list);
    setNutritionSummary(estimateNutritionSummary(list));
    if (focusView) {
      setActiveView('nutrition');
    }
    return list;
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

  const handleToolbarAddIngredient = () => {
    setActiveView('pantry');
    handleOpenAddItemModal();
  };

  const openCameraModal = () => {
    setActiveView('recipes');
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
    setActiveView('pantry');
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
    setActiveView('recipes');
    const activeItems = items.filter(item => item.status === ItemStatus.Active);
    const allActiveNames = activeItems.map(item => item.name);
    const topIngredients = activeItems
      .sort((a, b) => a.name.localeCompare(b.name, language))
      .slice(0, 8)
      .map(item => item.name);

    const sanitizedTopIngredients = applyNutritionFrom(topIngredients, { focusView: false });

    if (sanitizedTopIngredients.length === 0) {
      setSelectedIngredients([]);
      setRecipes([]);
      setError(t('errorAddItemsPrompt'));
      setRecipeModalOpen(true);
      return;
    }

    openRecipeModalFor(sanitizedTopIngredients);
    const availableIngredientNames = Array.from(
      new Set([...sanitizeIngredients(allActiveNames), ...sanitizedTopIngredients])
    );
    await fetchRecipesForIngredients(sanitizedTopIngredients, availableIngredientNames);
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
      applyNutritionFrom(sanitizedDetectedIngredients, { alreadySanitized: true, focusView: true });
      openRecipeModalFor(sanitizedDetectedIngredients);
      const activeIngredientNames = items
        .filter(item => item.status === ItemStatus.Active)
        .map(item => item.name);
      const availableIngredientNames = Array.from(
        new Set([...sanitizeIngredients(activeIngredientNames), ...sanitizedDetectedIngredients])
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
      setNutritionSummary(null);
      setNutritionIngredients([]);
      return;
    }

    applyNutritionFrom(sanitized, { alreadySanitized: true, focusView: true });
    setSelectedIngredients(sanitized);
    const activeIngredientNames = items
      .filter(item => item.status === ItemStatus.Active)
      .map(item => item.name);
    const availableIngredientNames = Array.from(
      new Set([...sanitizeIngredients(activeIngredientNames), ...sanitized])
    );

    await fetchRecipesForIngredients(sanitized, availableIngredientNames);
  };

  const handleCloseRecipeModal = () => {
    setRecipeModalOpen(false);
    setRecommendationMode('fridgeFirst');
  };

  if (activeView === 'intro') {
    return <IntroScreen onStart={() => setActiveView('pantry')} onScan={openCameraModal} />;
  }

  const handleNavigate = (view: Exclude<ActiveView, 'intro'>) => {
    setActiveView(view);
  };

  const handleOpenJournalView = () => {
    setActiveView('journal');
  };

  const previewRecipes = recipes.slice(0, 3);

  const renderActiveView = () => {
    switch (activeView) {
      case 'pantry':
        return (
          <section className="rounded-[36px] border border-[#7CB7FF]/30 bg-white/80 backdrop-blur-xl p-6 md:p-10 shadow-[0_28px_60px_rgba(124,183,255,0.25)] space-y-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.4em] text-[#7CB7FF]">
                  {t('pantryViewTagline')}
                </p>
                <h2 className="text-3xl font-bold text-[#1C2B4B]">{t('pantrySectionTitle')}</h2>
                <p className="text-sm text-[#1C2B4B]/70 max-w-xl">{t('pantrySectionDescription')}</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={openCameraModal}
                  className="inline-flex items-center gap-2 rounded-full border border-[#7CB7FF]/40 bg-white/70 px-5 py-2.5 text-sm font-semibold text-[#1C2B4B] shadow-sm hover:bg-[#EBF5FF]"
                >
                  <CameraIcon /> {t('pantrySectionScanButton')}
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenAddItemModal()}
                  className="inline-flex items-center gap-2 rounded-full bg-[#7CB7FF] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_16px_26px_rgba(124,183,255,0.35)] hover:shadow-[0_20px_32px_rgba(124,183,255,0.45)]"
                >
                  <PlusIcon /> {t('pantrySectionAddButton')}
                </button>
              </div>
            </div>
            <div className="rounded-3xl border border-[#EBF5FF] bg-[#EBF5FF]/60 p-4 md:p-6">
              <PantryList
                items={activeItems}
                onEdit={handleOpenAddItemModal}
                onUpdateStatus={handleUpdateItemStatus}
                onDelete={handleDeleteItem}
              />
            </div>
          </section>
        );
      case 'recipes':
        return (
          <section className="rounded-[36px] border border-[#7CB7FF]/30 bg-gradient-to-br from-[#EBF5FF]/90 via-white to-[#E2F0FF]/80 p-6 md:p-10 shadow-[0_28px_60px_rgba(124,183,255,0.28)] space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.4em] text-[#7CB7FF]">
                  {t('recipesViewTagline')}
                </p>
                <h2 className="text-3xl font-bold text-[#1C2B4B]">{t('recipesViewTitle')}</h2>
                <p className="text-sm text-[#1C2B4B]/70 max-w-xl">{t('recipesViewSubtitle')}</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleGetRecipes}
                  className="inline-flex items-center gap-2 rounded-full bg-[#7CB7FF] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_16px_26px_rgba(124,183,255,0.35)] hover:shadow-[0_20px_32px_rgba(124,183,255,0.45)]"
                >
                  <SparklesIcon /> {t('recipesViewSuggestButton')}
                </button>
                <button
                  type="button"
                  onClick={openCameraModal}
                  className="inline-flex items-center gap-2 rounded-full border border-[#7CB7FF]/40 bg-white/70 px-5 py-2.5 text-sm font-semibold text-[#1C2B4B] shadow-sm hover:bg-[#EBF5FF]"
                >
                  <CameraIcon /> {t('recipesViewScanButton')}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveView('nutrition')}
                  className="inline-flex items-center gap-2 rounded-full border border-[#7CB7FF]/40 bg-white/70 px-5 py-2.5 text-sm font-semibold text-[#1C2B4B] shadow-sm hover:bg-[#EBF5FF]"
                >
                  <SparklesIcon /> {t('recipesViewNutritionButton')}
                </button>
              </div>
            </div>

            {selectedIngredients.length > 0 && (
              <div className="rounded-3xl border border-[#7CB7FF]/30 bg-white/75 p-4 md:p-5 flex flex-wrap gap-2">
                {selectedIngredients.map(ingredient => (
                  <span
                    key={ingredient}
                    className="inline-flex items-center rounded-full bg-[#EBF5FF] px-3 py-1 text-xs font-semibold text-[#1C2B4B]"
                  >
                    {ingredient}
                  </span>
                ))}
              </div>
            )}

            {previewRecipes.length > 0 ? (
              <div className="grid gap-4">
                {previewRecipes.map(recipe => (
                  <div
                    key={recipe.recipeName}
                    className="rounded-3xl border border-[#7CB7FF]/25 bg-white/85 p-5 shadow-sm hover:shadow-md transition"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div className="space-y-1">
                        <h3 className="text-xl font-semibold text-[#1C2B4B]">{recipe.recipeName}</h3>
                        <p className="text-sm text-[#1C2B4B]/70 md:max-w-xl">{recipe.description}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span className="inline-flex items-center rounded-full bg-[#EBF5FF] px-3 py-1 text-xs font-semibold text-[#1C2B4B]">
                          {t('recipeModalMatchedIngredientsLabel')} · {recipe.matchedIngredients.length}
                        </span>
                        <span className="inline-flex items-center rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#1C2B4B]/80 border border-[#7CB7FF]/30">
                          {t('recipeModalMissingIngredientsLabel')} · {recipe.missingIngredients.length}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setRecipeModalOpen(true);
                      }}
                      className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#7CB7FF] px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white"
                    >
                      {t('recipesViewOpenModal')}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-3xl border border-dashed border-[#7CB7FF]/40 bg-white/65 p-8 text-center text-sm text-[#1C2B4B]/70">
                {t('recipesViewEmpty')}
              </div>
            )}

            {recipes.length > previewRecipes.length && (
              <p className="text-xs text-[#1C2B4B]/60">{t('recipesViewMore', { count: recipes.length - previewRecipes.length })}</p>
            )}
          </section>
        );
      case 'nutrition':
        return nutritionSummary ? (
          <NutritionSummaryCard summary={nutritionSummary} ingredients={nutritionIngredients} onClear={handleClearNutrition} />
        ) : (
          <section className="rounded-[36px] border border-dashed border-[#7CB7FF]/40 bg-white/75 p-8 text-center shadow-[0_18px_40px_rgba(124,183,255,0.18)] space-y-4">
            <h2 className="text-2xl font-semibold text-[#1C2B4B]">{t('nutritionEmptyTitle')}</h2>
            <p className="text-sm text-[#1C2B4B]/70 max-w-xl mx-auto">{t('nutritionEmptyDescription')}</p>
            <div className="flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={handleGetRecipes}
                className="inline-flex items-center gap-2 rounded-full bg-[#7CB7FF] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_16px_26px_rgba(124,183,255,0.35)] hover:shadow-[0_20px_32px_rgba(124,183,255,0.45)]"
              >
                <SparklesIcon /> {t('nutritionEmptyRecipes')}
              </button>
              <button
                type="button"
                onClick={openCameraModal}
                className="inline-flex items-center gap-2 rounded-full border border-[#7CB7FF]/40 bg-white/70 px-5 py-2.5 text-sm font-semibold text-[#1C2B4B] shadow-sm hover:bg-[#EBF5FF]"
              >
                <CameraIcon /> {t('nutritionEmptyScan')}
              </button>
            </div>
          </section>
        );
      case 'journal':
        return (
          <section className="rounded-[36px] border border-[#7CB7FF]/30 bg-white/85 backdrop-blur-xl p-6 md:p-10 shadow-[0_28px_60px_rgba(124,183,255,0.25)] space-y-6">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.4em] text-[#7CB7FF]">
                {t('journalViewTagline')}
              </p>
              <h2 className="text-3xl font-bold text-[#1C2B4B]">{t('journalSectionTitle')}</h2>
              <p className="text-sm text-[#1C2B4B]/70">{t('journalSectionDescription')}</p>
              <p className="text-xs text-[#1C2B4B]/60">{t('journalSectionHint')}</p>
            </div>
            <RecipeJournal
              entries={recipeMemories}
              onUpdate={handleUpdateRecipeMemory}
              onDelete={handleDeleteRecipeMemory}
              onMarkCooked={handleMarkRecipeCooked}
              highlightedId={highlightedMemoryId}
            />
          </section>
        );
      default:
        return null;
    }
  };

  const toolbarActions = [
    {
      key: 'scan',
      label: t('toolbarScan'),
      description: t('toolbarScanHint'),
      icon: <CameraIcon />,
      onClick: openCameraModal,
      active: isCameraOpen,
    },
    {
      key: 'ideas',
      label: t('toolbarSuggest'),
      description: t('toolbarSuggestHint'),
      icon: <SparklesIcon />,
      onClick: handleGetRecipes,
      active: activeView === 'recipes' && !isCameraOpen,
    },
    {
      key: 'add',
      label: t('toolbarAdd'),
      description: t('toolbarAddHint'),
      icon: <PlusIcon />,
      onClick: handleToolbarAddIngredient,
      active: activeView === 'pantry',
    },
    {
      key: 'journal',
      label: t('toolbarJournal'),
      description: t('toolbarJournalHint'),
      icon: <BookOpenIcon />,
      onClick: handleOpenJournalView,
      active: activeView === 'journal',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#EBF5FF] via-[#E2F0FF] to-[#7CB7FF]/30 font-sans text-[#1C2B4B]">
      <Header activeView={activeView} onNavigate={handleNavigate} />
      <main className="container mx-auto max-w-5xl px-4 py-6 md:py-10 pb-36 space-y-8">
        {renderActiveView()}
      </main>

      <BottomToolbar actions={toolbarActions} />

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