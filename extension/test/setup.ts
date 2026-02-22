import 'fake-indexeddb/auto';

// happy-dom does not provide CSS.escape — polyfill for selector-generator tests
if (typeof CSS === 'undefined' || !CSS.escape) {
  globalThis.CSS = { escape: (s: string) => s.replace(/([^\w-])/g, '\\$1') } as typeof CSS;
}
