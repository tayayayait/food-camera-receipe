import { GoogleGenAI, Type } from '@google/genai';
import type { Recipe, RecipeRecommendation, RecipeVideo } from '../types';

const GEMINI_API_KEY =
  (process.env.GEMINI_API_KEY as string | undefined) ?? (process.env.API_KEY as string | undefined);

const ai = GEMINI_API_KEY ? new GoogleGenAI({ apiKey: GEMINI_API_KEY }) : null;

const videoRecipeSchema = {
  type: Type.OBJECT,
  properties: {
    recipeName: {
      type: Type.STRING,
      description: 'Name of the dish featured in the selected video.',
    },
    description: {
      type: Type.STRING,
      description: 'A short summary that reflects the tone of the referenced video.',
    },
    ingredientsNeeded: {
      type: Type.ARRAY,
      description:
        'Ordered list of additional ingredients (beyond the detected pantry items) required to follow the selected video.',
      items: {
        type: Type.STRING,
      },
    },
    instructions: {
      type: Type.ARRAY,
      description:
        'Step-by-step cooking instructions distilled from the video. Each step must be concise and actionable.',
      items: {
        type: Type.STRING,
      },
    },
  },
  required: ['recipeName', 'description', 'ingredientsNeeded', 'instructions'],
} as const;

interface GenerateVideoRecipeOptions {
  video: RecipeVideo;
  baseRecipe?: RecipeRecommendation | null;
  pantryIngredients?: string[];
}

export async function generateVideoRecipe({
  video,
  baseRecipe = null,
  pantryIngredients = [],
}: GenerateVideoRecipeOptions): Promise<Recipe> {
  if (!ai || !GEMINI_API_KEY) {
    throw new Error('error_gemini_api_key');
  }

  const videoTitle = video.title.trim();
  const channelTitle = video.channelTitle.trim();
  const videoUrl = video.videoUrl.trim();

  const baseIngredients = (baseRecipe?.ingredientsNeeded ?? []).filter(Boolean);
  const baseInstructions = (baseRecipe?.instructions ?? []).filter(step => step && step.trim().length > 0);
  const pantryList = pantryIngredients.filter(Boolean);

  const baseInstructionText =
    baseInstructions.length > 0
      ? baseInstructions.map((step, index) => `${index + 1}. ${step.trim()}`).join('\n')
      : '없음';

  const prompt = `당신은 요리 영상을 텍스트 레시피로 정리하는 어시스턴트입니다.\n\n` +
    `선택된 영상 정보:\n- 제목: ${videoTitle}\n- 채널: ${channelTitle}\n- URL: ${videoUrl}\n\n` +
    `사용자가 사용할 수 있는 재료: ${pantryList.length > 0 ? pantryList.join(', ') : '주요 재료 정보 없음'}\n` +
    `기존 추천 레시피에서 참고할 수 있는 추가 재료: ${
      baseIngredients.length > 0 ? baseIngredients.join(', ') : '정보 없음'
    }\n` +
    `기존 추천 레시피의 단계:\n${baseInstructionText}\n\n` +
    '영상을 실제로 본 것처럼 자연스러운 톤으로 작성하되, 가정에서 따라 할 수 있도록 세부 단계를 분명하게 정리하세요. ' +
    '각 단계는 반드시 명령문으로 시작하고, 영상에서 강조할 만한 팁이나 주의사항이 있다면 간단히 덧붙입니다. ' +
    '추가 재료 목록은 영상에서 언급할 법한 기본 재료 위주로 구성하고, 중복되거나 이미 사용자가 가지고 있는 재료는 제외하세요. ' +
    '응답은 JSON 형식으로만 반환합니다.';

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: videoRecipeSchema,
        temperature: 0.6,
      },
    });

    let jsonText: string | undefined = response.text;

    if (!jsonText) {
      const fallback = (response as { output_text?: string | undefined }).output_text;
      if (typeof fallback === 'string') {
        jsonText = fallback;
      }
    }

    const trimmed = jsonText?.trim();
    if (!trimmed) {
      throw new Error('error_video_recipe_fetch');
    }

    const recipe = JSON.parse(trimmed) as Recipe;
    return {
      ...recipe,
      ingredientsNeeded: Array.isArray(recipe.ingredientsNeeded)
        ? recipe.ingredientsNeeded.map(entry => String(entry).trim()).filter(Boolean)
        : [],
      instructions: Array.isArray(recipe.instructions)
        ? recipe.instructions.map(step => String(step).trim()).filter(Boolean)
        : [],
    };
  } catch (error) {
    console.error('Failed to generate recipe from video', error);
    if (error instanceof Error && error.message === 'error_gemini_api_key') {
      throw error;
    }
    throw new Error('error_video_recipe_fetch');
  }
}
