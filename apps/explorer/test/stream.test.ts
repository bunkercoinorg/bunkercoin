import test from 'node:test';
import assert from 'node:assert/strict';
import { allowedStreamUrl, DEFAULT_STREAM_HOSTS, parseHostList, withQuery } from '../lib/stream-url.ts';
import { firstVariantUrl, isMasterPlaylist, liveEdge } from '../lib/hls.ts';

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
  assert.equal(liveEdge('#EXTM3U\n'), null);
});
