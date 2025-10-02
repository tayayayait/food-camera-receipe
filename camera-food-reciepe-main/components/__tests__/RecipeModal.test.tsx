/** @vitest-environment jsdom */

import { describe, expect, it, vi, afterEach } from 'vitest';

import React from 'react';
import { renderToString } from 'react-dom/server';
import { act } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';

import RecipeModal from '../RecipeModal';
import { LanguageProvider } from '../../context/LanguageContext';
import type { RecipeRecommendation } from '../../types';
import {
  error_youtube_api_key,
  recipeModalVideoInstructionsLoading,
  recipeModalVideoInstructionsError,
  recipeModalVideoInstructionsSelectPrompt,
  recipeModalStepByStepTitle,
} from '../../locales/ko';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const baseRecipe: RecipeRecommendation = {
  recipeName: '테스트 레시피',
  description: '설명',
  ingredientsNeeded: [],
  instructions: ['단계 1', '단계 2'],
  videos: [],
  missingIngredients: ['양파'],
  matchedIngredients: ['마늘'],
  isFullyMatched: false,
};

type RecipeModalProps = React.ComponentProps<typeof RecipeModal>;

const baseProps: RecipeModalProps = {
  isOpen: true,
  onClose: () => undefined,
  recipes: [],
  isLoading: false,
  error: null,
  ingredients: ['마늘'],
  onSaveRecipeToJournal: () => ({ id: '1', isNew: true }),
  savedRecipeNames: [],
  nutritionSummary: null,
  nutritionContext: null,
  onViewRecipeNutrition: () => undefined,
  onApplyDetectedIngredients: async ingredients => ingredients,
  videoAvailabilityNotice: null,
  onVideoSelect: () => undefined,
  videoRecipeState: {
    recipe: null,
    selectedVideo: null,
    targetRecipeName: null,
    isLoading: false,
    error: null,
    transcript: { status: 'idle', messageKey: null },
  },
};

const renderModal = (override: Partial<RecipeModalProps>) => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  let currentOverride: Partial<RecipeModalProps> = {};

  const renderWithOverride = (nextOverride: Partial<RecipeModalProps>) => {
    currentOverride = { ...currentOverride, ...nextOverride };
    act(() => {
      root.render(
        <LanguageProvider>
          <RecipeModal {...baseProps} {...currentOverride} />
        </LanguageProvider>
      );
    });
  };

  renderWithOverride(override);

  return {
    container,
    rerender: renderWithOverride,
    unmount: () => {
      act(() => {
        root.unmount();
      });
      if (container.parentNode) {
        container.parentNode.removeChild(container);
      }
    },
  };
};

describe('RecipeModal', () => {
  afterEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '';
  });

  it('renders the YouTube API key notice when provided', () => {
    const html = renderToString(
      <LanguageProvider>
        <RecipeModal
          isOpen
          onClose={() => undefined}
          recipes={[baseRecipe]}
          isLoading={false}
          error={null}
          ingredients={['마늘']}
          onSaveRecipeToJournal={(_, __) => ({ id: '1', isNew: true })}
          savedRecipeNames={[]}
          nutritionSummary={null}
          nutritionContext={null}
          onViewRecipeNutrition={() => undefined}
          onApplyDetectedIngredients={async ingredients => ingredients}
          videoAvailabilityNotice={error_youtube_api_key}
          onVideoSelect={() => undefined}
          videoRecipeState={baseProps.videoRecipeState}
        />
      </LanguageProvider>
    );

    expect(html).toContain(error_youtube_api_key);
  });

  it('invokes onVideoSelect when a video card is clicked', async () => {
    const recipeWithVideo: RecipeRecommendation = {
      ...baseRecipe,
      instructions: ['기존 단계 1', '기존 단계 2'],
      videos: [
        {
          id: 'video-1',
          title: 'Test Video',
          channelTitle: 'Channel',
          thumbnailUrl: 'thumb.jpg',
          videoUrl: 'https://example.com/video',
          transcriptStatus: 'unknown',
        },
      ],
    };

    const onVideoSelect = vi.fn();
    const { container, unmount } = renderModal({ recipes: [recipeWithVideo], onVideoSelect });

    try {
      const videoButton = Array.from(container.querySelectorAll('button')).find(button =>
        button.textContent?.includes(recipeWithVideo.videos[0].title)
      );
      expect(videoButton).toBeDefined();

      await act(async () => {
        videoButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });

      expect(onVideoSelect).toHaveBeenCalledWith(recipeWithVideo, recipeWithVideo.videos[0]);
    } finally {
      unmount();
    }
  });

  it('shows a loading state for the targeted video recipe', () => {
    const recipeWithVideo: RecipeRecommendation = {
      ...baseRecipe,
      instructions: ['기존 단계 1'],
      videos: [
        {
          id: 'video-1',
          title: 'Loading Video',
          channelTitle: 'Channel',
          thumbnailUrl: 'thumb.jpg',
          videoUrl: 'https://example.com/video',
          transcriptStatus: 'unknown',
        },
      ],
    };

    const { container, unmount } = renderModal({
      recipes: [recipeWithVideo],
      videoRecipeState: {
        recipe: null,
        selectedVideo: recipeWithVideo.videos[0],
        targetRecipeName: recipeWithVideo.recipeName,
        isLoading: true,
        error: null,
        transcript: { status: 'idle', messageKey: null },
      },
    });

    try {
      expect(container.textContent).toContain(recipeModalVideoInstructionsLoading);
    } finally {
      unmount();
    }
  });

  it('renders video-aligned instructions when available', () => {
    const recipeWithVideo: RecipeRecommendation = {
      ...baseRecipe,
      instructions: ['기존 단계 1'],
      videos: [
        {
          id: 'video-1',
          title: 'Success Video',
          channelTitle: 'Channel',
          thumbnailUrl: 'thumb.jpg',
          videoUrl: 'https://example.com/video',
          transcriptStatus: 'unknown',
        },
      ],
    };

    const enrichedRecipe: RecipeRecommendation = {
      ...recipeWithVideo,
      instructions: ['1. 새 단계 준비', '2. 다음 단계 이어가기'],
    };

    const { container, unmount } = renderModal({
      recipes: [recipeWithVideo],
      videoRecipeState: {
        recipe: enrichedRecipe,
        selectedVideo: recipeWithVideo.videos[0],
        targetRecipeName: recipeWithVideo.recipeName,
        isLoading: false,
        error: null,
        transcript: { status: 'used', messageKey: null },
      },
    });

    try {
      expect(container.textContent).toContain('새 단계 준비');
      expect(container.textContent).toContain('다음 단계 이어가기');
      expect(container.textContent).not.toContain('기존 단계 1');
    } finally {
      unmount();
    }
  });

  it('shows an error state when video-aligned instructions fail', () => {
    const recipeWithVideo: RecipeRecommendation = {
      ...baseRecipe,
      instructions: ['기존 단계 1'],
      videos: [
        {
          id: 'video-1',
          title: 'Error Video',
          channelTitle: 'Channel',
          thumbnailUrl: 'thumb.jpg',
          videoUrl: 'https://example.com/video',
          transcriptStatus: 'unknown',
        },
      ],
    };

    const { container, unmount } = renderModal({
      recipes: [recipeWithVideo],
      videoRecipeState: {
        recipe: null,
        selectedVideo: recipeWithVideo.videos[0],
        targetRecipeName: recipeWithVideo.recipeName,
        isLoading: false,
        error: recipeModalVideoInstructionsError,
        transcript: { status: 'error', messageKey: null },
      },
    });

    try {
      expect(container.textContent).toContain(recipeModalVideoInstructionsError);
    } finally {
      unmount();
    }
  });

  it('hides the step-by-step section until a video is selected and instructions arrive', async () => {
    const recipeWithVideo: RecipeRecommendation = {
      ...baseRecipe,
      videos: [
        {
          id: 'video-1',
          title: 'Prompt Video',
          channelTitle: 'Channel',
          thumbnailUrl: 'thumb.jpg',
          videoUrl: 'https://example.com/video',
          transcriptStatus: 'unknown',
        },
      ],
    };

    const onVideoSelect = vi.fn();
    const { container, rerender, unmount } = renderModal({
      recipes: [recipeWithVideo],
      onVideoSelect,
    });

    try {
      expect(container.textContent).toContain(recipeModalVideoInstructionsSelectPrompt);
      expect(container.textContent).not.toContain(recipeModalStepByStepTitle);

      const videoButton = Array.from(container.querySelectorAll('button')).find(button =>
        button.textContent?.includes(recipeWithVideo.videos[0].title)
      );
      expect(videoButton).toBeDefined();

      await act(async () => {
        videoButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });

      expect(onVideoSelect).toHaveBeenCalledWith(recipeWithVideo, recipeWithVideo.videos[0]);

      rerender({
        videoRecipeState: {
          recipe: {
            ...recipeWithVideo,
            instructions: ['1. 준비하기', '2. 마무리하기'],
          },
          selectedVideo: recipeWithVideo.videos[0],
          targetRecipeName: recipeWithVideo.recipeName,
          isLoading: false,
          error: null,
          transcript: { status: 'used', messageKey: null },
        },
      });

      expect(container.textContent).not.toContain(recipeModalVideoInstructionsSelectPrompt);
      expect(container.textContent).toContain('준비하기');
      expect(container.textContent).toContain('마무리하기');
      expect(container.textContent).toContain(recipeModalStepByStepTitle);
    } finally {
      unmount();
    }
  });
});
