/** @vitest-environment jsdom */

import { describe, expect, it, vi, afterEach } from 'vitest';
import React, { act } from 'react';
import { renderToString } from 'react-dom/server';
import { createRoot } from 'react-dom/client';

import RecipeJournal from '../RecipeJournal';
import { LanguageProvider } from '../../context/LanguageContext';
import type { RecipeMemory } from '../../types';
import { journalRewatchVideo, journalViewNutrition } from '../../locales/ko';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const baseMemory: RecipeMemory = {
  id: 'memory-1',
  recipeName: '테스트 요리',
  description: '설명',
  createdAt: new Date('2024-01-01T00:00:00Z').toISOString(),
  note: '',
  matchedIngredients: ['마늘'],
  missingIngredients: [],
  lastCookedAt: null,
  timesCooked: 0,
  ingredients: ['마늘'],
  instructions: ['단계 1'],
  videos: [
    {
      id: 'video-1',
      title: '테스트 영상',
      channelTitle: '채널',
      thumbnailUrl: 'thumb.jpg',
      videoUrl: 'https://example.com/video',
      transcriptStatus: 'available',
    },
  ],
  selectedVideoId: 'video-1',
  journalPreviewImage: null,
};

type RecipeJournalProps = React.ComponentProps<typeof RecipeJournal>;

const baseProps: RecipeJournalProps = {
  entries: [baseMemory],
  onUpdate: () => undefined,
  onDelete: () => undefined,
  onMarkCooked: () => undefined,
  onOpenDetails: () => undefined,
  onViewNutrition: () => undefined,
  onRegeneratePreview: () => undefined,
  previewStatuses: {},
  highlightedId: null,
};

const renderJournal = (override: Partial<RecipeJournalProps> = {}) => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  let currentOverride: Partial<RecipeJournalProps> = { ...override };

  const renderWithOverride = (nextOverride: Partial<RecipeJournalProps>) => {
    currentOverride = { ...currentOverride, ...nextOverride };
    const props = { ...baseProps, ...currentOverride };
    act(() => {
      root.render(
        <LanguageProvider>
          <RecipeJournal {...props} />
        </LanguageProvider>,
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

describe('RecipeJournal', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  it('renders selected video details with a rewatch link', () => {
    const html = renderToString(
      <LanguageProvider>
        <RecipeJournal {...baseProps} />
      </LanguageProvider>,
    );

    expect(html).toContain(baseMemory.videos?.[0]?.title ?? '');
    expect(html).toContain(baseMemory.videos?.[0]?.videoUrl ?? '');
    expect(html).toContain(journalRewatchVideo);
    expect(html).toContain('target="_blank"');
  });

  it('invokes the nutrition callback when the action is clicked', async () => {
    const onViewNutrition = vi.fn();
    const { container, unmount } = renderJournal({ onViewNutrition });

    try {
      const nutritionButton = Array.from(container.querySelectorAll('button')).find(button =>
        button.textContent?.includes(journalViewNutrition),
      );
      expect(nutritionButton).toBeDefined();

      await act(async () => {
        nutritionButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });

      expect(onViewNutrition).toHaveBeenCalledTimes(1);
      expect(onViewNutrition).toHaveBeenCalledWith(baseMemory);
    } finally {
      unmount();
    }
  });
});
