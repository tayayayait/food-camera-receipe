import { describe, expect, it } from 'vitest';
import { buildVideoRecipePrompt } from '../geminiService';

describe('buildVideoRecipePrompt', () => {
    it('instructs Gemini to preserve original instruction order without regrouping', () => {
        const prompt = buildVideoRecipePrompt('Video Title: Example\n\nContext details here');

        expect(prompt).toContain(
            'Keep the instructions in the exact order they appear in the supplied description or transcript and do not regroup, merge, split, or renumber steps.'
        );
    });
});
