import type { RecipeRecommendation } from '../types';

const GEMINI_IMAGE_MODEL = 'gemini-2.5-flash-image-preview';
const CACHE_PREFIX = 'recipe-preview:';
const DEFAULT_ERROR_MESSAGE = '프리뷰 이미지를 불러오지 못했어요.';

const importMetaEnv = (import.meta as { env?: Record<string, string | undefined> }).env ?? {};

const GEMINI_API_KEY =
  importMetaEnv.VITE_GEMINI_API_KEY ??
  (typeof process !== 'undefined'
    ? process.env?.GEMINI_API_KEY ?? process.env?.API_KEY ?? undefined
    : undefined);

type PreviewCacheEntry = {
  image: string;
  updatedAt: number;
  recipeName: string;
};

interface FetchPreviewOptions {
  forceRefresh?: boolean;
}

interface InlineDataPart {
  inlineData?: {
    mimeType?: string;
    data?: string;
  };
  fileData?: {
    fileUri?: string;
    mimeType?: string;
  };
}

const buildCacheKey = (recipe: RecipeRecommendation): string => {
  const candidateId = (recipe as { id?: string | number | undefined }).id;
  const base = candidateId !== undefined && candidateId !== null
    ? String(candidateId)
    : recipe.recipeName.trim().toLowerCase();
  return `${CACHE_PREFIX}${base}`;
};

const readFromCache = (key: string): string | null => {
  if (typeof window === 'undefined' || !window?.localStorage) {
    return null;
  }

  try {
    const cached = window.localStorage.getItem(key);
    if (!cached) {
      return null;
    }

    const parsed = JSON.parse(cached) as PreviewCacheEntry;
    if (parsed && typeof parsed.image === 'string') {
      return parsed.image;
    }
  } catch (error) {
    console.warn('Failed to read recipe preview cache', error);
  }

  return null;
};

const writeToCache = (key: string, payload: PreviewCacheEntry) => {
  if (typeof window === 'undefined' || !window?.localStorage) {
    return;
  }

  try {
    window.localStorage.setItem(key, JSON.stringify(payload));
  } catch (error) {
    console.warn('Failed to persist recipe preview cache', error);
  }
};

const extractImageDataUrl = (parts: InlineDataPart[]): string | null => {
  for (const part of parts) {
    if (part.inlineData?.data) {
      const mimeType = part.inlineData.mimeType ?? 'image/png';
      return `data:${mimeType};base64,${part.inlineData.data}`;
    }

    if (part.fileData?.fileUri) {
      // fileData URIs are authenticated; re-fetching them is not currently supported client-side.
      // Fall through so we can try the next part for inline data.
      continue;
    }
  }

  return null;
};

const requestPreviewFromGemini = async (recipe: RecipeRecommendation): Promise<string> => {
  if (!GEMINI_API_KEY) {
    throw new Error('Gemini 이미지 프리뷰를 사용할 수 없어요. API 키를 확인해주세요.');
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_IMAGE_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  const prompt = [
    'You are a food stylist generating a single high-quality preview image of a finished dish.',
    `Recipe name: ${recipe.recipeName}`,
    recipe.description ? `Recipe description: ${recipe.description}` : null,
    recipe.ingredientsNeeded.length > 0
      ? `Additional ingredients: ${recipe.ingredientsNeeded.join(', ')}`
      : null,
    'Create a vibrant, appetizing, professional photo that highlights the plating, texture, and warmth of the meal.',
    'Style it for a digital recipe card hero image. Do not include text, watermarks, or hands.',
  ]
    .filter(Boolean)
    .join('\n');

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: 0.65,
        aspectRatio: '4:3',
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(errorText || DEFAULT_ERROR_MESSAGE);
  }

  const payload = (await response.json()) as {
    candidates?: Array<{
      content?: {
        parts?: InlineDataPart[];
      };
    }>;
  };

  const candidates = payload.candidates ?? [];
  for (const candidate of candidates) {
    const parts = candidate.content?.parts ?? [];
    const imageUrl = extractImageDataUrl(parts);
    if (imageUrl) {
      return imageUrl;
    }
  }

  throw new Error(DEFAULT_ERROR_MESSAGE);
};

export const fetchRecipePreviewImage = async (
  recipe: RecipeRecommendation,
  options?: FetchPreviewOptions
): Promise<string> => {
  const cacheKey = buildCacheKey(recipe);

  if (!options?.forceRefresh) {
    const cached = readFromCache(cacheKey);
    if (cached) {
      return cached;
    }
  }

  const imageUrl = await requestPreviewFromGemini(recipe);

  try {
    writeToCache(cacheKey, {
      image: imageUrl,
      updatedAt: Date.now(),
      recipeName: recipe.recipeName,
    });
  } catch (error) {
    console.warn('Unable to cache recipe preview image', error);
  }

  return imageUrl;
};

export const getRecipePreviewCacheKey = (recipe: RecipeRecommendation): string => buildCacheKey(recipe);
