import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHash, viewHref } from '../src/hooks/useHashView.ts';

test('parseHash routes known views and round-trips params', () => {
  assert.deepEqual(parseHash(''), { name: 'home', param: null });
  assert.deepEqual(parseHash('#nowhere/1'), { name: 'home', param: null });
  assert.deepEqual(parseHash('#settings'), { name: 'settings', param: null });
  assert.deepEqual(parseHash(viewHref('tx', 'a/b c')), { name: 'tx', param: 'a/b c' });
  assert.deepEqual(parseHash('#tx'), { name: 'activity', param: null });
  assert.deepEqual(parseHash('#tokens'), { name: 'home', param: null });
  assert.deepEqual(parseHash('#tx/'), { name: 'activity', param: null });
});

test('parseHash falls back to the parent view on a malformed param', () => {
  assert.deepEqual(parseHash('#tx/%E0%A4%A'), { name: 'activity', param: null });
  assert.deepEqual(parseHash('#tokens/%'), { name: 'home', param: null });
  assert.deepEqual(parseHash('#send/%E0'), { name: 'home', param: null });
  assert.deepEqual(parseHash('#settings/%zz'), { name: 'settings', param: null });
});
