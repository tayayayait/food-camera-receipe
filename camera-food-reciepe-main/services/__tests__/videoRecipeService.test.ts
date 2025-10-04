import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const originalFetch = globalThis.fetch;

const { getRecipeFromVideoContextMock } = vi.hoisted(() => ({
  getRecipeFromVideoContextMock: vi.fn(),
}));

vi.mock('../geminiService', () => ({
  getRecipeFromVideoContext: getRecipeFromVideoContextMock,
}));

beforeEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
  vi.unstubAllEnvs();
  getRecipeFromVideoContextMock.mockReset();

  if (originalFetch) {
    globalThis.fetch = originalFetch;
  } else {
    // @ts-expect-error - allow clearing fetch when not available
    delete globalThis.fetch;
  }
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
  vi.unstubAllEnvs();
  getRecipeFromVideoContextMock.mockReset();

  if (originalFetch) {
    globalThis.fetch = originalFetch;
  } else {
    // @ts-expect-error - allow clearing fetch when not available
    delete globalThis.fetch;
  }
});

describe('analyzeVideoRecipe', () => {
  it('includes sanitized comments in the context when available', async () => {
    vi.stubEnv('YOUTUBE_API_KEY', 'test-key');
    vi.stubEnv('API_KEY', '');

    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [
            {
              id: 'video123',
              snippet: {
                title: 'Sample Title',
                description: 'Primary description',
                channelTitle: 'Channel Name',
                tags: ['Quick Meal', 'quick meal', 'Fast'],
              },
            },
          ],
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: [] }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [
            {
              snippet: {
                topLevelComment: {
                  snippet: {
                    textOriginal: 'Great recipe!\nLoved the tips.',
                  },
                },
              },
              replies: {
                comments: [
                  { snippet: { textOriginal: ' Thanks for sharing! ' } },
                  { snippet: { textOriginal: 'Can I use tofu instead?' } },
                  { snippet: { textOriginal: 'This reply should be ignored due to limit.' } },
                ],
              },
            },
          ],
        }),
      } as Response);

    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    getRecipeFromVideoContextMock.mockResolvedValue({
      recipeName: 'Mock Recipe',
      description: 'Mock Description',
      ingredientsNeeded: ['Ingredient'],
      instructions: ['Step 1'],
    });

    const { analyzeVideoRecipe } = await import('../videoRecipeService');

    const recipe = await analyzeVideoRecipe({
      id: 'video123',
      title: 'Video Title',
      channelTitle: 'Original Channel',
    });

    expect(getRecipeFromVideoContextMock).toHaveBeenCalledTimes(1);
    const contextInput = getRecipeFromVideoContextMock.mock.calls[0][0];
    expect(contextInput.contextText).toContain(
      'Comments:\n- Great recipe! Loved the tips.\n  ↳ Thanks for sharing!\n  ↳ Can I use tofu instead?'
    );

    expect(recipe).toEqual({
      recipeName: 'Mock Recipe',
      description: 'Mock Description',
      ingredientsNeeded: ['Ingredient'],
      instructions: ['Step 1'],
      sourceVideoId: 'video123',
    });
  });

  it('omits the comments section when comment fetching fails', async () => {
    vi.stubEnv('YOUTUBE_API_KEY', 'test-key');
    vi.stubEnv('API_KEY', '');

    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [
            {
              id: 'video123',
              snippet: {
                title: 'Sample Title',
                description: 'Primary description',
                channelTitle: 'Channel Name',
              },
            },
          ],
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: [] }),
      } as Response)
      .mockResolvedValueOnce({ ok: false } as Response);

    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    getRecipeFromVideoContextMock.mockResolvedValue({
      recipeName: 'Mock Recipe',
      description: 'Mock Description',
      ingredientsNeeded: ['Ingredient'],
      instructions: ['Step 1'],
    });

    const { analyzeVideoRecipe } = await import('../videoRecipeService');

    await analyzeVideoRecipe({
      id: 'video123',
      title: 'Video Title',
      channelTitle: 'Original Channel',
    });

    expect(getRecipeFromVideoContextMock).toHaveBeenCalledTimes(1);
    const contextInput = getRecipeFromVideoContextMock.mock.calls[0][0];
    expect(contextInput.contextText).not.toContain('Comments:');
  });
});
