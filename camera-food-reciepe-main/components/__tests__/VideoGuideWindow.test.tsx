/** @vitest-environment jsdom */

import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';

import VideoGuideWindow from '../VideoGuideWindow';
import { LanguageProvider } from '../../context/LanguageContext';
import type { RecipeRecommendation, RecipeVideo } from '../../types';
import { recipeModalMissingIngredientsLabel } from '../../locales/ko';

const baseRecipe: RecipeRecommendation = {
  recipeName: '가이드 레시피',
  description: '설명',
  ingredientsNeeded: [],
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
  it('shows the selected video and missing ingredient label', () => {
    const html = renderToString(
      <LanguageProvider>
        <VideoGuideWindow
          recipe={{ ...baseRecipe, missingIngredients: ['고추'] }}
          video={baseVideo}
          missingIngredients={['고추']}
          onClose={() => undefined}
        />
      </LanguageProvider>
    );

    expect(html).toContain(baseVideo.title);
    expect(html).toContain(recipeModalMissingIngredientsLabel);
    expect(html).toContain('고추');
  });
});
