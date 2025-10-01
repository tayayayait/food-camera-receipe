import { GoogleGenAI, Type } from '@google/genai';
import type { Recipe, RecipeRecommendation, RecipeVideo } from '../types';

const GEMINI_API_KEY =
  (process.env.GEMINI_API_KEY as string | undefined) ?? (process.env.API_KEY as string | undefined);

const ai = GEMINI_API_KEY ? new GoogleGenAI({ apiKey: GEMINI_API_KEY }) : null;

const recipeSchema = {
    type: Type.ARRAY,
    items: {
        type: Type.OBJECT,
        properties: {
            recipeName: {
                type: Type.STRING,
                description: 'The name of the recipe.',
            },
            description: {
                type: Type.STRING,
                description: 'A short, enticing description of the dish.'
            },
            ingredientsNeeded: {
                type: Type.ARRAY,
                items: {
                    type: Type.STRING,
                },
                description: 'A list of other common ingredients needed for this recipe, excluding the ones provided by the user.',
            },
            instructions: {
                type: Type.ARRAY,
                items: {
                    type: Type.STRING,
                },
                description: 'Step-by-step cooking directions that are easy for a middle school student to follow.',
            },
        },
        required: ['recipeName', 'description', 'ingredientsNeeded', 'instructions'],
    }
};

export async function getRecipeSuggestions(ingredients: string[]): Promise<Recipe[]> {
    if (!GEMINI_API_KEY || !ai) {
        throw new Error('error_gemini_api_key');
    }
    if (ingredients.length === 0) {
        return [];
    }

    const prompt = `제 주방에 다음 재료들이 있습니다: ${ingredients.join(', ')}. 이 재료들을 활용하는 레시피 3가지를 추천해 주세요. 각 레시피는 반드시 다음 정보를 포함해야 합니다.\n- 레시피 이름\n- 완성 결과가 훌륭해 보이도록 유도하는 짧고 설레는 설명\n- 제공된 재료 외에 필요할 수 있는 다른 흔한 재료 목록\n- 중학생도 따라 할 수 있을 만큼 간단하고 명확한 문장으로 작성된 단계별 조리법 (최소 4단계, 각 단계는 성공을 위한 팁 포함)\n\n단계는 순서를 지키면 완성도가 높아지도록 구성하고, 응답은 JSON 형식만 반환하세요.`;


    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: recipeSchema,
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

        const trimmedJson = jsonText?.trim();

        if (!trimmedJson) {
            throw new Error('error_gemini_fetch');
        }

        const recipes: Recipe[] = JSON.parse(trimmedJson);
        return recipes.map(recipe => ({
            ...recipe,
            instructions: Array.isArray(recipe.instructions)
                ? recipe.instructions.map(step => String(step).trim()).filter(Boolean)
                : [],
        }));
    } catch (error) {
        console.error('Error fetching recipe suggestions from Gemini API:', error);
        throw new Error('error_gemini_fetch');
    }
}

const videoInstructionSchema = {
    type: Type.ARRAY,
    items: {
        type: Type.STRING,
    },
};

type RecipeVideoContext = Pick<
    RecipeRecommendation,
    'recipeName' | 'description' | 'instructions' | 'ingredientsNeeded'
>;

const sanitizeList = (items: string[]): string[] =>
    items
        .map(item => item.trim())
        .filter(item => item.length > 0)
        .slice(0, 16);

export async function generateInstructionsFromVideo(
    video: RecipeVideo,
    availableIngredients: string[],
    recipeContext: RecipeVideoContext
): Promise<string[]> {
    if (!GEMINI_API_KEY || !ai) {
        throw new Error('error_gemini_api_key');
    }

    const safeIngredients = sanitizeList(availableIngredients);
    const safeExistingInstructions = sanitizeList(recipeContext.instructions ?? []);
    const safeRecipeIngredients = sanitizeList(recipeContext.ingredientsNeeded ?? []);

    const prompt = `당신은 전문 요리 어시스턴트입니다. 아래 YouTube 영상을 참고하여 레시피 단계를 재구성하세요.

영상 정보:
- 제목: ${video.title}
- 채널: ${video.channelTitle}
- URL: ${video.videoUrl}

레시피 이름: ${recipeContext.recipeName}
레시피 설명: ${recipeContext.description ?? '설명 없음'}
기존 조리 단계:
${safeExistingInstructions.length ? safeExistingInstructions.map((step, index) => `${index + 1}. ${step}`).join('\n') : '기존 단계 없음'}

현재 사용자가 가진 재료: ${safeIngredients.length ? safeIngredients.join(', ') : '재료 정보 없음'}
레시피에 권장된 재료: ${safeRecipeIngredients.length ? safeRecipeIngredients.join(', ') : '추가 정보 없음'}

요청 사항:
1. 영상 흐름을 따르되, 집에서 따라 하기 쉽게 한국어로 설명하세요.
2. 4~8단계로 구성하고, 각 단계는 "번호. 설명" 형태로 작성하세요.
3. 영상에서 참고하면 좋을 만한 팁이나 주의 사항이 있다면 설명에 함께 포함하세요.
4. 응답은 JSON 배열 형식만 반환하세요.`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: videoInstructionSchema,
                temperature: 0.4,
            },
        });

        let jsonText: string | undefined = response.text;

        if (!jsonText) {
            const fallback = (response as { output_text?: string | undefined }).output_text;
            if (typeof fallback === 'string') {
                jsonText = fallback;
            }
        }

        const trimmedJson = jsonText?.trim();

        if (!trimmedJson) {
            throw new Error('error_gemini_fetch');
        }

        const steps: string[] = JSON.parse(trimmedJson);
        return steps.map(step => String(step).trim()).filter(Boolean);
    } catch (error) {
        console.error('Error generating instructions from Gemini API:', error);
        throw new Error('error_gemini_fetch');
    }
}