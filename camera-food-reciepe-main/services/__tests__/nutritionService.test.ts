import { describe, expect, it } from 'vitest';
import { estimateNutritionSummary } from '../nutritionService';

describe('estimateNutritionSummary', () => {
  it('matches USDA macros for gram-based quantities', () => {
    const summary = estimateNutritionSummary(['150 g chicken breast']);
    expect(summary.total.calories).toBeCloseTo(247.5, 1);
    expect(summary.total.protein).toBeCloseTo(46.5, 1);
    expect(summary.total.carbs).toBeCloseTo(0, 1);
    expect(summary.total.fat).toBeCloseTo(5.4, 1);

    expect(summary.breakdown).toHaveLength(1);
    const [entry] = summary.breakdown;
    expect(entry.portionGrams).toBeCloseTo(150, 1);
    expect(entry.dataQuality).toBe('authoritative');
    expect(entry.sourceId).toBe('FDC:173686');
  });

  it('converts volumetric measures using USDA portion data', () => {
    const summary = estimateNutritionSummary(['1 cup cooked rice']);
    const [entry] = summary.breakdown;

    expect(entry.portionGrams).toBeCloseTo(158, 1);
    expect(entry.profile?.calories).toBeCloseTo(205.4, 1);
    expect(entry.profile?.carbs).toBeCloseTo(44.6, 1);
    expect(entry.dataQuality).toBe('authoritative');
    expect(entry.sourceCitation).toContain('FDC ID 1097499');
  });

  it('does not apply generic fallbacks for unknown foods', () => {
    const summary = estimateNutritionSummary(['mystery herb']);

    expect(summary.total.calories).toBe(0);
    expect(summary.breakdown).toHaveLength(1);
    const [entry] = summary.breakdown;
    expect(entry.profile).toBeUndefined();
    expect(entry.dataQuality).toBe('missing');
  });
});
