import type { NutritionSummary, NutrientProfile, NutritionBreakdownEntry } from '../types';

interface NutritionRecord {
  profile: NutrientProfile;
  aliases: string[];
}

const nutritionDatabase: NutritionRecord[] = [
  {
    aliases: ['chicken breast', 'chicken'],
    profile: { calories: 165, protein: 31, carbs: 0, fat: 4 },
  },
  {
    aliases: ['salmon'],
    profile: { calories: 208, protein: 22, carbs: 0, fat: 13 },
  },
  {
    aliases: ['egg', 'eggs'],
    profile: { calories: 78, protein: 6, carbs: 0.6, fat: 5 },
  },
  {
    aliases: ['tofu'],
    profile: { calories: 94, protein: 10, carbs: 2, fat: 6 },
  },
  {
    aliases: ['broccoli'],
    profile: { calories: 55, protein: 3.7, carbs: 11, fat: 0.6 },
  },
  {
    aliases: ['spinach'],
    profile: { calories: 23, protein: 2.9, carbs: 3.6, fat: 0.4 },
  },
  {
    aliases: ['tomato', 'tomatoes'],
    profile: { calories: 22, protein: 1.1, carbs: 4.8, fat: 0.2 },
  },
  {
    aliases: ['potato', 'potatoes'],
    profile: { calories: 161, protein: 4.3, carbs: 36, fat: 0.2 },
  },
  {
    aliases: ['rice', 'cooked rice'],
    profile: { calories: 206, protein: 4.2, carbs: 45, fat: 0.4 },
  },
  {
    aliases: ['pasta'],
    profile: { calories: 221, protein: 8, carbs: 43, fat: 1.3 },
  },
  {
    aliases: ['bread'],
    profile: { calories: 79, protein: 4, carbs: 15, fat: 1 },
  },
  {
    aliases: ['cheese', 'cheddar'],
    profile: { calories: 113, protein: 7, carbs: 0.4, fat: 9 },
  },
  {
    aliases: ['milk'],
    profile: { calories: 103, protein: 8, carbs: 12, fat: 2.4 },
  },
  {
    aliases: ['yogurt', 'greek yogurt'],
    profile: { calories: 100, protein: 17, carbs: 6, fat: 0.7 },
  },
  {
    aliases: ['banana'],
    profile: { calories: 105, protein: 1.3, carbs: 27, fat: 0.3 },
  },
  {
    aliases: ['apple'],
    profile: { calories: 95, protein: 0.5, carbs: 25, fat: 0.3 },
  },
  {
    aliases: ['carrot', 'carrots'],
    profile: { calories: 41, protein: 1, carbs: 10, fat: 0.2 },
  },
  {
    aliases: ['bell pepper', 'capsicum'],
    profile: { calories: 37, protein: 1, carbs: 9, fat: 0.4 },
  },
  {
    aliases: ['onion', 'onions'],
    profile: { calories: 44, protein: 1.2, carbs: 10, fat: 0.1 },
  },
  {
    aliases: ['garlic'],
    profile: { calories: 45, protein: 1.9, carbs: 10, fat: 0.1 },
  },
  {
    aliases: ['mushroom', 'mushrooms'],
    profile: { calories: 44, protein: 6, carbs: 9, fat: 0.3 },
  },
  {
    aliases: ['shrimp'],
    profile: { calories: 84, protein: 18, carbs: 1, fat: 1 },
  },
];

const fallbackProfile: NutrientProfile = { calories: 45, protein: 2, carbs: 9, fat: 1.5 };

const round = (value: number) => Math.round(value * 10) / 10;

const cleanName = (name: string) =>
  name
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/[^a-z가-힣0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const findRecord = (ingredient: string): { entry: NutritionRecord; confidence: 'high' | 'medium' } | null => {
  const cleaned = cleanName(ingredient);

  for (const record of nutritionDatabase) {
    if (record.aliases.some(alias => cleanName(alias) === cleaned)) {
      return { entry: record, confidence: 'high' };
    }
  }

  for (const record of nutritionDatabase) {
    if (record.aliases.some(alias => cleaned.includes(cleanName(alias)))) {
      return { entry: record, confidence: 'medium' };
    }
  }

  return null;
};

const sumProfiles = (target: NutrientProfile, profile: NutrientProfile): NutrientProfile => ({
  calories: round(target.calories + profile.calories),
  protein: round(target.protein + profile.protein),
  carbs: round(target.carbs + profile.carbs),
  fat: round(target.fat + profile.fat),
});

export function estimateNutritionSummary(ingredients: string[]): NutritionSummary {
  const breakdown: NutritionBreakdownEntry[] = [];

  const total = ingredients.reduce<NutrientProfile>((acc, ingredient) => {
    const match = findRecord(ingredient);

    if (match) {
      breakdown.push({ ingredient, profile: match.entry.profile, confidence: match.confidence });
      return sumProfiles(acc, match.entry.profile);
    }

    breakdown.push({ ingredient, profile: fallbackProfile, confidence: 'low' });
    return sumProfiles(acc, fallbackProfile);
  }, { calories: 0, protein: 0, carbs: 0, fat: 0 });

  return {
    total: {
      calories: round(total.calories),
      protein: round(total.protein),
      carbs: round(total.carbs),
      fat: round(total.fat),
    },
    breakdown,
    detectedCount: ingredients.length,
  };
}

export function formatMacro(value: number, unit: 'kcal' | 'g'): string {
  const rounded = unit === 'kcal' ? Math.round(value) : round(value);
  return `${rounded}${unit}`;
}
