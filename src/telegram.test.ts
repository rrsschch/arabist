import { describe, expect, it } from 'vitest'
import { isKeyboardLikelyOpen, isTelegramEnvironment, isTextEntryElement } from './telegram'

describe('mobile keyboard detection', () => {
  it('only treats a substantial viewport reduction while editing as an open keyboard', () => {
    const input = document.createElement('input')
    const button = document.createElement('button')
    expect(isTextEntryElement(input)).toBe(true)
    expect(isTextEntryElement(button)).toBe(false)
    expect(isKeyboardLikelyOpen(900, 620, input)).toBe(true)
    expect(isKeyboardLikelyOpen(900, 850, input)).toBe(false)
    expect(isKeyboardLikelyOpen(900, 620, button)).toBe(false)
  })
})

describe('Telegram environment detection', () => {
  it('distinguishes Telegram clients from a regular browser SDK stub', () => {
    expect(isTelegramEnvironment({ initData: '', platform: 'unknown' })).toBe(false)
    expect(isTelegramEnvironment({ initData: 'signed-data', platform: 'unknown' })).toBe(true)
    expect(isTelegramEnvironment({ initData: '', platform: 'ios' })).toBe(true)
  })
})
