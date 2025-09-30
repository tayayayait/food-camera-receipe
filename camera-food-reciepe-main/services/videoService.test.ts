import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RecipeVideo } from '../types';

const originalApiKey = process.env.YOUTUBE_API_KEY;
const originalFetch = global.fetch;

beforeAll(() => {
  process.env.YOUTUBE_API_KEY = 'test-api-key';
});

afterAll(() => {
  if (originalApiKey === undefined) {
    delete process.env.YOUTUBE_API_KEY;
  } else {
    process.env.YOUTUBE_API_KEY = originalApiKey;
  }
  global.fetch = originalFetch;
});

beforeEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
  global.fetch = originalFetch;
});

afterEach(() => {
  global.fetch = originalFetch;
});

const createJsonResponse = (data: unknown) =>
  new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

describe('getRecipeVideos', () => {
  it('returns fallback videos when all scores are non-positive', async () => {
    const { getRecipeVideos } = await import('./videoService');

    const snippet = {
      title: 'Travel vlog 123',
      channelTitle: 'Traveler',
      thumbnails: {
        high: { url: 'https://example.com/thumb1.jpg' },
      },
    };

    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(
        createJsonResponse({
          items: [
            {
              id: { videoId: 'video1' },
              snippet,
            },
          ],
        })
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          items: [
            {
              id: 'video1',
              snippet,
              status: { privacyStatus: 'public', uploadStatus: 'processed' },
            },
          ],
        })
      );

    const videos = await getRecipeVideos('Kimchi stew', ['kimchi']);

    expect(Array.isArray(videos)).toBe(true);
    expect(videos).toHaveLength(1);
    const [video] = videos;
    expect((video as RecipeVideo).id).toBe('video1');
  });

  it('prioritizes videos with positive scores when available', async () => {
    const { getRecipeVideos } = await import('./videoService');

    const positiveSnippet = {
      title: 'Kimchi stew recipe that is delicious',
      channelTitle: 'Chef',
      thumbnails: {
        high: { url: 'https://example.com/thumb-pos.jpg' },
      },
    };

    const zeroSnippet = {
      title: 'Random travel vlog',
      channelTitle: 'Traveler',
      thumbnails: {
        high: { url: 'https://example.com/thumb-zero.jpg' },
      },
    };

    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(
        createJsonResponse({
          items: [
            {
              id: { videoId: 'positive' },
              snippet: positiveSnippet,
            },
            {
              id: { videoId: 'neutral' },
              snippet: zeroSnippet,
            },
          ],
        })
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          items: [
            {
              id: 'positive',
              snippet: positiveSnippet,
              status: { privacyStatus: 'public', uploadStatus: 'processed' },
            },
            {
              id: 'neutral',
              snippet: zeroSnippet,
              status: { privacyStatus: 'public', uploadStatus: 'processed' },
            },
          ],
        })
      );

    const videos = await getRecipeVideos('Kimchi stew', ['kimchi']);

    expect(videos).toHaveLength(1);
    expect(videos[0]?.id).toBe('positive');
  });

  it('throws an explicit error when the API key is missing', async () => {
    delete process.env.YOUTUBE_API_KEY;
    delete process.env.API_KEY;
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;
    const { getRecipeVideos } = await import('./videoService');

    await expect(getRecipeVideos('Bibimbap', ['rice'])).rejects.toThrowError(
      new Error('error_youtube_api_key')
    );

    expect(fetchSpy).not.toHaveBeenCalled();

    process.env.YOUTUBE_API_KEY = 'test-api-key';
  });
});
