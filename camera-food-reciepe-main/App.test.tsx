/** @vitest-environment jsdom */

import React, { act } from 'react';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { createRoot } from 'react-dom/client';

import App from './App';
import { LanguageProvider } from './context/LanguageContext';
import { Category, ItemStatus, type PantryItem } from './types';

vi.mock('./components/CameraCapture', () => ({
  __esModule: true,
  default: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="camera-capture" /> : null,
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

describe('App intro start behavior', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = '';
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

