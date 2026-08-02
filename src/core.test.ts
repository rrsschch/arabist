import { beforeEach, describe, expect, it } from 'vitest'
import { buildTrainingQueue, hasDetails, lexemeSchema, migrateLibraryState, posLabels, repositories, resetDemoData, type Lexeme } from './core'

const particle: Lexeme = {
  id: 'e56d27ff-9b5a-5a52-b90f-02e5233e711b',
  word_ar: 'ا',
  pos: 'particle',
  subtype: null,
  translations: ['1) алиф'],
  examples: [],
  details: { root: null, form: null, present_vowel: null, masdar: null, plural: null, gender: null },
}

describe('public lexeme model', () => {
  it('accepts the shared nullable schema for particles', () => {
    expect(lexemeSchema.parse(particle)).toEqual(particle)
    expect(hasDetails(particle)).toBe(false)
    expect(posLabels[particle.pos]).toBe('частица')
  })

  it('detects noun and verb detail content', () => {
    expect(hasDetails({ ...particle, pos: 'noun', details: { ...particle.details, plural: 'كُتُب' } })).toBe(true)
    expect(hasDetails({ ...particle, pos: 'verb', details: { ...particle.details, form: 'I' } })).toBe(true)
  })

  it('rejects internal metadata in strict public payload checks', () => {
    const result = lexemeSchema.strict().safeParse({ ...particle, review: { status: 'ok' } })
    expect(result.success).toBe(false)
  })
})

describe('flat deck library', () => {
  beforeEach(() => resetDemoData())

  it('migrates legacy folders into a flat, deduplicated deck list', () => {
    expect(migrateLibraryState({
      folders: [{ id: 'arabic', title: 'Арабский язык', emoji: '📚' }],
      decks: [
        { id: 'saved', folderId: 'arabic', title: 'Мои слова', emoji: '⭐', wordIds: ['one', 'one', 'two'] },
        { id: 'saved', folderId: 'arabic', title: 'Дубликат', emoji: '❌', wordIds: [] },
      ],
    })).toEqual({ decks: [{ id: 'saved', title: 'Мои слова', emoji: '⭐', wordIds: ['one', 'two'] }] })
  })

  it('persists migrated v1 data and supports deck-only operations', async () => {
    localStorage.setItem('sanna.mock.v1.library', JSON.stringify({
      folders: [{ id: 'old-folder' }],
      decks: [{ id: 'old-deck', folderId: 'old-folder', title: 'Старая колода', emoji: '📖', wordIds: ['one'] }],
    }))
    expect((await repositories.library.get()).decks[0]).toEqual({ id: 'old-deck', title: 'Старая колода', emoji: '📖', wordIds: ['one'] })
    const created = await repositories.library.createDeck('Новая')
    await repositories.library.toggleLexeme(created.id, 'two')
    expect((await repositories.library.get()).decks.find((deck) => deck.id === created.id)?.wordIds).toEqual(['two'])
    await repositories.library.remove(created.id)
    expect((await repositories.library.get()).decks.some((deck) => deck.id === created.id)).toBe(false)
  })

  it('builds one shared queue from saved words and falls back to dictionary order', () => {
    const words = ['one', 'two', 'three'].map((id) => ({ ...particle, id }))
    expect(buildTrainingQueue({ decks: [{ id: 'deck', title: 'A', emoji: '✨', wordIds: ['three', 'three', 'missing'] }] }, words)).toEqual(['three'])
    expect(buildTrainingQueue({ decks: [] }, words, 2)).toEqual(['one', 'two'])
  })

  it('updates decks and atomically removes or moves selected words without duplicates', async () => {
    const source = await repositories.library.createDeck('Источник', '📚')
    const target = await repositories.library.createDeck('Назначение', '⭐')
    await repositories.library.toggleLexeme(source.id, 'one')
    await repositories.library.toggleLexeme(source.id, 'two')
    await repositories.library.toggleLexeme(target.id, 'two')
    await repositories.library.updateDeck(source.id, { title: '  Новое название  ', emoji: '🧠' })
    await repositories.library.moveLexemes(source.id, target.id, ['one', 'two'])
    let state = await repositories.library.get()
    expect(state.decks.find((deck) => deck.id === source.id)).toMatchObject({ title: 'Новое название', emoji: '🧠', wordIds: [] })
    expect(state.decks.find((deck) => deck.id === target.id)?.wordIds).toEqual(['two', 'one'])
    await repositories.library.removeLexemes(target.id, ['two'])
    state = await repositories.library.get()
    expect(state.decks.find((deck) => deck.id === target.id)?.wordIds).toEqual(['one'])
    expect(JSON.parse(localStorage.getItem('sanna.mock.v2.library') ?? '{}').decks).toBeDefined()
  })

  it('rejects moves when either deck is missing', async () => {
    const source = await repositories.library.createDeck('Источник')
    await expect(repositories.library.moveLexemes(source.id, 'missing', ['one'])).rejects.toThrow('Целевая колода не найдена')
    await expect(repositories.library.moveLexemes('missing', source.id, ['one'])).rejects.toThrow('Исходная колода не найдена')
  })
})
