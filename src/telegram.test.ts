import { describe, expect, it } from 'vitest'
import { isKeyboardLikelyOpen, isTelegramEnvironment, isTextEntryElement, requestMobileTelegramFullscreen, shouldExpandTelegramMiniApp } from './telegram'

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

  it('keeps desktop Mini Apps compact by not requesting expand', () => {
    expect(shouldExpandTelegramMiniApp('ios')).toBe(true)
    expect(shouldExpandTelegramMiniApp('android')).toBe(true)
    expect(shouldExpandTelegramMiniApp('tdesktop')).toBe(false)
    expect(shouldExpandTelegramMiniApp('macos')).toBe(false)
    expect(shouldExpandTelegramMiniApp('web')).toBe(false)
    expect(shouldExpandTelegramMiniApp(undefined)).toBe(false)
  })

  it('requests fullscreen only on mobile Telegram clients', () => {
    let fullscreenCalls = 0
    let expandCalls = 0
    requestMobileTelegramFullscreen({ platform: 'ios', requestFullscreen: () => { fullscreenCalls += 1 }, expand: () => { expandCalls += 1 } })
    expect(fullscreenCalls).toBe(1)
    expect(expandCalls).toBe(0)

    requestMobileTelegramFullscreen({ platform: 'android', expand: () => { expandCalls += 1 } })
    expect(expandCalls).toBe(1)

    requestMobileTelegramFullscreen({ platform: 'tdesktop', requestFullscreen: () => { fullscreenCalls += 1 }, expand: () => { expandCalls += 1 } })
    expect(fullscreenCalls).toBe(1)
    expect(expandCalls).toBe(1)
  })
})
