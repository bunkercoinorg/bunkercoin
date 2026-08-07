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
  signMint,
  mintSigningHash,
  metadataHash,
  isValidTicker,
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

test('mint signing hash matches the node byte layout', async () => {
  // sender=1s, nonce=0, fee=100, ticker="BNK", supply=1e6, metadata=0s — layout:
  // sender ‖ nonce_le ‖ fee_le ‖ 0x02 ‖ ticker_len_le(4) ‖ ticker ‖ supply_le ‖ hash(32)
  const sender = new Uint8Array(32).fill(1);
  const metadata = new Uint8Array(32);
  const hash = mintSigningHash({ sender, nonce: 0, fee: 100, ticker: 'BNK', maxSupply: 1_000_000, metadataHash: metadata });

  const expected = new Uint8Array([
    ...sender,
    0, 0, 0, 0, 0, 0, 0, 0,
    100, 0, 0, 0, 0, 0, 0, 0,
    0x02,
    3, 0, 0, 0,
    66, 78, 75,
    64, 66, 15, 0, 0, 0, 0, 0,
    ...metadata,
  ]);
  const { createHash } = await import('node:crypto');
  assert.deepEqual(Buffer.from(hash), createHash('sha256').update(expected).digest());
});

test('mint hash changes with ticker, supply, and metadata', () => {
  const base = {
    sender: new Uint8Array(32).fill(1),
    nonce: 0,
    fee: 100,
    ticker: 'BNK',
    maxSupply: 1_000_000,
    metadataHash: new Uint8Array(32),
  };
  const h = (o: Partial<typeof base>) => Buffer.from(mintSigningHash({ ...base, ...o })).toString('hex');
  const original = h({});
  assert.notEqual(h({ ticker: 'BNKX' }), original);
  assert.notEqual(h({ maxSupply: 1_000_001 }), original);
  assert.notEqual(h({ metadataHash: new Uint8Array(32).fill(9) }), original);
  assert.notEqual(h({ nonce: 1 }), original, 'nonce must affect the hash');
});

test('ticker length prefix prevents a concatenation collision', () => {
  // Without the length prefix, ("AB","C…") and ("ABC","…") would hash alike.
  const base = { sender: new Uint8Array(32), nonce: 0, fee: 0, maxSupply: 1, metadataHash: new Uint8Array(32) };
  assert.notEqual(
    Buffer.from(mintSigningHash({ ...base, ticker: 'ABC' })).toString('hex'),
    Buffer.from(mintSigningHash({ ...base, ticker: 'ABCD' })).toString('hex'),
  );
});

test('signed mint verifies and carries a hex metadata hash', () => {
  const { privateKey, publicKey, address } = keypairFromMnemonic(createMnemonic());
  const hash = metadataHash({ name: 'Bunker Token', description: 'demo' });
  const tx = signMint({ privateKey, publicKey, ticker: 'BNKR', maxSupply: 500, metadataHash: hash, nonce: 0, fee: 100 });

  assert.equal(tx.sender, address);
  assert.ok('Mint' in tx.body);
  assert.equal(tx.body.Mint.ticker, 'BNKR');
  assert.match(tx.body.Mint.metadata_hash, /^[0-9a-f]{64}$/, 'node decodes metadata_hash from hex');
  const digest = mintSigningHash({ sender: publicKey, nonce: 0, fee: 100, ticker: 'BNKR', maxSupply: 500, metadataHash: hash });
  assert.ok(ed25519.verify(bs58.decode(tx.signature), digest, publicKey));
});

test('metadata hash is stable and content-dependent', () => {
  const a = metadataHash({ name: 'A', description: 'x' });
  assert.deepEqual(a, metadataHash({ name: 'A', description: 'x' }));
  assert.notDeepEqual(a, metadataHash({ name: 'B', description: 'x' }));
});

test('ticker validation matches the chain rules', () => {
  assert.ok(isValidTicker('BNK'));
  assert.ok(isValidTicker('BUNKER12'));
  assert.equal(isValidTicker('BN'), false, 'min 3 chars');
  assert.equal(isValidTicker('BUNKERCOIN'), false, 'max 8 chars');
  assert.equal(isValidTicker('bnk'), false, 'uppercase only');
  assert.equal(isValidTicker('BN K'), false, 'no spaces');
});
