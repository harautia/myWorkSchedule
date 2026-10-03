import { useEffect, useState } from 'react'

const matches = (query) => typeof window !== 'undefined' && Boolean(window.matchMedia?.(query).matches)

// Whether a CSS media query matches, updated when it changes (e.g. the phone
// is turned). False where matchMedia isn't available.
const useMediaQuery = (query) => {
  const [value, setValue] = useState(() => matches(query))

  useEffect(() => {
    const list = window.matchMedia?.(query)
    if (!list) return undefined
    const update = () => setValue(list.matches)
    update()
    list.addEventListener('change', update)
    return () => list.removeEventListener('change', update)
  }, [query])

  return value
}

// Phone-sized screen: one day at a time in the week view.
export const NARROW_SCREEN = '(max-width: 640px)'
// Finger instead of mouse: tap to edit shifts instead of dragging.
export const TOUCH_POINTER = '(pointer: coarse)'

export default useMediaQuery
