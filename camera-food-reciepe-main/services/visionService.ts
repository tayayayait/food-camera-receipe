import { GoogleGenAI, Type } from '@google/genai';

const VISION_ENDPOINT = process.env.VISION_API_URL as string | undefined;
const VISION_API_KEY = process.env.VISION_API_KEY as string | undefined;
const GEMINI_API_KEY =
  (process.env.GEMINI_API_KEY as string | undefined) ?? (process.env.API_KEY as string | undefined);

const ai = GEMINI_API_KEY ? new GoogleGenAI({ apiKey: GEMINI_API_KEY }) : null;

const ingredientSchema = {
  type: Type.ARRAY,
  items: {
    type: Type.STRING,
    description:
      'Single-word or short food ingredient names that appear clearly in the provided image of refrigerator or pantry items.',
  },
};

interface VisionResponse {
  ingredients?: string[];
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  if (typeof btoa === 'function') {
    return btoa(binary);
  }
  if (typeof Buffer !== 'undefined') {
    // Fallback for environments where btoa is not available (e.g. some Node test runners)
    return Buffer.from(binary, 'binary').toString('base64');
  }
  throw new Error('Base64 encoding is not supported in this environment.');
}

async function analyzeWithGemini(image: Blob): Promise<string[]> {
  if (!ai || !GEMINI_API_KEY) {
    throw new Error('error_gemini_api_key');
  }

  try {
    const arrayBuffer = await image.arrayBuffer();
    const base64 = arrayBufferToBase64(arrayBuffer);

    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text:
                'Identify all visible, usable food ingredients in this refrigerator or pantry photo. Respond with a JSON array of distinct ingredient names in Korean when possible. Do not include utensils, containers, or non-food objects.',
            },
            {
              inlineData: {
                mimeType: image.type || 'image/jpeg',
                data: base64,
              },
            },
          ],
        },
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: ingredientSchema,
        temperature: 0.2,
        topK: 32,
      },
    });

    const jsonText = response.text.trim();
    const ingredients = JSON.parse(jsonText);

    if (!Array.isArray(ingredients)) {
      return [];
    }

    return ingredients.map((ingredient: string) => ingredient.trim()).filter(Boolean);
  } catch (error) {
    console.error('Gemini ingredient analysis failed', error);
    throw new Error('error_vision_fetch');
  }
}

async function analyzeWithExternalService(image: Blob): Promise<string[]> {
  if (!VISION_ENDPOINT) {
    throw new Error('error_vision_api_url');
  }

  const formData = new FormData();
  formData.append('file', image, 'fridge.jpg');

  const headers: Record<string, string> = {};
  if (VISION_API_KEY) {
    headers.Authorization = `Bearer ${VISION_API_KEY}`;
  }

  const response = await fetch(VISION_ENDPOINT, {
    method: 'POST',
    body: formData,
    headers,
  });

  if (!response.ok) {
    throw new Error('error_vision_fetch');
  }

  const data = (await response.json()) as VisionResponse;
  const ingredients = Array.isArray(data.ingredients) ? data.ingredients : [];

  return ingredients.map(ingredient => ingredient.trim()).filter(Boolean);
}

export async function analyzeIngredientsFromImage(image: Blob): Promise<string[]> {
  if (VISION_ENDPOINT) {
    try {
      return await analyzeWithExternalService(image);
    } catch (error) {
      if (error instanceof Error && error.message === 'error_gemini_api_key') {
        throw error;
      }
      console.warn('External vision service failed, falling back to Gemini.', error);
    }
  }

  return analyzeWithGemini(image);
}
