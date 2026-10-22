import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as ui from '../src/index.ts';
import * as explorer from '../src/explorer/index.ts';

const ADDR = '8Ep5GwasrohgscRB7wSZ1ULiFisMxMg6uq53DhVdsuHx';
const HASH = '7ffcc7' + '0'.repeat(54) + '52bf';
const noop = () => {};
// Children passed positionally, which createElement's typings reject for required `children` props.
const h = (type: unknown, props?: object | null, ...children: ReactNode[]): ReactElement =>
  createElement(type as never, props as never, ...children);

type Block = { slot: string; hash: string };
const BLOCKS: Block[] = [
  { slot: '48,213', hash: HASH },
  { slot: '48,212', hash: HASH.replace('7f', '66') },
];

const GALLERY: Record<string, ReactElement> = {
  BrandMark: h(ui.BrandMark, { size: 24, title: 'BunkerCoin' }),
  Icon: h(ui.Icon, { name: 'copy' }),
  Sprite: h(ui.Sprite),
  Link: h(ui.Link, { href: '/blocks' }, 'blocks'),
  LinkProvider: h(ui.LinkProvider, { component: 'a' }, h(ui.Link, { href: '/x' }, 'x')),
  AppShell: h(
    ui.AppShell,
    {
      app: 'wallet',
      nav: [
        { label: 'home', href: '#home', current: true },
        { label: 'activity', href: '#activity' },
      ],
      status: h(ui.StatusTag, { status: 'live' }),
      tools: h(ui.AddressChip, { address: ADDR }),
      footer: h(ui.Footer, { links: [{ label: 'explorer', href: 'https://explorer.example', external: true }] }, 'keys stay in this browser.'),
      tabBar: h(ui.TabBar, { current: 'home' }),
    },
    h(ui.PageIntro, { title: 'Home.' }),
  ),
  Header: h(ui.Header, { app: 'explorer', nav: [{ label: 'blocks', href: '/blocks' }], flow: true }),
  Footer: h(ui.Footer, {}, 'alpenglow over hf radio'),
  Nav: h(ui.Nav, { items: [{ label: 'overview', href: '/', current: true }], label: 'explorer' }),
  Wrap: h(ui.Wrap, {}, 'x'),
  Rule: h(ui.Rule),
  SkipLink: h(ui.SkipLink),
  TabBar: h(ui.TabBar, { current: 'activity' }),
  FlowBar: h(ui.FlowBar, { title: 'send', step: [2, 3], onBack: noop }),
  BackLink: h(ui.BackLink, { label: 'blocks', href: '/blocks' }),
  Banner: h(ui.Banner, { action: h(ui.Button, { variant: 'ghost', size: 'sm' }, 'retry') }, "Offline. Can't reach rpc.bunkercoin.com."),
  PageIntro: h(ui.PageIntro, { label: 'create wallet', title: 'Write down your 24 words.', lead: 'In order, on paper.' }),
  SectionHead: h(ui.SectionHead, { label: 'tokens', action: h(ui.Link, { href: '#activity' }, 'all →') }),
  Button: h(ui.Button, { busy: true }, 'encrypting…'),
  ButtonLink: h(ui.ButtonLink, { href: '/tx', variant: 'quiet', external: true }, 'view in explorer ↗'),
  Actions: h(ui.Actions, {}, h(ui.Button, { variant: 'ghost' }, 'edit'), h(ui.Button, {}, 'sign and send')),
  Field: h(ui.Field, { id: 'to', label: 'to', hint: 'base58 address', error: 'Not a BunkerCoin address.' }, h(ui.TextInput, { mono: true })),
  TextInput: h(ui.TextInput, { 'aria-label': 'amount', inputMode: 'decimal' }),
  Textarea: h(ui.Textarea, { 'aria-label': 'words' }),
  InputSuffix: h(ui.InputSuffix, {}, 'BUNKER'),
  Select: h(ui.Select, { 'aria-label': 'filter', options: [{ value: 'a', label: 'all' }], value: 'a', onChange: noop }),
  Checkbox: h(ui.Checkbox, { id: 'have', label: 'I have the 24 words.', checked: false, onChange: noop }),
  Segmented: h(ui.Segmented, { label: 'show', options: [{ value: 'all', label: 'all' }, { value: 'pending', label: 'pending' }], value: 'all', onChange: noop }),
  ThemeControl: h(ui.ThemeControl, { value: 'dark', onChange: noop }),
  Tag: h(ui.Tag, { state: 'pending' }, 'proposed'),
  StatusTag: h(ui.StatusTag, { status: 'confirming', detail: '18s' }),
  Notice: h(ui.Notice, { tone: 'warn', title: 'Fee changed.' }, '0.000100 → 0.000150 BUNKER. Review again.'),
  StatePanel: h(ui.StatePanel, { state: 'notfound', title: 'No block at slot 48,999.', message: 'Latest slot seen: 48,213.', heading: 'h1' }),
  EmptyState: h(ui.EmptyState, { action: h(ui.Button, {}, 'faucet') }, 'No activity yet.'),
  StateLine: h(ui.StateLine, {}, 'checking balance…'),
  Skeleton: h(ui.Skeleton, { rows: 2, label: 'loading blocks…' }),
  StepList: h(ui.StepList, {
    steps: [
      { label: 'signed', state: 'done', ms: 12 },
      { label: 'accepted', state: 'done', ms: 500 },
      { label: 'waiting for finality', state: 'active', ms: 18_000 },
    ],
  }),
  TimeValue: h(ui.TimeValue, { ms: Date.UTC(2026, 9, 21, 21, 4, 17), relative: true, now: Date.UTC(2026, 9, 21, 21, 4, 21) }),
  Freshness: h(ui.Freshness, { lastSuccessAt: 1_000, staleAfterMs: 60_000, now: 9_000 }),
  Panel: h(ui.Panel, { title: 'review before signing', meta: 'nonce 7', tone: 'receipt', footer: 'from 8Ep5…suHx' }, 'body'),
  Facts: h(ui.Facts, { variant: 'rows', items: [{ label: 'to', value: h(ui.CopyValue, { value: ADDR, mode: 'full' }) }, { label: 'total', value: '12.500100 BUNKER', strong: true }] }),
  Cells: h(ui.Cells, {}, h(ui.Cell, { isNew: true }, 'node 2')),
  Cell: h(ui.Cell, {}, 'node 1'),
  Amount: h(ui.Amount, { units: 1_248_500_000n, scale: 6, symbol: 'BUNKER', size: 'balance' }),
  BalanceHero: h(ui.BalanceHero, {}, h(ui.Amount, { units: null, scale: 6, size: 'balance' })),
  CopyValue: h(ui.CopyValue, { value: ADDR, label: 'address' }),
  AddressChip: h(ui.AddressChip, { address: ADDR }),
  Disclosure: h(ui.Disclosure, { summary: 'details' }, 'nonce 7'),
  ActionTile: h(ui.ActionTile, { icon: 'send', label: 'send', disabled: true }),
  ActionTiles: h(ui.ActionTiles, {}, h(ui.ActionTile, { icon: 'faucet', label: 'faucet', primary: true, onClick: noop })),
  List: h(ui.List, { label: 'tokens' }, h(ui.ListRow, { mark: h(ui.BrandMark), title: 'BUNKER', sub: 'native', value: '1,248.500000' })),
  ListRow: h(ui.ListRow, { mark: 'RA', title: 'send', sub: '2ndb…ZMTa', value: '−12.500000', tag: h(ui.StatusTag, { status: 'confirming' }), href: '#tx' }),
  GroupLabel: h(ui.GroupLabel, {}, 'today'),
  ChoiceList: h(ui.ChoiceList, {}, h(ui.Choice, { icon: 'plus', title: 'create a wallet', line: 'New 24-word recovery phrase.', primary: true, onClick: noop })),
  Choice: h(ui.Choice, { icon: 'receive', title: 'import a wallet', href: '#import' }),
  SettingsList: h(ui.SettingsList, { rows: [{ label: 'auto-lock', value: '15 min', href: '#lock' }, { label: 'erase wallet', danger: true, onClick: noop }] }),
  Pagination: h(ui.Pagination, { state: 'error', onMore: noop, note: 'loaded 48,213 to 48,194' }),
  WordGrid: h(ui.WordGrid, { words: ['orbit', 'lunar', 'velvet'] }),
  WordGridHidden: h(ui.WordGridHidden, {}, '24 words · hidden'),
  WordPicker: h(ui.WordPicker, { position: 11, choices: ['echo', 'fossil', 'pilot', 'crane'], value: 'pilot', error: 'That is word 14. Pick word 11.', onChange: noop }),
  QrCode: h(ui.QrCode, { value: ADDR }),
  Dialog: h(ui.Dialog, { open: false, title: 'Erase this wallet.', description: 'Coins stay on-chain.', onClose: noop }),
  TransmissionStrip: h(explorer.TransmissionStrip, {
    columns: Array.from({ length: 60 }, (_, i) => ({ level: i === 17 ? null : (i % 8) + 1, finalized: i % 7 === 3 ? `48,${200 + i} finalized` : undefined })),
    summary: 'last 2 minutes: average 3.4 kb/s, 9 blocks finalized, 2 gaps',
    peak: '4.1 kb/s',
    samples: [{ time: '21:04:17 UTC', value: '3.42 kb/s', finalized: '48,203 at 21:04:16 UTC' }],
  }),
  BlockTimeline: h(explorer.BlockTimeline, {
    title: 'history · 24 h',
    summary: 'last 24 hours: 2 blocks finalized, 1 skipped, no data for 15 min',
    columns: [
      { stack: [], known: false, label: '11:30–11:45 UTC · no data' },
      { stack: ['f', 's', 'f'], known: true, label: '11:45–12:00 UTC · 2 blocks, 1 skipped' },
    ],
    axis: ['-24h', '-12h', 'now'],
    phoneAxis: ['-12h', '-6h', 'now'],
    rows: [{ time: '11:45–12:00 UTC', blocks: '48,203 node 1 11:59' }],
    idle: 'latest · 48,203 node 1 11:59 UTC',
    cadence: { points: [0.2, 1, 0.4], median: 0.4, label: 'median 4.6 min' },
  }),
  DataTable: h(explorer.DataTable, {
    caption: 'recent blocks',
    columns: [
      { key: 'slot', header: 'slot', cell: (b: Block) => b.slot },
      { key: 'hash', header: 'hash', cell: (b: Block) => h(ui.CopyValue, { value: b.hash, label: 'hash' }) },
    ],
    rows: BLOCKS,
    rowKey: (b: Block) => b.slot,
    rowHref: (b: Block) => `/block?id=${b.slot}`,
    phone: (b: Block) => b.slot,
    empty: 'No blocks received yet.',
  }),
  Ledger: h(explorer.Ledger, { row: true, items: [{ label: 'latest slot', value: '48,213' }] }),
  Summaries: h(explorer.Summaries, { items: [{ label: 'validators', value: '4 reporting', href: '/network' }] }),
  Lifecycle: h(explorer.Lifecycle, { steps: [{ label: 'mempool' }, { label: 'confirmed', sub: 'slot 48,219' }, { label: 'finalized' }], current: 1 }),
  ShareBar: h(explorer.ShareBar, { fraction: 0.42, label: '42.0%' }),
  NewRowsBar: h(explorer.NewRowsBar, { onShow: noop }, '3 new blocks'),
  HeaderSearch: h(explorer.HeaderSearch, { value: '', onChange: noop, onSubmit: noop }),
};

const render = (name: string) => renderToStaticMarkup(GALLERY[name]);

test('every exported component is in the gallery and renders', () => {
  const components = [...Object.entries(ui), ...Object.entries(explorer)]
    .filter(([name, v]) => typeof v === 'function' && /^[A-Z]/.test(name))
    .map(([name]) => name);
  for (const name of components) {
    assert.ok(name in GALLERY, `${name} missing from the gallery`);
    const html = render(name);
    assert.ok(html.length > 0, `${name} rendered nothing`);
    assert.doesNotMatch(html, /\sstyle="/, `${name} emits an inline style, which the wallet CSP blocks`);
  }
});

test('copy value is a button with an accessible name and a status region', () => {
  const html = render('CopyValue');
  assert.match(html, /<button type="button" class="bc-cv"[^>]*aria-label="copy address 8Ep5…suHx"/);
  assert.match(html, new RegExp(`title="copy ${ADDR}"`));
  assert.match(html, /role="status"/);
  assert.doesNotMatch(html, /8Ep5 /, 'identifiers are never grouped with spaces');
  const linked = renderToStaticMarkup(h(ui.CopyValue, { value: HASH, href: '/tx', label: 'transaction' }));
  assert.match(linked, /<a href="\/tx" class="bc-lnk">7ffcc7…52bf<\/a>/);
  assert.match(linked, /<button[^>]*aria-label="copy transaction 7ffcc7…52bf"/);
  const full = renderToStaticMarkup(h(ui.CopyValue, { value: ADDR, mode: 'box' }));
  assert.match(full, new RegExp(`<span class="bc-v">${ADDR}</span>`));
});

test('field wires label, describedby and invalid state', () => {
  const html = render('Field');
  assert.match(html, /<label for="to">to<\/label>/);
  assert.match(html, /<input type="text" class="bc-inp" data-mono="" id="to" aria-describedby="to-error to-hint" aria-invalid="true"\/>/);
  assert.match(html, /<p id="to-hint" class="bc-hint">base58 address<\/p>/);
  assert.match(html, /<p id="to-error" class="bc-err" role="alert">/);
  const ok = renderToStaticMarkup(h(ui.Field, { id: 'pw', label: 'password' }, h(ui.TextInput, { type: 'password' })));
  assert.doesNotMatch(ok, /aria-invalid|aria-describedby/);
});

test('shell has landmarks, skip link and current page', () => {
  const html = render('AppShell');
  assert.match(html, /<a class="bc-skip" href="#main">skip to content<\/a>/);
  assert.match(html, /<header class="bc-hd">/);
  assert.match(html, /<nav class="bc-nav" aria-label="wallet">/);
  assert.match(html, /<a href="#home" aria-current="page">home<\/a>/);
  assert.match(html, /<main id="main" class="bc-main" tabindex="-1">/);
  assert.match(html, /<footer class="bc-ft">/);
  assert.match(html, /<a href="https:\/\/explorer.example" rel="noopener noreferrer">explorer<\/a>/);
  assert.match(html, /<symbol id="bc-mark" viewBox="0 0 161 128">/);
  assert.match(html, /aria-label="BunkerCoin wallet"/);
  assert.match(html, /<h1 class="bc-t1">Home.<\/h1>/);
});

test('controls expose their state', () => {
  assert.match(render('Segmented'), /role="group" aria-label="show"><button type="button" aria-pressed="true">all/);
  assert.match(render('ThemeControl'), /aria-label="theme".*aria-pressed="true">dark/);
  assert.match(render('Checkbox'), /<label class="bc-chk" for="have"><input id="have" type="checkbox"/);
  assert.match(render('Button'), /aria-busy="true"/);
  assert.match(render('ActionTile'), /<button type="button" class="bc-tile" disabled="">/);
  assert.match(render('FlowBar'), /aria-label="back".*step 2 of 3/);
  assert.match(render('WordPicker'), /<legend class="bc-lbl">word 11<\/legend>.*aria-pressed="true" data-wrong="">pilot/);
  assert.match(render('WordPicker'), /role="alert">That is word 14/);
  assert.match(render('Dialog'), /<dialog class="bc-dlg" aria-labelledby="[^"]+" aria-describedby="[^"]+"><\/dialog>/);
});

test('status is text first', () => {
  assert.match(render('StatusTag'), /data-tone="pending"><i aria-hidden="true"><\/i>confirming · 18s<\/span>/);
  assert.equal(renderToStaticMarkup(h(ui.StatusTag, { status: 'unconfirmed' })), '<span class="bc-tag" data-tone="unconfirmed">still unconfirmed</span>');
  assert.equal(renderToStaticMarkup(h(ui.StatusTag, { status: 'skipped' })), '<span class="bc-tag" data-tone="unknown">skipped</span>');
  assert.match(render('StepList'), /<div role="status" aria-live="polite"><ol class="bc-st"><li data-state="done"><span class="bc-n" aria-hidden="true">01/);
  assert.match(render('StepList'), /12ms.*0\.5s.*18s/);
  assert.match(render('TimeValue'), /<time dateTime="2026-10-21T21:04:17.000Z">21:04:17 UTC · 4s ago<\/time>/);
  assert.match(render('Freshness'), /checked 8s ago/);
  assert.match(renderToStaticMarkup(h(ui.Freshness, { lastSuccessAt: 1_000, staleAfterMs: 60_000, now: 121_000, onRetry: noop })), /stale · 2m 0s.*retry/);
  assert.match(render('Skeleton'), /role="status"/);
  assert.match(render('StatePanel'), /<section class="bc-spn" data-state="notfound"><h1 class="bc-t2">/);
});

test('pagination announces loading and errors, never its note', () => {
  assert.match(render('Pagination'), /^<div class="bc-pg"><span class="bc-sr" aria-live="polite">Older entries unavailable<\/span><span class="bc-grow">loaded/);
  const idle = renderToStaticMarkup(h(ui.Pagination, { state: 'idle', onMore: noop, note: 'checked 3s ago' }));
  assert.match(idle, /<span class="bc-sr" aria-live="polite"><\/span>/);
  assert.equal(idle.match(/aria-live/g)?.length, 1);
  assert.match(renderToStaticMarkup(h(explorer.NewRowsBar, { onShow: noop, action: 'latest' }, 'older blocks')), />latest<\/button>/);
});

test('amounts are exact and unknown is a dash', () => {
  assert.equal(render('Amount'), '<div class="bc-bal">1,248<span class="bc-fr">.500000</span><span class="bc-u">BUNKER</span></div>');
  assert.match(render('BalanceHero'), /<span aria-hidden="true">–<\/span><span class="bc-sr">unknown<\/span>/);
  assert.equal(
    renderToStaticMarkup(h(ui.Amount, { units: 250_000_000n, scale: 6, sign: '+' })),
    '<span class="bc-amt" data-sign="+">+250<span class="bc-fr">.000000</span></span>',
  );
  assert.match(renderToStaticMarkup(h(ui.Amount, { units: -12_500_000n, scale: 6 })), />−12<span class="bc-fr">.500000/);
  assert.match(renderToStaticMarkup(h(ui.Amount, { units: 1_000_000n, scale: 0, symbol: 'RADIO' })), />1,000,000 RADIO</);
  assert.match(renderToStaticMarkup(h(ui.Amount, { units: 18_446_744_073_709_551_615n, scale: 6, size: 'balance' })), /data-long=""/);
});

test('words, qr, tables and strip carry their semantics', () => {
  assert.equal(renderToStaticMarkup(h(ui.WordGrid, { words: null })), '');
  assert.match(render('WordGrid'), /<ol class="bc-wg" aria-label="recovery phrase"[^>]*><li><b aria-hidden="true">01<\/b>orbit<\/li>/);
  assert.match(render('QrCode'), /<svg class="bc-qr" viewBox="-4 -4 41 41" shape-rendering="crispEdges" role="img" aria-label="QR code of the address">/);
  const table = render('DataTable');
  assert.match(table, /<caption class="bc-sr">recent blocks<\/caption>/);
  assert.match(table, /<th scope="col">slot<\/th>/);
  assert.match(table, /<tr data-href=""><td><a href="\/block\?id=48,213">48,213<\/a><\/td>/);
  assert.match(table, /<ul class="bc-recs" aria-label="recent blocks">/);
  assert.match(renderToStaticMarkup(h(explorer.DataTable, { caption: 'c', columns: [], rows: [], rowKey: (b: Block) => b.slot, empty: 'No blocks received yet.' })), /No blocks received yet\./);
  const strip = render('TransmissionStrip');
  assert.match(strip, /role="img" aria-label="last 2 minutes: average 3.4 kb\/s, 9 blocks finalized, 2 gaps"/);
  assert.match(strip, /<svg class="bc-sv-d" viewBox="0 0 600 94"/);
  assert.match(strip, /<svg class="bc-sv-p" viewBox="0 0 300 94"/);
  assert.match(strip, /class="bc-c-g"/);
  assert.match(strip, /<title>48,203 finalized<\/title>/);
  assert.match(strip, /<table class="bc-sr"><caption>latest samples<\/caption>/);
  assert.match(strip, /<th scope="col">finalized<\/th>.*<td>48,203 at 21:04:16 UTC<\/td>/);
  const timeline = render('BlockTimeline');
  assert.match(timeline, /role="img" aria-label="last 24 hours: 2 blocks finalized, 1 skipped, no data for 15 min"/);
  assert.match(timeline, /tabindex="0" aria-label="history · 24 h: use arrow keys to read each column"/);
  assert.match(timeline, /class="bc-t-g"/);
  assert.match(timeline, /class="bc-t-s"/);
  assert.match(timeline, /<p class="bc-tl-ro" aria-live="polite">latest · 48,203 node 1 11:59 UTC<\/p>/);
  assert.match(timeline, /<caption>history · 24 h: blocks by time<\/caption>/);
  assert.match(render('Lifecycle'), /<li data-state="current" aria-current="step">/);
  assert.match(render('HeaderSearch'), /<form class="bc-hs" role="search"><label class="bc-sr" for="([^"]+)">search<\/label><input type="text" class="bc-inp" data-mono="" id="\1"/);
});
