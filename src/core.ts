import { z } from 'zod'

export type PartOfSpeech = 'noun' | 'verb' | 'particle'
export type ReviewGrade = 'again' | 'hard' | 'easy'
export type TrainingMode = 'review' | 'study' | 'flip' | 'quiz'
export type ThemePreference = 'telegram' | 'light' | 'dark'
export type Accent = 'blue' | 'emerald' | 'purple' | 'rose' | 'amber'
export type LexemeSource = 'dictionary' | 'user'
export type UserLexemeKind = 'word' | 'phrase'

export interface LexemeDetails {
  root: string | null
  form: string | null
  present_vowel: string | null
  masdar: string | null
  plural: string | null
  gender: 'masculine' | 'feminine' | null
  subtype?: string | null
}

export interface Lexeme {
  id: string
  word_ar: string
  word_ar_plain?: string
  pos: PartOfSpeech
  subtype: string | null
  translations: string[]
  examples: string[]
  details: LexemeDetails
}

export interface UserLexeme {
  id: string
  word_ar: string
  pos: PartOfSpeech | null
  subtype: null
  translations: string[]
  examples: string[]
  details: LexemeDetails
  kind: UserLexemeKind
  note: string | null
  createdAt: string
  updatedAt: string
}

export interface UserLexemeInput {
  kind: UserLexemeKind
  word_ar: string
  translation: string
  pos?: PartOfSpeech | null
  example?: string
  note?: string
}

export type CatalogLexeme = (Lexeme & { source: 'dictionary'; kind: 'word'; note: null }) |
  (UserLexeme & { source: 'user' })

export interface Deck { id: string; title: string; emoji: string; wordIds: string[] }
export interface LibraryState { decks: Deck[] }
export interface ReviewEvent { lexemeId: string; grade: ReviewGrade; reviewedAt: string }
export interface TrainingSession {
  id: string
  mode: TrainingMode
  lexemeIds: string[]
  cursor: number
  answers: ReviewEvent[]
  completed: boolean
}
export interface Profile {
  name: string
  dailyGoal: number
  notifications: boolean
  theme: ThemePreference
  accent: Accent
  streak: number
  reviewedTotal: number
}

export const lexemeSchema = z.object({
  id: z.string().min(1),
  word_ar: z.string().min(1),
  pos: z.enum(['noun', 'verb', 'particle']),
  subtype: z.string().nullable(),
  translations: z.array(z.string()).min(1),
  examples: z.array(z.string()),
  details: z.object({
    root: z.string().nullable(),
    form: z.string().nullable(),
    present_vowel: z.string().nullable(),
    masdar: z.string().nullable(),
    plural: z.string().nullable(),
    gender: z.enum(['masculine', 'feminine']).nullable(),
    subtype: z.string().nullable().optional(),
  }),
})
export const lexemeListSchema = z.array(lexemeSchema)

export const userLexemeSchema = z.object({
  id: z.string().min(1),
  word_ar: z.string().trim().min(1),
  pos: z.enum(['noun', 'verb', 'particle']).nullable(),
  subtype: z.null(),
  translations: z.array(z.string().trim().min(1)).min(1),
  examples: z.array(z.string().trim().min(1)),
  details: lexemeSchema.shape.details,
  kind: z.enum(['word', 'phrase']),
  note: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})
export const userLexemeListSchema = z.array(userLexemeSchema)

const STORAGE_PREFIX = 'sanna.mock.v2'
const LEGACY_STORAGE_PREFIX = 'sanna.mock.v1'
const USER_LEXEME_STORAGE_PREFIX = 'sanna.user-lexemes.v1'
const key = (name: string) => `${STORAGE_PREFIX}.${name}`
const legacyKey = (name: string) => `${LEGACY_STORAGE_PREFIX}.${name}`

function read<T>(name: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key(name))
    return raw ? (JSON.parse(raw) as T) : structuredClone(fallback)
  } catch { return structuredClone(fallback) }
}
function write<T>(name: string, value: T) { localStorage.setItem(key(name), JSON.stringify(value)) }
export function resetDemoData() {
  Object.keys(localStorage)
    .filter((item) => item.startsWith(STORAGE_PREFIX) || item.startsWith(LEGACY_STORAGE_PREFIX) || item.startsWith(USER_LEXEME_STORAGE_PREFIX))
    .forEach((item) => localStorage.removeItem(item))
}

const defaultLibrary: LibraryState = {
  decks: [
    { id: 'food', emoji: '🥑', title: 'Еда и продукты', wordIds: [] },
    { id: 'verbs', emoji: '🏃', title: 'Глаголы', wordIds: [] },
    { id: 'popular', emoji: '👋', title: 'Популярные фразы', wordIds: [] },
  ],
}
const defaultProfile: Profile = {
  name: 'Ученик', dailyGoal: 30, notifications: true, theme: 'telegram', accent: 'blue', streak: 12, reviewedTotal: 248,
}

export interface LexemeRepository {
  list(): Promise<CatalogLexeme[]>
  search(input: { query?: string; source?: LexemeSource | 'all'; limit?: number }): Promise<CatalogLexeme[]>
  get(id: string): Promise<CatalogLexeme | null>
}
export interface UserLexemeRepository {
  setUserKey(userKey: string): void
  list(): Promise<UserLexeme[]>
  get(id: string): Promise<UserLexeme | null>
  create(input: UserLexemeInput): Promise<UserLexeme>
  update(id: string, input: UserLexemeInput): Promise<UserLexeme>
  remove(id: string): Promise<void>
}
export interface LibraryRepository {
  get(): Promise<LibraryState>
  createDeck(title: string, emoji?: string): Promise<Deck>
  updateDeck(id: string, patch: Pick<Deck, 'title' | 'emoji'>): Promise<Deck>
  remove(id: string): Promise<void>
  addLexeme(deckId: string, lexemeId: string): Promise<void>
  toggleLexeme(deckId: string, lexemeId: string): Promise<boolean>
  removeLexemes(deckId: string, lexemeIds: string[]): Promise<void>
  moveLexemes(sourceDeckId: string, targetDeckId: string, lexemeIds: string[]): Promise<void>
  removeLexemeEverywhere(lexemeId: string): Promise<void>
}
export interface ReviewRepository {
  start(mode: TrainingMode, lexemeIds: string[]): Promise<TrainingSession>
  get(id: string): Promise<TrainingSession | null>
  answer(id: string, lexemeId: string, grade: ReviewGrade): Promise<TrainingSession>
  skipMissing(id: string, lexemeId: string): Promise<TrainingSession>
  stats(): Promise<ReviewStats>
}
export interface ProfileRepository { get(): Promise<Profile>; update(patch: Partial<Profile>): Promise<Profile> }
export interface AuthGateway { exchangeTelegramInitData(initData: string): Promise<{ id: number; firstName: string }> }
export interface AudioRepository { getUrl(lexemeId: string): Promise<string | null> }
export interface ReviewStats { learned: number }
export interface LocalSnapshot {
  importKey: string
  profile: Profile
  library: LibraryState
  userLexemes: UserLexeme[]
}
export interface BackendController {
  isEnabled(): boolean
  authenticate(initData: string): Promise<void>
  importLocalSnapshot(userKey: string): Promise<void>
}

class StaticLexemeRepository {
  private cache?: Promise<Lexeme[]>
  list() {
    this.cache ??= fetch('/data/lexemes.json')
      .then((response) => { if (!response.ok) throw new Error('Не удалось загрузить словарь'); return response.json() })
      .then((value) => lexemeListSchema.parse(value))
    return this.cache
  }
  async search({ query = '', limit = 80 }: { query?: string; limit?: number }) {
    const normalized = normalize(query)
    const words = await this.list()
    return words.filter((word) => {
      if (!normalized) return true
      const haystack = [word.word_ar, word.details.root ?? '', ...word.translations].map(normalize).join(' ')
      return haystack.includes(normalized)
    }).slice(0, limit)
  }
  async get(id: string) { return (await this.list()).find((word) => word.id === id) ?? null }
}

const emptyDetails = (): LexemeDetails => ({ root: null, form: null, present_vowel: null, masdar: null, plural: null, gender: null })

export class LocalUserLexemeRepository implements UserLexemeRepository {
  private userKey = 'demo'
  setUserKey(userKey: string) { this.userKey = userKey.trim().replace(/[^a-zA-Z0-9_-]/g, '') || 'demo' }
  private storageKey() { return `${USER_LEXEME_STORAGE_PREFIX}:${this.userKey}` }
  private read() {
    try { return userLexemeListSchema.parse(JSON.parse(localStorage.getItem(this.storageKey()) ?? '[]')) }
    catch { return [] }
  }
  private normalize(entry: UserLexeme): UserLexeme {
    return { ...entry, kind: 'phrase', pos: null, examples: [] }
  }
  private write(value: UserLexeme[]) { localStorage.setItem(this.storageKey(), JSON.stringify(value)) }
  async list() { return this.read().map((entry) => this.normalize(entry)) }
  async get(id: string) { return (await this.list()).find((entry) => entry.id === id) ?? null }
  async create(input: UserLexemeInput) {
    const values = validateUserLexemeInput(input); const now = new Date().toISOString()
    const entry: UserLexeme = {
      id: crypto.randomUUID(), kind: 'phrase', word_ar: values.word_ar, pos: null, subtype: null,
      translations: [values.translation], examples: [], details: emptyDetails(),
      note: values.note || null, createdAt: now, updatedAt: now,
    }
    this.write([...this.read(), entry]); return entry
  }
  async update(id: string, input: UserLexemeInput) {
    const values = validateUserLexemeInput(input); const entries = this.read(); const index = entries.findIndex((entry) => entry.id === id)
    if (index < 0) throw new Error('Личная запись не найдена')
    const updated: UserLexeme = {
      ...entries[index], kind: 'phrase', word_ar: values.word_ar, pos: null,
      translations: [values.translation], examples: [],
      note: values.note || null, updatedAt: new Date().toISOString(),
    }
    entries[index] = updated; this.write(entries); return updated
  }
  async remove(id: string) { this.write(this.read().filter((entry) => entry.id !== id)) }
}

function validateUserLexemeInput(input: UserLexemeInput) {
  const word_ar = input.word_ar.trim(); const translation = input.translation.trim()
  if (!word_ar) throw new Error('Введите фразу на арабском')
  if (!translation) throw new Error('Введите перевод')
  return { kind: 'phrase' as const, word_ar, translation, pos: null, example: '', note: input.note?.trim() ?? '' }
}

class CombinedLexemeRepository implements LexemeRepository {
  constructor(private readonly dictionary: StaticLexemeRepository, private readonly personal: UserLexemeRepository) {}
  async list(): Promise<CatalogLexeme[]> {
    const [dictionary, user] = await Promise.all([this.dictionary.list(), this.personal.list()])
    return [
      ...dictionary.map((entry): CatalogLexeme => ({ ...entry, source: 'dictionary', kind: 'word', note: null })),
      ...user.map((entry): CatalogLexeme => ({ ...entry, source: 'user' })),
    ]
  }
  async search({ query = '', source = 'all', limit = 80 }: { query?: string; source?: LexemeSource | 'all'; limit?: number }) {
    const normalized = normalize(query)
    return (await this.list()).filter((word) => {
      if (source !== 'all' && word.source !== source) return false
      if (!normalized) return true
      const haystack = [word.word_ar, word.details.root ?? '', word.note ?? '', ...word.translations, ...word.examples].map(normalize).join(' ')
      return haystack.includes(normalized)
    }).slice(0, limit)
  }
  async get(id: string) { return (await this.list()).find((word) => word.id === id) ?? null }
}

function normalize(value: string) {
  return value.toLocaleLowerCase('ru').normalize('NFKD').replace(/[\u064b-\u065f\u0670]/g, '').trim()
}
function makeId(prefix: string) { return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` }

class LocalLibraryRepository implements LibraryRepository {
  async get() {
    const current = localStorage.getItem(key('library'))
    if (current) return read('library', defaultLibrary)
    const legacy = localStorage.getItem(legacyKey('library'))
    if (!legacy) return structuredClone(defaultLibrary)
    try {
      const migrated = migrateLibraryState(JSON.parse(legacy))
      this.save(migrated)
      return migrated
    } catch { return structuredClone(defaultLibrary) }
  }
  private save(value: LibraryState) { write('library', value) }
  async createDeck(title: string, emoji = '✨') {
    const state = await this.get(); const deck = { id: makeId('deck'), title, emoji, wordIds: [] }
    state.decks.push(deck); this.save(state); return deck
  }
  async updateDeck(id: string, patch: Pick<Deck, 'title' | 'emoji'>) {
    const state = await this.get(); const deck = state.decks.find((entry) => entry.id === id)
    if (!deck) throw new Error('Колода не найдена')
    const title = patch.title.trim()
    if (!title) throw new Error('Введите название колоды')
    deck.title = title
    deck.emoji = patch.emoji.trim() || '✨'
    this.save(state)
    return deck
  }
  async remove(id: string) {
    const state = await this.get()
    state.decks = state.decks.filter((deck) => deck.id !== id)
    this.save(state)
  }
  async toggleLexeme(deckId: string, lexemeId: string) {
    const state = await this.get(); const deck = state.decks.find((d) => d.id === deckId)
    if (!deck) throw new Error('Колода не найдена')
    const saved = !deck.wordIds.includes(lexemeId)
    deck.wordIds = saved ? [...deck.wordIds, lexemeId] : deck.wordIds.filter((id) => id !== lexemeId)
    this.save(state); return saved
  }
  async addLexeme(deckId: string, lexemeId: string) {
    const state = await this.get(); const deck = state.decks.find((d) => d.id === deckId)
    if (!deck) throw new Error('Колода не найдена')
    if (!deck.wordIds.includes(lexemeId)) deck.wordIds = [...deck.wordIds, lexemeId]
    this.save(state)
  }
  async removeLexemes(deckId: string, lexemeIds: string[]) {
    const state = await this.get(); const deck = state.decks.find((entry) => entry.id === deckId)
    if (!deck) throw new Error('Колода не найдена')
    const removing = new Set(lexemeIds)
    deck.wordIds = deck.wordIds.filter((id) => !removing.has(id))
    this.save(state)
  }
  async moveLexemes(sourceDeckId: string, targetDeckId: string, lexemeIds: string[]) {
    const state = await this.get()
    const source = state.decks.find((entry) => entry.id === sourceDeckId)
    const target = state.decks.find((entry) => entry.id === targetDeckId)
    if (!source) throw new Error('Исходная колода не найдена')
    if (!target) throw new Error('Целевая колода не найдена')
    if (source.id === target.id) throw new Error('Выберите другую колоду')
    const selected = new Set(lexemeIds)
    const moving = source.wordIds.filter((id) => selected.has(id))
    source.wordIds = source.wordIds.filter((id) => !selected.has(id))
    target.wordIds = [...new Set([...target.wordIds, ...moving])]
    this.save(state)
  }
  async removeLexemeEverywhere(lexemeId: string) {
    const state = await this.get()
    state.decks.forEach((deck) => { deck.wordIds = deck.wordIds.filter((id) => id !== lexemeId) })
    this.save(state)
  }
}

export function migrateLibraryState(value: unknown): LibraryState {
  if (!value || typeof value !== 'object') return structuredClone(defaultLibrary)
  const decks = (value as { decks?: unknown }).decks
  if (!Array.isArray(decks)) return structuredClone(defaultLibrary)
  const seen = new Set<string>()
  return {
    decks: decks.flatMap((entry) => {
      if (!entry || typeof entry !== 'object') return []
      const candidate = entry as Partial<Deck>
      if (typeof candidate.id !== 'string' || !candidate.id || seen.has(candidate.id) || typeof candidate.title !== 'string') return []
      seen.add(candidate.id)
      return [{
        id: candidate.id,
        title: candidate.title,
        emoji: typeof candidate.emoji === 'string' ? candidate.emoji : '✨',
        wordIds: Array.isArray(candidate.wordIds) ? [...new Set(candidate.wordIds.filter((id): id is string => typeof id === 'string'))] : [],
      }]
    }),
  }
}

export function buildTrainingQueue(library: LibraryState, lexemes: Array<Pick<Lexeme, 'id'>>, limit = 20) {
  const available = new Set(lexemes.map((word) => word.id))
  const saved = [...new Set(library.decks.flatMap((deck) => deck.wordIds))].filter((id) => available.has(id))
  return (saved.length ? saved : lexemes.map((word) => word.id)).slice(0, limit)
}

export function buildDeckTrainingQueue(deck: Pick<Deck, 'wordIds'>, lexemes: Array<Pick<Lexeme, 'id'>>, limit = 20) {
  const available = new Set(lexemes.map((word) => word.id))
  return [...new Set(deck.wordIds)].filter((id) => available.has(id)).slice(0, limit)
}

export function buildProfileLearningStats(library: LibraryState, sessions: Record<string, TrainingSession>) {
  const studied = new Set(library.decks.flatMap((deck) => deck.wordIds)).size
  const learned = new Set(Object.values(sessions).flatMap((session) => session.answers.filter((answer) => answer.grade === 'easy').map((answer) => answer.lexemeId))).size
  return { studied, learned, deckCount: library.decks.length }
}

class LocalReviewRepository implements ReviewRepository {
  async start(mode: TrainingMode, lexemeIds: string[]) {
    const session: TrainingSession = { id: makeId('session'), mode, lexemeIds, cursor: 0, answers: [], completed: lexemeIds.length === 0 }
    const sessions = read<Record<string, TrainingSession>>('sessions', {}); sessions[session.id] = session; write('sessions', sessions); return session
  }
  async get(id: string) { return read<Record<string, TrainingSession>>('sessions', {})[id] ?? null }
  async answer(id: string, lexemeId: string, grade: ReviewGrade) {
    const sessions = read<Record<string, TrainingSession>>('sessions', {}); const session = sessions[id]
    if (!session) throw new Error('Сессия не найдена')
    session.answers.push({ lexemeId, grade, reviewedAt: new Date().toISOString() })
    session.cursor += 1; session.completed = session.cursor >= session.lexemeIds.length
    sessions[id] = session; write('sessions', sessions)
    const profile = read('profile', defaultProfile); profile.reviewedTotal += 1; write('profile', profile)
    return session
  }
  async skipMissing(id: string, lexemeId: string) {
    const sessions = read<Record<string, TrainingSession>>('sessions', {}); const session = sessions[id]
    if (!session) throw new Error('Сессия не найдена')
    if (session.lexemeIds[session.cursor] === lexemeId) session.cursor += 1
    session.completed = session.cursor >= session.lexemeIds.length
    sessions[id] = session; write('sessions', sessions); return session
  }
  async stats() {
    const sessions = read<Record<string, TrainingSession>>('sessions', {})
    return { learned: buildProfileLearningStats(read('library', defaultLibrary), sessions).learned }
  }
}

export function calculateRubberBandOffset(delta: number, atTop: boolean, atBottom: boolean, isTelegram: boolean) {
  const canStretchTop = atTop && delta > 0 && !isTelegram
  const canStretchBottom = atBottom && delta < 0
  if (!canStretchTop && !canStretchBottom) return 0
  return Math.sign(delta) * Math.min(10, Math.abs(delta) * .12)
}

class LocalProfileRepository implements ProfileRepository {
  async get() { return read('profile', defaultProfile) }
  async update(patch: Partial<Profile>) { const next = { ...(await this.get()), ...patch }; write('profile', next); return next }
}

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '')

class ApiClient {
  private active = false
  isEnabled() { return Boolean(apiBaseUrl && this.active) }
  async authenticate(initData: string) {
    if (!apiBaseUrl || !initData) return
    await this.request('/auth/telegram', { method: 'POST', body: { initData }, allowInactive: true })
    this.active = true
  }
  async request<T>(path: string, init: { method?: string; body?: unknown; allowInactive?: boolean } = {}): Promise<T> {
    if (!apiBaseUrl) throw new Error('API backend is not configured')
    if (!this.active && !init.allowInactive) throw new Error('Backend session is not ready')
    const response = await fetch(`${apiBaseUrl}${path}`, {
      method: init.method ?? 'GET',
      credentials: 'include',
      headers: init.body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    })
    if (!response.ok) {
      const body = await response.json().catch(() => null) as { error?: string } | null
      throw new Error(body?.error ?? 'Backend request failed')
    }
    return response.json() as Promise<T>
  }
}

class ApiUserLexemeRepository implements UserLexemeRepository {
  constructor(private readonly api: ApiClient) {}
  setUserKey() {}
  async list() { return this.api.request<UserLexeme[]>('/user-lexemes') }
  async get(id: string) { return this.api.request<UserLexeme | null>(`/user-lexemes/${encodeURIComponent(id)}`) }
  async create(input: UserLexemeInput) { return this.api.request<UserLexeme>('/user-lexemes', { method: 'POST', body: input }) }
  async update(id: string, input: UserLexemeInput) { return this.api.request<UserLexeme>(`/user-lexemes/${encodeURIComponent(id)}`, { method: 'PATCH', body: input }) }
  async remove(id: string) { await this.api.request(`/user-lexemes/${encodeURIComponent(id)}`, { method: 'DELETE' }) }
}

class ApiLibraryRepository implements LibraryRepository {
  constructor(private readonly api: ApiClient, private readonly lexemes: LexemeRepository) {}
  async get() { return this.api.request<LibraryState>('/decks') }
  async createDeck(title: string, emoji = '✨') { return this.api.request<Deck>('/decks', { method: 'POST', body: { title, emoji } }) }
  async updateDeck(id: string, patch: Pick<Deck, 'title' | 'emoji'>) { return this.api.request<Deck>(`/decks/${encodeURIComponent(id)}`, { method: 'PATCH', body: patch }) }
  async remove(id: string) { await this.api.request(`/decks/${encodeURIComponent(id)}`, { method: 'DELETE' }) }
  async addLexeme(deckId: string, lexemeId: string) {
    const word = await this.lexemes.get(lexemeId)
    await this.api.request(`/decks/${encodeURIComponent(deckId)}/lexemes`, { method: 'POST', body: { lexemeId, source: word?.source ?? 'dictionary' } })
  }
  async toggleLexeme(deckId: string, lexemeId: string) {
    const state = await this.get()
    const saved = !state.decks.find((deck) => deck.id === deckId)?.wordIds.includes(lexemeId)
    if (saved) await this.addLexeme(deckId, lexemeId)
    else await this.removeLexemes(deckId, [lexemeId])
    return saved
  }
  async removeLexemes(deckId: string, lexemeIds: string[]) { await this.api.request(`/decks/${encodeURIComponent(deckId)}/lexemes`, { method: 'DELETE', body: { lexemeIds } }) }
  async moveLexemes(sourceDeckId: string, targetDeckId: string, lexemeIds: string[]) { await this.api.request(`/decks/${encodeURIComponent(sourceDeckId)}/move`, { method: 'POST', body: { targetDeckId, lexemeIds } }) }
  async removeLexemeEverywhere(lexemeId: string) {
    const state = await this.get()
    await Promise.all(state.decks.filter((deck) => deck.wordIds.includes(lexemeId)).map((deck) => this.removeLexemes(deck.id, [lexemeId])))
  }
}

class ApiReviewRepository implements ReviewRepository {
  constructor(private readonly api: ApiClient) {}
  async start(mode: TrainingMode, lexemeIds: string[]) { return this.api.request<TrainingSession>('/training/sessions', { method: 'POST', body: { mode, lexemeIds } }) }
  async get(id: string) { return this.api.request<TrainingSession | null>(`/training/sessions/${encodeURIComponent(id)}`) }
  async answer(id: string, lexemeId: string, grade: ReviewGrade) { return this.api.request<TrainingSession>(`/training/sessions/${encodeURIComponent(id)}/answers`, { method: 'POST', body: { lexemeId, grade } }) }
  async skipMissing(id: string, lexemeId: string) { return this.api.request<TrainingSession>(`/training/sessions/${encodeURIComponent(id)}/skip-missing`, { method: 'POST', body: { lexemeId } }) }
  async stats() { return this.api.request<ReviewStats>('/review-stats') }
}

class ApiProfileRepository implements ProfileRepository {
  constructor(private readonly api: ApiClient) {}
  async get() { return this.api.request<Profile>('/profile') }
  async update(patch: Partial<Profile>) { return this.api.request<Profile>('/profile', { method: 'PATCH', body: patch }) }
}

class SwitchableRepository<T> {
  constructor(private readonly api: ApiClient, private readonly local: T, private readonly remote: T) {}
  get current() { return this.api.isEnabled() ? this.remote : this.local }
}

class SwitchableUserLexemeRepository extends SwitchableRepository<UserLexemeRepository> implements UserLexemeRepository {
  setUserKey(userKey: string) { this.current.setUserKey(userKey) }
  list() { return this.current.list() }
  get(id: string) { return this.current.get(id) }
  create(input: UserLexemeInput) { return this.current.create(input) }
  update(id: string, input: UserLexemeInput) { return this.current.update(id, input) }
  remove(id: string) { return this.current.remove(id) }
}

class SwitchableLibraryRepository extends SwitchableRepository<LibraryRepository> implements LibraryRepository {
  get() { return this.current.get() }
  createDeck(title: string, emoji?: string) { return this.current.createDeck(title, emoji) }
  updateDeck(id: string, patch: Pick<Deck, 'title' | 'emoji'>) { return this.current.updateDeck(id, patch) }
  remove(id: string) { return this.current.remove(id) }
  addLexeme(deckId: string, lexemeId: string) { return this.current.addLexeme(deckId, lexemeId) }
  toggleLexeme(deckId: string, lexemeId: string) { return this.current.toggleLexeme(deckId, lexemeId) }
  removeLexemes(deckId: string, lexemeIds: string[]) { return this.current.removeLexemes(deckId, lexemeIds) }
  moveLexemes(sourceDeckId: string, targetDeckId: string, lexemeIds: string[]) { return this.current.moveLexemes(sourceDeckId, targetDeckId, lexemeIds) }
  removeLexemeEverywhere(lexemeId: string) { return this.current.removeLexemeEverywhere(lexemeId) }
}

class SwitchableReviewRepository extends SwitchableRepository<ReviewRepository> implements ReviewRepository {
  start(mode: TrainingMode, lexemeIds: string[]) { return this.current.start(mode, lexemeIds) }
  get(id: string) { return this.current.get(id) }
  answer(id: string, lexemeId: string, grade: ReviewGrade) { return this.current.answer(id, lexemeId, grade) }
  skipMissing(id: string, lexemeId: string) { return this.current.skipMissing(id, lexemeId) }
  stats() { return this.current.stats() }
}

class SwitchableProfileRepository extends SwitchableRepository<ProfileRepository> implements ProfileRepository {
  get() { return this.current.get() }
  update(patch: Partial<Profile>) { return this.current.update(patch) }
}

function localSnapshot(userKey: string): LocalSnapshot {
  const defaultDeckIds = new Set(defaultLibrary.decks.map((deck) => deck.id))
  const library = read('library', defaultLibrary)
  return {
    importKey: `local-v1:${userKey}`,
    profile: read('profile', defaultProfile),
    library: { decks: library.decks.filter((deck) => deck.wordIds.length > 0 || !defaultDeckIds.has(deck.id)) },
    userLexemes: JSON.parse(localStorage.getItem(`${USER_LEXEME_STORAGE_PREFIX}:${userKey}`) ?? '[]') as UserLexeme[],
  }
}

const staticLexemes = new StaticLexemeRepository()
const api = new ApiClient()
const localUserLexemes = new LocalUserLexemeRepository()
const remoteUserLexemes = new ApiUserLexemeRepository(api)
const userLexemes = new SwitchableUserLexemeRepository(api, localUserLexemes, remoteUserLexemes)
const lexemes = new CombinedLexemeRepository(staticLexemes, userLexemes)

export const repositories = {
  lexemes,
  userLexemes,
  library: new SwitchableLibraryRepository(api, new LocalLibraryRepository(), new ApiLibraryRepository(api, lexemes)),
  reviews: new SwitchableReviewRepository(api, new LocalReviewRepository(), new ApiReviewRepository(api)),
  profile: new SwitchableProfileRepository(api, new LocalProfileRepository(), new ApiProfileRepository(api)),
  auth: { async exchangeTelegramInitData() { return { id: 0, firstName: 'Ученик' } } } satisfies AuthGateway,
  backend: {
    isEnabled: () => api.isEnabled(),
    authenticate: (initData: string) => api.authenticate(initData),
    importLocalSnapshot: async (userKey: string) => {
      if (!api.isEnabled()) return
      await api.request('/import', { method: 'POST', body: localSnapshot(userKey) })
    },
  } satisfies BackendController,
  audio: { async getUrl() { return null } } satisfies AudioRepository,
}

export function hasDetails(word: CatalogLexeme | Lexeme) {
  return Object.values(word.details).some((value) => value !== null && value !== '')
}

export const posLabels: Record<PartOfSpeech, string> = { noun: 'имя', verb: 'глагол', particle: 'частица' }
export const genderLabels = { masculine: 'мужской', feminine: 'женский' } as const
