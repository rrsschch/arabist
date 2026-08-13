import crypto from 'node:crypto'

type Json = null | boolean | number | string | Json[] | { [key: string]: Json }
type Req = { method?: string; url?: string; headers: Record<string, string | string[] | undefined>; body?: unknown }
type Res = { status(code: number): Res; setHeader(name: string, value: string | string[]): void; json(value: unknown): void; end(value?: string): void }

type Theme = 'telegram' | 'light' | 'dark'
type Accent = 'blue' | 'emerald' | 'purple' | 'rose' | 'amber'
type Grade = 'again' | 'hard' | 'easy'
type Mode = 'review' | 'study' | 'flip' | 'quiz'

const cookieName = 'sanna_session'
const month = 60 * 60 * 24 * 30
const defaultDecks = [
  { id: 'food', emoji: '🥑', title: 'Еда и продукты', wordIds: [] as string[] },
  { id: 'verbs', emoji: '🏃', title: 'Глаголы', wordIds: [] as string[] },
  { id: 'popular', emoji: '👋', title: 'Популярные фразы', wordIds: [] as string[] },
]

export default async function handler(req: Req, res: Res) {
  try {
    const url = new URL(req.url ?? '/', 'http://localhost')
    const routedPath = url.searchParams.get('path') ?? url.pathname.replace(/^\/api\/?/, '')
    const path = routedPath.split('/').filter(Boolean)

    if (req.method === 'POST' && route(path, 'auth', 'telegram')) return authTelegram(req, res)

    const user = await requireUser(req)
    if (req.method === 'GET' && route(path, 'profile')) return getProfile(res, user.userId)
    if (req.method === 'PATCH' && route(path, 'profile')) return patchProfile(req, res, user.userId)
    if (route(path, 'user-lexemes')) return userLexemes(req, res, user.userId, path[1])
    if (route(path, 'decks')) return decks(req, res, user.userId, path)
    if (route(path, 'training', 'sessions')) return trainingSessions(req, res, user.userId, path)
    if (req.method === 'GET' && route(path, 'review-stats')) return reviewStats(res, user.userId)
    if (req.method === 'POST' && route(path, 'import')) return importSnapshot(req, res, user.userId)

    return fail(res, 404, 'Not found')
  } catch (error) {
    if (error instanceof HttpError) return fail(res, error.status, error.message)
    console.error(error)
    return fail(res, 500, 'Internal server error')
  }
}

async function authTelegram(req: Req, res: Res) {
  const body = await readBody<{ initData?: string }>(req)
  const parsed = validateTelegramInitData(body.initData ?? '')
  const user = parsed.user
  if (!user?.id || !user.first_name) throw new HttpError(400, 'Telegram user is missing')

  const rows = await supabase('users', {
    method: 'POST',
    search: 'on_conflict=telegram_id',
    body: [{
      telegram_id: user.id,
      username: user.username ?? null,
      first_name: user.first_name,
      photo_url: user.photo_url ?? null,
      updated_at: new Date().toISOString(),
    }],
    prefer: 'resolution=merge-duplicates,return=representation',
  }) as DbUser[]
  const row = rows[0]
  await ensureProfile(row.id)

  res.setHeader('Set-Cookie', serializeSession({ userId: row.id, telegramId: row.telegram_id }))
  return ok(res, { id: row.telegram_id, firstName: row.first_name, username: row.username, photoUrl: row.photo_url })
}

async function getProfile(res: Res, userId: string) {
  const profile = await ensureProfile(userId)
  return ok(res, mapProfile(profile))
}

async function patchProfile(req: Req, res: Res, userId: string) {
  const body = await readBody<Partial<{ dailyGoal: number; notifications: boolean; theme: Theme; accent: Accent }>>(req)
  const patch: Record<string, Json> = { updated_at: new Date().toISOString() }
  if (typeof body.dailyGoal === 'number') patch.daily_goal = clamp(Math.round(body.dailyGoal), 0, 1000)
  if (typeof body.notifications === 'boolean') patch.notifications = body.notifications
  if (isOneOf(body.theme, ['telegram', 'light', 'dark'])) patch.theme = body.theme
  if (isOneOf(body.accent, ['blue', 'emerald', 'purple', 'rose', 'amber'])) patch.accent = body.accent
  const rows = await supabase('profiles', { method: 'PATCH', search: eq({ user_id: userId }), body: patch, prefer: 'return=representation' }) as DbProfile[]
  return ok(res, mapProfile(rows[0] ?? await ensureProfile(userId)))
}

async function userLexemes(req: Req, res: Res, userId: string, id?: string) {
  if (req.method === 'GET' && !id) {
    const rows = await supabase('user_lexemes', { search: `${eq({ user_id: userId })}&order=created_at.asc` }) as DbUserLexeme[]
    return ok(res, rows.map(mapUserLexeme))
  }
  if (req.method === 'POST' && !id) {
    const input = validateUserLexeme(await readBody<UserLexemeInput>(req))
    const rows = await supabase('user_lexemes', { method: 'POST', body: [{ user_id: userId, ...input }], prefer: 'return=representation' }) as DbUserLexeme[]
    return ok(res, mapUserLexeme(rows[0]), 201)
  }
  if (!id) return fail(res, 404, 'Not found')
  if (req.method === 'GET') {
    const row = await ownedUserLexeme(userId, id)
    return ok(res, row ? mapUserLexeme(row) : null)
  }
  if (req.method === 'PATCH') {
    await ownedUserLexeme(userId, id, true)
    const input = validateUserLexeme(await readBody<UserLexemeInput>(req))
    const rows = await supabase('user_lexemes', { method: 'PATCH', search: eq({ id, user_id: userId }), body: { ...input, updated_at: new Date().toISOString() }, prefer: 'return=representation' }) as DbUserLexeme[]
    return ok(res, mapUserLexeme(rows[0]))
  }
  if (req.method === 'DELETE') {
    await ownedUserLexeme(userId, id, true)
    const deckIds = await userDeckIdsCsv(userId)
    if (deckIds) await supabase('deck_lexemes', { method: 'DELETE', search: `lexeme_source=eq.user&lexeme_id=eq.${encodeURIComponent(id)}&deck_id=in.(${deckIds})` })
    await supabase('user_lexemes', { method: 'DELETE', search: eq({ id, user_id: userId }) })
    return ok(res, { ok: true })
  }
  return fail(res, 405, 'Method not allowed')
}

async function decks(req: Req, res: Res, userId: string, path: string[]) {
  const id = path[1]
  const action = path[2]
  if (req.method === 'GET' && !id) return ok(res, { decks: await listDecks(userId) })
  if (req.method === 'POST' && !id) {
    const input = validateDeck(await readBody<{ title?: string; emoji?: string }>(req))
    const rows = await supabase('decks', { method: 'POST', body: [{ user_id: userId, ...input }], prefer: 'return=representation' }) as DbDeck[]
    return ok(res, await hydrateDeck(rows[0]), 201)
  }
  if (!id) return fail(res, 404, 'Not found')
  if (action === 'lexemes') return deckLexemes(req, res, userId, id)
  if (action === 'move' && req.method === 'POST') return moveLexemes(req, res, userId, id)
  if (req.method === 'PATCH') {
    await ownedDeck(userId, id, true)
    const input = validateDeck(await readBody<{ title?: string; emoji?: string }>(req))
    const rows = await supabase('decks', { method: 'PATCH', search: eq({ id, user_id: userId }), body: { ...input, updated_at: new Date().toISOString() }, prefer: 'return=representation' }) as DbDeck[]
    return ok(res, await hydrateDeck(rows[0]))
  }
  if (req.method === 'DELETE') {
    await ownedDeck(userId, id, true)
    await supabase('decks', { method: 'DELETE', search: eq({ id, user_id: userId }) })
    return ok(res, { ok: true })
  }
  return fail(res, 405, 'Method not allowed')
}

async function deckLexemes(req: Req, res: Res, userId: string, deckId: string) {
  await ownedDeck(userId, deckId, true)
  const body = await readBody<{ lexemeId?: string; lexemeIds?: string[]; source?: 'dictionary' | 'user' }>(req)
  const ids = body.lexemeIds ?? (body.lexemeId ? [body.lexemeId] : [])
  if (req.method === 'POST') {
    const existing = await deckLexemeCount(deckId)
    const rows = await Promise.all(ids.filter(Boolean).map(async (id, index) => ({ deck_id: deckId, lexeme_id: id, lexeme_source: body.source ?? await sourceForId(userId, id), position: existing + index })))
    if (rows.length) await supabase('deck_lexemes', { method: 'POST', search: 'on_conflict=deck_id,lexeme_source,lexeme_id', body: rows, prefer: 'resolution=ignore-duplicates' })
    return ok(res, { ok: true })
  }
  if (req.method === 'DELETE') {
    await deleteDeckLexemes(userId, deckId, ids)
    return ok(res, { ok: true })
  }
  return fail(res, 405, 'Method not allowed')
}

async function moveLexemes(req: Req, res: Res, userId: string, sourceDeckId: string) {
  const body = await readBody<{ targetDeckId?: string; lexemeIds?: string[] }>(req)
  const targetDeckId = body.targetDeckId ?? ''
  const ids = body.lexemeIds ?? []
  if (!targetDeckId || sourceDeckId === targetDeckId) throw new HttpError(400, 'Choose another deck')
  await ownedDeck(userId, sourceDeckId, true)
  await ownedDeck(userId, targetDeckId, true)
    const rows = await supabase('deck_lexemes', { search: `${eq({ deck_id: sourceDeckId })}&lexeme_id=in.(${ids.map(encodeURIComponent).join(',')})` }) as DbDeckLexeme[]
  await deleteDeckLexemes(userId, sourceDeckId, ids)
  const offset = await deckLexemeCount(targetDeckId)
  if (rows.length) await supabase('deck_lexemes', {
    method: 'POST',
    search: 'on_conflict=deck_id,lexeme_source,lexeme_id',
    body: rows.map((row, index) => ({ deck_id: targetDeckId, lexeme_source: row.lexeme_source, lexeme_id: row.lexeme_id, position: offset + index })),
    prefer: 'resolution=ignore-duplicates',
  })
  return ok(res, { ok: true })
}

async function trainingSessions(req: Req, res: Res, userId: string, path: string[]) {
  const sessionId = path[2]
  const action = path[3]
  if (req.method === 'POST' && !sessionId) {
    const body = await readBody<{ mode?: Mode; lexemeIds?: string[] }>(req)
    if (!isOneOf(body.mode, ['review', 'study', 'flip', 'quiz'])) throw new HttpError(400, 'Invalid training mode')
    const lexemeIds = (body.lexemeIds ?? []).filter((id): id is string => typeof id === 'string' && id.length > 0)
    const rows = await supabase('training_sessions', { method: 'POST', body: [{ user_id: userId, mode: body.mode, lexeme_ids: lexemeIds, completed: lexemeIds.length === 0 }], prefer: 'return=representation' }) as DbSession[]
    return ok(res, await mapSession(rows[0]), 201)
  }
  if (!sessionId) return fail(res, 404, 'Not found')
  if (req.method === 'GET' && !action) {
    const row = await ownedSession(userId, sessionId)
    return ok(res, row ? await mapSession(row) : null)
  }
  if (req.method === 'POST' && action === 'answers') {
    const body = await readBody<{ lexemeId?: string; grade?: Grade }>(req)
    if (!body.lexemeId || !isOneOf(body.grade, ['again', 'hard', 'easy'])) throw new HttpError(400, 'Invalid answer')
    const session = await ownedSession(userId, sessionId, true)
    await supabase('review_events', { method: 'POST', body: [{ session_id: session.id, user_id: userId, lexeme_id: body.lexemeId, grade: body.grade }] })
    const cursor = session.cursor + 1
    const completed = cursor >= session.lexeme_ids.length
    const rows = await supabase('training_sessions', { method: 'PATCH', search: eq({ id: session.id, user_id: userId }), body: { cursor, completed, updated_at: new Date().toISOString() }, prefer: 'return=representation' }) as DbSession[]
    await supabase('profiles', { method: 'PATCH', search: eq({ user_id: userId }), body: { reviewed_total: await reviewedTotal(userId), updated_at: new Date().toISOString() } })
    return ok(res, await mapSession(rows[0]))
  }
  if (req.method === 'POST' && action === 'skip-missing') {
    const body = await readBody<{ lexemeId?: string }>(req)
    const session = await ownedSession(userId, sessionId, true)
    const cursor = session.lexeme_ids[session.cursor] === body.lexemeId ? session.cursor + 1 : session.cursor
    const completed = cursor >= session.lexeme_ids.length
    const rows = await supabase('training_sessions', { method: 'PATCH', search: eq({ id: session.id, user_id: userId }), body: { cursor, completed, updated_at: new Date().toISOString() }, prefer: 'return=representation' }) as DbSession[]
    return ok(res, await mapSession(rows[0]))
  }
  return fail(res, 405, 'Method not allowed')
}

async function reviewStats(res: Res, userId: string) {
  const rows = await supabase('review_events', { search: `${eq({ user_id: userId, grade: 'easy' })}&select=lexeme_id` }) as Array<{ lexeme_id: string }>
  return ok(res, { learned: new Set(rows.map((row) => row.lexeme_id)).size })
}

async function importSnapshot(req: Req, res: Res, userId: string) {
  const body = await readBody<{ importKey?: string; library?: { decks?: Array<{ title?: string; emoji?: string; wordIds?: string[] }> }; userLexemes?: ImportUserLexeme[]; profile?: Partial<{ dailyGoal: number; notifications: boolean; theme: Theme; accent: Accent }> }>(req)
  const importKey = (body.importKey ?? '').trim()
  if (!importKey) throw new HttpError(400, 'Import key is required')
  const inserted = await supabase('import_batches', { method: 'POST', search: 'on_conflict=user_id,import_key', body: [{ user_id: userId, import_key: importKey }], prefer: 'resolution=ignore-duplicates,return=representation' }) as unknown[]
  if (inserted.length === 0) return ok(res, { imported: false })

  if (body.profile) await patchProfile({ ...req, body: body.profile }, noopRes(), userId)
  const createdLexemes = new Map<string, string>()
  for (const entry of body.userLexemes ?? []) {
    const input = validateUserLexeme(entry)
    const rows = await supabase('user_lexemes', { method: 'POST', body: [{ user_id: userId, ...input }], prefer: 'return=representation' }) as DbUserLexeme[]
    if (entry.id) createdLexemes.set(entry.id, rows[0].id)
  }
  for (const deck of body.library?.decks ?? []) {
    const input = validateDeck(deck)
    const rows = await supabase('decks', { method: 'POST', body: [{ user_id: userId, ...input }], prefer: 'return=representation' }) as DbDeck[]
    const deckId = rows[0].id
    const wordIds = Array.isArray(deck.wordIds) ? [...new Set(deck.wordIds)].map((id) => createdLexemes.get(id) ?? id) : []
    if (wordIds.length) await supabase('deck_lexemes', {
      method: 'POST',
      body: await Promise.all(wordIds.map(async (id, index) => ({ deck_id: deckId, lexeme_source: await sourceForId(userId, id), lexeme_id: id, position: index }))),
      prefer: 'return=minimal',
    })
  }
  return ok(res, { imported: true, createdUserLexemes: createdLexemes.size })
}

export function validateTelegramInitData(initData: string, token = env('TELEGRAM_BOT_TOKEN')) {
  if (!initData) throw new HttpError(401, 'Telegram initData is required')
  const params = new URLSearchParams(initData)
  const hash = params.get('hash')
  if (!hash) throw new HttpError(401, 'Telegram hash is missing')
  params.delete('hash')
  const dataCheckString = [...params.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}=${value}`).join('\n')
  const secret = crypto.createHmac('sha256', 'WebAppData').update(token).digest()
  const expected = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex')
  if (!timingSafeEqual(hash, expected)) throw new HttpError(401, 'Invalid Telegram signature')
  const authDate = Number(params.get('auth_date') ?? 0)
  if (!authDate || Date.now() / 1000 - authDate > month) throw new HttpError(401, 'Telegram initData expired')
  const user = JSON.parse(params.get('user') ?? '{}') as { id?: number; first_name?: string; username?: string; photo_url?: string }
  return { user }
}

async function requireUser(req: Req) {
  const raw = parseCookie(req.headers.cookie)[cookieName]
  if (!raw) throw new HttpError(401, 'Not authenticated')
  const [payload, signature] = raw.split('.')
  if (!payload || !signature || !timingSafeEqual(signature, sign(payload))) throw new HttpError(401, 'Invalid session')
  const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { userId?: string; telegramId?: number; exp?: number }
  if (!data.userId || !data.exp || data.exp < Date.now() / 1000) throw new HttpError(401, 'Session expired')
  return { userId: data.userId, telegramId: data.telegramId ?? 0 }
}

function serializeSession(input: { userId: string; telegramId: number }) {
  const payload = Buffer.from(JSON.stringify({ ...input, exp: Math.floor(Date.now() / 1000) + month }), 'utf8').toString('base64url')
  return `${cookieName}=${payload}.${sign(payload)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${month}`
}

function sign(value: string) {
  return crypto.createHmac('sha256', env('SESSION_SECRET', env('TELEGRAM_BOT_TOKEN'))).update(value).digest('base64url')
}

async function supabase(table: string, input: { method?: string; search?: string; body?: unknown; prefer?: string } = {}) {
  const url = `${env('SUPABASE_URL').replace(/\/$/, '')}/rest/v1/${table}${input.search ? `?${input.search}` : ''}`
  const response = await fetch(url, {
    method: input.method ?? 'GET',
    headers: {
      apikey: env('SUPABASE_SERVICE_ROLE_KEY'),
      Authorization: `Bearer ${env('SUPABASE_SERVICE_ROLE_KEY')}`,
      'Content-Type': 'application/json',
      ...(input.prefer ? { Prefer: input.prefer } : {}),
    },
    body: input.body === undefined ? undefined : JSON.stringify(input.body),
  })
  if (!response.ok) throw new HttpError(response.status, await response.text())
  if (response.status === 204) return null
  const text = await response.text()
  return text ? JSON.parse(text) : null
}

async function ensureProfile(userId: string) {
  const existing = await supabase('profiles', { search: eq({ user_id: userId }) }) as DbProfile[]
  if (existing[0]) return existing[0]
  const created = await supabase('profiles', { method: 'POST', body: [{ user_id: userId }], prefer: 'return=representation' }) as DbProfile[]
  return created[0]
}

async function listDecks(userId: string) {
  let rows = await supabase('decks', { search: `${eq({ user_id: userId })}&order=created_at.asc` }) as DbDeck[]
  if (rows.length === 0) {
    rows = await supabase('decks', {
      method: 'POST',
      body: defaultDecks.map((deck) => ({ user_id: userId, title: deck.title, emoji: deck.emoji })),
      prefer: 'return=representation',
    }) as DbDeck[]
  }
  return Promise.all(rows.map(hydrateDeck))
}

async function hydrateDeck(deck: DbDeck) {
  const rows = await supabase('deck_lexemes', { search: `${eq({ deck_id: deck.id })}&order=position.asc` }) as DbDeckLexeme[]
  return { id: deck.id, title: deck.title, emoji: deck.emoji, wordIds: rows.map((row) => row.lexeme_id) }
}

async function mapSession(session: DbSession) {
  const rows = await supabase('review_events', { search: `${eq({ session_id: session.id })}&order=reviewed_at.asc` }) as DbReviewEvent[]
  return { id: session.id, mode: session.mode, lexemeIds: session.lexeme_ids, cursor: session.cursor, completed: session.completed, answers: rows.map((row) => ({ lexemeId: row.lexeme_id, grade: row.grade, reviewedAt: row.reviewed_at })) }
}

async function ownedDeck(userId: string, id: string, required = false) {
  const rows = await supabase('decks', { search: eq({ id, user_id: userId }) }) as DbDeck[]
  if (!rows[0] && required) throw new HttpError(404, 'Deck not found')
  return rows[0] ?? null
}

async function ownedUserLexeme(userId: string, id: string, required = false) {
  const rows = await supabase('user_lexemes', { search: eq({ id, user_id: userId }) }) as DbUserLexeme[]
  if (!rows[0] && required) throw new HttpError(404, 'Personal lexeme not found')
  return rows[0] ?? null
}

async function ownedSession(userId: string, id: string, required = false) {
  const rows = await supabase('training_sessions', { search: eq({ id, user_id: userId }) }) as DbSession[]
  if (!rows[0] && required) throw new HttpError(404, 'Session not found')
  return rows[0] ?? null
}

async function deleteDeckLexemes(userId: string, deckId: string, ids: string[]) {
  await ownedDeck(userId, deckId, true)
  if (!ids.length) return
  await supabase('deck_lexemes', { method: 'DELETE', search: `${eq({ deck_id: deckId })}&lexeme_id=in.(${ids.map(encodeURIComponent).join(',')})` })
}

async function userDeckIdsCsv(userId: string) {
  const rows = await supabase('decks', { search: `${eq({ user_id: userId })}&select=id` }) as Array<{ id: string }>
  return rows.map((row) => row.id).join(',')
}

async function deckLexemeCount(deckId: string) {
  const rows = await supabase('deck_lexemes', { search: `${eq({ deck_id: deckId })}&select=lexeme_id` }) as unknown[]
  return rows.length
}

async function reviewedTotal(userId: string) {
  const rows = await supabase('review_events', { search: `${eq({ user_id: userId })}&select=id` }) as unknown[]
  return rows.length
}

function mapProfile(profile: DbProfile) {
  return { name: 'Ученик', dailyGoal: profile.daily_goal, notifications: profile.notifications, theme: profile.theme, accent: profile.accent, streak: profile.streak, reviewedTotal: profile.reviewed_total }
}

function mapUserLexeme(row: DbUserLexeme) {
  return {
    id: row.id,
    word_ar: row.word_ar,
    pos: null,
    subtype: null,
    translations: [row.translation],
    examples: [],
    details: { root: null, form: null, present_vowel: null, masdar: null, plural: null, gender: null, subtype: null },
    kind: 'phrase',
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function validateUserLexeme(input: UserLexemeInput | ImportUserLexeme) {
  const word_ar = String(input.word_ar ?? '').trim()
  const translation = String(input.translation ?? input.translations?.[0] ?? '').trim()
  const note = String(input.note ?? '').trim()
  if (!word_ar) throw new HttpError(400, 'Arabic phrase is required')
  if (!translation) throw new HttpError(400, 'Translation is required')
  return { word_ar, translation, note: note || null }
}

function validateDeck(input: { title?: string; emoji?: string }) {
  const title = String(input.title ?? '').trim()
  const emoji = String(input.emoji ?? '').trim() || '✨'
  if (!title) throw new HttpError(400, 'Deck title is required')
  return { title, emoji }
}

async function sourceForId(userId: string, id: string): Promise<'dictionary' | 'user'> {
  const personal = await ownedUserLexeme(userId, id)
  return personal ? 'user' : 'dictionary'
}

function eq(values: Record<string, string | number | boolean>) {
  return Object.entries(values).map(([key, value]) => `${key}=eq.${encodeURIComponent(String(value))}`).join('&')
}

async function readBody<T>(req: Req): Promise<T> {
  if (req.body && typeof req.body === 'object') return req.body as T
  if (typeof req.body === 'string') return JSON.parse(req.body) as T
  return {} as T
}

function route(path: string[], ...parts: string[]) {
  return parts.every((part, index) => path[index] === part)
}

function ok(res: Res, data: unknown, status = 200) {
  res.status(status).json(data)
}

function fail(res: Res, status: number, message: string) {
  res.status(status).json({ error: message })
}

function parseCookie(header: string | string[] | undefined) {
  const raw = Array.isArray(header) ? header.join(';') : header ?? ''
  return Object.fromEntries(raw.split(';').map((part) => part.trim().split('=')).filter(([key, value]) => key && value))
}

function timingSafeEqual(a: string, b: string) {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && crypto.timingSafeEqual(left, right)
}

function isOneOf<T extends string>(value: unknown, values: readonly T[]): value is T {
  return typeof value === 'string' && values.includes(value as T)
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function env(name: string, fallback?: string) {
  const value = process.env[name] ?? fallback
  if (!value) throw new HttpError(500, `${name} is not configured`)
  return value
}

function noopRes(): Res {
  return { status: () => noopRes(), setHeader() {}, json() {}, end() {} }
}

class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message)
  }
}

interface UserLexemeInput { word_ar?: string; translation?: string; translations?: string[]; note?: string }
interface ImportUserLexeme extends UserLexemeInput { id?: string }
interface DbUser { id: string; telegram_id: number; username: string | null; first_name: string; photo_url: string | null }
interface DbProfile { daily_goal: number; notifications: boolean; theme: Theme; accent: Accent; streak: number; reviewed_total: number }
interface DbUserLexeme { id: string; word_ar: string; translation: string; note: string | null; created_at: string; updated_at: string }
interface DbDeck { id: string; title: string; emoji: string }
interface DbDeckLexeme { lexeme_source: 'dictionary' | 'user'; lexeme_id: string }
interface DbSession { id: string; mode: Mode; lexeme_ids: string[]; cursor: number; completed: boolean }
interface DbReviewEvent { lexeme_id: string; grade: Grade; reviewed_at: string }
