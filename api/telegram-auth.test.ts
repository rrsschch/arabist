import crypto from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { validateTelegramInitData } from './[...path]'

const token = '123456:test-token'

function signInitData(values: Record<string, string>) {
  const params = new URLSearchParams(values)
  const dataCheckString = [...params.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}=${value}`).join('\n')
  const secret = crypto.createHmac('sha256', 'WebAppData').update(token).digest()
  const hash = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex')
  params.set('hash', hash)
  return params.toString()
}

describe('Telegram initData validation', () => {
  it('accepts a valid signed Telegram payload', () => {
    const initData = signInitData({
      auth_date: String(Math.floor(Date.now() / 1000)),
      query_id: 'query',
      user: JSON.stringify({ id: 101, first_name: 'Sanna', username: 'learner' }),
    })

    expect(validateTelegramInitData(initData, token).user).toMatchObject({ id: 101, first_name: 'Sanna' })
  })

  it('rejects invalid signatures', () => {
    const initData = signInitData({
      auth_date: String(Math.floor(Date.now() / 1000)),
      user: JSON.stringify({ id: 101, first_name: 'Sanna' }),
    }).replace('Sanna', 'Mallory')

    expect(() => validateTelegramInitData(initData, token)).toThrow('Invalid Telegram signature')
  })

  it('rejects expired payloads and missing users', () => {
    const expired = signInitData({
      auth_date: String(Math.floor(Date.now() / 1000) - 60 * 60 * 24 * 31),
      user: JSON.stringify({ id: 101, first_name: 'Sanna' }),
    })
    const missingUser = signInitData({ auth_date: String(Math.floor(Date.now() / 1000)) })

    expect(() => validateTelegramInitData(expired, token)).toThrow('expired')
    expect(validateTelegramInitData(missingUser, token).user).toEqual({})
  })
})
