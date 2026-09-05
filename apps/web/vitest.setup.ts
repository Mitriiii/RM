import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';

// @testing-library/react's own auto-cleanup only registers itself when it finds a global
// `afterEach` at import time, which vitest doesn't provide unless `test.globals` is on. Since
// this repo imports afterEach/describe/it explicitly instead of enabling globals, cleanup
// must be wired up here or component render tests leak DOM nodes across test cases.
afterEach(() => {
  cleanup();
});
