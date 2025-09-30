import { GoogleGenAI } from '@google/genai';
import type { RecipeRecommendation } from '../types';

const GEMINI_API_KEY =
  (process.env.GEMINI_API_KEY as string | undefined) ?? (process.env.API_KEY as string | undefined);

export const isDesignPreviewSupported = Boolean(GEMINI_API_KEY);

const ai = isDesignPreviewSupported ? new GoogleGenAI({ apiKey: GEMINI_API_KEY }) : null;

const GEMINI_PREVIEW_MODEL = 'gemini-2.5-flash-image-preview';
const DEFAULT_IMAGE_MODEL = 'imagen-3.0-generate-002';

const configuredImageModel = process.env.GEMINI_IMAGE_MODEL?.trim();
const resolvedPrimaryImageModel = configuredImageModel && configuredImageModel.length > 0
  ? configuredImageModel
  : DEFAULT_IMAGE_MODEL;

const resolvedAlternateImageModel = resolvedPrimaryImageModel === GEMINI_PREVIEW_MODEL
  ? DEFAULT_IMAGE_MODEL
  : GEMINI_PREVIEW_MODEL;

const PLACEHOLDER_PREVIEW_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAAxklEQVR4nO3ZwQ2DMBAF0bNIN1EGsRNshDYg3QgZ5M90yxCLgn/FBqXfiKPu21/x+sBAAAAAAAAAAAAwL/kuz2po3WT6c7tKZrX9G0v0zSdmmbpN03TNM2maZqeNE3TNM2maZqeNE3TtD1C03Vf+Wbvk3Sf37Bdlum6btM0zSZpmunRN0zTNpmmanjRN0zTNpmmanjRN07Q9Qk3TfJbrJN0nd+wXZbpum7TNM0maZrp0TdM0zaZppp40TdM0zaZpp40TdO0PQLnFf8tAwAAAAAAAAAAAAAA4Jt+AzHYAX8GumSCAAAAAElFTkSuQmCC';

export type GeminiPreviewStatus = 'success' | 'unsupported';

export interface GeminiPreviewResponse {
  status: GeminiPreviewStatus;
  dataUrl: string;
  model: string | null;
  attemptedModels: string[];
}

const normalizeIngredients = (ingredients: string[]): string[] =>
  ingredients
    .map(ingredient => ingredient.trim())
    .filter((ingredient, index, self) => ingredient && self.findIndex(value => value.toLowerCase() === ingredient.toLowerCase()) === index);

const recipePreviewCachePrefix = 'recipe-preview:';
const defaultJournalArtStyle =
  'warm tabletop scene with soft natural light, handcrafted ceramics, and gentle steam';

export interface JournalPreviewOptions {
  recipeName: string;
  matchedIngredients?: string[];
  missingIngredients?: string[];
  artStyle?: string;
}

const readFromLocalStorage = (key: string): string | null => {
  if (typeof window === 'undefined' || !window?.localStorage) {
    return null;
  }

  try {
    return window.localStorage.getItem(key);
  } catch (error) {
    console.warn('Unable to read recipe preview cache', error);
    return null;
  }
};

const writeToLocalStorage = (key: string, value: string) => {
  if (typeof window === 'undefined' || !window?.localStorage) {
    return;
  }

  try {
    window.localStorage.setItem(key, value);
  } catch (error) {
    console.warn('Unable to persist recipe preview cache', error);
  }
};

const removeFromLocalStorage = (key: string) => {
  if (typeof window === 'undefined' || !window?.localStorage) {
    return;
  }

  try {
    window.localStorage.removeItem(key);
  } catch (error) {
    console.warn('Unable to clear recipe preview cache', error);
  }
};

const deriveRecipePreviewKey = (recipe: RecipeRecommendation): string => {
  const candidateId = (recipe as { id?: string | number | null }).id;
  const resolvedId = candidateId != null && String(candidateId).trim().length > 0
    ? String(candidateId).trim()
    : recipe.recipeName.trim();
  return `${recipePreviewCachePrefix}${resolvedId.toLowerCase()}`;
};

const extractStatusCode = (error: unknown): number | undefined => {
  if (!error || typeof error !== 'object') {
    return undefined;
  }

  const candidateValues = [
    (error as { status?: unknown }).status,
    (error as { statusCode?: unknown }).statusCode,
    (error as { code?: unknown }).code,
    (error as { response?: { status?: unknown } }).response?.status,
    (error as { cause?: { status?: unknown } }).cause?.status,
  ];

  for (const candidate of candidateValues) {
    if (typeof candidate === 'number') {
      return candidate;
    }
    if (typeof candidate === 'string') {
      const parsed = Number(candidate);
      if (!Number.isNaN(parsed)) {
        return parsed;
      }
    }
  }

  return undefined;
};

const isRetryableGeminiError = (error: unknown): boolean => {
  const statusCode = extractStatusCode(error);
  if (statusCode === 403 || statusCode === 404) {
    return true;
  }

  if (statusCode && statusCode >= 400 && statusCode < 500) {
    return true;
  }

  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  const normalizedMessage = message.toLowerCase();
  return [
    'gemini',
    'permission',
    'model',
    'not found',
    'forbidden',
  ].some(keyword => normalizedMessage.includes(keyword));
};

const requestPreviewFromGemini = async (prompt: string): Promise<GeminiPreviewResponse> => {
  if (!isDesignPreviewSupported || !ai) {
    throw new Error('error_gemini_api_key');
  }

  const attemptedModels: string[] = [];

  const generateWithModel = async (model: string): Promise<string> => {
    attemptedModels.push(model);
    const response = await ai.models.generateImages({
      model,
      prompt,
      config: {
        numberOfImages: 1,
      },
    });

    const generatedImage = response.generatedImages?.[0]?.image;
    const imageBytes = generatedImage?.imageBytes?.trim();

    if (!imageBytes) {
      throw new Error('error_design_preview_fetch');
    }

    const mimeType = generatedImage?.mimeType && generatedImage.mimeType.trim()
      ? generatedImage.mimeType.trim()
      : 'image/png';

    return `data:${mimeType};base64,${imageBytes}`;
  };

  try {
    const dataUrl = await generateWithModel(resolvedPrimaryImageModel);
    return {
      status: 'success',
      dataUrl,
      model: resolvedPrimaryImageModel,
      attemptedModels: [...attemptedModels],
    };
  } catch (primaryError) {
    const shouldAttemptFallback = isRetryableGeminiError(primaryError);

    if (!shouldAttemptFallback) {
      console.error('Error generating design preview from Gemini API:', primaryError);
      throw new Error('error_design_preview_fetch');
    }

    console.warn('Gemini image generation failed, attempting alternate model.', primaryError);

    if (resolvedAlternateImageModel && resolvedAlternateImageModel !== resolvedPrimaryImageModel) {
      try {
        const dataUrl = await generateWithModel(resolvedAlternateImageModel);
        return {
          status: 'success',
          dataUrl,
          model: resolvedAlternateImageModel,
          attemptedModels: [...attemptedModels],
        };
      } catch (alternateError) {
        console.error('Alternate Gemini image model also failed, using placeholder preview.', alternateError);
      }
    }

    return {
      status: 'unsupported',
      dataUrl: PLACEHOLDER_PREVIEW_DATA_URL,
      model: null,
      attemptedModels: [...attemptedModels],
    };
  }
};

export async function generateDesignPreview(ingredients: string[]): Promise<GeminiPreviewResponse> {
  const sanitizedIngredients = normalizeIngredients(ingredients);

  if (sanitizedIngredients.length === 0) {
    throw new Error('error_design_preview_fetch');
  }

  if (!isDesignPreviewSupported) {
    throw new Error('error_gemini_api_key');
  }

  const prompt = [
    'You are a culinary art director helping a cooking assistant app feel inspiring when users scan their fridge.',
    'Create a single evocative moodboard preview image that blends the detected ingredients into a cohesive cooking inspiration scene.',
    'Use soft natural lighting, minimal text, and avoid including people. The focus should be on textures, colors, and plating ideas.',
    'Return the final image as base64 encoded data (PNG or JPEG). Do not include any additional commentary.',
    '',
    `Detected ingredients: ${sanitizedIngredients.join(', ')}`,
  ].join('\n');

  return requestPreviewFromGemini(prompt);
}

export const getRecipePreviewCacheKey = (recipe: RecipeRecommendation): string => deriveRecipePreviewKey(recipe);

export const clearRecipePreviewCache = (recipe: RecipeRecommendation) => {
  const key = deriveRecipePreviewKey(recipe);
  removeFromLocalStorage(key);
};

export async function fetchRecipePreviewImage(
  recipe: RecipeRecommendation
): Promise<GeminiPreviewResponse> {
  if (!isDesignPreviewSupported) {
    throw new Error('error_gemini_api_key');
  }

  const cacheKey = deriveRecipePreviewKey(recipe);
  const cached = readFromLocalStorage(cacheKey);

  if (cached) {
    return {
      status: 'success',
      dataUrl: cached,
      model: resolvedPrimaryImageModel,
      attemptedModels: [resolvedPrimaryImageModel],
    };
  }

  const sanitizedRecipeIngredients = normalizeIngredients(recipe.ingredientsNeeded ?? []);
  const availableIngredients = normalizeIngredients(recipe.matchedIngredients ?? []);
  const missingIngredients = normalizeIngredients(recipe.missingIngredients ?? []);

  const prompt = [
    'You are an imaginative food photographer crafting a stylized hero shot for a recipe recommendation card.',
    `Recipe name: ${recipe.recipeName.trim()}`,
    recipe.description ? `Recipe description: ${recipe.description.trim()}` : null,
    sanitizedRecipeIngredients.length > 0
      ? `Core ingredients that must be visible in the dish: ${sanitizedRecipeIngredients.join(', ')}`
      : null,
    availableIngredients.length > 0
      ? `Ingredients currently available to the cook: ${availableIngredients.join(', ')}`
      : null,
    missingIngredients.length > 0
      ? `Ingredients not yet gathered (avoid showing them prominently): ${missingIngredients.join(', ')}`
      : null,
    'Create a single appetizing photograph of the finished dish plated beautifully on a modern table.',
    'Use soft daylight, emphasize vibrant colors, and avoid any text overlays, logos, hands, or people.',
    'Ensure the final plating clearly highlights the core ingredients and reflects the described recipe.',
    'Return only base64 encoded PNG or JPEG data for the generated image.',
  ]
    .filter(Boolean)
    .join('\n');

  const result = await requestPreviewFromGemini(prompt);

  if (result.status === 'success') {
    writeToLocalStorage(cacheKey, result.dataUrl);
  }

  return result;
}

export async function generateJournalPreviewImage(
  options: JournalPreviewOptions
): Promise<GeminiPreviewResponse> {
  const { recipeName, matchedIngredients = [], missingIngredients = [], artStyle = defaultJournalArtStyle } = options;

  const normalizedName = recipeName.trim();
  if (!normalizedName) {
    throw new Error('error_design_preview_fetch');
  }

  if (!isDesignPreviewSupported) {
    throw new Error('error_gemini_api_key');
  }

  const available = normalizeIngredients(matchedIngredients);
  const missing = normalizeIngredients(missingIngredients);

  const prompt = [
    'You are crafting a tiny hero image for a cooking journal entry.',
    'Create an illustration or stylized photo that feels handcrafted and inspiring at a glance.',
    `Recipe name: ${normalizedName}`,
    available.length > 0
      ? `Ingredients already on hand: ${available.join(', ')}`
      : 'Ingredients already on hand: none explicitly listed.',
    missing.length > 0
      ? `Ingredients still missing (hint subtly, do not emphasize scarcity): ${missing.join(', ')}`
      : 'All ingredients appear to be available for this dish.',
    `Art direction: ${artStyle}.`,
    'Keep the composition focused on food, props, and mood—no people, no text, and no logos.',
    'Return a single base64 encoded PNG or JPEG image that can be used as a thumbnail.',
  ]
    .filter(Boolean)
    .join('\n');

  return requestPreviewFromGemini(prompt);
}
