import React, { useEffect, useMemo, useState } from 'react';
import { useLocalStorage } from './hooks/useLocalStorage';
import type {
  PantryItem,
  Recipe,
  RecipeRecommendation,
  RecipeWithVideos,
  RecipeMemory,
  NutritionSummary,
  NutritionContext,
} from './types';
import { Category, ItemStatus } from './types';
import { v4 as uuidv4 } from 'uuid';
import PantryList from './components/PantryList';
import Header from './components/Header';
import RecipeModal from './components/RecipeModal';
import CameraCapture from './components/CameraCapture';
import RecipeJournal from './components/RecipeJournal';
import NutritionSummaryCard from './components/NutritionSummaryCard';
import BottomToolbar from './components/BottomToolbar';
import RecipeExperienceModal from './components/RecipeExperienceModal';
import { getRecipeSuggestions } from './services/geminiService';
import { generateDesignPreview, generateJournalPreviewImage } from './services/designPreviewService';
import { analyzeIngredientsFromImage } from './services/visionService';
import { getRecipeVideos } from './services/videoService';
import { parseIngredientInput, sanitizeIngredients } from './services/ingredientParser';
import { SparklesIcon, CameraIcon, BookOpenIcon, PulseIcon } from './components/icons';
import { useLanguage } from './context/LanguageContext';
import { estimateNutritionSummary } from './services/nutritionService';

type ActiveView = 'intro' | 'pantry' | 'recipes' | 'nutrition' | 'journal';

type YoutubeConfigError = Error & { recipes?: RecipeWithVideos[] };

interface IntroScreenProps {
  onStart: () => void;
  onScan: () => void;
  moodboardImage?: string | null;
  isMoodboardLoading?: boolean;
  moodboardError?: string | null;
}

const IntroScreen: React.FC<IntroScreenProps> = ({
  onStart,
  onScan,
  moodboardImage,
  isMoodboardLoading = false,
  moodboardError,
}) => {
  const { t } = useLanguage();

  const backgroundStyle = moodboardImage
    ? {
        backgroundImage: `url(${moodboardImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }
    : undefined;

  const wrapperClasses = [
    'relative min-h-screen flex items-center justify-center px-6 py-16 transition-colors duration-500',
    moodboardImage ? 'bg-[#EBF5FF]' : 'bg-gradient-to-br from-[#EBF5FF] via-[#E2F0FF] to-[#7CB7FF]/40',
  ].join(' ');

  const overlayClasses = [
    'pointer-events-none absolute inset-0 transition-opacity duration-500',
    moodboardImage
      ? 'bg-gradient-to-br from-[#EBF5FF]/85 via-[#E2F0FF]/78 to-[#7CB7FF]/50'
      : isMoodboardLoading
      ? 'bg-gradient-to-br from-[#EBF5FF]/90 via-[#E2F0FF]/80 to-[#7CB7FF]/55'
      : 'bg-transparent',
    isMoodboardLoading ? 'backdrop-blur-lg' : moodboardImage ? 'backdrop-blur-[2px]' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={wrapperClasses} style={backgroundStyle}>
      <div className={overlayClasses} aria-hidden="true" />

      <div className="relative max-w-3xl w-full text-center space-y-10">
        <div className="pointer-events-none absolute -top-28 -left-32 h-64 w-64 rounded-full bg-[#E2F0FF]/70 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -right-24 h-48 w-48 rounded-full bg-[#7CB7FF]/30 blur-3xl" />
        {(isMoodboardLoading || moodboardError) && (
          <div className="absolute -top-20 right-0 flex w-full justify-end px-2">
            <div
              className={`rounded-2xl border border-white/60 bg-white/75 px-4 py-2 text-sm font-medium text-[#1F2E4C] shadow-[0_18px_30px_rgba(124,183,255,0.25)] ${
                isMoodboardLoading ? 'backdrop-blur-md animate-pulse' : 'backdrop-blur-sm'
              }`}
            >
              {isMoodboardLoading ? t('introMoodboardLoading') : moodboardError}
            </div>
          </div>
        )}
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
  const { t } = useLanguage();
  const [items, setItems] = useLocalStorage<PantryItem[]>('pantryItems', []);
  const [recipeMemories, setRecipeMemories] = useLocalStorage<RecipeMemory[]>('recipeMemories', []);
  const [activeView, setActiveView] = useState<ActiveView>('intro');
  const [isRecipeModalOpen, setRecipeModalOpen] = useState(false);
  const [recipes, setRecipes] = useState<RecipeRecommendation[]>([]);
  const [isLoadingRecipes, setIsLoadingRecipes] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCameraOpen, setCameraOpen] = useState(false);
  const [isAnalyzingPhoto, setIsAnalyzingPhoto] = useState(false);
  const [selectedIngredients, setSelectedIngredients] = useState<string[]>([]);
  const [highlightedMemoryId, setHighlightedMemoryId] = useState<string | null>(null);
  const [nutritionSummary, setNutritionSummary] = useState<NutritionSummary | null>(null);
  const [nutritionIngredients, setNutritionIngredients] = useState<string[]>([]);
  const [activeMemoryForCooking, setActiveMemoryForCooking] = useState<RecipeMemory | null>(null);
  const [nutritionContext, setNutritionContext] = useState<NutritionContext | null>(null);
  const [manualIngredientsInput, setManualIngredientsInput] = useState('');
  const [manualInputError, setManualInputError] = useState<string | null>(null);
  const [moodboardImage, setMoodboardImage] = useState<string | null>(null);
  const [isMoodboardLoading, setIsMoodboardLoading] = useState(false);
  const [moodboardError, setMoodboardError] = useState<string | null>(null);
  const [journalPreviewStatuses, setJournalPreviewStatuses] = useState<
    Record<string, 'idle' | 'loading' | 'error' | 'unsupported'>
  >({});
  const [videoAvailabilityNotice, setVideoAvailabilityNotice] = useState<string | null>(null);

  useEffect(() => {
    setRecipeMemories(current => {
      if (!current.some(memory => typeof memory.journalPreviewImage === 'undefined')) {
        return current;
      }

      return current.map(memory => ({
        ...memory,
        journalPreviewImage: memory.journalPreviewImage ?? null,
      }));
    });
  }, [setRecipeMemories]);

  const normalizeIngredientName = (ingredient: string) => ingredient.trim().toLowerCase();

  const manualInputPreviewCount = useMemo(() => {
    if (!manualIngredientsInput.trim()) {
      return 0;
    }

    const rawEntries = parseIngredientInput(manualIngredientsInput);

    return sanitizeIngredients(rawEntries).length;
  }, [manualIngredientsInput]);

  const categoryKeywords: Record<Category, string[]> = {
    [Category.Vegetable]: [
      'lettuce',
      'spinach',
      'cabbage',
      'broccoli',
      'kale',
      'pepper',
      'onion',
      'garlic',
      'cucumber',
      'carrot',
      'mushroom',
      'herb',
    ],
    [Category.Fruit]: ['apple', 'banana', 'berry', 'orange', 'pear', 'tomato', 'grape', 'melon', 'peach'],
    [Category.Meat]: ['beef', 'pork', 'chicken', 'duck', 'lamb', 'steak', 'ham', 'bacon', 'salmon', 'fish', 'shrimp'],
    [Category.Dairy]: ['milk', 'cheese', 'yogurt', 'butter', 'cream'],
    [Category.Pantry]: ['rice', 'pasta', 'noodle', 'flour', 'bean', 'lentil', 'oil', 'sauce', 'spice'],
    [Category.Other]: [],
  };

  const categorizeIngredient = (ingredient: string): Category => {
    const name = normalizeIngredientName(ingredient);
    for (const [category, keywords] of Object.entries(categoryKeywords) as [Category, string[]][]) {
      if (keywords.some(keyword => name.includes(keyword))) {
        return category;
      }
    }
    if (name.includes('egg')) return Category.Dairy;
    if (name.includes('tofu')) return Category.Pantry;
    return Category.Other;
  };

  const buildDetectedItems = (ingredients: string[]): PantryItem[] => {
    const timestamp = new Date().toISOString();
    return ingredients.map(ingredient => ({
      id: uuidv4(),
      name: ingredient,
      category: categorizeIngredient(ingredient),
      acquiredAt: timestamp,
      status: ItemStatus.Active,
    }));
  };

  const commitDetectedIngredients = (ingredients: string[]) => {
    setItems(buildDetectedItems(ingredients));
  };

  useEffect(() => {
    setItems(current => {
      if (!current.length) {
        return current;
      }
      const sanitized = sanitizeIngredients(current.map(item => item.name));
      const requiresMigration =
        sanitized.length !== current.length || current.some(item => item.status !== ItemStatus.Active);
      return requiresMigration ? buildDetectedItems(sanitized) : current;
    });
  }, []);

  const applyNutritionFrom = (
    ingredients: string[],
    options: {
      alreadySanitized?: boolean;
      focusView?: boolean;
      context?: NutritionContext | null;
    } = {}
  ) => {
    const { alreadySanitized = false, focusView = false, context = null } = options;
    const list = alreadySanitized ? ingredients : sanitizeIngredients(ingredients);

    if (list.length === 0) {
      setNutritionSummary(null);
      setNutritionIngredients([]);
      setNutritionContext(null);
      if (focusView) {
        setActiveView(current => (current === 'nutrition' ? 'pantry' : current));
      }
      return list;
    }

    setNutritionIngredients(list);
    setNutritionSummary(estimateNutritionSummary(list));
    setNutritionContext(context);
    if (focusView) {
      setActiveView('nutrition');
    }
    return list;
  };

  const openCameraModal = () => {
    setActiveView('recipes');
    setCameraOpen(true);
  };

  const requestJournalPreviewForMemory = (
    memory: RecipeMemory,
    recipeContext?: RecipeRecommendation | null
  ) => {
    let shouldSkip = false;

    setJournalPreviewStatuses(current => {
      if (current[memory.id] === 'loading') {
        shouldSkip = true;
        return current;
      }

      return { ...current, [memory.id]: 'loading' };
    });

    if (shouldSkip) {
      return;
    }

    const matched = recipeContext?.matchedIngredients ?? memory.matchedIngredients ?? [];
    const missing = recipeContext?.missingIngredients ?? memory.missingIngredients ?? [];
    const artStyle =
      'warm tabletop scene with soft natural light, handcrafted ceramics, and gentle steam rising from the dish';

    void (async () => {
      try {
        const previewResult = await generateJournalPreviewImage({
          recipeName: memory.recipeName,
          matchedIngredients: matched,
          missingIngredients: missing,
          artStyle,
        });

        setRecipeMemories(current =>
          current.map(entry =>
            entry.id === memory.id ? { ...entry, journalPreviewImage: previewResult.dataUrl } : entry
          )
        );

        setJournalPreviewStatuses(current => ({
          ...current,
          [memory.id]: previewResult.status === 'unsupported' ? 'unsupported' : 'idle',
        }));
      } catch (error) {
        console.error('Failed to generate journal preview image', error);
        setJournalPreviewStatuses(current => ({ ...current, [memory.id]: 'error' }));
      }
    })();
  };

  const handleSaveRecipeMemory = (recipe: RecipeRecommendation) => {
    const normalizedName = recipe.recipeName.trim().toLowerCase();
    const existing = recipeMemories.find(
      memory => memory.recipeName.trim().toLowerCase() === normalizedName
    );

    if (existing) {
      const needsEnrichment =
        !existing.ingredients?.length || !existing.instructions?.length || !existing.videos?.length;
      if (needsEnrichment) {
        setRecipeMemories(current =>
          current.map(memory =>
            memory.id === existing.id
              ? {
                  ...memory,
                  ingredients: recipe.ingredientsNeeded,
                  instructions: recipe.instructions,
                  videos: recipe.videos,
                }
              : memory
          )
        );
      }
      if (!existing.journalPreviewImage) {
        requestJournalPreviewForMemory(existing, recipe);
      }
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
      ingredients: recipe.ingredientsNeeded,
      instructions: recipe.instructions,
      videos: recipe.videos,
      journalPreviewImage: null,
    };

    setRecipeMemories(current => [newMemory, ...current]);
    setHighlightedMemoryId(newMemory.id);
    requestJournalPreviewForMemory(newMemory, recipe);
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
    setJournalPreviewStatuses(current => {
      if (!(id in current)) {
        return current;
      }
      const next = { ...current };
      delete next[id];
      return next;
    });
  };

  const handleRegenerateJournalPreview = (id: string) => {
    const memory = recipeMemories.find(entry => entry.id === id);
    if (!memory) {
      return;
    }

    setRecipeMemories(current =>
      current.map(entry => (entry.id === id ? { ...entry, journalPreviewImage: null } : entry))
    );

    requestJournalPreviewForMemory({ ...memory, journalPreviewImage: null });
  };

  const handleMarkRecipeCooked = (id: string) => {
    let updatedEntry: RecipeMemory | null = null;
    setRecipeMemories(current =>
      current.map(memory => {
        if (memory.id !== id) {
          return memory;
        }
        const enriched: RecipeMemory = {
          ...memory,
          timesCooked: memory.timesCooked + 1,
          lastCookedAt: new Date().toISOString(),
        };
        updatedEntry = enriched;
        return enriched;
      })
    );
    if (updatedEntry) {
      setActiveMemoryForCooking(prev => (prev?.id === id ? updatedEntry : prev));
    }
    setHighlightedMemoryId(id);
  };

  const handleOpenMemoryForCooking = (id: string) => {
    const memory = recipeMemories.find(entry => entry.id === id);
    if (!memory) {
      return;
    }
    setActiveMemoryForCooking(memory);
  };

  const handleCloseMemoryForCooking = () => {
    setActiveMemoryForCooking(null);
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
    setNutritionContext(null);
    setActiveView('recipes');
  };

  const openRecipeModalFor = (ingredients: string[]) => {
    setSelectedIngredients(ingredients);
    setRecipeModalOpen(true);
  };

  const enrichRecipesWithVideos = async (
    suggestions: Recipe[],
    ingredients: string[]
  ): Promise<RecipeWithVideos[]> => {
    let youtubeConfigErrorDetected = false;

    const enriched = await Promise.all(
      suggestions.map(async suggestion => {
        try {
          const videos = await getRecipeVideos(suggestion.recipeName, ingredients);
          return { ...suggestion, videos };
        } catch (videoError) {
          if (videoError instanceof Error && videoError.message === 'error_youtube_api_key') {
            youtubeConfigErrorDetected = true;
          } else {
            console.error('Unable to fetch recipe videos', videoError);
          }
          return { ...suggestion, videos: [] };
        }
      })
    );

    if (youtubeConfigErrorDetected) {
      const error = new Error('error_youtube_api_key') as YoutubeConfigError;
      error.recipes = enriched;
      throw error;
    }

    return enriched;
  };

  const fetchRecipesForIngredients = async (ingredients: string[], availableIngredientNames: string[]) => {
    setError(null);
    setIsLoadingRecipes(true);
    setVideoAvailabilityNotice(null);

    try {
      const suggestions = await getRecipeSuggestions(ingredients);
      if (!suggestions.length) {
        setRecipes([]);
        setError(t('errorNoRecipes'));
        return;
      }
      let youtubeConfigError = false;
      let enriched: RecipeWithVideos[];

      try {
        enriched = await enrichRecipesWithVideos(suggestions, ingredients);
      } catch (videoError) {
        if (videoError instanceof Error && videoError.message === 'error_youtube_api_key') {
          youtubeConfigError = true;
          setVideoAvailabilityNotice(t('error_youtube_api_key'));
          const enrichedFromError = (videoError as YoutubeConfigError).recipes;
          enriched = enrichedFromError ?? suggestions.map(suggestion => ({ ...suggestion, videos: [] }));
        } else {
          throw videoError;
        }
      }

      const hasVideos = enriched.some(recipe => recipe.videos.length > 0);
      const youtubeReady = hasVideos ? enriched.filter(recipe => recipe.videos.length > 0) : [];

      if (hasVideos && youtubeReady.length === 0) {
        setRecipes([]);
        setVideoAvailabilityNotice(null);
        setError(t('errorNoVideoRecipes'));
        return;
      }

      if (!hasVideos && !youtubeConfigError) {
        setVideoAvailabilityNotice(t('noticeVideoFallback'));
      }

      const availableSet = new Set(availableIngredientNames.map(normalizeIngredientName));
      const recommendationSource = hasVideos ? youtubeReady : enriched;
      const recommendations: RecipeRecommendation[] = recommendationSource
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
    } catch (err) {
      const messageKey = err instanceof Error ? err.message : 'errorUnknown';
      setRecipes([]);
      setError(t(messageKey as any));
      setVideoAvailabilityNotice(null);
    } finally {
      setIsLoadingRecipes(false);
    }
  };

  const handleGetRecipes = async () => {
    setActiveView('recipes');
    setManualInputError(null);
    const activeItems = items;
    if (activeItems.length === 0) {
      setSelectedIngredients([]);
      setRecipes([]);
      setVideoAvailabilityNotice(null);
      setError(t('errorScanFirst'));
      setRecipeModalOpen(true);
      return;
    }

    const sortedNames = [...activeItems]
      .sort((a, b) => a.name.localeCompare(b.name, 'ko'))
      .map(item => item.name);
    const topIngredients = sortedNames.slice(0, 8);
    const sanitizedTopIngredients = sanitizeIngredients(topIngredients);

    if (sanitizedTopIngredients.length === 0) {
      setSelectedIngredients([]);
      setRecipes([]);
      setError(t('errorScanFirst'));
      setRecipeModalOpen(true);
      return;
    }

    openRecipeModalFor(sanitizedTopIngredients);
    const availableIngredientNames = Array.from(new Set([...sortedNames, ...sanitizedTopIngredients]));
    await fetchRecipesForIngredients(sanitizedTopIngredients, availableIngredientNames);
  };

  const handleCameraCapture = async (photo: Blob) => {
    setIsAnalyzingPhoto(true);

    try {
      setError(null);
      setMoodboardError(null);
      const detectedIngredients = await analyzeIngredientsFromImage(photo);
      const sanitizedDetectedIngredients = sanitizeIngredients(detectedIngredients ?? []);
      if (!sanitizedDetectedIngredients || sanitizedDetectedIngredients.length === 0) {
        throw new Error('errorNoIngredientsFound');
      }
      setIsMoodboardLoading(true);
      setMoodboardImage(null);
      commitDetectedIngredients(sanitizedDetectedIngredients);
      setManualIngredientsInput(sanitizedDetectedIngredients.join('\n'));
      setManualInputError(null);
      setSelectedIngredients([]);
      setRecipes([]);
      setNutritionSummary(null);
      setNutritionIngredients([]);
      setNutritionContext(null);
      setRecipeModalOpen(false);
      setActiveView('pantry');

      try {
        const previewResult = await generateDesignPreview(sanitizedDetectedIngredients);
        setMoodboardImage(previewResult.dataUrl);
        if (previewResult.status === 'unsupported') {
          setMoodboardError(t('introMoodboardUnsupported'));
        }
      } catch (previewError) {
        console.error('Failed to generate design preview:', previewError);
        setMoodboardImage(null);
        setMoodboardError(t('introMoodboardError'));
      } finally {
        setIsMoodboardLoading(false);
      }
    } catch (err) {
      const messageKey = err instanceof Error ? err.message : 'errorPhotoAnalysis';
      setSelectedIngredients([]);
      setRecipes([]);
      setError(t(messageKey as any));
      setVideoAvailabilityNotice(null);
      setRecipeModalOpen(true);
      setNutritionSummary(null);
      setNutritionIngredients([]);
      setNutritionContext(null);
      setManualInputError(null);
      setMoodboardImage(null);
      setIsMoodboardLoading(false);
      if (messageKey === 'error_gemini_api_key') {
        setMoodboardError(t('introMoodboardError'));
      }
    } finally {
      setIsAnalyzingPhoto(false);
      setCameraOpen(false);
    }
  };

  const handleManualIngredientsSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const rawEntries = parseIngredientInput(manualIngredientsInput);
    const sanitized = sanitizeIngredients(rawEntries);

    if (sanitized.length === 0) {
      setManualInputError(t('pantryManualInputError'));
      return;
    }

    setManualInputError(null);
    commitDetectedIngredients(sanitized);
    setManualIngredientsInput('');
    openRecipeModalFor(sanitized);
    setActiveView('recipes');
    await fetchRecipesForIngredients(sanitized, sanitized);
  };

  const handleApplyDetectedIngredients = async (candidate: string[]) => {
    const sanitized = sanitizeIngredients(candidate);

    if (sanitized.length === 0) {
      throw new Error('errorNoIngredientsAfterEdit');
    }

    commitDetectedIngredients(sanitized);
    setManualIngredientsInput(sanitized.join('\n'));
    setManualInputError(null);
    setSelectedIngredients(sanitized);

    const availableIngredientNames = Array.from(new Set([...sanitized]));
    await fetchRecipesForIngredients(sanitized, availableIngredientNames);

    return sanitized;
  };

  const activeItems = items;

  const handleViewRecipeNutrition = (recipe: RecipeRecommendation) => {
    const sanitized = applyNutritionFrom(recipe.ingredientsNeeded, {
      focusView: true,
      context: { type: 'recipe', label: recipe.recipeName },
    });
    if (sanitized.length > 0) {
      setRecipeModalOpen(false);
    }
  };

  const resolveMemoryIngredients = (memory: RecipeMemory) => {
    if (memory.ingredients?.length) {
      return memory.ingredients;
    }
    const combined = [
      ...(memory.matchedIngredients ?? []),
      ...(memory.missingIngredients ?? []),
    ].filter(Boolean);
    return combined.length ? combined : [];
  };

  const handleViewMemoryNutrition = (memory: RecipeMemory) => {
    const sourceIngredients = resolveMemoryIngredients(memory);
    if (!sourceIngredients.length) {
      return;
    }
    applyNutritionFrom(sourceIngredients, {
      focusView: true,
      context: { type: 'memory', label: memory.recipeName },
    });
  };

  const handleCloseRecipeModal = () => {
    setRecipeModalOpen(false);
  };

  if (activeView === 'intro') {
    return (
      <IntroScreen
        onStart={() => setActiveView('pantry')}
        onScan={openCameraModal}
        moodboardImage={moodboardImage}
        isMoodboardLoading={isMoodboardLoading}
        moodboardError={moodboardError}
      />
    );
  }

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
                {nutritionSummary && (
                  <button
                    type="button"
                    onClick={() => setActiveView('nutrition')}
                    className="inline-flex items-center gap-2 rounded-full border border-[#7CB7FF]/40 bg-white/70 px-5 py-2.5 text-sm font-semibold text-[#1C2B4B] shadow-sm hover:bg-[#EBF5FF]"
                  >
                    <SparklesIcon /> {t('pantrySectionNutritionButton')}
                  </button>
                )}
              </div>
            </div>
            <form
              onSubmit={handleManualIngredientsSubmit}
              className="rounded-3xl border border-[#7CB7FF]/20 bg-white/70 p-5 md:p-6 space-y-3"
            >
              <div className="space-y-2">
                <label className="text-sm font-semibold text-[#1C2B4B]" htmlFor="manual-ingredients">
                  {t('pantryManualInputTitle')}
                </label>
                <textarea
                  id="manual-ingredients"
                  className="w-full rounded-2xl border border-[#7CB7FF]/30 bg-white/80 px-4 py-3 text-sm text-[#1C2B4B] shadow-sm focus:border-[#7CB7FF] focus:outline-none focus:ring-2 focus:ring-[#7CB7FF]/40"
                  rows={3}
                  value={manualIngredientsInput}
                  onChange={event => {
                    setManualIngredientsInput(event.target.value);
                    if (manualInputError) {
                      setManualInputError(null);
                    }
                  }}
                  placeholder={t('pantryManualInputPlaceholder')}
                />
                <p className="text-xs text-[#1C2B4B]/60">{t('pantryManualInputHint')}</p>
                {manualInputPreviewCount > 0 && (
                  <p className="text-xs font-semibold text-[#1C2B4B]/80">
                    {t('pantryManualInputCount', { count: manualInputPreviewCount })}
                  </p>
                )}
                {manualInputError && (
                  <p className="text-xs font-semibold text-red-500">{manualInputError}</p>
                )}
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-full bg-[#7CB7FF] px-5 py-2 text-sm font-semibold text-white shadow-[0_16px_26px_rgba(124,183,255,0.35)] hover:shadow-[0_20px_32px_rgba(124,183,255,0.45)]"
                >
                  <SparklesIcon /> {t('pantryManualInputSubmit')}
                </button>
              </div>
            </form>
            <div className="rounded-3xl border border-[#EBF5FF] bg-[#EBF5FF]/60 p-4 md:p-6">
              <PantryList items={activeItems} />
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
          <NutritionSummaryCard
            summary={nutritionSummary}
            ingredients={nutritionIngredients}
            context={nutritionContext}
            onClear={handleClearNutrition}
          />
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
              onOpenDetails={handleOpenMemoryForCooking}
              onRegeneratePreview={handleRegenerateJournalPreview}
              previewStatuses={journalPreviewStatuses}
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
      key: 'nutrition',
      label: t('toolbarNutrition'),
      description: t('toolbarNutritionHint'),
      icon: <PulseIcon />,
      onClick: () => setActiveView('nutrition'),
      active: activeView === 'nutrition',
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
      <Header />
      <main className="container mx-auto max-w-5xl px-4 py-6 md:py-10 pb-36 space-y-8">
        {videoAvailabilityNotice && (
          <div className="rounded-3xl border border-[#7CB7FF]/30 bg-white/80 px-4 py-3 text-sm text-[#1C2B4B]/80 shadow-sm">
            {videoAvailabilityNotice}
          </div>
        )}
        {renderActiveView()}
      </main>

      <BottomToolbar actions={toolbarActions} />

      {isRecipeModalOpen && (
        <RecipeModal
          isOpen={isRecipeModalOpen}
          onClose={handleCloseRecipeModal}
          recipes={recipes}
          isLoading={isLoadingRecipes}
          error={error}
          ingredients={selectedIngredients}
          onSaveRecipeToJournal={handleSaveRecipeMemory}
          savedRecipeNames={recipeMemories.map(memory => memory.recipeName)}
          nutritionSummary={nutritionSummary}
          nutritionContext={nutritionContext}
          onViewRecipeNutrition={handleViewRecipeNutrition}
          onApplyDetectedIngredients={handleApplyDetectedIngredients}
          videoAvailabilityNotice={videoAvailabilityNotice}
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

      {activeMemoryForCooking && (
        <RecipeExperienceModal
          entry={activeMemoryForCooking}
          onClose={handleCloseMemoryForCooking}
          onCook={() => handleMarkRecipeCooked(activeMemoryForCooking.id)}
          onViewNutrition={() => handleViewMemoryNutrition(activeMemoryForCooking)}
        />
      )}
    </div>
  );
};

export default App;