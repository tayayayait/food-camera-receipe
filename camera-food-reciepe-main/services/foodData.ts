import type { NutrientProfile } from '../types';

export interface FoodDataEntry {
  aliases: string[];
  description: string;
  sourceId: string;
  citation: string;
  defaultPortionGrams: number;
  portionEquivalents?: Record<string, number>;
  nutrientsPer100g: NutrientProfile;
}

export const foodData: FoodDataEntry[] = [
  {
    aliases: ['chicken breast', 'chicken'],
    description: 'Chicken, breast, meat only, cooked, roasted',
    sourceId: 'FDC:173686',
    citation:
      'USDA FoodData Central, FDC ID 173686 (Chicken, breast, meat only, cooked, roasted)',
    defaultPortionGrams: 100,
    portionEquivalents: {
      piece: 120,
      serving: 85,
    },
    nutrientsPer100g: { calories: 165, protein: 31, carbs: 0, fat: 3.6 },
  },
  {
    aliases: ['salmon'],
    description: 'Salmon, Atlantic, farmed, cooked, dry heat',
    sourceId: 'FDC:152356',
    citation: 'USDA FoodData Central, FDC ID 152356 (Salmon, Atlantic, farmed, cooked, dry heat)',
    defaultPortionGrams: 100,
    portionEquivalents: {
      fillet: 170,
      piece: 170,
      serving: 85,
    },
    nutrientsPer100g: { calories: 206, protein: 22.1, carbs: 0, fat: 12.3 },
  },
  {
    aliases: ['egg', 'eggs'],
    description: 'Egg, whole, large, raw, fresh',
    sourceId: 'FDC:171688',
    citation: 'USDA FoodData Central, FDC ID 171688 (Egg, whole, large, raw, fresh)',
    defaultPortionGrams: 50,
    portionEquivalents: {
      piece: 50,
      large: 50,
    },
    nutrientsPer100g: { calories: 143, protein: 12.6, carbs: 0.7, fat: 9.5 },
  },
  {
    aliases: ['tofu'],
    description: 'Tofu, firm, prepared with calcium sulfate',
    sourceId: 'FDC:175164',
    citation:
      'USDA FoodData Central, FDC ID 175164 (Tofu, firm, prepared with calcium sulfate)',
    defaultPortionGrams: 100,
    portionEquivalents: {
      cup: 126,
      serving: 85,
    },
    nutrientsPer100g: { calories: 144, protein: 15.7, carbs: 3.4, fat: 8.7 },
  },
  {
    aliases: ['broccoli'],
    description: 'Broccoli, raw',
    sourceId: 'FDC:1102657',
    citation: 'USDA FoodData Central, FDC ID 1102657 (Broccoli, raw)',
    defaultPortionGrams: 91,
    portionEquivalents: {
      cup: 91,
      serving: 85,
    },
    nutrientsPer100g: { calories: 34, protein: 2.8, carbs: 6.6, fat: 0.4 },
  },
  {
    aliases: ['spinach'],
    description: 'Spinach, raw',
    sourceId: 'FDC:1147259',
    citation: 'USDA FoodData Central, FDC ID 1147259 (Spinach, raw)',
    defaultPortionGrams: 30,
    portionEquivalents: {
      cup: 30,
      serving: 85,
    },
    nutrientsPer100g: { calories: 23, protein: 2.9, carbs: 3.6, fat: 0.4 },
  },
  {
    aliases: ['tomato', 'tomatoes'],
    description: 'Tomatoes, red, ripe, raw, year round average',
    sourceId: 'FDC:170494',
    citation:
      'USDA FoodData Central, FDC ID 170494 (Tomatoes, red, ripe, raw, year round average)',
    defaultPortionGrams: 123,
    portionEquivalents: {
      medium: 123,
      piece: 123,
      cup: 180,
    },
    nutrientsPer100g: { calories: 18, protein: 0.9, carbs: 3.9, fat: 0.2 },
  },
  {
    aliases: ['potato', 'potatoes'],
    description: 'Potatoes, russet, flesh and skin, baked',
    sourceId: 'FDC:171714',
    citation: 'USDA FoodData Central, FDC ID 171714 (Potatoes, russet, flesh and skin, baked)',
    defaultPortionGrams: 173,
    portionEquivalents: {
      medium: 173,
      piece: 173,
    },
    nutrientsPer100g: { calories: 93, protein: 2.6, carbs: 21, fat: 0.1 },
  },
  {
    aliases: ['rice', 'cooked rice'],
    description: 'Rice, white, long-grain, cooked',
    sourceId: 'FDC:1097499',
    citation: 'USDA FoodData Central, FDC ID 1097499 (Rice, white, long-grain, cooked)',
    defaultPortionGrams: 158,
    portionEquivalents: {
      cup: 158,
      tablespoon: 12.3,
      serving: 158,
    },
    nutrientsPer100g: { calories: 130, protein: 2.4, carbs: 28.2, fat: 0.3 },
  },
  {
    aliases: ['pasta'],
    description: 'Macaroni, cooked, enriched',
    sourceId: 'FDC:1100020',
    citation: 'USDA FoodData Central, FDC ID 1100020 (Macaroni, cooked, enriched)',
    defaultPortionGrams: 140,
    portionEquivalents: {
      cup: 140,
      serving: 140,
    },
    nutrientsPer100g: { calories: 131, protein: 5.2, carbs: 24.9, fat: 1.1 },
  },
  {
    aliases: ['bread'],
    description: 'Bread, whole-wheat, commercially prepared',
    sourceId: 'FDC:1750323',
    citation:
      'USDA FoodData Central, FDC ID 1750323 (Bread, whole-wheat, commercially prepared)',
    defaultPortionGrams: 28,
    portionEquivalents: {
      slice: 28,
      piece: 28,
    },
    nutrientsPer100g: { calories: 247, protein: 13, carbs: 41, fat: 4.2 },
  },
  {
    aliases: ['cheese', 'cheddar'],
    description: 'Cheese, cheddar',
    sourceId: 'FDC:170999',
    citation: 'USDA FoodData Central, FDC ID 170999 (Cheese, cheddar)',
    defaultPortionGrams: 28,
    portionEquivalents: {
      slice: 28,
      cup: 113,
      ounce: 28.3495,
    },
    nutrientsPer100g: { calories: 403, protein: 24.9, carbs: 1.3, fat: 33.1 },
  },
  {
    aliases: ['milk'],
    description: 'Milk, reduced fat, 2%',
    sourceId: 'FDC:1089414',
    citation: 'USDA FoodData Central, FDC ID 1089414 (Milk, reduced fat, 2%)',
    defaultPortionGrams: 244,
    portionEquivalents: {
      cup: 244,
      milliliter: 1,
      tablespoon: 15,
    },
    nutrientsPer100g: { calories: 50, protein: 3.3, carbs: 4.8, fat: 1.9 },
  },
  {
    aliases: ['yogurt', 'greek yogurt'],
    description: 'Yogurt, Greek, plain, nonfat',
    sourceId: 'FDC:173706',
    citation: 'USDA FoodData Central, FDC ID 173706 (Yogurt, Greek, plain, nonfat)',
    defaultPortionGrams: 170,
    portionEquivalents: {
      cup: 245,
      container: 170,
      serving: 170,
    },
    nutrientsPer100g: { calories: 59, protein: 10.3, carbs: 3.6, fat: 0.4 },
  },
  {
    aliases: ['banana'],
    description: 'Bananas, raw',
    sourceId: 'FDC:1102655',
    citation: 'USDA FoodData Central, FDC ID 1102655 (Bananas, raw)',
    defaultPortionGrams: 118,
    portionEquivalents: {
      medium: 118,
      piece: 118,
      large: 136,
      small: 101,
    },
    nutrientsPer100g: { calories: 89, protein: 1.1, carbs: 22.8, fat: 0.3 },
  },
  {
    aliases: ['apple'],
    description: 'Apples, raw, with skin',
    sourceId: 'FDC:1102647',
    citation: 'USDA FoodData Central, FDC ID 1102647 (Apples, raw, with skin)',
    defaultPortionGrams: 182,
    portionEquivalents: {
      medium: 182,
      piece: 182,
      large: 223,
      small: 149,
    },
    nutrientsPer100g: { calories: 52, protein: 0.3, carbs: 13.8, fat: 0.2 },
  },
  {
    aliases: ['carrot', 'carrots'],
    description: 'Carrots, raw',
    sourceId: 'FDC:1102643',
    citation: 'USDA FoodData Central, FDC ID 1102643 (Carrots, raw)',
    defaultPortionGrams: 61,
    portionEquivalents: {
      medium: 61,
      piece: 61,
      cup: 128,
    },
    nutrientsPer100g: { calories: 41, protein: 0.9, carbs: 9.6, fat: 0.2 },
  },
  {
    aliases: ['bell pepper', 'capsicum'],
    description: 'Peppers, sweet, red, raw',
    sourceId: 'FDC:168394',
    citation: 'USDA FoodData Central, FDC ID 168394 (Peppers, sweet, red, raw)',
    defaultPortionGrams: 119,
    portionEquivalents: {
      medium: 119,
      piece: 119,
      cup: 149,
    },
    nutrientsPer100g: { calories: 31, protein: 1, carbs: 6, fat: 0.3 },
  },
  {
    aliases: ['onion', 'onions'],
    description: 'Onions, yellow, raw',
    sourceId: 'FDC:1102047',
    citation: 'USDA FoodData Central, FDC ID 1102047 (Onions, yellow, raw)',
    defaultPortionGrams: 110,
    portionEquivalents: {
      medium: 110,
      piece: 110,
      cup: 160,
    },
    nutrientsPer100g: { calories: 40, protein: 1.1, carbs: 9.3, fat: 0.1 },
  },
  {
    aliases: ['garlic'],
    description: 'Garlic, raw',
    sourceId: 'FDC:171686',
    citation: 'USDA FoodData Central, FDC ID 171686 (Garlic, raw)',
    defaultPortionGrams: 3,
    portionEquivalents: {
      clove: 3,
    },
    nutrientsPer100g: { calories: 149, protein: 6.4, carbs: 33.1, fat: 0.5 },
  },
  {
    aliases: ['mushroom', 'mushrooms'],
    description: 'Mushrooms, white, raw',
    sourceId: 'FDC:1102707',
    citation: 'USDA FoodData Central, FDC ID 1102707 (Mushrooms, white, raw)',
    defaultPortionGrams: 96,
    portionEquivalents: {
      cup: 96,
      piece: 18,
    },
    nutrientsPer100g: { calories: 22, protein: 3.1, carbs: 3.3, fat: 0.3 },
  },
  {
    aliases: ['shrimp'],
    description: 'Shrimp, cooked, moist heat',
    sourceId: 'FDC:171707',
    citation: 'USDA FoodData Central, FDC ID 171707 (Shrimp, cooked, moist heat)',
    defaultPortionGrams: 85,
    portionEquivalents: {
      serving: 85,
      piece: 16,
      cup: 145,
    },
    nutrientsPer100g: { calories: 99, protein: 24, carbs: 0.2, fat: 0.3 },
  },
];
