import '@testing-library/jest-dom';

// jsdom's native localStorage is a special host object whose methods live on
// Storage.prototype and cannot be intercepted by vi.spyOn(window.localStorage, …).
// Replace it with a plain JS object so spying works correctly in tests.
const _localStorageStore: Record<string, string> = {};
const fakeLocalStorage = {
  getItem: (key: string) => _localStorageStore[key] ?? null,
  setItem: (key: string, value: string) => {
    _localStorageStore[key] = String(value);
  },
  removeItem: (key: string) => {
    delete _localStorageStore[key];
  },
  clear: () => {
    Object.keys(_localStorageStore).forEach((k) => delete _localStorageStore[k]);
  },
  get length() {
    return Object.keys(_localStorageStore).length;
  },
  key: (i: number) => Object.keys(_localStorageStore)[i] ?? null,
};
Object.defineProperty(window, 'localStorage', {
  configurable: true,
  value: fakeLocalStorage,
});
