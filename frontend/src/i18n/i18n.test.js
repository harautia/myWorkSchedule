import { describe, expect, test, vi } from 'vitest'
import en from './en.json'
import fi from './fi.json'

// 'a.b.c' for every text, without i18next's plural endings (_one, _other).
const keys = (object, prefix = '') =>
  Object.entries(object).flatMap(([key, value]) =>
    typeof value === 'object' ? keys(value, `${prefix}${key}.`) : [`${prefix}${key}`.replace(/_(one|other)$/, '')]
  )

const unique = (list) => [...new Set(list)].sort()

describe('translations', () => {
  test('every English text has a Finnish translation, and the other way round', () => {
    expect(unique(keys(fi))).toEqual(unique(keys(en)))
  })

  test('no translation is empty', () => {
    const empty = [...keys(en).map((k) => ['en', k]), ...keys(fi).map((k) => ['fi', k])]
      .filter(([lang, key]) => {
        const value = key.split('.').reduce((o, part) => o?.[part] ?? o?.[`${part}_other`], lang === 'en' ? en : fi)
        return typeof value === 'string' && !value.trim()
      })
    expect(empty).toEqual([])
  })

  test('placeholders match between the languages', () => {
    const placeholders = (text) => unique(text.match(/{{\w+}}/g) ?? [])
    const flat = (object, prefix = '') =>
      Object.entries(object).flatMap(([key, value]) =>
        typeof value === 'object' ? flat(value, `${prefix}${key}.`) : [[`${prefix}${key}`, value]]
      )
    const fiTexts = Object.fromEntries(flat(fi))
    const mismatched = flat(en)
      .filter(([key, text]) => key in fiTexts && placeholders(text).join() !== placeholders(fiTexts[key]).join())
      .map(([key]) => key)
    expect(mismatched).toEqual([])
  })
})

describe('browser language', () => {
  test('Finnish browsers get Finnish, everything else English', async () => {
    const { browserLanguage } = await import('./index')
    const language = vi.spyOn(navigator, 'language', 'get')
    language.mockReturnValue('fi-FI')
    expect(browserLanguage()).toBe('fi')
    language.mockReturnValue('sv-SE')
    expect(browserLanguage()).toBe('en')
    language.mockRestore()
  })
})
