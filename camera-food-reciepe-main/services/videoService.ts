import type { RecipeVideo } from '../types';

const YOUTUBE_API_KEY =
  (process.env.YOUTUBE_API_KEY as string | undefined) ?? (process.env.API_KEY as string | undefined);

interface YouTubeThumbnailSet {
  url?: string;
}

interface YouTubeSnippet {
  title?: string;
  channelTitle?: string;
  thumbnails?: {
    medium?: YouTubeThumbnailSet;
    high?: YouTubeThumbnailSet;
    default?: YouTubeThumbnailSet;
  };
}

interface YouTubeSearchResultItem {
  id?: { videoId?: string };
  snippet?: YouTubeSnippet;
}

interface YouTubeSearchResult {
  items?: YouTubeSearchResultItem[];
}

interface YouTubeVideoDetail {
  id?: string;
  snippet?: YouTubeSnippet;
  status?: {
    privacyStatus?: string;
    uploadStatus?: string;
  };
}

interface YouTubeVideosResponse {
  items?: YouTubeVideoDetail[];
}

const normalizeText = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s가-힣]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const buildKeywords = (text: string) => normalizeText(text).split(' ').filter(word => word.length > 1);

const isVideoRelevant = (title: string | undefined, recipeName: string, ingredients: string[]) => {
  if (!title) {
    return false;
  }

  const normalizedTitle = normalizeText(title);
  if (!normalizedTitle) {
    return false;
  }

  const recipeKeywords = buildKeywords(recipeName);
  const ingredientKeywords = ingredients.flatMap(ingredient => buildKeywords(ingredient)).slice(0, 6);

  const recipeMatches = recipeKeywords.filter(keyword => normalizedTitle.includes(keyword));
  if (recipeKeywords.length > 0 && recipeMatches.length > 0) {
    return true;
  }

  if (ingredientKeywords.length === 0) {
    return recipeKeywords.length === 0;
  }

  const ingredientMatches = ingredientKeywords.filter(keyword => normalizedTitle.includes(keyword));
  return ingredientMatches.length >= Math.min(2, ingredientKeywords.length);
};

export async function getRecipeVideos(recipeName: string, ingredients: string[], maxResults = 2): Promise<RecipeVideo[]> {
  if (!YOUTUBE_API_KEY) {
    console.warn('YOUTUBE_API_KEY (or API_KEY) environment variable is not set. No recipe videos will be returned.');
    return [];
  }

  try {
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

    const searchSnippets = new Map(
      items
        .map(item => {
          const videoId = item.id?.videoId;
          if (!videoId) {
            return null;
          }
          return [videoId, item.snippet] as const;
        })
        .filter((entry): entry is readonly [string, YouTubeSnippet | undefined] => Boolean(entry))
    );

    const videoIds = items
      .map(item => item.id?.videoId)
      .filter((videoId): videoId is string => Boolean(videoId));

    if (videoIds.length === 0) {
      return [];
    }

    const verifyParams = new URLSearchParams({
      part: 'snippet,status',
      id: videoIds.join(','),
      key: YOUTUBE_API_KEY,
      maxResults: String(videoIds.length),
    });

    const verifyResponse = await fetch(`https://www.googleapis.com/youtube/v3/videos?${verifyParams.toString()}`);

    if (!verifyResponse.ok) {
      throw new Error('error_youtube_fetch');
    }

    const verifyData = (await verifyResponse.json()) as YouTubeVideosResponse;
    const detailsById = new Map(
      (verifyData.items ?? [])
        .filter(item => {
          const status = item.status;
          const uploadStatus = status?.uploadStatus;
          const privacyStatus = status?.privacyStatus;
          return (
            (privacyStatus === 'public' || privacyStatus === 'unlisted') &&
            (uploadStatus === 'processed' || uploadStatus === 'uploaded')
          );
        })
        .map(item => [item.id ?? '', item] as const)
        .filter((entry): entry is readonly [string, YouTubeVideoDetail] => Boolean(entry[0]))
    );

    return videoIds
      .map(videoId => {
        const detail = detailsById.get(videoId);
        const snippet = detail?.snippet ?? searchSnippets.get(videoId);
        if (!snippet) {
          return null;
        }

        const thumbnail =
          snippet.thumbnails?.high?.url ||
          snippet.thumbnails?.medium?.url ||
          snippet.thumbnails?.default?.url;

        if (!thumbnail) {
          return null;
        }

        if (!isVideoRelevant(snippet.title, recipeName, ingredients)) {
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
  } catch (error) {
    console.error('Error fetching or verifying YouTube videos', error);
    throw new Error('error_youtube_fetch');
  }
}
