/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from 'react'

type Insets = { top: number; right: number; bottom: number; left: number }
type TelegramWebApp = {
  initData: string
  platform?: string
  colorScheme: 'light' | 'dark'
  themeParams: Record<string, string>
  safeAreaInset?: Insets
  contentSafeAreaInset?: Insets
  initDataUnsafe?: { user?: { id: number; first_name: string; username?: string; photo_url?: string } }
  ready(): void
  expand(): void
  setHeaderColor(color: string): void
  setBackgroundColor(color: string): void
  onEvent(event: string, callback: () => void): void
  offEvent(event: string, callback: () => void): void
  BackButton: { show(): void; hide(): void; onClick(callback: () => void): void; offClick(callback: () => void): void }
  HapticFeedback?: { impactOccurred(style: 'light' | 'medium' | 'heavy'): void }
}

declare global { interface Window { Telegram?: { WebApp?: TelegramWebApp } } }

interface TelegramContextValue {
  app: TelegramWebApp | null
  isTelegram: boolean
  colorScheme: 'light' | 'dark'
  user: { id: number; firstName: string; username?: string; photoUrl?: string }
  haptic(): void
}

const fallbackUser = { id: 0, firstName: 'Ученик' }
const TelegramContext = createContext<TelegramContextValue>({
  app: null, isTelegram: false, colorScheme: 'light', user: fallbackUser, haptic() {},
})

function applyInsets(app: TelegramWebApp) {
  const root = document.documentElement
  const apply = (prefix: string, inset?: Insets) => {
    if (!inset) return
    root.style.setProperty(`--${prefix}-top`, `${inset.top}px`)
    root.style.setProperty(`--${prefix}-right`, `${inset.right}px`)
    root.style.setProperty(`--${prefix}-bottom`, `${inset.bottom}px`)
    root.style.setProperty(`--${prefix}-left`, `${inset.left}px`)
  }
  apply('tg-safe', app.safeAreaInset)
  apply('tg-content-safe', app.contentSafeAreaInset)
}

export function isTextEntryElement(element: Element | null) {
  return Boolean(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement || element instanceof HTMLElement && element.isContentEditable)
}

export function isKeyboardLikelyOpen(baselineHeight: number, viewportHeight: number, activeElement: Element | null) {
  return isTextEntryElement(activeElement) && baselineHeight - viewportHeight > 120
}

export function isTelegramEnvironment(app: { initData?: string; platform?: string } | null | undefined) {
  return Boolean(app && (app.initData || app.platform && app.platform !== 'unknown'))
}

function useKeyboardVisibility() {
  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return
    let baselineHeight = viewport.height
    const sync = () => {
      const focused = isTextEntryElement(document.activeElement)
      if (!focused) baselineHeight = Math.max(baselineHeight, viewport.height)
      document.documentElement.dataset.keyboardOpen = String(isKeyboardLikelyOpen(baselineHeight, viewport.height, document.activeElement))
    }
    const syncAfterFocus = () => window.setTimeout(sync, 0)
    viewport.addEventListener('resize', sync)
    window.addEventListener('orientationchange', syncAfterFocus)
    document.addEventListener('focusin', syncAfterFocus)
    document.addEventListener('focusout', syncAfterFocus)
    sync()
    return () => {
      viewport.removeEventListener('resize', sync)
      window.removeEventListener('orientationchange', syncAfterFocus)
      document.removeEventListener('focusin', syncAfterFocus)
      document.removeEventListener('focusout', syncAfterFocus)
      delete document.documentElement.dataset.keyboardOpen
    }
  }, [])
}

export function TelegramProvider({ children }: { children: ReactNode }) {
  const app = window.Telegram?.WebApp ?? null
  const isTelegram = isTelegramEnvironment(app)
  const [colorScheme, setColorScheme] = useState<'light' | 'dark'>(app?.colorScheme ?? 'light')
  useKeyboardVisibility()
  useLayoutEffect(() => {
    const root = document.documentElement
    root.dataset.telegram = String(isTelegram)
    if (!app) return () => { delete root.dataset.telegram }
    const sync = () => { setColorScheme(app.colorScheme); applyInsets(app) }
    app.ready(); app.expand(); sync()
    app.setHeaderColor(app.themeParams.bg_color ?? '#f6f8fc')
    app.setBackgroundColor(app.themeParams.bg_color ?? '#f6f8fc')
    app.onEvent('themeChanged', sync); app.onEvent('safeAreaChanged', sync); app.onEvent('contentSafeAreaChanged', sync)
    window.addEventListener('orientationchange', sync)
    return () => {
      app.offEvent('themeChanged', sync); app.offEvent('safeAreaChanged', sync); app.offEvent('contentSafeAreaChanged', sync)
      window.removeEventListener('orientationchange', sync)
      delete root.dataset.telegram
    }
  }, [app, isTelegram])
  const rawUser = app?.initDataUnsafe?.user
  const value = useMemo<TelegramContextValue>(() => ({
    app,
    isTelegram,
    colorScheme,
    user: rawUser ? { id: rawUser.id, firstName: rawUser.first_name, username: rawUser.username, photoUrl: rawUser.photo_url } : fallbackUser,
    haptic: () => app?.HapticFeedback?.impactOccurred('light'),
  }), [app, colorScheme, isTelegram, rawUser])
  return <TelegramContext.Provider value={value}>{children}</TelegramContext.Provider>
}

export const useTelegram = () => useContext(TelegramContext)

export function useTelegramBack(visible: boolean, onBack: () => void) {
  const { app } = useTelegram()
  useEffect(() => {
    if (!app || !visible) { app?.BackButton.hide(); return }
    app.BackButton.show(); app.BackButton.onClick(onBack)
    return () => { app.BackButton.offClick(onBack); app.BackButton.hide() }
  }, [app, visible, onBack])
}
