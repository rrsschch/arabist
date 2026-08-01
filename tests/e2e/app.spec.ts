import { expect, test } from '@playwright/test'

test('searches real Arabic data and opens a word', async ({ page }) => {
  await page.goto('/dictionary')
  await expect(page.getByRole('heading', { name: 'Словарь' })).toBeVisible()
  await page.getByRole('textbox', { name: 'Поиск слов' }).fill('август')
  const card = page.locator('article').first()
  await expect(card).toContainText('آبُ')
  await card.getByRole('link').click()
  await expect(page.getByText('1) август')).toBeVisible()
})

test('creates a deck and persists it after reload', async ({ page }) => {
  await page.goto('/library/arabic')
  await page.getByRole('button', { name: /Новая колода/ }).click()
  await page.getByLabel('Название').fill('Моя колода')
  await page.getByRole('button', { name: 'Создать' }).click()
  await expect(page.getByText('Моя колода')).toBeVisible()
  await page.reload()
  await expect(page.getByText('Моя колода')).toBeVisible()
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
