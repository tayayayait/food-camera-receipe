import type { RecipeVideo } from '../types';

const resolveYoutubeApiKey = () => {
  const apiKey = process.env.YOUTUBE_API_KEY as string | undefined;
  if (!apiKey) {
    throw new Error('error_youtube_api_key');
  }
  return apiKey;
};

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

const buildSearchQuery = (recipeName: string, ingredients: string[]) => {
  const trimmedName = recipeName.trim();
  const ingredientPart = ingredients.slice(0, 2).join(' ');
  return [trimmedName, '요리 레시피 만드는 법', ingredientPart, 'recipe']
    .filter(Boolean)
    .join(' ')
    .trim();
};

const scoreVideo = (title: string | undefined, recipeName: string, ingredients: string[]) => {
  if (!title) {
    return 0;
  }

  const normalizedTitle = normalizeText(title);
  if (!normalizedTitle) {
    return 0;
  }

  const normalizedRecipeName = normalizeText(recipeName);
  const recipeKeywords = buildKeywords(recipeName);
  const ingredientKeywords = ingredients.flatMap(ingredient => buildKeywords(ingredient)).slice(0, 6);

  let score = 0;

  if (normalizedRecipeName && normalizedTitle.includes(normalizedRecipeName)) {
    score += 6;
  }

  for (const keyword of recipeKeywords) {
    if (normalizedTitle.includes(keyword)) {
      score += 3;
    }
  }

  for (const keyword of ingredientKeywords) {
    if (normalizedTitle.includes(keyword)) {
      score += 1.5;
    }
  }

  const emphasisKeywords = ['레시피', '요리', '만드는법', '만드는 법', 'recipe'];
  for (const keyword of emphasisKeywords) {
    const normalizedKeyword = normalizeText(keyword);
    if (normalizedKeyword && normalizedTitle.includes(normalizedKeyword)) {
      score += 0.5;
    }
  }

  return score;
};

export async function getRecipeVideos(recipeName: string, ingredients: string[], maxResults = 4): Promise<RecipeVideo[]> {
  const YOUTUBE_API_KEY = resolveYoutubeApiKey();

  try {
    const sanitizedIngredients = ingredients.map(ingredient => ingredient.trim()).filter(Boolean);
    const searchQuery = buildSearchQuery(recipeName, sanitizedIngredients);
    const searchPoolSize = Math.max(8, maxResults * 3);
    const params = new URLSearchParams({
      part: 'snippet',
      q: searchQuery,
      key: YOUTUBE_API_KEY,
      type: 'video',
      maxResults: String(searchPoolSize),
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

    const rankedCandidates = videoIds
      .map((videoId, index) => {
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

        const score = scoreVideo(snippet.title, recipeName, sanitizedIngredients);

        return {
          score,
          index,
          video: {
            id: videoId,
            title: snippet.title ?? 'Recipe video',
            channelTitle: snippet.channelTitle ?? 'Unknown creator',
            thumbnailUrl: thumbnail,
            videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
          } as RecipeVideo,
        };
      })
      .filter(
        (entry): entry is { score: number; index: number; video: RecipeVideo } => Boolean(entry)
      );

    if (rankedCandidates.length === 0) {
      return [];
    }

    const positiveScoreVideos = rankedCandidates
      .filter(entry => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults)
      .map(entry => entry.video);

    if (positiveScoreVideos.length > 0) {
      return positiveScoreVideos;
    }

    const fallbackVideos = rankedCandidates
      .slice()
      .sort((a, b) => {
        if (a.score === b.score) {
          return a.index - b.index;
        }
        return b.score - a.score;
      })
      .slice(0, maxResults)
      .map(entry => entry.video);

    return fallbackVideos;
  } catch (error) {
    console.error('Error fetching or verifying YouTube videos', error);
    throw new Error('error_youtube_fetch');
  }
}
