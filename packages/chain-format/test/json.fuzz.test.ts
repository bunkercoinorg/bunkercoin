import test from 'node:test';
import assert from 'node:assert/strict';
import { parseJson, stringifyJson, type Json } from '../src/json.ts';

// Seeded so a failure reproduces.
function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CHARS = ['a', 'Z', '0', ' ', '"', '\\', '/', '\n', '\t', '\u0001', '\u001f', 'é', '€', '😀', '\ud800', '\udfff', ' '];
const KEYS = ['', 'a', 'value', '__proto__', 'constructor', 'é', '"q"', 'a.b'];

function generate(r: () => number, depth = 0): unknown {
  const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)];
  const kind = depth > 5 ? Math.floor(r() * 4) : Math.floor(r() * 6);
  switch (kind) {
    case 0:
      return pick([null, true, false]);
    case 1: {
      const n = pick([0, 1, -1, 42, 2 ** 53 - 1, -(2 ** 53 - 1), 0.5, -1.25, 1e21, 1e-7, 123.456, Number.MAX_VALUE, Number.MIN_VALUE]);
      return r() < 0.5 ? n : Math.floor((r() - 0.5) * 2 ** 40);
    }
    case 2:
    case 3:
      return Array.from({ length: Math.floor(r() * 8) }, () => pick(CHARS)).join('');
    case 4:
      return Array.from({ length: Math.floor(r() * 5) }, () => generate(r, depth + 1));
    default:
      return Object.fromEntries(Array.from({ length: Math.floor(r() * 5) }, () => [pick(KEYS), generate(r, depth + 1)]));
  }
}

const normalize = (v: Json): unknown => {
  if (typeof v === 'bigint') return Number(v);
  if (Array.isArray(v)) return v.map(normalize);
  if (v !== null && typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) Object.defineProperty(out, k, { value: normalize(x), enumerable: true, writable: true, configurable: true });
    return out;
  }
  return v;
};

const native = (text: string): unknown => JSON.parse(text, (_k, v) => (Object.is(v, -0) ? 0 : v));

function outcome(parse: () => unknown): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: parse() };
  } catch (e) {
    assert.ok(e instanceof SyntaxError, `only SyntaxError may escape, got ${String(e)}`);
    return { ok: false };
  }
}

test('parseJson (all bigints) matches JSON.parse on generated documents', () => {
  const r = rng(1);
  for (let n = 0; n < 3000; n++) {
    const text = JSON.stringify(generate(r), null, r() < 0.3 ? Math.floor(r() * 4) : undefined);
    assert.deepStrictEqual(normalize(parseJson(text)), native(text), text);
  }
});

test('parseJson (all bigints) accepts and rejects exactly what JSON.parse does on mutated input', () => {
  const r = rng(2);
  const noise = ['', '"', '\\', ',', ':', '[', ']', '{', '}', '0', '-', '.', 'e', '+', ' ', '\n', 'u', 'x', 'n', '\u0000'];
  for (let n = 0; n < 5000; n++) {
    let text = JSON.stringify(generate(r));
    for (let m = Math.floor(r() * 3) + 1; m > 0; m--) {
      const at = Math.floor(r() * (text.length + 1));
      const cut = r() < 0.5 ? 1 : 0;
      text = text.slice(0, at) + noise[Math.floor(r() * noise.length)] + text.slice(at + cut);
    }
    if (/\d{16,}/.test(text)) continue;
    const ours = outcome(() => normalize(parseJson(text)));
    const theirs = outcome(() => native(text));
    assert.deepStrictEqual(ours, theirs, JSON.stringify(text));
  }
});

test('stringifyJson round-trips through JSON.parse for documents without bigints', () => {
  const r = rng(3);
  for (let n = 0; n < 2000; n++) {
    const value = generate(r);
    assert.deepStrictEqual(JSON.parse(stringifyJson(value)), JSON.parse(JSON.stringify(value)));
  }
});
