import { describe, expect, it } from 'vitest';
import { parseIngredientInput, sanitizeIngredients } from './ingredientParser';

describe('parseIngredientInput', () => {
  it('splits text by punctuation and newlines', () => {
    const input = 'onion, garlic\npepper; basil · thyme';
    expect(parseIngredientInput(input)).toEqual(['onion', 'garlic', 'pepper', 'basil', 'thyme']);
  });

  it('falls back to whitespace splitting when delimiters are absent', () => {
    const input = 'apple banana   carrot';
    expect(parseIngredientInput(input)).toEqual(['apple', 'banana', 'carrot']);
  });

  it('integrates with sanitizeIngredients to deduplicate and trim entries', () => {
    const spaceSeparated = 'eggplant   tomato  tomato';
    const mixedSeparated = 'milk, cream\nbutter; yogurt · cream';

    expect(sanitizeIngredients(parseIngredientInput(spaceSeparated)).length).toBe(2);
    expect(sanitizeIngredients(parseIngredientInput(mixedSeparated)).length).toBe(4);
  });
});
