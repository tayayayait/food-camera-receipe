/** @vitest-environment jsdom */

import { describe, expect, it, vi, afterEach } from 'vitest';

vi.mock('../../services/geminiService', () => ({
  generateInstructionsFromVideo: vi.fn(),
}));

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
  error_gemini_fetch,
} from '../../locales/ko';
import { generateInstructionsFromVideo } from '../../services/geminiService';

const mockedGenerateInstructionsFromVideo = vi.mocked(generateInstructionsFromVideo);

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
};

const renderModal = (override: Partial<RecipeModalProps>) => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      <LanguageProvider>
        <RecipeModal {...baseProps} {...override} />
      </LanguageProvider>
    );
  });

  return {
    container,
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
    mockedGenerateInstructionsFromVideo.mockReset();
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
        />
      </LanguageProvider>
    );

    expect(html).toContain(error_youtube_api_key);
  });

  it('fetches and replaces instructions after selecting a video', async () => {
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
        },
      ],
    };

    let resolveInstructions: (value: string[]) => void = () => undefined;
    const instructionsPromise = new Promise<string[]>(resolve => {
      resolveInstructions = resolve;
    });
    mockedGenerateInstructionsFromVideo.mockReturnValueOnce(instructionsPromise);

    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const { container, unmount } = renderModal({ recipes: [recipeWithVideo] });

    try {
      const videoButton = Array.from(container.querySelectorAll('button')).find(button =>
        button.textContent?.includes(recipeWithVideo.videos[0].title)
      );
      expect(videoButton).toBeDefined();

      await act(async () => {
        videoButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });

      expect(openSpy).toHaveBeenCalledWith(
        recipeWithVideo.videos[0].videoUrl,
        '_blank',
        'noopener,noreferrer'
      );
      expect(mockedGenerateInstructionsFromVideo).toHaveBeenCalledWith(
        recipeWithVideo.videos[0],
        baseProps.ingredients,
        recipeWithVideo
      );
      expect(container.textContent).toContain(recipeModalVideoInstructionsLoading);

      await act(async () => {
        resolveInstructions(['1. 새 단계 준비', '2. 다음 단계 이어가기']);
        await Promise.resolve();
      });

      expect(container.textContent).toContain('새 단계 준비');
      expect(container.textContent).toContain('다음 단계 이어가기');
      expect(container.textContent).not.toContain('기존 단계 1');
    } finally {
      openSpy.mockRestore();
      unmount();
    }
  });

  it('shows an error state when video-aligned instructions fail', async () => {
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
        },
      ],
    };

    let rejectInstructions: (reason?: unknown) => void = () => undefined;
    const failingPromise = new Promise<string[]>((_, reject) => {
      rejectInstructions = reject;
    });
    mockedGenerateInstructionsFromVideo.mockReturnValueOnce(failingPromise);

    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const { container, unmount } = renderModal({ recipes: [recipeWithVideo] });

    try {
      const videoButton = Array.from(container.querySelectorAll('button')).find(button =>
        button.textContent?.includes(recipeWithVideo.videos[0].title)
      );
      expect(videoButton).toBeDefined();

      await act(async () => {
        videoButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });

      expect(openSpy).toHaveBeenCalled();
      expect(container.textContent).toContain(recipeModalVideoInstructionsLoading);

      await act(async () => {
        rejectInstructions(new Error('error_gemini_fetch'));
        await Promise.resolve();
      });

      expect(container.textContent).toContain(recipeModalVideoInstructionsError);
      expect(container.textContent).toContain(error_gemini_fetch);
      expect(container.textContent).toContain('기존 단계 1');
    } finally {
      openSpy.mockRestore();
      unmount();
    }
  });
});
