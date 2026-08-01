import { describe, expect, it } from 'vitest'
import { hasDetails, lexemeSchema, posLabels, type Lexeme } from './core'

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
