import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// jsdom 没有实现 scrollIntoView / scrollBy
Element.prototype.scrollIntoView = () => {};
Element.prototype.scrollBy = () => {};

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});
