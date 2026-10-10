import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import i18n from './src/i18n'

// Tests are written against the English texts.
i18n.changeLanguage('en')

afterEach(() => {
  cleanup()
})
