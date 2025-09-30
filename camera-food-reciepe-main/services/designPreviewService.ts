import { GoogleGenAI, Type } from '@google/genai';
import type { RecipeRecommendation } from '../types';

const GEMINI_API_KEY =
  (process.env.GEMINI_API_KEY as string | undefined) ?? (process.env.API_KEY as string | undefined);

const ai = GEMINI_API_KEY ? new GoogleGenAI({ apiKey: GEMINI_API_KEY }) : null;

const previewSchema = {
  type: Type.OBJECT,
  properties: {
    imageData: {
      type: Type.STRING,
      description:
        'Base64 encoded PNG or JPEG image data that visually represents a culinary moodboard inspired by the provided ingredients.',
    },
    mimeType: {
      type: Type.STRING,
      description: 'Optional MIME type for the encoded image (image/png or image/jpeg).',
    },
  },
  required: ['imageData'],
};

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

const requestPreviewFromGemini = async (prompt: string): Promise<string> => {
  if (!GEMINI_API_KEY || !ai) {
    throw new Error('error_gemini_api_key');
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image-preview',
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: previewSchema,
        temperature: 0.4,
      },
    });

    const candidateParts = (response as any)?.candidates?.flatMap((candidate: any) => candidate?.content?.parts ?? []) ?? [];
    const inlinePart = candidateParts.find((part: any) => part?.inlineData?.data);

    if (inlinePart?.inlineData?.data) {
      const mimeType = typeof inlinePart.inlineData.mimeType === 'string' && inlinePart.inlineData.mimeType.trim()
        ? inlinePart.inlineData.mimeType.trim()
        : 'image/png';
      const data = String(inlinePart.inlineData.data).trim();
      if (!data) {
        throw new Error('error_design_preview_fetch');
      }
      return `data:${mimeType};base64,${data}`;
    }

    let jsonText: string | undefined = response.text;
    if (!jsonText) {
      const fallback = (response as { output_text?: string | undefined }).output_text;
      if (typeof fallback === 'string') {
        jsonText = fallback;
      }
    }

    const trimmedJson = jsonText?.trim();
    if (!trimmedJson) {
      throw new Error('error_design_preview_fetch');
    }

    const parsed = JSON.parse(trimmedJson) as { imageData?: string; image?: string; mimeType?: string };
    const base64 = (parsed.imageData ?? parsed.image ?? '').trim();

    if (!base64) {
      throw new Error('error_design_preview_fetch');
    }

    const mimeType = (parsed.mimeType ?? 'image/png').trim();
    const normalizedMimeType = mimeType.startsWith('image/') ? mimeType : `image/${mimeType}`;

    return `data:${normalizedMimeType};base64,${base64}`;
  } catch (error) {
    console.error('Error generating design preview from Gemini API:', error);
    throw new Error('error_design_preview_fetch');
  }
};

export async function generateDesignPreview(ingredients: string[]): Promise<string> {
  const sanitizedIngredients = normalizeIngredients(ingredients);

  if (sanitizedIngredients.length === 0) {
    throw new Error('error_design_preview_fetch');
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

export async function fetchRecipePreviewImage(recipe: RecipeRecommendation): Promise<string> {
  const cacheKey = deriveRecipePreviewKey(recipe);
  const cached = readFromLocalStorage(cacheKey);

  if (cached) {
    return cached;
  }

  const prompt = [
    'You are an imaginative food photographer crafting a stylized hero shot for a recipe recommendation card.',
    `Recipe name: ${recipe.recipeName.trim()}`,
    recipe.description ? `Recipe description: ${recipe.description.trim()}` : null,
    'Create a single appetizing photograph of the finished dish plated beautifully on a modern table.',
    'Use soft daylight, emphasize vibrant colors, and avoid any text overlays, logos, hands, or people.',
    'Return only base64 encoded PNG or JPEG data for the generated image.',
  ]
    .filter(Boolean)
    .join('\n');

  const imageData = await requestPreviewFromGemini(prompt);
  writeToLocalStorage(cacheKey, imageData);

  return imageData;
}

export async function generateJournalPreviewImage(options: JournalPreviewOptions): Promise<string> {
  const { recipeName, matchedIngredients = [], missingIngredients = [], artStyle = defaultJournalArtStyle } = options;

  const normalizedName = recipeName.trim();
  if (!normalizedName) {
    throw new Error('error_design_preview_fetch');
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
