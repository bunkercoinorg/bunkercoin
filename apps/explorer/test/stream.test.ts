import test from 'node:test';
import assert from 'node:assert/strict';
import { allowedStreamUrl, DEFAULT_STREAM_HOSTS, parseHostList, withQuery } from '../lib/stream-url.ts';
import { assessHls, firstVariantUrl, initialHlsWatch, isMasterPlaylist, isPlaylist, liveEdge } from '../lib/hls.ts';

test('only https URLs on allowed hosts pass', () => {
  const hosts = DEFAULT_STREAM_HOSTS;
  assert.equal(
    allowedStreamUrl('https://customer-abc.cloudflarestream.com/uid/iframe', hosts),
    'https://customer-abc.cloudflarestream.com/uid/iframe',
  );
  assert.equal(allowedStreamUrl('https://iframe.videodelivery.net/uid', hosts), 'https://iframe.videodelivery.net/uid');
  assert.equal(allowedStreamUrl('http://customer-abc.cloudflarestream.com/uid', hosts), null);
  assert.equal(allowedStreamUrl('javascript:alert(1)', hosts), null);
  assert.equal(allowedStreamUrl('https://evilcloudflarestream.com/x', hosts), null);
  assert.equal(allowedStreamUrl('https://cloudflarestream.com.evil.net/x', hosts), null);
  assert.equal(allowedStreamUrl('https://user@iframe.videodelivery.net/x', hosts), null);
  assert.equal(allowedStreamUrl('not a url', hosts), null);
  assert.equal(allowedStreamUrl(null, hosts), null);
});

test('extra hosts parse from a comma list', () => {
  assert.deepEqual(parseHostList(' A.example.com, *.cdn.example.org ,,'), ['a.example.com', '*.cdn.example.org']);
  assert.deepEqual(parseHostList(undefined), []);
});

test('withQuery sets params without breaking existing ones', () => {
  assert.equal(withQuery('https://x.test/p?a=1', { autoplay: 'true' }), 'https://x.test/p?a=1&autoplay=true');
});

test('live edge advances with the media playlist, not the master', () => {
  const master = '#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=800000\nlow/index.m3u8\n';
  assert.equal(isMasterPlaylist(master), true);
  assert.equal(firstVariantUrl(master, 'https://cdn.test/live/master.m3u8'), 'https://cdn.test/live/low/index.m3u8');
  const media = '#EXTM3U\n#EXT-X-MEDIA-SEQUENCE:41\n#EXTINF:2.0,\na.ts\n#EXTINF:2.0,\nb.ts\n';
  assert.equal(isMasterPlaylist(media), false);
  assert.equal(liveEdge(media), 43);
  assert.equal(liveEdge('#EXTM3U\n#EXTINF:2.0,\na.ts\n'), 'unknown');
  assert.equal(isPlaylist('  #EXTM3U\n'), true);
  assert.equal(isPlaylist('<html>'), false);
});

const STALE = 20_000;
const T = 1_700_000_000_000;

test('a failed probe keeps a playing player mounted and live', () => {
  let r = assessHls(initialHlsWatch, { ok: true, edge: 10 }, 0, T + 1000, STALE);
  assert.equal(r.view, 'live');
  assert.equal(r.watch.mounted, true);
  r = assessHls(r.watch, { ok: false }, T + 30_000, T + 31_000, STALE);
  assert.equal(r.watch.mounted, true);
  assert.equal(r.view, 'live');
  r = assessHls(r.watch, { ok: false }, T + 30_000, T + 60_000, STALE);
  assert.equal(r.watch.mounted, true);
  assert.equal(r.view, 'starting');
});

test('playback progress keeps a stalled edge fresh', () => {
  let r = assessHls(initialHlsWatch, { ok: true, edge: 10 }, 0, T + 1000, STALE);
  r = assessHls(r.watch, { ok: true, edge: 10 }, T + 40_000, T + 41_000, STALE);
  assert.equal(r.view, 'live');
  r = assessHls(r.watch, { ok: true, edge: 10 }, T + 40_000, T + 70_000, STALE);
  assert.equal(r.view, 'waiting');
  assert.equal(r.watch.mounted, false);
});

test('a playlist without a media sequence mounts the player instead of waiting forever', () => {
  let r = assessHls(initialHlsWatch, { ok: true, edge: 'unknown' }, 0, T + 1000, STALE);
  assert.equal(r.watch.mounted, true);
  assert.equal(r.view, 'starting');
  r = assessHls(r.watch, { ok: true, edge: 'unknown' }, T + 4000, T + 5000, STALE);
  assert.equal(r.view, 'live');
});

test('a player that gave up is remounted with a new key once the stream moves', () => {
  const live = assessHls(initialHlsWatch, { ok: true, edge: 10 }, 0, T + 1000, STALE).watch;
  const broken = { ...live, brokenAt: T + 2000, mounted: false };
  let r = assessHls(broken, { ok: true, edge: 10 }, 0, T + 3000, STALE);
  assert.equal(r.watch.mounted, false);
  r = assessHls(r.watch, { ok: true, edge: 11 }, 0, T + 6000, STALE);
  assert.equal(r.watch.mounted, true);
  assert.equal(r.watch.playerKey, live.playerKey + 1);
  const unknown = assessHls({ ...broken, edge: null }, { ok: true, edge: 'unknown' }, 0, T + 3000, STALE);
  assert.equal(unknown.watch.mounted, false);
  assert.equal(assessHls(unknown.watch, { ok: true, edge: 'unknown' }, 0, T + 2000 + STALE, STALE).watch.mounted, true);
});
