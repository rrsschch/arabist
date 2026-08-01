import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const EXPECTED_COUNT = 918;
const DEFAULT_INPUT = String.raw`C:\Users\79628\Documents\Codex\2026-07-29\new-chat-2\outputs\production_sample_1000\production_ready.json`;
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_OUTPUT = path.resolve(scriptDirectory, '../public/data/lexemes.json');

const inputPath = path.resolve(process.argv[2] ?? DEFAULT_INPUT);
const outputPath = path.resolve(process.argv[3] ?? DEFAULT_OUTPUT);

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function prepareLexeme(record, index) {
  assert(record && typeof record === 'object' && !Array.isArray(record), `Record ${index} must be an object`);
  assert(record.id !== undefined && record.id !== null, `Record ${index} is missing id`);
  assert(typeof record.word_ar === 'string' && record.word_ar.trim(), `Record ${index} has invalid word_ar`);
  assert(typeof record.pos === 'string' && record.pos.trim(), `Record ${index} has invalid pos`);
  assert(record.subtype === null || typeof record.subtype === 'string', `Record ${index} has invalid subtype`);
  assert(Array.isArray(record.translations), `Record ${index} translations must be an array`);
  assert(record.translations.every((value) => typeof value === 'string'), `Record ${index} translations must contain strings`);
  assert(Array.isArray(record.examples), `Record ${index} examples must be an array`);
  assert(record.examples.every((value) => typeof value === 'string'), `Record ${index} examples must contain strings`);
  assert(record.details && typeof record.details === 'object' && !Array.isArray(record.details), `Record ${index} has invalid details`);

  const details = {
    root: record.details.root ?? null,
    form: record.details.form ?? null,
    present_vowel: record.details.present_vowel ?? null,
    masdar: record.details.masdar ?? null,
    plural: record.details.plural ?? null,
    gender: record.details.gender ?? null,
  };

  return {
    id: record.id,
    word_ar: record.word_ar,
    pos: record.pos,
    subtype: record.subtype ?? null,
    translations: record.translations,
    examples: record.examples,
    details,
  };
}

async function main() {
  const source = JSON.parse(await readFile(inputPath, 'utf8'));
  assert(Array.isArray(source), 'Input JSON root must be an array');
  assert(source.length === EXPECTED_COUNT, `Expected ${EXPECTED_COUNT} input records, received ${source.length}`);

  const lexemes = source.map(prepareLexeme);
  assert(lexemes.length === EXPECTED_COUNT, `Expected ${EXPECTED_COUNT} output records, produced ${lexemes.length}`);

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(lexemes, null, 2)}\n`, 'utf8');
  console.log(`Prepared ${lexemes.length} lexemes: ${outputPath}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
