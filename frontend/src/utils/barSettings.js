import { setBarSettings } from './dates'
import { setLanguage } from '../i18n'

// Makes the app follow a bar's settings: its timezone, opening hours and clock
// for every date and time, its language, and its accent colour for the look.
export const applyBarSettings = (bar) => {
  setBarSettings(bar)
  setLanguage(bar.locale)
  document.documentElement.style.setProperty('--accent', bar.accentColor)
}
