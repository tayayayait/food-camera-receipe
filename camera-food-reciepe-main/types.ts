
export enum Category {
  Vegetable = 'Vegetable',
  Fruit = 'Fruit',
  Meat = 'Meat',
  Dairy = 'Dairy',
  Pantry = 'Pantry',
  Other = 'Other'
}

export enum ItemStatus {
  Active = 'Active',
  Used = 'Used',
  Deleted = 'Deleted' // Soft delete
}

export interface PantryItem {
  id: string;
  name: string;
  category: Category;
  acquiredAt: string; // ISO string
  status: ItemStatus;
}

export interface Recipe {
    recipeName: string;
    description: string;
    ingredientsNeeded: string[];
    instructions: string[];
}

export interface RecipeVideo {
    id: string;
    title: string;
    channelTitle: string;
    thumbnailUrl: string;
    videoUrl: string;
}

export interface RecipeWithVideos extends Recipe {
    videos: RecipeVideo[];
}

export interface RecipeRecommendation extends RecipeWithVideos {
    missingIngredients: string[];
    matchedIngredients: string[];
    isFullyMatched: boolean;
    previewImage?: string;
    previewStatus?: 'idle' | 'loading' | 'error';
}

export interface NutrientProfile {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
}

export type NutritionDataQuality = 'authoritative' | 'derived' | 'missing';

export interface NutritionBreakdownEntry {
    ingredient: string;
    profile?: NutrientProfile;
    portionGrams?: number;
    portionText?: string;
    sourceCitation?: string;
    sourceId?: string;
    dataQuality: NutritionDataQuality;
    note?: string;
}

export interface NutritionSummary {
    total: NutrientProfile;
    breakdown: NutritionBreakdownEntry[];
    detectedCount: number;
}

export type NutritionContext =
  | { type: 'scan' }
  | { type: 'recipe'; label: string }
  | { type: 'memory'; label: string };

export interface RecipeMemory {
    id: string;
    recipeName: string;
    description?: string;
    createdAt: string; // ISO string
    note: string;
    matchedIngredients?: string[];
    missingIngredients?: string[];
    lastCookedAt?: string | null;
    timesCooked: number;
    ingredients?: string[];
    instructions?: string[];
    videos?: RecipeVideo[];
    journalPreviewImage?: string | null;
}

export interface VideoRecipeState {
    video: RecipeVideo | null;
    recipe: Recipe | null;
    baseRecipeName: string | null;
    isLoading: boolean;
    error: string | null;
}
