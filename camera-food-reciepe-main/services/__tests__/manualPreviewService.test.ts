import { describe, expect, it } from 'vitest';
import type { RecipeVideo } from '../../types';
import {
  hasManualPreview,
  resolveManualPreviewImage,
  type ManualPreviewLookup,
} from '../manualPreviewService';

const sampleLookup: ManualPreviewLookup = {
  vid123: 'data:image/png;base64,video-sample',
  'garlic butter pasta': 'data:image/png;base64,recipe-sample',
};

describe('manualPreviewService', () => {
  it('resolves manual previews by YouTube video id', () => {
    const videos: RecipeVideo[] = [
      {
        id: 'vid123',
        title: 'Sample',
        channelTitle: 'Channel',
        thumbnailUrl: 'https://example.com/thumb.jpg',
        videoUrl: 'https://youtube.com/watch?v=vid123',
      },
    ];

    const result = resolveManualPreviewImage({ recipeName: 'Any', videos }, sampleLookup);
    expect(result).toBe(sampleLookup.vid123);
  });

  it('resolves manual previews by recipe name ignoring case', () => {
    const result = resolveManualPreviewImage({ recipeName: 'Garlic Butter Pasta', videos: [] }, sampleLookup);
    expect(result).toBe(sampleLookup['garlic butter pasta']);
  });

  it('reports whether a manual preview exists', () => {
    expect(
      hasManualPreview(
        {
          recipeName: 'Unknown Recipe',
          videos: [],
        },
        sampleLookup
      )
    ).toBe(false);

    expect(
      hasManualPreview(
        {
          recipeName: 'Garlic Butter Pasta',
          videos: [],
        },
        sampleLookup
      )
    ).toBe(true);
  });
});
