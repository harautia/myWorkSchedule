import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import WeekStatusBar from './WeekStatusBar'

const NEW_WEEK = { status: 'planning', lockedAt: null, lockedBy: null, published: false }
const LOCKED = { status: 'locked', lockedAt: '2026-10-01T11:05:00Z', lockedBy: 'Anna', published: true }
const UNLOCKED = { ...LOCKED, status: 'planning' }

test('a new week is not yet published', () => {
  render(<WeekStatusBar week={NEW_WEEK} canEdit onLock={vi.fn()} onAddShift={vi.fn()} />)
  expect(screen.getByText(/Not published to employees yet/)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Lock week' })).toBeInTheDocument()
})

test('an unlocked week tells which version employees see', () => {
  render(<WeekStatusBar week={UNLOCKED} canEdit onLock={vi.fn()} />)
  expect(screen.getByText(/Employees see the version locked .* by Anna/)).toBeInTheDocument()
})

test('lock week calls onLock', async () => {
  const onLock = vi.fn()
  render(<WeekStatusBar week={NEW_WEEK} canEdit onLock={onLock} />)
  await userEvent.click(screen.getByRole('button', { name: 'Lock week' }))
  expect(onLock).toHaveBeenCalled()
})

test('unlocking is not done when the confirmation is cancelled', async () => {
  const onUnlock = vi.fn()
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
  render(<WeekStatusBar week={LOCKED} canEdit onUnlock={onUnlock} />)
  await userEvent.click(screen.getByRole('button', { name: 'Unlock week' }))
  expect(onUnlock).not.toHaveBeenCalled()
  confirm.mockRestore()
})

test('buttons are disabled while saving', () => {
  render(<WeekStatusBar week={LOCKED} canEdit busy onUnlock={vi.fn()} />)
  expect(screen.getByRole('button', { name: 'Unlock week' })).toBeDisabled()
})

test('employees see nothing for a published week and a note for an unpublished one', () => {
  const { container, rerender } = render(<WeekStatusBar week={UNLOCKED} canEdit={false} />)
  expect(container).toBeEmptyDOMElement()
  rerender(<WeekStatusBar week={NEW_WEEK} canEdit={false} />)
  expect(screen.getByRole('status')).toHaveTextContent('This week\'s schedule hasn\'t been published yet.')
})
