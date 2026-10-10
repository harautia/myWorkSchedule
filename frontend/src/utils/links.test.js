import { linkFromUrl } from './links'
import { countryOptions } from './forms'

describe('links from emails and the website', () => {
  test('are read from the address', () => {
    expect(linkFromUrl('?invite=abc')).toEqual({ type: 'invite', token: 'abc' })
    expect(linkFromUrl('?reset=def')).toEqual({ type: 'reset', token: 'def' })
    expect(linkFromUrl('?verify=ghi')).toEqual({ type: 'verify', token: 'ghi' })
    expect(linkFromUrl('?signup')).toEqual({ type: 'signup' })
    expect(linkFromUrl('')).toBeNull()
    expect(linkFromUrl('?verify=')).toBeNull()
  })
})

describe('country list', () => {
  test('has the countries, named in the language, without non-countries', () => {
    const english = countryOptions('en')
    expect(english).toContainEqual({ code: 'FI', name: 'Finland' })
    expect(english).toContainEqual({ code: 'GB', name: 'United Kingdom' })
    expect(english.map((country) => country.code)).not.toContain('EU')
    expect(english.length).toBeGreaterThan(240)
    expect(countryOptions('fi')).toContainEqual({ code: 'SE', name: 'Ruotsi' })
  })
})
