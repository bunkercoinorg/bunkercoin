import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPath, joinUrl, nodePaths, routes } from '../lib/routes.ts';

test('page routes encode ids', () => {
  assert.equal(routes.block(12), '/block?id=12');
  assert.equal(routes.token('ab&cd'), '/token?id=ab%26cd');
  assert.equal(routes.account('a b#c'), '/account?address=a%20b%23c');
  assert.equal(routes.tx('x?y=1'), '/tx?sig=x%3Fy%3D1');
});

test('node paths encode every segment', () => {
  assert.equal(nodePaths.block('../nodes'), '/block/..%2Fnodes');
  assert.equal(nodePaths.blockBySlot('5'), '/block/slot/5');
  assert.equal(nodePaths.tokenHolders('deadbeef', 100, 50), '/tokens/deadbeef/holders?offset=100&limit=50');
  assert.equal(nodePaths.blocks(0, 20), '/blocks?offset=0&limit=20');
});

test('buildPath drops undefined query values', () => {
  assert.equal(buildPath(['a'], { x: undefined, y: 1 }), '/a?y=1');
  assert.equal(buildPath(['a']), '/a');
});

test('joinUrl tolerates trailing slashes on the base', () => {
  assert.equal(joinUrl('http://h:3001/', '/blocks'), 'http://h:3001/blocks');
  assert.equal(joinUrl('http://h:3001', '/blocks'), 'http://h:3001/blocks');
});
