import { GoogleGenAI, Type } from '@google/genai';

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

export async function generateDesignPreview(ingredients: string[]): Promise<string> {
  if (!GEMINI_API_KEY || !ai) {
    throw new Error('error_gemini_api_key');
  }

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
}
