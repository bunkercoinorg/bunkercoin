import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { ed25519 } from '@noble/curves/ed25519.js';
import bs58 from 'bs58';
import {
  createMnemonic,
  keypairFromMnemonic,
  isValidMnemonic,
  decodeAddress,
  isValidAddress,
  transferSigningHash,
  tokenTransferSigningHash,
  signTransfer,
} from '../src/lib/keys.ts';

test('generated mnemonic has 24 words and round-trips to a stable address', () => {
  const phrase = createMnemonic();
  assert.equal(phrase.split(' ').length, 24);
  assert.ok(isValidMnemonic(phrase));
  assert.equal(keypairFromMnemonic(phrase).address, keypairFromMnemonic(phrase).address);
});

test('mnemonic with a corrupted word is rejected', () => {
  const words = createMnemonic().split(' ');
  words[5] = 'zzzznotaword';
  assert.equal(isValidMnemonic(words.join(' ')), false);
  assert.throws(() => keypairFromMnemonic(words.join(' ')), /Invalid recovery phrase/);
});

test('recovery is case- and whitespace-insensitive', () => {
  const phrase = createMnemonic();
  const messy = `  ${phrase.toUpperCase().split(' ').join('   ')}  `;
  assert.equal(keypairFromMnemonic(messy).address, keypairFromMnemonic(phrase).address);
});

test('different mnemonics yield different addresses', () => {
  assert.notEqual(
    keypairFromMnemonic(createMnemonic()).address,
    keypairFromMnemonic(createMnemonic()).address,
  );
});

test('addresses decode from both base58 and hex to the same bytes', () => {
  const { publicKey, address } = keypairFromMnemonic(createMnemonic());
  const hex = Buffer.from(publicKey).toString('hex');
  assert.deepEqual(decodeAddress(address), publicKey);
  assert.deepEqual(decodeAddress(hex), publicKey);
});

test('malformed addresses are rejected', () => {
  assert.equal(isValidAddress('not-an-address'), false);
  assert.equal(isValidAddress(''), false);
  assert.equal(isValidAddress(bs58.encode(new Uint8Array(16))), false, '16 bytes is not an address');
});

test('signing hash matches the node byte layout for Transfer', () => {
  // sender=1s, to=2s, nonce=1, fee=100, amount=5000 — layout per
  // Transaction::signing_hash: sender ‖ nonce_le ‖ fee_le ‖ 0x00 ‖ to ‖ amount_le
  const sender = new Uint8Array(32).fill(1);
  const to = new Uint8Array(32).fill(2);
  const hash = transferSigningHash({ sender, nonce: 1, fee: 100, to, amount: 5000 });

  const expected = new Uint8Array([
    ...sender,
    1, 0, 0, 0, 0, 0, 0, 0,
    100, 0, 0, 0, 0, 0, 0, 0,
    0x00,
    ...to,
    136, 19, 0, 0, 0, 0, 0, 0,
  ]);
  assert.deepEqual(Buffer.from(hash), createHash('sha256').update(expected).digest());
});

test('signing hash changes with every field', () => {
  const base = {
    sender: new Uint8Array(32).fill(1),
    to: new Uint8Array(32).fill(2),
    nonce: 1,
    fee: 100,
    amount: 5000,
  };
  const h = (o: Partial<typeof base>) => Buffer.from(transferSigningHash({ ...base, ...o })).toString('hex');
  const original = h({});
  assert.notEqual(h({ nonce: 2 }), original, 'nonce must affect the hash (replay protection)');
  assert.notEqual(h({ fee: 101 }), original);
  assert.notEqual(h({ amount: 5001 }), original);
  assert.notEqual(h({ to: new Uint8Array(32).fill(3) }), original);
});

test('Transfer and TokenTransfer hash differently for identical fields', () => {
  const common = {
    sender: new Uint8Array(32).fill(1),
    to: new Uint8Array(32).fill(2),
    nonce: 0,
    fee: 100,
    amount: 5000,
  };
  assert.notEqual(
    Buffer.from(transferSigningHash(common)).toString('hex'),
    Buffer.from(tokenTransferSigningHash({ ...common, tokenId: new Uint8Array([0, 0, 0, 0]) })).toString('hex'),
    'body tag must distinguish the variants',
  );
});

test('token_id is hashed as raw bytes, not a little-endian integer', () => {
  // The node uses TokenId = [u8; 4] with test values like [0,0,0,99]. If we
  // treated it as u32 LE, [0,0,0,99] and [99,0,0,0] would collide.
  const common = {
    sender: new Uint8Array(32).fill(1),
    to: new Uint8Array(32).fill(2),
    nonce: 0,
    fee: 100,
    amount: 1,
  };
  const a = tokenTransferSigningHash({ ...common, tokenId: new Uint8Array([0, 0, 0, 99]) });
  const b = tokenTransferSigningHash({ ...common, tokenId: new Uint8Array([99, 0, 0, 0]) });
  assert.notEqual(Buffer.from(a).toString('hex'), Buffer.from(b).toString('hex'));
});

test('signed transfer verifies under the sender public key', () => {
  const { privateKey, publicKey, address } = keypairFromMnemonic(createMnemonic());
  const to = keypairFromMnemonic(createMnemonic()).address;
  const tx = signTransfer({ privateKey, publicKey, to, amount: 12345, nonce: 0, fee: 100 });

  assert.equal(tx.sender, address);
  assert.ok('Transfer' in tx.body);
  assert.equal(tx.body.Transfer.amount, 12345);
  const hash = transferSigningHash({
    sender: publicKey,
    nonce: 0,
    fee: 100,
    to: decodeAddress(to),
    amount: 12345,
  });
  assert.ok(ed25519.verify(bs58.decode(tx.signature), hash, publicKey));
});

test('a signature does not verify against a tampered amount', () => {
  const { privateKey, publicKey } = keypairFromMnemonic(createMnemonic());
  const to = keypairFromMnemonic(createMnemonic()).address;
  const tx = signTransfer({ privateKey, publicKey, to, amount: 100, nonce: 0, fee: 100 });

  const tamperedHash = transferSigningHash({
    sender: publicKey,
    nonce: 0,
    fee: 100,
    to: decodeAddress(to),
    amount: 999999,
  });
  assert.equal(ed25519.verify(bs58.decode(tx.signature), tamperedHash, publicKey), false);
});
