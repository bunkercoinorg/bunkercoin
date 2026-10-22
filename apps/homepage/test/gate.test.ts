import test from 'node:test';
import assert from 'node:assert/strict';
import { gate, withBypass } from '../src/lib/gate.ts';

const ORIGIN = 'https://bunkercoin.com';
const req = (path: string, country: string | null, referer: string | null = null, method = 'GET') =>
  gate({ url: `${ORIGIN}${path}`, method, country, referer });

test('DE gets the light site, not a block page', () => {
  assert.deepEqual(req('/', 'DE'), { action: 'next', light: true });
  assert.deepEqual(req('/legal/imprint', 'DE'), { action: 'next', light: true });
  assert.deepEqual(req('/whitepaper', 'DE'), { action: 'next', light: true });
  assert.deepEqual(req('/view?file=technical-whitepaper', 'DE'), { action: 'next', light: true });
});

test('bunker pages and documents are hidden from DE', () => {
  for (const path of ['/our-bunker', '/our-bunker/x', '/view?file=land-registry', '/view?file=trade-register']) {
    assert.deepEqual(req(path, 'DE'), { action: 'rewrite', pathname: '/__hidden' }, path);
  }
  assert.deepEqual(req('/our-bunkerx', 'DE'), { action: 'next', light: true });
});

test('DE with bnkr gets the whole site, with or without a value', () => {
  assert.deepEqual(req('/?bnkr', 'DE'), { action: 'next', light: false });
  assert.deepEqual(req('/?bnkr=1', 'DE'), { action: 'next', light: false });
  assert.deepEqual(req('/our-bunker?bnkr', 'DE'), { action: 'next', light: false });
  assert.deepEqual(req('/view?file=land-registry&bnkr', 'DE'), { action: 'next', light: false });
});

test('other countries get the whole site', () => {
  for (const c of ['AT', 'FR', 'NL', 'US', 'XX', 'T1', null]) {
    assert.deepEqual(req('/', c), { action: 'next', light: false }, String(c));
    assert.deepEqual(req('/our-bunker', c), { action: 'next', light: false }, String(c));
  }
});

test('same-origin referer with bnkr redirects to the same URL with bnkr', () => {
  assert.deepEqual(req('/legal/imprint', 'DE', `${ORIGIN}/?bnkr`), {
    action: 'redirect',
    url: `${ORIGIN}/legal/imprint?bnkr`,
  });
  assert.deepEqual(req('/view?file=land-registry', 'US', `${ORIGIN}/whitepaper?bnkr=abc`), {
    action: 'redirect',
    url: `${ORIGIN}/view?file=land-registry&bnkr=abc`,
  });
});

test('referer propagation needs same origin, a bnkr param and a safe method', () => {
  assert.deepEqual(req('/', 'DE', 'https://evil.example/?bnkr'), { action: 'next', light: true });
  assert.deepEqual(req('/', 'DE', `${ORIGIN}/whitepaper`), { action: 'next', light: true });
  assert.deepEqual(req('/', 'DE', 'not a url'), { action: 'next', light: true });
  assert.deepEqual(req('/', 'US', `${ORIGIN}/?bnkr`, 'POST'), { action: 'next', light: false });
  assert.deepEqual(req('/?bnkr=2', 'DE', `${ORIGIN}/?bnkr=1`), { action: 'next', light: false });
});

test('withBypass keeps bnkr on internal hrefs only', () => {
  assert.equal(withBypass('/', null), '/');
  assert.equal(withBypass('/', ''), '/?bnkr');
  assert.equal(withBypass('/whitepaper', '1'), '/whitepaper?bnkr=1');
  assert.equal(withBypass('/view?file=land-registry', 'a b'), '/view?file=land-registry&bnkr=a%20b');
  assert.equal(withBypass('/#token', ''), '/?bnkr#token');
  assert.equal(withBypass('/?bnkr=x', 'y'), '/?bnkr=x');
  assert.equal(withBypass('https://explorer.bunkercoin.com/', ''), 'https://explorer.bunkercoin.com/');
  assert.equal(withBypass('//evil.example/', ''), '//evil.example/');
});
