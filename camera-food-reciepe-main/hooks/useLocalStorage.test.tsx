/** @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';

import { useLocalStorage } from './useLocalStorage';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('useLocalStorage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it('falls back to the initial value when localStorage returns "null"', () => {
    vi.spyOn(window.localStorage, 'getItem').mockReturnValue('null');

    let capturedValue: string[] = [];

    const TestComponent = () => {
      const [value] = useLocalStorage<string[]>('test-key', ['fallback']);
      capturedValue = value;
      return null;
    };

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(<TestComponent />);
    });

    expect(capturedValue).toEqual(['fallback']);

    act(() => {
      root.unmount();
    });

    container.remove();
  });
});
