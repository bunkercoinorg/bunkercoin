import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Button } from '../src/index.ts';

test('a busy button keeps its width with stacked labels, never an inline style', () => {
  const busy = renderToStaticMarkup(createElement(Button, { busy: true }, 'encrypting…'));
  assert.doesNotMatch(busy, /style=/);
  assert.match(busy, /aria-busy="true"/);
  assert.match(busy, /<span class="bc-btn-st"><span aria-hidden="true">encrypting…<\/span><span>encrypting…<\/span><\/span>/);
  const idle = renderToStaticMarkup(createElement(Button, null, 'show words'));
  assert.doesNotMatch(idle, /style=|bc-btn-st/);
});
