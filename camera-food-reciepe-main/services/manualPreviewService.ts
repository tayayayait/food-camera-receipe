import type { RecipeRecommendation, RecipeVideo } from '../types';

export type ManualPreviewLookup = Record<string, string>;

export const manualPreviewLookup: ManualPreviewLookup = {
  // Add curated recipe previews here using stable keys.
};

const normalizeRecipeName = (name: string) => name.trim().toLowerCase();

const collectCandidateKeys = (recipe: { recipeName: string; videos?: RecipeVideo[] }): string[] => {
  const candidates: string[] = [];
  if (recipe.videos && recipe.videos.length > 0) {
    for (const video of recipe.videos) {
      const id = video?.id?.trim();
      if (id) {
        candidates.push(id);
      }
    }
  }

  const recipeName = recipe.recipeName?.trim();
  if (recipeName) {
    candidates.push(normalizeRecipeName(recipeName));
  }

  return candidates;
};

export const resolveManualPreviewImage = (
  recipe: Pick<RecipeRecommendation, 'recipeName' | 'videos'>,
  lookup: ManualPreviewLookup = manualPreviewLookup
): string | undefined => {
  const candidates = collectCandidateKeys(recipe);
  for (const key of candidates) {
    const directMatch = lookup[key];
    if (directMatch) {
      return directMatch;
    }

    const normalizedKey = normalizeRecipeName(key);
    if (normalizedKey !== key && lookup[normalizedKey]) {
      return lookup[normalizedKey];
    }
  }
  return undefined;
};

export const hasManualPreview = (
  recipe: Pick<RecipeRecommendation, 'recipeName' | 'videos'>,
  lookup: ManualPreviewLookup = manualPreviewLookup
): boolean => Boolean(resolveManualPreviewImage(recipe, lookup));

