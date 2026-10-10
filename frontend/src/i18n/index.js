import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './en.json'
import fi from './fi.json'

// The app's languages (D15). A bar's users see the bar's language; the login
// page and admins (who have no bar) get the browser's language.
export const LANGUAGE_CODES = ['en', 'fi']

export const browserLanguage = () =>
  typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('fi') ? 'fi' : 'en'

i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, fi: { translation: fi } },
  lng: browserLanguage(),
  fallbackLng: 'en',
  // React escapes text itself.
  interpolation: { escapeValue: false }
})

// Switches the whole app's language, including the page's lang attribute.
export const setLanguage = (code) => {
  const language = LANGUAGE_CODES.includes(code) ? code : 'en'
  document.documentElement.lang = language
  return i18n.changeLanguage(language)
}

export default i18n
