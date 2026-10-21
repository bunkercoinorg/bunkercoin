import test from 'node:test';
import assert from 'node:assert/strict';
import { backoffDelay, parseWsMessage, WS_MAX_BACKOFF_MS, WS_MIN_BACKOFF_MS } from '../lib/ws-protocol.ts';

// Byte-for-byte what serde emits for WebSocketUpdate::BlockUpdate(UpdateSlot(..)).
const SLOT_FRAME =
  '{"type":"block_update","type":"update_slot","type":"block","slot":123,"hash":"abcd","parent_slot":122,' +
  '"parent_hash":"9876","producer":2,"proposed_timestamp":1719430000000,"finalized_timestamp":null,"status":"notarized"}';

test('slot updates parse from the duplicate-tag frame the node sends', () => {
  const msg = parseWsMessage(SLOT_FRAME, 0);
  assert.deepEqual(msg, {
    kind: 'slot',
    block: {
      type: 'block',
      slot: 123,
      hash: 'abcd',
      status: 'notarized',
      producer: 2,
      parent_slot: 122,
      parent_hash: '9876',
      proposed_timestamp: 1719430000000,
      finalized_timestamp: undefined,
    },
  });
});

test('skip updates parse as skip rows', () => {
  const frame =
    '{"type":"block_update","type":"update_slot","type":"skip","slot":7,"hash":"skip-7",' +
    '"proposed_timestamp":1,"finalized_timestamp":1719430000000,"status":"finalized"}';
  const msg = parseWsMessage(frame, 0);
  assert.equal(msg?.kind, 'slot');
  assert.equal(msg?.kind === 'slot' && msg.block.type, 'skip');
});

test('status changes parse in both the emitted and documented forms', () => {
  const emitted = '{"type":"block_update","type":"status_change","slot":5,"hash":"h","old_status":"proposed","new_status":"finalized"}';
  const documented = '{"type":"block_update","status_change":{"slot":5,"hash":"h","old_status":"proposed","new_status":"finalized"}}';
  const expected = { kind: 'status', slot: 5, hash: 'h', status: 'finalized' };
  assert.deepEqual(parseWsMessage(emitted, 0), expected);
  assert.deepEqual(parseWsMessage(documented, 0), expected);
});

test('the documented nested slot form is accepted', () => {
  const doc = '{"type":"block_update","update_slot":{"type":"block","slot":1,"hash":"x","producer":0,"proposed_timestamp":5,"status":"proposed"}}';
  const msg = parseWsMessage(doc, 0);
  assert.equal(msg?.kind === 'slot' && msg.block.slot, 1);
});

test('radio stats keep the sampler ratio and stamp receipt time', () => {
  const frame =
    '{"type":"radio_stats","packets_sent_2s":7,"packets_dropped_2s":3,"packets_transmitted_2s":10,' +
    '"bytes_transmitted_2s":2100,"effective_throughput_bps_2s":8400.5,"packet_loss_rate_2s":0.3,' +
    '"packets_queued":12,"link_speed_level":4,"bytes_received_2s":900}';
  const msg = parseWsMessage(frame, 42);
  assert.equal(msg?.kind, 'radio');
  if (msg?.kind !== 'radio') return;
  assert.equal(msg.stats.packet_loss_rate_2s, 0.3);
  assert.equal(msg.stats.received_at, 42);
  assert.equal(msg.stats.bytes_received_2s, 900);
});

test('unknown, malformed, and ill-typed frames are dropped', () => {
  assert.equal(parseWsMessage('{"type":"transaction_received","hash":"a","sender":"b","fee":1,"body_type":"Transfer"}', 0), null);
  assert.equal(parseWsMessage('not json', 0), null);
  assert.equal(parseWsMessage('[1,2]', 0), null);
  assert.equal(parseWsMessage('{"type":"block","slot":"7","hash":"h","status":"finalized"}', 0), null);
  assert.equal(parseWsMessage('{"type":"block","slot":7,"hash":"h","status":"weird"}', 0), null);
});

test('timestamps in seconds are normalized to ms', () => {
  const frame = '{"type":"block","slot":1,"hash":"x","proposed_timestamp":1719430000,"status":"proposed"}';
  const msg = parseWsMessage(frame, 0);
  assert.equal(msg?.kind === 'slot' && msg.block.proposed_timestamp, 1719430000000);
});

test('backoff doubles from 1s, caps at 30s, and jitters within half the ceiling', () => {
  assert.equal(backoffDelay(0, () => 0), WS_MIN_BACKOFF_MS);
  assert.equal(backoffDelay(0, () => 1), WS_MIN_BACKOFF_MS);
  assert.equal(backoffDelay(3, () => 0), 4000);
  assert.equal(backoffDelay(3, () => 1), 8000);
  assert.equal(backoffDelay(20, () => 1), WS_MAX_BACKOFF_MS);
  assert.equal(backoffDelay(20, () => 0), WS_MAX_BACKOFF_MS / 2);
});
