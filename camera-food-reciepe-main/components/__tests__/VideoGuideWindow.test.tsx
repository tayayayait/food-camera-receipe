/** @vitest-environment jsdom */

import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';

import VideoGuideWindow from '../VideoGuideWindow';
import { LanguageProvider } from '../../context/LanguageContext';
import type { RecipeRecommendation, RecipeVideo } from '../../types';
import { recipeModalVideoTranscriptError, videoGuideWindowHint } from '../../locales/ko';

const baseRecipe: RecipeRecommendation = {
  recipeName: '가이드 레시피',
  description: '설명',
  ingredientsNeeded: [],
  instructions: ['단계 1'],
  videos: [],
  missingIngredients: [],
  matchedIngredients: [],
  isFullyMatched: false,
};

const baseVideo: RecipeVideo = {
  id: 'video-1',
  title: '가이드 영상',
  channelTitle: '채널',
  thumbnailUrl: 'thumb.jpg',
  videoUrl: 'https://youtube.com/watch?v=example',
  transcriptStatus: 'unknown',
};

describe('VideoGuideWindow', () => {
  it('renders transcript messaging and helper hint when provided', () => {
    const html = renderToString(
      <LanguageProvider>
        <VideoGuideWindow
          recipe={baseRecipe}
          video={baseVideo}
          instructions={[]}
          missingIngredients={[]}
          transcriptStatus="error"
          transcriptMessageKey="recipeModalVideoTranscriptError"
          isLoading={false}
          error={null}
          onClose={() => undefined}
        />
      </LanguageProvider>
    );

    expect(html).toContain(recipeModalVideoTranscriptError);
    expect(html).toContain(videoGuideWindowHint);
  });
});
