/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

type Insets = { top: number; right: number; bottom: number; left: number }
type TelegramWebApp = {
  initData: string
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
  const safe = app.contentSafeAreaInset ?? app.safeAreaInset
  if (!safe) return
  const root = document.documentElement
  root.style.setProperty('--tg-safe-top', `${safe.top}px`)
  root.style.setProperty('--tg-safe-right', `${safe.right}px`)
  root.style.setProperty('--tg-safe-bottom', `${safe.bottom}px`)
  root.style.setProperty('--tg-safe-left', `${safe.left}px`)
}

export function TelegramProvider({ children }: { children: ReactNode }) {
  const app = window.Telegram?.WebApp ?? null
  const [colorScheme, setColorScheme] = useState<'light' | 'dark'>(app?.colorScheme ?? 'light')
  useEffect(() => {
    if (!app) return
    const sync = () => { setColorScheme(app.colorScheme); applyInsets(app) }
    app.ready(); app.expand(); sync()
    app.setHeaderColor(app.themeParams.bg_color ?? '#f6f8fc')
    app.setBackgroundColor(app.themeParams.bg_color ?? '#f6f8fc')
    app.onEvent('themeChanged', sync); app.onEvent('safeAreaChanged', sync); app.onEvent('contentSafeAreaChanged', sync)
    return () => { app.offEvent('themeChanged', sync); app.offEvent('safeAreaChanged', sync); app.offEvent('contentSafeAreaChanged', sync) }
  }, [app])
  const rawUser = app?.initDataUnsafe?.user
  const value = useMemo<TelegramContextValue>(() => ({
    app,
    isTelegram: Boolean(app?.initData),
    colorScheme,
    user: rawUser ? { id: rawUser.id, firstName: rawUser.first_name, username: rawUser.username, photoUrl: rawUser.photo_url } : fallbackUser,
    haptic: () => app?.HapticFeedback?.impactOccurred('light'),
  }), [app, colorScheme, rawUser])
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
