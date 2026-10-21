import test from 'node:test';
import assert from 'node:assert/strict';
import { parseJson } from '../lib/json.ts';

test('amounts above 2^53 survive JSON parsing', () => {
  const v = parseJson('{"native_balance":9007199254740993,"nonce":5}') as Record<string, unknown>;
  assert.equal(v.native_balance, 9007199254740993n);
  assert.equal(v.nonce, 5);
});

test('parseJson matches JSON.parse on ordinary documents', () => {
  const doc = '{"a":[1,-2.5,3e2,true,false,null],"s":"x\\n\\u00e9\\"","o":{}}';
  assert.deepEqual(parseJson(doc), JSON.parse(doc));
});

test('parseJson keeps the last duplicate key like JSON.parse', () => {
  assert.deepEqual(parseJson('{"type":"a","type":"b"}'), { type: 'b' });
});

test('parseJson does not let __proto__ rewrite the prototype', () => {
  const v = parseJson('{"__proto__":{"polluted":true}}') as Record<string, unknown>;
  assert.equal(Object.getPrototypeOf(v), Object.prototype);
  assert.deepEqual(Object.keys(v), ['__proto__']);
});

test('parseJson rejects malformed input', () => {
  for (const bad of ['', '{', '[1,]', '01', '{"a" 1}', '"\\x"', '1 2']) {
    assert.throws(() => parseJson(bad), SyntaxError, bad);
  }
});
