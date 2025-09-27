import type {
  NutritionBreakdownEntry,
  NutritionDataQuality,
  NutritionSummary,
  NutrientProfile,
} from '../types';
import { foodData } from './foodData';

interface ParsedIngredient {
  quantity: number;
  quantityText?: string;
  unit?: string;
  unitText?: string;
  name: string;
  original: string;
}

interface FoodMatch {
  entry: (typeof foodData)[number];
  matchType: 'exact' | 'partial';
}

interface PortionResult {
  grams: number;
  dataQuality: NutritionDataQuality;
  portionText: string;
  note?: string;
}

const round = (value: number) => Math.round(value * 10) / 10;

const cleanName = (name: string) =>
  name
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/[^a-z가-힣0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const canonicalUnitMap: Record<string, string> = {
  g: 'gram',
  gram: 'gram',
  grams: 'gram',
  kilogram: 'kilogram',
  kilograms: 'kilogram',
  kg: 'kilogram',
  milligram: 'milligram',
  milligrams: 'milligram',
  mg: 'milligram',
  ounce: 'ounce',
  ounces: 'ounce',
  oz: 'ounce',
  pound: 'pound',
  pounds: 'pound',
  lb: 'pound',
  lbs: 'pound',
  milliliter: 'milliliter',
  milliliters: 'milliliter',
  ml: 'milliliter',
  liter: 'liter',
  liters: 'liter',
  l: 'liter',
  cup: 'cup',
  cups: 'cup',
  tablespoon: 'tablespoon',
  tablespoons: 'tablespoon',
  tbsp: 'tablespoon',
  teaspoon: 'teaspoon',
  teaspoons: 'teaspoon',
  tsp: 'teaspoon',
  serving: 'serving',
  servings: 'serving',
  slice: 'slice',
  slices: 'slice',
  piece: 'piece',
  pieces: 'piece',
  fillet: 'fillet',
  fillets: 'fillet',
  clove: 'clove',
  cloves: 'clove',
  container: 'container',
  containers: 'container',
  medium: 'medium',
  large: 'large',
  small: 'small',
};

const baseUnitToGrams: Record<string, number> = {
  gram: 1,
  kilogram: 1000,
  milligram: 0.001,
  ounce: 28.3495,
  pound: 453.592,
  milliliter: 1,
  liter: 1000,
};

const unicodeFractionToAscii: Record<string, string> = {
  '¼': '1/4',
  '½': '1/2',
  '¾': '3/4',
  '⅓': '1/3',
  '⅔': '2/3',
  '⅛': '1/8',
  '⅜': '3/8',
  '⅝': '5/8',
  '⅞': '7/8',
};

const phraseNumberMap: Record<string, number> = {
  'one and a half': 1.5,
  'one and one half': 1.5,
  'one and half': 1.5,
  'one half': 0.5,
  'one third': 1 / 3,
  'two thirds': 2 / 3,
  'three quarters': 0.75,
  'three quarter': 0.75,
  'a half': 0.5,
  'a quarter': 0.25,
};

const wordNumberMap: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  dozen: 12,
  half: 0.5,
  quarter: 0.25,
  a: 1,
  an: 1,
};

const fractionPattern = /^([0-9]+)\s+([0-9]+\/[0-9]+)$/;

const parseFraction = (input: string): number | null => {
  const [numerator, denominator] = input.split('/').map(Number);
  if (!Number.isNaN(numerator) && !Number.isNaN(denominator) && denominator !== 0) {
    return numerator / denominator;
  }
  return null;
};

const extractQuantity = (tokensLower: string[], tokensOriginal: string[]) => {
  let quantity: number | undefined;
  let usedTokens = 0;
  let quantityText = '';

  const maxPhraseLength = Math.min(3, tokensLower.length);
  for (let length = maxPhraseLength; length >= 2; length -= 1) {
    const phrase = tokensLower.slice(0, length).join(' ');
    if (phraseNumberMap[phrase] !== undefined) {
      quantity = phraseNumberMap[phrase];
      usedTokens = length;
      quantityText = tokensOriginal.slice(0, length).join(' ');
      break;
    }
  }

  if (quantity === undefined && tokensLower.length > 0) {
    const first = tokensLower[0];

    if (wordNumberMap[first] !== undefined) {
      quantity = wordNumberMap[first];
      usedTokens = 1;
      quantityText = tokensOriginal[0];
    }
  }

  if (quantity === undefined && tokensLower.length > 0) {
    const combinedFraction = tokensLower[0].match(fractionPattern);
    if (combinedFraction) {
      const whole = Number.parseFloat(combinedFraction[1]);
      const fractionValue = parseFraction(combinedFraction[2]);
      if (!Number.isNaN(whole) && fractionValue !== null) {
        quantity = whole + fractionValue;
        usedTokens = 2;
        quantityText = tokensOriginal.slice(0, 2).join(' ');
      }
    }
  }

  if (quantity === undefined && tokensLower.length >= 2) {
    const [first, second] = tokensLower;
    if (/^[0-9]+$/.test(first) && /^[0-9]+\/[0-9]+$/.test(second)) {
      const whole = Number.parseInt(first, 10);
      const fractionValue = parseFraction(second);
      if (!Number.isNaN(whole) && fractionValue !== null) {
        quantity = whole + fractionValue;
        usedTokens = 2;
        quantityText = tokensOriginal.slice(0, 2).join(' ');
      }
    }
  }

  if (quantity === undefined && tokensLower.length > 0) {
    const first = tokensLower[0].replace(',', '.');
    if (/^[0-9]+(\.[0-9]+)?$/.test(first)) {
      quantity = Number.parseFloat(first);
      usedTokens = 1;
      quantityText = tokensOriginal[0];
    }
  }

  if (quantity === undefined && tokensLower.length > 0 && /^[0-9]+\/[0-9]+$/.test(tokensLower[0])) {
    const fractionValue = parseFraction(tokensLower[0]);
    if (fractionValue !== null) {
      quantity = fractionValue;
      usedTokens = 1;
      quantityText = tokensOriginal[0];
    }
  }

  return {
    quantity,
    usedTokens,
    quantityText,
  };
};

const parseIngredientString = (input: string): ParsedIngredient => {
  let normalized = input.trim();
  normalized = normalized.replace(/\((.*?)\)/g, ' ');
  normalized = normalized.replace(/[\u2012-\u2015]/g, '-');
  normalized = normalized.replace(/(\d)-(\d\/[0-9]+)/g, '$1 $2');
  normalized = normalized.replace(/([0-9])([a-zA-Z가-힣])/g, '$1 $2');
  normalized = normalized.replace(/([a-zA-Z가-힣])([0-9])/g, '$1 $2');
  normalized = normalized.replace(/[¼½¾⅓⅔⅛⅜⅝⅞]/g, match => ` ${unicodeFractionToAscii[match]} `);
  normalized = normalized.replace(/\s+/g, ' ').trim();

  const originalTokens = normalized.split(' ').filter(Boolean);
  const tokensLower = originalTokens.map(token => token.toLowerCase());

  const { quantity, usedTokens, quantityText } = extractQuantity(tokensLower, originalTokens);

  let index = usedTokens;
  let unit: string | undefined;
  let unitText: string | undefined;

  if (tokensLower[index]) {
    const canonical = canonicalUnitMap[tokensLower[index]];
    if (canonical) {
      unit = canonical;
      unitText = originalTokens[index];
      index += 1;
    }
  }

  if (tokensLower[index] === 'of') {
    index += 1;
  }

  const nameTokens = originalTokens.slice(index);
  const name = nameTokens.join(' ').trim() || input.trim();

  return {
    quantity: quantity ?? 1,
    quantityText,
    unit,
    unitText,
    name,
    original: input,
  };
};

const findFoodMatch = (ingredient: ParsedIngredient): FoodMatch | null => {
  const cleaned = cleanName(ingredient.name);

  for (const entry of foodData) {
    if (entry.aliases.some(alias => cleanName(alias) === cleaned)) {
      return { entry, matchType: 'exact' };
    }
  }

  for (const entry of foodData) {
    if (entry.aliases.some(alias => cleaned.includes(cleanName(alias)))) {
      return { entry, matchType: 'partial' };
    }
  }

  return null;
};

const scaleProfile = (per100g: NutrientProfile, grams: number): NutrientProfile => {
  const multiplier = grams / 100;
  return {
    calories: round(per100g.calories * multiplier),
    protein: round(per100g.protein * multiplier),
    carbs: round(per100g.carbs * multiplier),
    fat: round(per100g.fat * multiplier),
  };
};

const determinePortion = (
  parsed: ParsedIngredient,
  match: FoodMatch,
): PortionResult => {
  const { entry } = match;
  const { quantity, unit, unitText, quantityText } = parsed;
  const normalizedQuantityText = quantityText ?? String(round(quantity));

  if (unit && baseUnitToGrams[unit] !== undefined) {
    const grams = quantity * baseUnitToGrams[unit];
    const portionText = `${normalizedQuantityText} ${unitText ?? unit} (${round(grams)} g)`;
    return { grams, dataQuality: 'authoritative', portionText };
  }

  if (unit && entry.portionEquivalents?.[unit] !== undefined) {
    const grams = quantity * entry.portionEquivalents[unit];
    const portionText = `${normalizedQuantityText} ${unitText ?? unit} ≈ ${round(grams)} g`;
    return { grams, dataQuality: 'authoritative', portionText };
  }

  if (unit && unit === 'serving' && entry.portionEquivalents?.serving !== undefined) {
    const grams = quantity * entry.portionEquivalents.serving;
    const portionText = `${normalizedQuantityText} ${unitText ?? unit} ≈ ${round(grams)} g`;
    return { grams, dataQuality: 'authoritative', portionText };
  }

  if (unit && unit === 'fillet' && entry.portionEquivalents?.fillet !== undefined) {
    const grams = quantity * entry.portionEquivalents.fillet;
    const portionText = `${normalizedQuantityText} ${unitText ?? unit} ≈ ${round(grams)} g`;
    return { grams, dataQuality: 'authoritative', portionText };
  }

  if (unit && entry.portionEquivalents?.piece !== undefined && ['piece', 'medium', 'large', 'small'].includes(unit)) {
    const specificUnitGrams = entry.portionEquivalents[unit] ?? entry.portionEquivalents.piece;
    if (specificUnitGrams !== undefined) {
      const grams = quantity * specificUnitGrams;
      const portionText = `${normalizedQuantityText} ${unitText ?? unit} ≈ ${round(grams)} g`;
      return { grams, dataQuality: 'authoritative', portionText };
    }
  }

  const grams = quantity * entry.defaultPortionGrams;
  const inferredText = quantity === 1
    ? `USDA reference portion ≈ ${round(grams)} g`
    : `${normalizedQuantityText} × USDA reference portion ≈ ${round(grams)} g`;

  const note = unit
    ? `Unable to convert unit "${unitText ?? unit}"; used USDA reference weight.`
    : undefined;

  return { grams, dataQuality: 'derived', portionText: inferredText, note };
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
    const parsed = parseIngredientString(ingredient);
    const match = findFoodMatch(parsed);

    if (!match) {
      breakdown.push({
        ingredient,
        dataQuality: 'missing',
        note: 'No USDA FoodData Central record matched this ingredient.',
      });
      return acc;
    }

    const portion = determinePortion(parsed, match);
    const profile = scaleProfile(match.entry.nutrientsPer100g, portion.grams);
    const baseQuality = match.matchType === 'exact' ? portion.dataQuality : 'derived';
    const notes: string[] = [];

    if (portion.note) {
      notes.push(portion.note);
    }

    if (match.matchType === 'partial') {
      notes.push('Matched USDA entry using a partial name similarity.');
    }

    breakdown.push({
      ingredient,
      profile,
      portionGrams: round(portion.grams),
      portionText: portion.portionText,
      sourceCitation: match.entry.citation,
      sourceId: match.entry.sourceId,
      dataQuality: baseQuality,
      note: notes.length ? notes.join(' ') : undefined,
    });

    return sumProfiles(acc, profile);
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
