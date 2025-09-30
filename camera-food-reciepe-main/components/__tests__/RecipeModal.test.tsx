import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';

import RecipeModal from '../RecipeModal';
import { LanguageProvider } from '../../context/LanguageContext';
import type { RecipeRecommendation } from '../../types';
import { error_youtube_api_key } from '../../locales/ko';

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

describe('RecipeModal', () => {
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
          onSaveRecipeToJournal={() => ({ id: '1', isNew: true })}
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
});
