import { z } from 'zod'

export type PartOfSpeech = 'noun' | 'verb' | 'particle'
export type ReviewGrade = 'again' | 'hard' | 'easy'
export type TrainingMode = 'review' | 'study' | 'flip' | 'quiz'
export type ThemePreference = 'telegram' | 'light' | 'dark'
export type Accent = 'blue' | 'emerald' | 'purple' | 'rose' | 'amber'

export interface LexemeDetails {
  root: string | null
  form: string | null
  present_vowel: string | null
  masdar: string | null
  plural: string | null
  gender: 'masculine' | 'feminine' | null
}

export interface Lexeme {
  id: string
  word_ar: string
  pos: PartOfSpeech
  subtype: string | null
  translations: string[]
  examples: string[]
  details: LexemeDetails
}

export interface Folder { id: string; title: string; emoji: string }
export interface Deck { id: string; folderId: string; title: string; emoji: string; wordIds: string[] }
export interface LibraryState { folders: Folder[]; decks: Deck[] }
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
  }),
})
export const lexemeListSchema = z.array(lexemeSchema)

const STORAGE_PREFIX = 'sanna.mock.v1'
const key = (name: string) => `${STORAGE_PREFIX}.${name}`

function read<T>(name: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key(name))
    return raw ? (JSON.parse(raw) as T) : structuredClone(fallback)
  } catch { return structuredClone(fallback) }
}
function write<T>(name: string, value: T) { localStorage.setItem(key(name), JSON.stringify(value)) }
export function resetDemoData() {
  Object.keys(localStorage).filter((item) => item.startsWith(STORAGE_PREFIX)).forEach((item) => localStorage.removeItem(item))
}

const defaultLibrary: LibraryState = {
  folders: [
    { id: 'arabic', emoji: '📚', title: 'Арабский язык' },
    { id: 'phrases', emoji: '💬', title: 'Разговорник' },
  ],
  decks: [
    { id: 'food', folderId: 'arabic', emoji: '🥑', title: 'Еда и продукты', wordIds: [] },
    { id: 'verbs', folderId: 'arabic', emoji: '🏃', title: 'Глаголы', wordIds: [] },
    { id: 'popular', folderId: 'phrases', emoji: '👋', title: 'Популярные фразы', wordIds: [] },
  ],
}
const defaultProfile: Profile = {
  name: 'Ученик', dailyGoal: 30, notifications: true, theme: 'telegram', accent: 'blue', streak: 12, reviewedTotal: 248,
}

export interface LexemeRepository {
  list(): Promise<Lexeme[]>
  search(input: { query?: string; pos?: PartOfSpeech | 'all'; limit?: number }): Promise<Lexeme[]>
  get(id: string): Promise<Lexeme | null>
}
export interface LibraryRepository {
  get(): Promise<LibraryState>
  createFolder(title: string, emoji?: string): Promise<Folder>
  createDeck(folderId: string, title: string, emoji?: string): Promise<Deck>
  rename(kind: 'folder' | 'deck', id: string, title: string): Promise<void>
  remove(kind: 'folder' | 'deck', id: string): Promise<void>
  moveDeck(deckId: string, folderId: string): Promise<void>
  toggleLexeme(deckId: string, lexemeId: string): Promise<boolean>
}
export interface ReviewRepository {
  start(mode: TrainingMode, lexemeIds: string[]): Promise<TrainingSession>
  get(id: string): Promise<TrainingSession | null>
  answer(id: string, lexemeId: string, grade: ReviewGrade): Promise<TrainingSession>
}
export interface ProfileRepository { get(): Promise<Profile>; update(patch: Partial<Profile>): Promise<Profile> }
export interface AuthGateway { exchangeTelegramInitData(initData: string): Promise<{ id: number; firstName: string }> }
export interface AudioRepository { getUrl(lexemeId: string): Promise<string | null> }

class StaticLexemeRepository implements LexemeRepository {
  private cache?: Promise<Lexeme[]>
  list() {
    this.cache ??= fetch('/data/lexemes.json')
      .then((response) => { if (!response.ok) throw new Error('Не удалось загрузить словарь'); return response.json() })
      .then((value) => lexemeListSchema.parse(value))
    return this.cache
  }
  async search({ query = '', pos = 'all', limit = 80 }: { query?: string; pos?: PartOfSpeech | 'all'; limit?: number }) {
    const normalized = normalize(query)
    const words = await this.list()
    return words.filter((word) => {
      if (pos !== 'all' && word.pos !== pos) return false
      if (!normalized) return true
      const haystack = [word.word_ar, word.details.root ?? '', ...word.translations].map(normalize).join(' ')
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
  async get() { return read('library', defaultLibrary) }
  private save(value: LibraryState) { write('library', value) }
  async createFolder(title: string, emoji = '📁') {
    const state = await this.get(); const folder = { id: makeId('folder'), title, emoji }
    state.folders.push(folder); this.save(state); return folder
  }
  async createDeck(folderId: string, title: string, emoji = '✨') {
    const state = await this.get(); const deck = { id: makeId('deck'), folderId, title, emoji, wordIds: [] }
    state.decks.push(deck); this.save(state); return deck
  }
  async rename(kind: 'folder' | 'deck', id: string, title: string) {
    const state = await this.get(); const item = (kind === 'folder' ? state.folders : state.decks).find((entry) => entry.id === id)
    if (item) item.title = title; this.save(state)
  }
  async remove(kind: 'folder' | 'deck', id: string) {
    const state = await this.get()
    if (kind === 'folder') { state.folders = state.folders.filter((f) => f.id !== id); state.decks = state.decks.filter((d) => d.folderId !== id) }
    else state.decks = state.decks.filter((d) => d.id !== id)
    this.save(state)
  }
  async moveDeck(deckId: string, folderId: string) {
    const state = await this.get(); const deck = state.decks.find((d) => d.id === deckId)
    if (deck) deck.folderId = folderId; this.save(state)
  }
  async toggleLexeme(deckId: string, lexemeId: string) {
    const state = await this.get(); const deck = state.decks.find((d) => d.id === deckId)
    if (!deck) throw new Error('Колода не найдена')
    const saved = !deck.wordIds.includes(lexemeId)
    deck.wordIds = saved ? [...deck.wordIds, lexemeId] : deck.wordIds.filter((id) => id !== lexemeId)
    this.save(state); return saved
  }
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
}

class LocalProfileRepository implements ProfileRepository {
  async get() { return read('profile', defaultProfile) }
  async update(patch: Partial<Profile>) { const next = { ...(await this.get()), ...patch }; write('profile', next); return next }
}

export const repositories = {
  lexemes: new StaticLexemeRepository(),
  library: new LocalLibraryRepository(),
  reviews: new LocalReviewRepository(),
  profile: new LocalProfileRepository(),
  auth: { async exchangeTelegramInitData() { return { id: 0, firstName: 'Ученик' } } } satisfies AuthGateway,
  audio: { async getUrl() { return null } } satisfies AudioRepository,
}

export function hasDetails(word: Lexeme) {
  return Object.values(word.details).some((value) => value !== null && value !== '')
}

export const posLabels: Record<PartOfSpeech, string> = { noun: 'имя', verb: 'глагол', particle: 'частица' }
export const genderLabels = { masculine: 'мужской', feminine: 'женский' } as const
