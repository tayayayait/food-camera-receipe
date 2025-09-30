import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const originalFetch = globalThis.fetch;

beforeEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
  vi.unstubAllEnvs();
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
  if (originalFetch) {
    globalThis.fetch = originalFetch;
  } else {
    // @ts-expect-error - allow clearing fetch when not available
    delete globalThis.fetch;
  }
});

describe('getRecipeVideos', () => {
  it('throws error_youtube_api_key when API key is missing', async () => {
    vi.stubEnv('YOUTUBE_API_KEY', '');
    vi.stubEnv('API_KEY', '');

    const { getRecipeVideos } = await import('../videoService');

    await expect(getRecipeVideos('Kimchi Stew', [])).rejects.toThrowError(
      new Error('error_youtube_api_key')
    );
  });

  it('throws error_youtube_fetch when YouTube search response is not ok', async () => {
    vi.stubEnv('YOUTUBE_API_KEY', 'test-key');
    const fetchSpy = vi.fn().mockResolvedValue({ ok: false } as Response);
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    const { getRecipeVideos } = await import('../videoService');

    await expect(getRecipeVideos('Bibimbap', [])).rejects.toThrowError(new Error('error_youtube_fetch'));
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('throws error_youtube_fetch when the fetch call rejects', async () => {
    vi.stubEnv('YOUTUBE_API_KEY', 'test-key');
    const fetchError = new Error('network failure');
    const fetchSpy = vi.fn().mockRejectedValue(fetchError);
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    const { getRecipeVideos } = await import('../videoService');

    await expect(getRecipeVideos('Tteokbokki', [])).rejects.toThrowError(new Error('error_youtube_fetch'));
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
