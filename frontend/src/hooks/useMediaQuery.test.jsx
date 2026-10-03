import { act, render, screen } from '@testing-library/react'
import useMediaQuery from './useMediaQuery'
import { clearMedia, mockMedia } from '../test/media'

const Probe = () => <span>{useMediaQuery('(max-width: 640px)') ? 'narrow' : 'wide'}</span>

afterEach(clearMedia)

test('follows the media query as it changes', () => {
  const setMedia = mockMedia({ '(max-width: 640px)': true })
  render(<Probe />)
  expect(screen.getByText('narrow')).toBeInTheDocument()

  act(() => setMedia('(max-width: 640px)', false))
  expect(screen.getByText('wide')).toBeInTheDocument()
})

test('is false where matchMedia is not available', () => {
  clearMedia()
  render(<Probe />)
  expect(screen.getByText('wide')).toBeInTheDocument()
})
