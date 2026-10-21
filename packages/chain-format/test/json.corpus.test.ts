import test from 'node:test';
import assert from 'node:assert/strict';
import { parseJson as parseAll } from '../src/json.ts';

const parseJson = (text: string) => parseAll(text, { bigints: 'unsafe' });

const VALID = [
  '"\\u0041\\u00e9\\u4E2D"',
  '"\\ud83d\\ude00 and raw 😀"',
  '"\\ud800 lone \\udc00"',
  '"\\"\\\\\\/\\b\\f\\n\\r\\t"',
  '""',
  '0',
  '-0',
  '1e3',
  '1E+3',
  '1e-3',
  '-1.5e-10',
  '0.1',
  '1.7976931348623157e308',
  '1e400',
  '9007199254740991',
  '-9007199254740991',
  '[]',
  '{}',
  ' \t\n\r[1 , 2 ]\n',
  '{"a":{"b":[{"c":null}]},"d":[true,false]}',
  '{"a":1,"b":2,"a":3}',
  '{"__proto__":{"x":1},"y":2}',
  '{"":1,"constructor":2,"toString":3}',
];

const INVALID = [
  '',
  ' ',
  '01',
  '-',
  '-01',
  '1.',
  '.5',
  '+1',
  '1e',
  '1e+',
  '0x10',
  'NaN',
  'Infinity',
  '[1,]',
  '{"a":1,}',
  '{a:1}',
  "'a'",
  '"\\x"',
  '"\\u12"',
  '"\\u12G4"',
  '"a\nb"',
  '"unterminated',
  '"\\',
  'tru',
  'nul',
  '[1 2]',
  '{"a" 1}',
  '{"a":}',
  '1 2',
  '[',
];

test('parseJson matches JSON.parse on the parity corpus', () => {
  for (const doc of VALID) {
    const ours = parseJson(doc);
    const theirs = JSON.parse(doc);
    assert.deepStrictEqual(ours, theirs, doc);
    if (ours && typeof ours === 'object') assert.deepEqual(Object.keys(ours), Object.keys(theirs), doc);
  }
});

test('parseJson rejects everything JSON.parse rejects in the corpus', () => {
  for (const doc of INVALID) {
    assert.throws(() => JSON.parse(doc), SyntaxError, `JSON.parse accepted ${doc}`);
    assert.throws(() => parseJson(doc), SyntaxError, `parseJson accepted ${doc}`);
  }
});

test('only unsafe plain integers become bigint', () => {
  assert.equal(parseJson('9007199254740992'), 9007199254740992n);
  assert.equal(parseJson('-18446744073709551615'), -18446744073709551615n);
  assert.equal(parseJson('9007199254740993.0'), 9007199254740992);
  assert.equal(parseJson('1e20'), 1e20);
  assert.deepEqual(parseJson('[18446744073709551615,1]'), [18446744073709551615n, 1]);
});
