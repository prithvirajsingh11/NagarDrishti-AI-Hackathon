import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

if (typeof window !== 'undefined') {
  window.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
  window.URL.revokeObjectURL = vi.fn();
}

globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

afterEach(() => {
  cleanup();
});
