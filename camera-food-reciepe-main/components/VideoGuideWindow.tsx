import React, { useMemo } from 'react';
import type { RecipeRecommendation, RecipeVideo } from '../types';
import type { TranscriptPromptStatus } from '../services/geminiService';
import { useLanguage } from '../context/LanguageContext';

interface VideoGuideWindowProps {
  recipe: RecipeRecommendation;
  video: RecipeVideo;
  instructions: string[];
  missingIngredients: string[];
  transcriptStatus: TranscriptPromptStatus['status'] | 'idle' | 'loading';
  transcriptMessageKey: string | null;
  isLoading: boolean;
  error: string | null;
  onClose: () => void;
}

const resolveYoutubeEmbedUrl = (url: string): string | null => {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.replace(/^www\./, '');
    if (hostname === 'youtube.com' || hostname === 'm.youtube.com') {
      if (parsed.pathname === '/watch') {
        const videoId = parsed.searchParams.get('v');
        return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
      }
      if (parsed.pathname.startsWith('/shorts/')) {
        const videoId = parsed.pathname.split('/')[2];
        return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
      }
    }
    if (hostname === 'youtu.be') {
      const videoId = parsed.pathname.replace('/', '');
      return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
    }
  } catch (error) {
    console.error('Failed to resolve YouTube embed URL', error);
  }
  return null;
};

const VideoGuideWindow: React.FC<VideoGuideWindowProps> = ({
  recipe,
  video,
  transcriptStatus,
  transcriptMessageKey,
  isLoading,
  error,
  onClose,
}) => {
  const { t } = useLanguage();
  const embedUrl = useMemo(() => resolveYoutubeEmbedUrl(video.videoUrl), [video.videoUrl]);
  const transcriptMessage = transcriptMessageKey ? t(transcriptMessageKey as any) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-8" onClick={onClose}>
      <div
        className="flex w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
        onClick={event => event.stopPropagation()}
      >
        <header className="flex flex-col gap-3 border-b border-gray-100 bg-brand-blue/5 px-6 py-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-brand-blue">
              {t('videoGuideWindowTitle', { recipe: recipe.recipeName, title: video.title })}
            </p>
            <p className="text-xs text-brand-blue/70">
              {t('videoGuideWindowSubtitle', { channel: video.channelTitle })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (typeof window !== 'undefined') {
                  window.open(video.videoUrl, '_blank', 'noopener,noreferrer');
                }
              }}
              className="inline-flex items-center rounded-full border border-brand-blue/30 px-4 py-2 text-xs font-semibold text-brand-blue transition hover:bg-brand-blue/10"
            >
              {t('videoGuideWindowOpenExternally')}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center rounded-full bg-brand-blue px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-600"
            >
              {t('videoGuideWindowClose')}
            </button>
          </div>
        </header>

        <div className="max-h-[75vh] overflow-y-auto px-6 py-6">
          {isLoading ? (
            <div className="flex h-60 flex-col items-center justify-center gap-3 text-brand-blue">
              <span className="h-8 w-8 animate-spin rounded-full border-2 border-brand-blue/30 border-t-transparent" />
              <p className="text-sm font-semibold">{t('videoGuideWindowLoading')}</p>
            </div>
          ) : error ? (
            <div className="flex h-60 flex-col items-center justify-center gap-3 text-center text-red-600">
              <p className="text-sm font-semibold">{t('videoGuideWindowError')}</p>
              <p className="text-xs text-red-500">{error}</p>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="overflow-hidden rounded-2xl border border-gray-100 shadow-sm">
                {embedUrl ? (
                  <iframe
                    src={embedUrl}
                    title={video.title}
                    className="aspect-video w-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <div className="flex aspect-video w-full items-center justify-center bg-gray-100 px-6 text-center text-sm text-gray-500">
                    {video.title}
                  </div>
                )}
              </div>

              <div className="space-y-2 rounded-2xl border border-brand-blue/15 bg-brand-blue/5 px-4 py-4 text-sm text-brand-blue">
                <p className="font-semibold">{t('videoGuideWindowNowPlaying')}</p>
                <p className="text-xs text-brand-blue/70">{video.channelTitle}</p>
                {transcriptMessage && transcriptStatus !== 'idle' && (
                  <p className="text-xs text-brand-blue/80">{transcriptMessage}</p>
                )}
                <p className="text-xs text-brand-blue/60">{t('videoGuideWindowHint')}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VideoGuideWindow;
