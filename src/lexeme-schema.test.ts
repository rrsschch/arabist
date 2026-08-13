import { describe, expect, it } from 'vitest'
import { lexemeSchema } from './core'

describe('backend-ready lexeme schema', () => {
  it('accepts plain Arabic and nested subtype metadata', () => {
    expect(lexemeSchema.parse({
      id: 'uuid-v4',
      word_ar: 'كَتَبَ',
      word_ar_plain: 'كتب',
      pos: 'verb',
      subtype: null,
      translations: ['1) писать'],
      examples: [],
      details: {
        root: 'ك ت ب',
        form: 'I',
        present_vowel: 'u',
        masdar: 'كِتَابَةٌ',
        plural: null,
        gender: null,
        subtype: null,
      },
    })).toMatchObject({ word_ar_plain: 'كتب', details: { subtype: null } })
  })
})
