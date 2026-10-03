import { vi } from 'vitest'

// Pretends the given media queries match, e.g. mockMedia({ '(pointer: coarse)': true }).
// Returns a function that changes a query later and notifies listeners.
export const mockMedia = (matching = {}) => {
  const state = { ...matching }
  const listeners = new Map()
  window.matchMedia = vi.fn((query) => ({
    get matches() {
      return Boolean(state[query])
    },
    media: query,
    addEventListener: (_, listener) => listeners.set(listener, query),
    removeEventListener: (_, listener) => listeners.delete(listener)
  }))
  return (query, value) => {
    state[query] = value
    listeners.forEach((q, listener) => q === query && listener())
  }
}

export const clearMedia = () => {
  delete window.matchMedia
}
