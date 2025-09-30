export const parseIngredientInput = (text: string): string[] => {
  if (!text) {
    return [];
  }

  const trimmed = text.trim();
  if (!trimmed) {
    return [];
  }

  const primarySeparators = /[\n,;·]/;
  const hasPrimarySeparator = primarySeparators.test(trimmed);
  const splitter = hasPrimarySeparator ? /[\n,;·]+/ : /\s+/;

  return trimmed
    .split(splitter)
    .map(entry => entry.trim())
    .filter(entry => entry.length > 0);
};

export const sanitizeIngredients = (rawIngredients: string[]): string[] => {
  const seen = new Set<string>();
  const sanitized: string[] = [];

  rawIngredients.forEach(ingredient => {
    const trimmed = ingredient.trim();
    if (!trimmed) return;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    sanitized.push(trimmed);
  });

  return sanitized;
};
