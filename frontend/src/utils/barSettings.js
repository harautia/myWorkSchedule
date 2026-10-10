import { setBarSettings } from './dates'

// Makes the app follow a bar's settings: its timezone, opening hours and clock
// for every date and time, and its accent colour for the look.
export const applyBarSettings = (bar) => {
  setBarSettings(bar)
  document.documentElement.style.setProperty('--accent', bar.accentColor)
}
