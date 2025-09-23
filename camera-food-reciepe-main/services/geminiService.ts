import { GoogleGenAI, Type } from '@google/genai';
import type { Recipe } from '../types';

const API_KEY = process.env.API_KEY as string | undefined;

const ai = API_KEY ? new GoogleGenAI({ apiKey: API_KEY }) : null;

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
        },
        required: ['recipeName', 'description', 'ingredientsNeeded'],
    }
};

export async function getRecipeSuggestions(ingredients: string[], language: 'en' | 'ko'): Promise<Recipe[]> {
    if (!API_KEY || !ai) {
        throw new Error('error_gemini_api_key');
    }
    if (ingredients.length === 0) {
        return [];
    }

    const prompt = language === 'ko'
    ? `제 주방에 다음 재료들이 있습니다: ${ingredients.join(', ')}. 이 재료들을 활용하는 간단한 레시피 3가지를 추천해 주세요. 각 레시피에 대해 이름, 간단하고 매력적인 설명, 그리고 필요할 수 있는 다른 일반적인 재료 목록을 응답으로 주세요.`
    : `I have the following ingredients in my kitchen: ${ingredients.join(', ')}. Suggest 3 friendly recipes that highlight these ingredients. For each recipe respond with a name, a short and encouraging description, and a list of other common household ingredients I might need.`;


    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: recipeSchema,
                temperature: 0.7,
            },
        });

        const jsonText = response.text.trim();
        const recipes: Recipe[] = JSON.parse(jsonText);
        return recipes;
    } catch (error) {
        console.error('Error fetching recipe suggestions from Gemini API:', error);
        throw new Error('error_gemini_fetch');
    }
}