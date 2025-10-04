/** @vitest-environment jsdom */

import React, { act } from 'react';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { createRoot } from 'react-dom/client';

import App from './App';
import { LanguageProvider } from './context/LanguageContext';
import { Category, ItemStatus, type PantryItem } from './types';

const cameraCaptureHandler: {
  current: ((photo: Blob) => Promise<void>) | null;
} = { current: null };

const { analyzeIngredientsFromImageMock, generateDesignPreviewMock } = vi.hoisted(() => ({
  analyzeIngredientsFromImageMock: vi.fn<
    (photo: Blob) => Promise<string[]>
  >(),
  generateDesignPreviewMock: vi.fn<
    (ingredients: string[]) =>
      Promise<{
        status: 'success' | 'unsupported';
        dataUrl: string;
        model: string | null;
        attemptedModels: string[];
      }>
  >(),
}));

vi.mock('./components/CameraCapture', () => ({
  __esModule: true,
  default: ({ isOpen, onCapture }: { isOpen: boolean; onCapture: (photo: Blob) => Promise<void> }) => {
    cameraCaptureHandler.current = onCapture;
    return isOpen ? <div data-testid="camera-capture" /> : null;
  },
}));

vi.mock('./services/visionService', () => ({
  __esModule: true,
  analyzeIngredientsFromImage: analyzeIngredientsFromImageMock,
}));

vi.mock('./services/designPreviewService', () => ({
  __esModule: true,
  generateDesignPreview: generateDesignPreviewMock,
  generateJournalPreviewImage: vi.fn(),
}));

const triggerCameraCapture = async (photo: Blob) => {
  expect(cameraCaptureHandler.current).toBeTruthy();
  await act(async () => {
    await cameraCaptureHandler.current?.(photo);
  });
};

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

beforeEach(() => {
  localStorage.clear();
  document.body.innerHTML = '';
  cameraCaptureHandler.current = null;
  analyzeIngredientsFromImageMock.mockReset();
  generateDesignPreviewMock.mockReset();
  generateDesignPreviewMock.mockResolvedValue({
    status: 'success',
    dataUrl: 'data:image/png;base64,mock-preview',
    model: 'mock-model',
    attemptedModels: ['mock-model'],
  });
});

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

describe('App intro start behavior', () => {
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

describe('App scan nutrition flow', () => {
  it('applies nutrition summary and focuses the nutrition view after a scan', async () => {
    localStorage.setItem('pantryItems', JSON.stringify([]));
    analyzeIngredientsFromImageMock.mockResolvedValue(['사과', 'Banana']);

    const { container, cleanup } = await renderApp();

    try {
      await clickStartButton(container);
      expect(container.querySelector('[data-testid="camera-capture"]')).not.toBeNull();

      await triggerCameraCapture(new Blob(['fake-image'], { type: 'image/png' }));

      expect(analyzeIngredientsFromImageMock).toHaveBeenCalledTimes(1);
      expect(container.textContent).toContain('예상 영양 구성');
      expect(container.textContent).toContain('최근 인식된 재료를 기준으로 계산했어요.');

      const nutritionButton = Array.from(container.querySelectorAll('button')).find(button =>
        button.textContent?.includes('영양')
      );
      expect(nutritionButton?.getAttribute('aria-pressed')).toBe('true');
    } finally {
      cleanup();
    }
  });
});

