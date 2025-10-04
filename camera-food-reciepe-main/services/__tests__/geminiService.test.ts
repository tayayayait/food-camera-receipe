import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const generateContentMock = vi.fn();

vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn().mockImplementation(() => ({
    models: {
      generateContent: generateContentMock,
    },
  })),
  Type: {
    ARRAY: 'ARRAY',
    OBJECT: 'OBJECT',
    STRING: 'STRING',
  },
}));

describe('getRecipeSuggestions', () => {
  beforeEach(() => {
    vi.resetModules();
    generateContentMock.mockReset();
    process.env.GEMINI_API_KEY = 'test-key';
  });

  afterEach(() => {
    delete process.env.GEMINI_API_KEY;
  });

  it('parses recipe suggestions from Gemini response', async () => {
    generateContentMock.mockResolvedValue({
      text:
        '[{"recipeName":"김치볶음밥","description":"매콤한 밥","ingredientsNeeded":["김치","밥"]}]',
    });

    const { getRecipeSuggestions } = await import('../geminiService');

    const results = await getRecipeSuggestions(['계란', '파']);

    expect(generateContentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gemini-2.5-flash',
        config: expect.objectContaining({ responseMimeType: 'application/json' }),
      })
    );
    expect(results).toEqual([
      {
        recipeName: '김치볶음밥',
        description: '매콤한 밥',
        ingredientsNeeded: ['김치', '밥'],
      },
    ]);
  });

  it('throws an error when Gemini returns empty output', async () => {
    generateContentMock.mockResolvedValue({ text: '' });

    const { getRecipeSuggestions } = await import('../geminiService');

    await expect(getRecipeSuggestions(['계란'])).rejects.toThrow('error_gemini_fetch');
  });

  it('throws an error when API key is missing', async () => {
    delete process.env.GEMINI_API_KEY;
    delete process.env.API_KEY;

    const { getRecipeSuggestions } = await import('../geminiService');

    await expect(getRecipeSuggestions(['계란'])).rejects.toThrow('error_gemini_api_key');
  });
});
