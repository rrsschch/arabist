import { expect, test } from '@playwright/test'

test('submits a home search and removes decorative screen headers', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText(/Салам,/)).toHaveCount(0)
  await page.getByRole('textbox', { name: 'Поиск слова или корня' }).fill('август')
  await page.getByRole('button', { name: 'Найти' }).click()
  await expect(page).toHaveURL(/\/dictionary\?q=%D0%B0%D0%B2%D0%B3%D1%83%D1%81%D1%82/)
  await expect(page.getByRole('heading', { name: 'Словарь' })).toHaveCount(0)
  await expect(page.locator('article').first()).toContainText('آبُ', { timeout: 15_000 })
})

test('keeps dictionary search controls clear and opens a real word', async ({ page }) => {
  await page.goto('/dictionary')
  await expect(page.getByLabel('Фильтр части речи')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Имя', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Глагол', exact: true })).toHaveCount(0)
  const input = page.getByRole('textbox', { name: 'Поиск слов' })
  await expect(input).toBeVisible()
  expect(Number.parseFloat(await input.evaluate((element) => getComputedStyle(element).paddingLeft))).toBeGreaterThanOrEqual(48)
  await input.fill('август')
  await expect(page.getByRole('button', { name: 'Очистить поиск' })).toBeVisible()
  const card = page.locator('article').first()
  await expect(card).toContainText('آبُ')
  await card.getByRole('link').click()
  await expect(page).toHaveURL(/\/lexemes\//)
  await expect(page.getByRole('status')).toHaveCount(0)
  await expect(page.locator('.standalone-shell article').getByText('1) август', { exact: true }).first()).toBeVisible()
})

test('creates a deck and persists it after reload', async ({ page }) => {
  await page.goto('/library')
  await page.getByRole('button', { name: /Новая колода/ }).click()
  await page.getByLabel('Название').fill('Моя колода')
  await page.getByRole('button', { name: 'Создать' }).click()
  await expect(page.getByText('Моя колода')).toBeVisible()
  await page.reload()
  await expect(page.getByText('Моя колода')).toBeVisible()
  await page.getByRole('link', { name: /Моя колода/ }).click()
  await expect(page).toHaveURL(/\/library\/deck-/)
})

test('edits a deck title and emoji from its actions menu', async ({ page }) => {
  await page.goto('/library')
  await page.getByRole('button', { name: 'Действия с колодой Еда и продукты' }).click()
  await page.getByRole('button', { name: 'Редактировать' }).click()
  await page.getByLabel('Название').fill('Любимые слова')
  await page.getByLabel('Эмодзи').fill('🧠')
  await page.getByRole('button', { name: 'Сохранить' }).click()
  await expect(page.getByRole('link', { name: /Любимые слова/ })).toContainText('🧠')
  await page.reload()
  await expect(page.getByRole('link', { name: /Любимые слова/ })).toBeVisible()
})

test('selects, moves and removes multiple deck words', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('sanna.mock.v2.library', JSON.stringify({ decks: [
    { id: 'food', emoji: '🥑', title: 'Еда и продукты', wordIds: ['e56d27ff-9b5a-5a52-b90f-02e5233e711b', '3cd23a89-b6b3-55c7-a807-d5b96feba2c2'] },
    { id: 'verbs', emoji: '🏃', title: 'Глаголы', wordIds: [] },
  ] })))
  await page.goto('/library/food')
  await page.getByRole('button', { name: /Управление/ }).click()
  await page.getByRole('button', { name: /Выбрать/ }).first().click({ force: true })
  await page.getByRole('button', { name: /Выбрать/ }).first().click({ force: true })
  await page.getByRole('button', { name: /Переместить/ }).click()
  await page.getByRole('button', { name: /Глаголы/ }).click({ force: true })
  await expect(page.getByRole('link', { name: /Открыть словарь/ })).toBeVisible()
  await page.getByRole('button', { name: 'Назад' }).click()
  await page.getByRole('link', { name: /Глаголы/ }).click()
  await page.getByRole('button', { name: /Управление/ }).click()
  await page.getByRole('button', { name: /Выбрать/ }).first().click({ force: true })
  await page.getByRole('button', { name: /Убрать/ }).click()
  await page.getByRole('dialog', { name: 'Убрать слова из колоды?' }).getByRole('button', { name: 'Убрать' }).click()
  await expect(page.getByText('1 слов')).toBeVisible()
})

test('redirects legacy nested deck URLs to the flat route', async ({ page }) => {
  await page.goto('/library/arabic/decks/food')
  await expect(page).toHaveURL('/library/food')
  await expect(page.getByRole('heading', { name: /Еда и продукты/ })).toBeVisible()
})

test('starts a review session directly from home', async ({ page }) => {
  await page.goto('/')
  const start = page.getByRole('button', { name: /Начать сессию/ })
  await expect(start).toBeEnabled()
  await start.click()
  await expect(page).toHaveURL(/\/training\/session\//)
  await expect(page.getByRole('button', { name: 'Показать ответ' })).toBeVisible()
})

test('completes a mock review flow', async ({ page }) => {
  await page.goto('/training')
  await page.getByRole('button', { name: 'Начать повторение' }).click()
  await expect(page).toHaveURL(/\/training\/session\//)
  for (let index = 0; index < 20; index += 1) {
    await page.getByRole('button', { name: 'Показать ответ' }).click()
    await page.getByRole('button', { name: 'Легко' }).click()
  }
  await expect(page.getByRole('heading', { name: 'Сессия завершена' })).toBeVisible()
})

test('shows Training without flip-card and quiz blocks', async ({ page }) => {
  await page.goto('/training')
  await expect(page.getByRole('button', { name: /Тренировка/ })).toBeVisible()
  await expect(page.getByText('Флип-карточки')).toHaveCount(0)
  await expect(page.getByText('Тест на знание')).toHaveCount(0)
})

test('hides the navigation island when the mobile keyboard reduces the viewport', async ({ page }) => {
  await page.goto('/')
  const input = page.getByRole('textbox', { name: 'Поиск слова или корня' })
  const initial = page.viewportSize()!
  await input.focus()
  await page.setViewportSize({ width: initial.width, height: initial.height - 300 })
  await expect(page.locator('html')).toHaveAttribute('data-keyboard-open', 'true')
  await expect(page.getByRole('navigation')).toBeHidden()
  await input.blur()
  await page.setViewportSize(initial)
  await expect(page.locator('html')).toHaveAttribute('data-keyboard-open', 'false')
  await expect(page.getByRole('navigation')).toBeVisible()
})

test('applies Telegram content safe area above the first screen content', async ({ page }) => {
  await page.route('https://telegram.org/js/telegram-web-app.js', (route) => route.abort())
  await page.addInitScript(() => {
    const empty = () => undefined
    window.Telegram = { WebApp: {
      initData: 'test', platform: 'ios', colorScheme: 'light', themeParams: {},
      safeAreaInset: { top: 12, right: 0, bottom: 0, left: 0 },
      contentSafeAreaInset: { top: 48, right: 0, bottom: 0, left: 0 },
      ready: empty, expand: empty, setHeaderColor: empty, setBackgroundColor: empty,
      onEvent: empty, offEvent: empty,
      BackButton: { show: empty, hide: empty, onClick: empty, offClick: empty },
    } }
  })
  await page.goto('/')
  const paddingTop = await page.locator('.app-shell').first().evaluate((element) => Number.parseFloat(getComputedStyle(element).paddingTop))
  expect(paddingTop).toBeGreaterThanOrEqual(104)
  await page.goto('/dictionary')
  const tools = page.locator('.dictionary-tools')
  const stickyTop = await tools.evaluate((element) => Number.parseFloat(getComputedStyle(element).top))
  expect(stickyTop).toBe(0)
  const searchTop = (await tools.locator('input').boundingBox())!.y
  expect(searchTop).toBeGreaterThanOrEqual(104)
  await page.goto('/lexemes/e56d27ff-9b5a-5a52-b90f-02e5233e711b')
  const standalonePadding = await page.locator('.app-shell').first().evaluate((element) => Number.parseFloat(getComputedStyle(element).paddingTop))
  expect(standalonePadding).toBeGreaterThanOrEqual(104)
})

test('does not add Telegram clearance in a regular browser', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('html')).toHaveAttribute('data-telegram', 'false')
  const paddingTop = await page.locator('.app-shell').first().evaluate((element) => Number.parseFloat(getComputedStyle(element).paddingTop))
  expect(paddingTop).toBeLessThan(104)
})

test('places audio and bookmark controls on either side of the lexeme', async ({ page }) => {
  await page.goto('/lexemes/e56d27ff-9b5a-5a52-b90f-02e5233e711b')
  const actions = page.locator('.lexeme-word-actions')
  const audio = actions.getByRole('button', { name: 'Озвучивание пока недоступно' })
  const word = actions.locator('.lexeme-word')
  const bookmark = actions.getByRole('button', { name: 'Сохранить слово' })
  await expect(audio).toBeDisabled()
  await expect(actions.locator(':scope > *')).toHaveCount(3)
  const [audioBox, wordBox, bookmarkBox] = await Promise.all([audio.boundingBox(), word.boundingBox(), bookmark.boundingBox()])
  expect(audioBox!.x).toBeLessThan(wordBox!.x)
  expect(wordBox!.x).toBeLessThan(bookmarkBox!.x)
  expect(audioBox!.width).toBeGreaterThanOrEqual(44)
  expect(bookmarkBox!.width).toBeGreaterThanOrEqual(44)
})

test('opens dialogs in the center and restores page scrolling after close', async ({ page }) => {
  await page.goto('/library')
  await page.getByRole('button', { name: /Новая колода/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Новая колода' })
  await expect(dialog).toBeVisible()
  const viewport = page.viewportSize()!
  const box = await dialog.boundingBox()
  expect(box!.width).toBeLessThanOrEqual(440)
  expect(Math.abs(box!.y + box!.height / 2 - viewport.height / 2)).toBeLessThan(32)
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe('hidden')
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe('')
})

test('masks scrolling dictionary cards above the search in Telegram', async ({ page }) => {
  await page.route('https://telegram.org/js/telegram-web-app.js', (route) => route.abort())
  await page.addInitScript(() => {
    const empty = () => undefined
    window.Telegram = { WebApp: {
      initData: 'test', platform: 'ios', colorScheme: 'light', themeParams: {},
      safeAreaInset: { top: 12, right: 0, bottom: 0, left: 0 },
      contentSafeAreaInset: { top: 48, right: 0, bottom: 0, left: 0 },
      ready: empty, expand: empty, setHeaderColor: empty, setBackgroundColor: empty,
      onEvent: empty, offEvent: empty,
      BackButton: { show: empty, hide: empty, onClick: empty, offClick: empty },
    } }
  })
  await page.goto('/dictionary')
  await expect(page.locator('.word-card').first()).toBeVisible({ timeout: 15_000 })
  await page.locator('.app-scroll').evaluate((element) => { element.scrollTop = 700 })
  const tools = page.locator('.dictionary-tools')
  const viewportTop = (await page.locator('.app-viewport').boundingBox())!.y
  await expect.poll(async () => Math.abs(((await tools.boundingBox())?.y ?? 0) - viewportTop)).toBeLessThanOrEqual(1)
  const inputBox = await tools.locator('input').boundingBox()
  expect(inputBox!.y).toBeGreaterThanOrEqual(104)
  const mask = await tools.evaluate((element) => {
    const style = getComputedStyle(element, '::before')
    return { width: Number.parseFloat(style.width), color: style.backgroundColor }
  })
  expect(mask.width).toBeGreaterThanOrEqual(page.viewportSize()!.width)
  expect(mask.color).not.toBe('rgba(0, 0, 0, 0)')
})

test('uses application controls for profile settings', async ({ page }) => {
  await page.goto('/profile')
  await expect(page.locator('select')).toHaveCount(0)
  await expect(page.locator('input[type="checkbox"]')).toHaveCount(0)
  const toggle = page.getByRole('switch', { name: 'Включить напоминания' })
  await expect(toggle).toHaveAttribute('aria-checked', 'true')
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-checked', 'false')
  await page.getByRole('button', { name: /Дневная цель/ }).click()
  await page.getByRole('dialog', { name: 'Дневная цель' }).getByRole('radio', { name: '20 слов' }).click()
  await expect(page.getByRole('button', { name: /Дневная цель/ })).toContainText('20 слов')
})

test('creates a personal phrase, finds it in My and adds it to a deck', async ({ page }) => {
  await page.goto('/dictionary')
  await page.getByRole('button', { name: 'Добавить своё слово или фразу' }).click()
  const form = page.getByRole('dialog', { name: 'Своё слово или фраза' })
  await form.getByRole('button', { name: 'Фраза' }).click()
  await form.getByLabel('Арабский текст').fill('صباح الخير')
  await form.getByLabel('Перевод').fill('Доброе утро')
  await form.getByRole('button', { name: 'Создать', exact: true }).click()
  await page.getByRole('dialog', { name: 'Сохранить в колоду' }).getByRole('button', { name: /Еда и продукты/ }).click()
  await page.getByRole('radio', { name: 'Мои' }).click()
  await expect(page.getByText('صباح الخير')).toBeVisible()
  await expect(page.getByText('Моё')).toBeVisible()
  await page.getByRole('navigation').getByRole('link', { name: 'Колоды' }).click()
  await page.getByRole('link', { name: /Еда и продукты/ }).click()
  await expect(page.getByText('صباح الخير')).toBeVisible()
})

test('contains the app in a 520px desktop frame', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes('desktop'), 'desktop-only layout')
  await page.goto('/')
  const box = await page.locator('.app-viewport').boundingBox()
  expect(box!.width).toBeLessThanOrEqual(520)
  expect(box!.width).toBeLessThan(page.viewportSize()!.width)
  expect(await page.locator('.app-viewport').evaluate((element) => getComputedStyle(element).borderRadius)).not.toBe('0px')
})

test('honors reduced motion preferences', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  const duration = await page.locator('.route-content').evaluate((element) => Number.parseFloat(getComputedStyle(element).animationDuration))
  expect(duration).toBeLessThanOrEqual(0.001)
})
