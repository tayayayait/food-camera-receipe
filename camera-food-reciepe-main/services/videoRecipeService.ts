import type { Recipe, RecipeVideo } from '../types';
import { getRecipeFromVideoContext } from './geminiService';

const YOUTUBE_API_KEY =
  (process.env.YOUTUBE_API_KEY as string | undefined) ?? (process.env.API_KEY as string | undefined);

interface YouTubeVideoSnippet {
  title?: string;
  description?: string;
  channelTitle?: string;
  tags?: string[];
}

interface YouTubeVideoItem {
  id?: string;
  snippet?: YouTubeVideoSnippet;
}

interface YouTubeVideosResponse {
  items?: YouTubeVideoItem[];
}

interface YouTubeCaptionSnippet {
  language?: string;
  trackKind?: string;
  name?: { simpleText?: string };
}

interface YouTubeCaptionItem {
  id?: string;
  snippet?: YouTubeCaptionSnippet;
}

interface YouTubeCaptionsResponse {
  items?: YouTubeCaptionItem[];
}

interface YouTubeCommentSnippet {
  textOriginal?: string;
}

interface YouTubeComment {
  id?: string;
  snippet?: YouTubeCommentSnippet;
}

interface YouTubeCommentThreadSnippet {
  topLevelComment?: YouTubeComment;
}

interface YouTubeCommentThread {
  snippet?: YouTubeCommentThreadSnippet;
  replies?: { comments?: YouTubeComment[] };
}

interface YouTubeCommentThreadsResponse {
  items?: YouTubeCommentThread[];
}

const DESCRIPTION_LIMIT = 2000;
const CAPTION_LIMIT = 6000;
const COMMENTS_LIMIT = 2000;

const MAX_REPLY_COUNT_PER_THREAD = 2;

const sanitizeMultiline = (text: string) =>
  text
    .replace(/\r/g, '')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .join('\n')
    .trim();

const truncate = (text: string, limit: number) => {
  if (text.length <= limit) {
    return text;
  }
  return text.slice(0, limit);
};

const sanitizeCommentText = (text: string) =>
  sanitizeMultiline(text)
    .replace(/\s*\n\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const uniqueSanitizedList = (values: string[]) => {
  const seen = new Set<string>();
  const result: string[] = [];

  values
    .map(value => value.trim())
    .filter(Boolean)
    .forEach(value => {
      const key = value.toLowerCase();
      if (seen.has(key)) {
        return;
      }
      seen.add(key);
      result.push(value);
    });

  return result;
};

const fetchVideoMetadata = async (videoId: string) => {
  const params = new URLSearchParams({
    id: videoId,
    part: 'snippet',
    key: YOUTUBE_API_KEY ?? '',
    maxResults: '1',
  });

  const response = await fetch(`https://www.googleapis.com/youtube/v3/videos?${params.toString()}`);

  if (!response.ok) {
    throw new Error('error_youtube_fetch');
  }

  const data = (await response.json()) as YouTubeVideosResponse;
  const item = data.items?.find(entry => entry?.id === videoId) ?? data.items?.[0];

  if (!item) {
    throw new Error('error_youtube_fetch');
  }

  return item.snippet ?? {};
};

const prioritizeCaptions = (items: YouTubeCaptionItem[]) => {
  const preferredLanguages = ['ko', 'en'];

  return [...items].sort((a, b) => {
    const aLang = a.snippet?.language ?? '';
    const bLang = b.snippet?.language ?? '';
    const aLangIndex = preferredLanguages.indexOf(aLang);
    const bLangIndex = preferredLanguages.indexOf(bLang);
    const aAutoPenalty = a.snippet?.trackKind === 'ASR' ? 1 : 0;
    const bAutoPenalty = b.snippet?.trackKind === 'ASR' ? 1 : 0;

    const normalizedALang = aLangIndex === -1 ? preferredLanguages.length : aLangIndex;
    const normalizedBLang = bLangIndex === -1 ? preferredLanguages.length : bLangIndex;

    if (normalizedALang !== normalizedBLang) {
      return normalizedALang - normalizedBLang;
    }

    if (aAutoPenalty !== bAutoPenalty) {
      return aAutoPenalty - bAutoPenalty;
    }

    return 0;
  });
};

const downloadCaptionTrack = async (captionId: string) => {
  const formats = ['srv3', 'srv2', 'srv1', 'ttml', 'srt', 'vtt'];

  for (const format of formats) {
    try {
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/captions/${captionId}?${new URLSearchParams({
          key: YOUTUBE_API_KEY ?? '',
          tfmt: format,
          alt: 'media',
        }).toString()}`
      );

      if (!response.ok) {
        continue;
      }

      const text = await response.text();
      if (text.trim()) {
        return sanitizeMultiline(text);
      }
    } catch (error) {
      console.warn('Unable to download caption track', error);
    }
  }

  return '';
};

const fetchCaptionText = async (videoId: string) => {
  try {
    const params = new URLSearchParams({
      part: 'snippet',
      videoId,
      key: YOUTUBE_API_KEY ?? '',
    });

    const response = await fetch(`https://www.googleapis.com/youtube/v3/captions?${params.toString()}`);

    if (!response.ok) {
      return '';
    }

    const data = (await response.json()) as YouTubeCaptionsResponse;
    const items = data.items ?? [];
    if (items.length === 0) {
      return '';
    }

    const prioritized = prioritizeCaptions(items);

    for (const item of prioritized) {
      if (!item.id) {
        continue;
      }

      const text = await downloadCaptionTrack(item.id);
      if (text) {
        return truncate(text, CAPTION_LIMIT);
      }
    }
  } catch (error) {
    console.warn('Unable to fetch caption list', error);
  }

  return '';
};

const fetchVideoComments = async (videoId: string) => {
  try {
    const params = new URLSearchParams({
      part: 'snippet,replies',
      videoId,
      key: YOUTUBE_API_KEY ?? '',
      maxResults: '20',
      order: 'relevance',
      textFormat: 'plainText',
    });

    const response = await fetch(`https://www.googleapis.com/youtube/v3/commentThreads?${params.toString()}`);

    if (!response.ok) {
      return '';
    }

    const data = (await response.json()) as YouTubeCommentThreadsResponse;
    const threads = data.items ?? [];
    const formattedComments: string[] = [];

    for (const thread of threads) {
      const topLevelText = thread.snippet?.topLevelComment?.snippet?.textOriginal;
      const sanitizedTopLevel = topLevelText ? sanitizeCommentText(topLevelText) : '';

      if (sanitizedTopLevel) {
        formattedComments.push(`- ${sanitizedTopLevel}`);
      }

      const replies = thread.replies?.comments ?? [];
      let replyCount = 0;

      for (const reply of replies) {
        if (replyCount >= MAX_REPLY_COUNT_PER_THREAD) {
          break;
        }

        const replyText = reply.snippet?.textOriginal;
        const sanitizedReply = replyText ? sanitizeCommentText(replyText) : '';

        if (sanitizedReply) {
          formattedComments.push(`  ↳ ${sanitizedReply}`);
          replyCount += 1;
        }
      }
    }

    if (formattedComments.length === 0) {
      return '';
    }

    const combinedComments = formattedComments.join('\n');
    return truncate(combinedComments, COMMENTS_LIMIT).trim();
  } catch (error) {
    console.warn('Unable to fetch comments', error);
  }

  return '';
};

export async function analyzeVideoRecipe(video: RecipeVideo): Promise<Recipe> {
  if (!YOUTUBE_API_KEY) {
    throw new Error('error_youtube_api_key');
  }

  try {
    const metadata = await fetchVideoMetadata(video.id);
    const captionText = await fetchCaptionText(video.id);
    const commentText = await fetchVideoComments(video.id);

    const contextSections: string[] = [];

    const title = metadata.title ?? video.title;
    if (title) {
      contextSections.push(`Video Title: ${title}`);
    }

    if (metadata.channelTitle ?? video.channelTitle) {
      contextSections.push(`Channel: ${metadata.channelTitle ?? video.channelTitle}`);
    }

    if (metadata.description) {
      const sanitizedDescription = truncate(sanitizeMultiline(metadata.description), DESCRIPTION_LIMIT);
      if (sanitizedDescription) {
        contextSections.push(`Description:\n${sanitizedDescription}`);
      }
    }

    if (metadata.tags && metadata.tags.length > 0) {
      contextSections.push(`Tags: ${uniqueSanitizedList(metadata.tags).join(', ')}`);
    }

    if (captionText) {
      contextSections.push(`Transcript excerpt:\n${captionText}`);
    }

    if (commentText) {
      contextSections.push(`Comments:\n${commentText}`);
    }

    const contextText = contextSections.join('\n\n').trim();
    const recipe = await getRecipeFromVideoContext({
      videoId: video.id,
      videoTitle: title,
      channelTitle: metadata.channelTitle ?? video.channelTitle,
      contextText,
    });

    return {
      ...recipe,
      sourceVideoId: video.id,
    };
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('error_')) {
      throw error;
    }

    console.error('Failed to analyze video recipe', error);
    throw new Error('error_video_recipe_analysis');
  }
}
