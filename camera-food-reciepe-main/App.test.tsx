/** @vitest-environment jsdom */

import React, { act } from 'react';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { createRoot } from 'react-dom/client';

import App from './App';
import { LanguageProvider } from './context/LanguageContext';
import {
  Category,
  ItemStatus,
  type PantryItem,
  type Recipe,
  type RecipeRecommendation,
  type RecipeVideo,
} from './types';

const mockGetRecipeSuggestions = vi.fn<[string[]], Promise<Recipe[]>>();
const mockGenerateInstructionsFromVideo = vi.fn<
  [RecipeVideo, string[], RecipeRecommendation],
  Promise<{ steps: string[]; transcript: { status: 'used'; messageKey: 'recipeModalVideoTranscriptUsed' } }>
>();
const mockGetRecipeVideos = vi.fn<[string, string[]], Promise<RecipeVideo[]>>();
const mockAnalyzeIngredientsFromImage = vi.fn<[Blob], Promise<string[]>>();
const mockGenerateDesignPreview = vi.fn<
  [string[]],
  Promise<{ status: 'success' | 'unsupported'; dataUrl: string; model: string | null; attemptedModels: string[] }>
>();
const mockGenerateJournalPreviewImage = vi.fn<
  [
    {
      recipeName: string;
      matchedIngredients?: string[];
      missingIngredients?: string[];
      artStyle?: string;
    },
  ],
  Promise<{ status: 'success' | 'unsupported'; dataUrl: string; model: string | null; attemptedModels: string[] }>
>();

vi.mock('./components/CameraCapture', () => ({
  __esModule: true,
  default: ({
    isOpen,
    onCapture,
  }: {
    isOpen: boolean;
    onCapture: (photo: Blob) => Promise<void> | void;
  }) => {
    if (!isOpen) {
      return null;
    }

    return (
      <div data-testid="camera-capture">
        <button
          type="button"
          data-testid="mock-capture"
          onClick={() => onCapture(new Blob(['mock'], { type: 'image/png' }))}
        >
          Capture
        </button>
      </div>
    );
  },
}));

vi.mock('./services/geminiService', () => ({
  __esModule: true,
  getRecipeSuggestions: (ingredients: string[]) => mockGetRecipeSuggestions(ingredients),
  generateInstructionsFromVideo: (
    video: RecipeVideo,
    availableIngredients: string[],
    recipe: RecipeRecommendation,
  ) => mockGenerateInstructionsFromVideo(video, availableIngredients, recipe),
}));

vi.mock('./services/videoService', () => ({
  __esModule: true,
  getRecipeVideos: (recipeName: string, ingredients: string[]) =>
    mockGetRecipeVideos(recipeName, ingredients),
}));

vi.mock('./services/visionService', () => ({
  __esModule: true,
  analyzeIngredientsFromImage: (image: Blob) => mockAnalyzeIngredientsFromImage(image),
}));

vi.mock('./services/designPreviewService', () => ({
  __esModule: true,
  generateDesignPreview: (ingredients: string[]) => mockGenerateDesignPreview(ingredients),
  generateJournalPreviewImage: (
    options: {
      recipeName: string;
      matchedIngredients?: string[];
      missingIngredients?: string[];
      artStyle?: string;
    }
  ) => mockGenerateJournalPreviewImage(options),
}));

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const renderApp = async () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(
      <LanguageProvider>
        <App />
      </LanguageProvider>
    );
  });

  return {
    container,
    cleanup: () => {
      act(() => {
        root.unmount();
      });
      if (container.parentNode) {
        container.parentNode.removeChild(container);
      }
    },
  };
};

const clickStartButton = async (container: HTMLElement) => {
  const startButton = Array.from(container.querySelectorAll('button')).find(button =>
    button.textContent?.includes('시작하기')
  );
  expect(startButton).toBeDefined();

  await act(async () => {
    startButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
};

const flushPromises = async (count = 1) => {
  for (let index = 0; index < count; index += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

describe('App intro start behavior', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = '';
    mockGetRecipeSuggestions.mockReset();
    mockGenerateInstructionsFromVideo.mockReset();
    mockGetRecipeVideos.mockReset();
    mockAnalyzeIngredientsFromImage.mockReset();
    mockGenerateDesignPreview.mockReset();
    mockGenerateJournalPreviewImage.mockReset();
    mockGetRecipeSuggestions.mockResolvedValue([]);
    mockGetRecipeVideos.mockResolvedValue([]);
    mockGenerateInstructionsFromVideo.mockResolvedValue({
      steps: ['1. 준비'],
      transcript: { status: 'used', messageKey: 'recipeModalVideoTranscriptUsed' },
    });
    mockAnalyzeIngredientsFromImage.mockResolvedValue([]);
    mockGenerateDesignPreview.mockResolvedValue({
      status: 'success',
      dataUrl: 'data:image/png;base64,preview',
      model: 'mock-preview',
      attemptedModels: [],
    });
    mockGenerateJournalPreviewImage.mockResolvedValue({
      status: 'success',
      dataUrl: 'data:image/png;base64,journal',
      model: 'mock-journal',
      attemptedModels: [],
    });
  });

  it('opens the camera when starting with an empty pantry', async () => {
    localStorage.setItem('pantryItems', JSON.stringify([]));

    const { container, cleanup } = await renderApp();

    try {
      expect(container.querySelector('[data-testid="camera-capture"]')).toBeNull();

      await clickStartButton(container);

      expect(container.querySelector('[data-testid="camera-capture"]')).not.toBeNull();
    } finally {
      cleanup();
    }
  });

  it('navigates to the pantry view when items exist', async () => {
    const storedItems: PantryItem[] = [
      {
        id: 'item-1',
        name: '사과',
        category: Category.Fruit,
        acquiredAt: new Date().toISOString(),
        status: ItemStatus.Active,
      },
    ];
    localStorage.setItem('pantryItems', JSON.stringify(storedItems));

    const { container, cleanup } = await renderApp();

    try {
      await clickStartButton(container);

      expect(container.querySelector('[data-testid="camera-capture"]')).toBeNull();
      expect(container.textContent).toContain('카메라가 인식한 재료 목록');
    } finally {
      cleanup();
    }
  });
});

describe('handleCameraCapture', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = '';
    mockGetRecipeSuggestions.mockReset();
    mockGenerateInstructionsFromVideo.mockReset();
    mockGetRecipeVideos.mockReset();
    mockAnalyzeIngredientsFromImage.mockReset();
    mockGenerateDesignPreview.mockReset();
    mockGenerateJournalPreviewImage.mockReset();
    mockGetRecipeSuggestions.mockResolvedValue([]);
    mockGetRecipeVideos.mockResolvedValue([]);
    mockGenerateInstructionsFromVideo.mockResolvedValue({
      steps: ['1. 준비'],
      transcript: { status: 'used', messageKey: 'recipeModalVideoTranscriptUsed' },
    });
    mockAnalyzeIngredientsFromImage.mockResolvedValue([]);
    mockGenerateDesignPreview.mockResolvedValue({
      status: 'success',
      dataUrl: 'data:image/png;base64,preview',
      model: 'mock-preview',
      attemptedModels: [],
    });
    mockGenerateJournalPreviewImage.mockResolvedValue({
      status: 'success',
      dataUrl: 'data:image/png;base64,journal',
      model: 'mock-journal',
      attemptedModels: [],
    });
  });

  it('applies nutrition summary and focuses the nutrition view after scanning ingredients', async () => {
    mockAnalyzeIngredientsFromImage.mockResolvedValue(['토마토', ' 모짜렐라 ']);

    const { container, cleanup } = await renderApp();

    try {
      const scanButton = Array.from(container.querySelectorAll('button')).find(button =>
        button.textContent?.includes('냉장고 스캔하기')
      );
      expect(scanButton).toBeDefined();

      await act(async () => {
        scanButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });

      await flushPromises(1);

      let captureButton = container.querySelector('[data-testid="mock-capture"]') as HTMLButtonElement | null;
      if (!captureButton) {
        await flushPromises(2);
        captureButton = container.querySelector('[data-testid="mock-capture"]') as HTMLButtonElement | null;
      }
      expect(captureButton).not.toBeNull();

      await act(async () => {
        captureButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });

      await flushPromises(6);

      expect(mockAnalyzeIngredientsFromImage).toHaveBeenCalledOnce();
      expect(mockGenerateDesignPreview).toHaveBeenCalledWith(['토마토', '모짜렐라']);

      expect(container.textContent).toContain('예상 영양 구성');
      expect(container.textContent).toContain('토마토');
      expect(container.textContent).toContain('모짜렐라');

      const nutritionToolbarButton = Array.from(container.querySelectorAll('button')).find(button =>
        button.textContent?.includes('영양 요약')
      );
      expect(nutritionToolbarButton?.getAttribute('aria-pressed')).toBe('true');
    } finally {
      cleanup();
    }
  });
});

describe('handleSelectVideoForRecipe', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = '';
    mockGetRecipeSuggestions.mockReset();
    mockGenerateInstructionsFromVideo.mockReset();
    mockGetRecipeVideos.mockReset();
    mockAnalyzeIngredientsFromImage.mockReset();
    mockGenerateDesignPreview.mockReset();
    mockGenerateJournalPreviewImage.mockReset();
    mockAnalyzeIngredientsFromImage.mockResolvedValue([]);
    mockGenerateDesignPreview.mockResolvedValue({
      status: 'success',
      dataUrl: 'data:image/png;base64,preview',
      model: 'mock-preview',
      attemptedModels: [],
    });
    mockGenerateJournalPreviewImage.mockResolvedValue({
      status: 'success',
      dataUrl: 'data:image/png;base64,journal',
      model: 'mock-journal',
      attemptedModels: [],
    });
  });

  it('applies nutrition and focuses the nutrition view after selecting a video', async () => {
    const storedItems: PantryItem[] = [
      {
        id: 'item-1',
        name: '닭가슴살',
        category: Category.Meat,
        acquiredAt: new Date().toISOString(),
        status: ItemStatus.Active,
      },
      {
        id: 'item-2',
        name: '마늘',
        category: Category.Vegetable,
        acquiredAt: new Date().toISOString(),
        status: ItemStatus.Active,
      },
    ];
    localStorage.setItem('pantryItems', JSON.stringify(storedItems));

    const suggestion: Recipe = {
      recipeName: '갈릭 치킨 파스타',
      description: '테스트 레시피',
      ingredientsNeeded: ['스파게티', '올리브 오일', '마늘'],
      instructions: ['1. 준비', '2. 조리'],
    };
    const video: RecipeVideo = {
      id: 'video-1',
      title: 'Test Video',
      channelTitle: 'Test Channel',
      thumbnailUrl: 'https://example.com/thumb.jpg',
      videoUrl: 'https://example.com/video',
      transcriptStatus: 'available',
    };

    mockGetRecipeSuggestions.mockResolvedValue([suggestion]);
    mockGetRecipeVideos.mockResolvedValue([video]);
    mockGenerateInstructionsFromVideo.mockResolvedValue({
      steps: ['1. 재료 손질', '2. 볶기'],
      transcript: { status: 'used', messageKey: 'recipeModalVideoTranscriptUsed' },
    });

    const { container, cleanup } = await renderApp();

    try {
      await clickStartButton(container);

      const ideasButton = Array.from(container.querySelectorAll('button')).find(button =>
        button.textContent?.includes('아이디어')
      );
      expect(ideasButton).toBeDefined();
      await act(async () => {
        ideasButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });

      await flushPromises(4);

      expect(mockGetRecipeSuggestions).toHaveBeenCalledOnce();
      expect(mockGetRecipeVideos).toHaveBeenCalledOnce();

      let videoSelectButton = Array.from(container.querySelectorAll('button, a')).find(element =>
        element.textContent?.includes('영상 선택')
      ) as HTMLButtonElement | HTMLAnchorElement | undefined;
      for (let attempt = 0; attempt < 6 && !videoSelectButton; attempt += 1) {
        await flushPromises(1);
        videoSelectButton = Array.from(container.querySelectorAll('button, a')).find(element =>
          element.textContent?.includes('영상 선택')
        ) as HTMLButtonElement | HTMLAnchorElement | undefined;
      }
      expect(videoSelectButton).toBeDefined();

      await act(async () => {
        videoSelectButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });

      await flushPromises(4);

      expect(mockGenerateInstructionsFromVideo).toHaveBeenCalledOnce();
      expect(mockGenerateInstructionsFromVideo).toHaveBeenCalledWith(
        video,
        expect.any(Array),
        expect.objectContaining({ recipeName: suggestion.recipeName })
      );

      expect(container.textContent).toContain('예상 영양 구성');
      expect(container.textContent).toContain('갈릭 치킨 파스타');
      expect(container.textContent).not.toContain('맞춤 레시피 추천');

      const nutritionToolbarButton = Array.from(container.querySelectorAll('button')).find(button =>
        button.textContent?.includes('영양 요약')
      );
      expect(nutritionToolbarButton?.getAttribute('aria-pressed')).toBe('true');
    } finally {
      cleanup();
    }
  });
});

