import { GoogleGenAI, Type } from '@google/genai';
import type { Recipe } from '../types';

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

const singleRecipeSchema = {
    type: Type.OBJECT,
    properties: {
        recipeName: {
            type: Type.STRING,
            description: 'The name of the recipe.',
        },
        description: {
            type: Type.STRING,
            description: 'A short, enticing description of the dish.',
        },
        ingredientsNeeded: {
            type: Type.ARRAY,
            items: {
                type: Type.STRING,
            },
            description:
                'A list of common ingredients needed for this recipe. Keep quantities concise and easy to follow.',
        },
        instructions: {
            type: Type.ARRAY,
            items: {
                type: Type.STRING,
            },
            description:
                'Step-by-step cooking directions written in concise sentences that a middle school student can follow.',
        },
    },
    required: ['recipeName', 'description', 'ingredientsNeeded', 'instructions'],
};

interface VideoRecipeContextInput {
    videoId: string;
    videoTitle?: string;
    channelTitle?: string;
    contextText: string;
}

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
            contents: [
                {
                    role: 'user',
                    parts: [{ text: prompt }],
                },
            ],
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

export function buildVideoRecipePrompt(metadataLines: string): string {
    return `You are a culinary assistant that transforms YouTube cooking video context into structured recipes. Use only the provided context from the video to infer the dish name, a short enticing description, ingredients, and clear numbered instructions (at least four steps). Keep the instructions in the exact order they appear in the supplied description or transcript and do not regroup, merge, split, or renumber steps.

Do not invent or assume details beyond the supplied context. If any field cannot be determined, set recipeName and description to "Not specified in video context" and return an array containing "Not specified in video context" for ingredientsNeeded or instructions when necessary.

Context to analyse:
${metadataLines}

Return only JSON matching the schema.`;
}

export async function getRecipeFromVideoContext({
    videoId,
    videoTitle,
    channelTitle,
    contextText,
}: VideoRecipeContextInput): Promise<Recipe> {
    if (!GEMINI_API_KEY || !ai) {
        throw new Error('error_gemini_api_key');
    }

    const sanitizedContext = contextText.trim();

    const metadataLines = [
        videoTitle ? `Video Title: ${videoTitle}` : null,
        channelTitle ? `Channel: ${channelTitle}` : null,
        `YouTube Video ID: ${videoId}`,
        sanitizedContext
            ? `Video Context (description, transcript excerpts, comments):\n${sanitizedContext}`
            : 'Video Context: (no transcript or description available)',
    ]
        .filter((line): line is string => Boolean(line))
        .join('\n\n');

    const prompt = buildVideoRecipePrompt(metadataLines);

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
                responseSchema: singleRecipeSchema,
                temperature: 0.5,
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
            throw new Error('error_gemini_video_recipe');
        }

        const recipe = JSON.parse(trimmedJson) as Recipe;
        return {
            ...recipe,
            ingredientsNeeded: Array.isArray(recipe.ingredientsNeeded)
                ? recipe.ingredientsNeeded.map(item => String(item).trim()).filter(Boolean)
                : [],
            instructions: Array.isArray(recipe.instructions)
                ? recipe.instructions.map(step => String(step).trim()).filter(Boolean)
                : [],
        };
    } catch (error) {
        console.error('Error generating recipe from video context via Gemini API:', error);
        if (error instanceof Error && error.message.startsWith('error_')) {
            throw error;
        }
        throw new Error('error_gemini_video_recipe');
    }
}