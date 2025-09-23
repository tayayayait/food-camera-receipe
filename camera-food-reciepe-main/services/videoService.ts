import type { RecipeVideo } from '../types';

const YOUTUBE_API_KEY = process.env.API_KEY as string | undefined;

interface YouTubeSearchResult {
  items?: Array<{
    id?: { videoId?: string };
    snippet?: {
      title?: string;
      channelTitle?: string;
      thumbnails?: {
        medium?: { url?: string };
        high?: { url?: string };
        default?: { url?: string };
      };
    };
  }>;
}

export async function getRecipeVideos(recipeName: string, ingredients: string[], maxResults = 2): Promise<RecipeVideo[]> {
  if (!YOUTUBE_API_KEY) {
    console.warn('API_KEY environment variable is not set. No recipe videos will be returned.');
    return [];
  }

  const searchQuery = [recipeName, 'recipe', ...ingredients.slice(0, 2)].join(' ');
  const params = new URLSearchParams({
    part: 'snippet',
    q: searchQuery,
    key: YOUTUBE_API_KEY,
    type: 'video',
    maxResults: String(maxResults),
    safeSearch: 'moderate',
    videoEmbeddable: 'true',
  });

  const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${params.toString()}`);

  if (!response.ok) {
    throw new Error('error_youtube_fetch');
  }

  const data = (await response.json()) as YouTubeSearchResult;
  const items = data.items ?? [];

  return items
    .map(item => {
      const videoId = item.id?.videoId;
      const snippet = item.snippet;
      if (!videoId || !snippet) {
        return null;
      }

      const thumbnail =
        snippet.thumbnails?.high?.url ||
        snippet.thumbnails?.medium?.url ||
        snippet.thumbnails?.default?.url ||
        '';

      if (!thumbnail) {
        return null;
      }

      return {
        id: videoId,
        title: snippet.title ?? 'Recipe video',
        channelTitle: snippet.channelTitle ?? 'Unknown creator',
        thumbnailUrl: thumbnail,
        videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
      } as RecipeVideo;
    })
    .filter((video): video is RecipeVideo => Boolean(video));
}
