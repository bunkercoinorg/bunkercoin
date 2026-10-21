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
  signTokenTransfer,
  mintSigningHash,
  metadataHash,
  signUpdateMetadata,
  updateMetadataSigningHash,
  isValidTicker,
  tokenIdBytes,
  isTokenId,
  assetKey,
  NATIVE_ASSET,
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
  const tx = signTransfer({ privateKey, publicKey, to, amount: 12345n, nonce: 0n, fee: 100n });

  assert.equal(tx.sender, address);
  assert.ok('Transfer' in tx.body);
  assert.equal(tx.body.Transfer.amount, 12345n);
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
  const tx = signTransfer({ privateKey, publicKey, to, amount: 100n, nonce: 0n, fee: 100n });

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
  const tx = signMint({ privateKey, publicKey, ticker: 'BNKR', maxSupply: 500n, metadataHash: hash, nonce: 0n, fee: 100n });

  assert.equal(tx.sender, address);
  assert.ok('Mint' in tx.body);
  assert.equal(tx.body.Mint.ticker, 'BNKR');
  assert.match(tx.body.Mint.metadata_hash, /^[0-9a-f]{64}$/, 'node decodes metadata_hash from hex');
  const digest = mintSigningHash({ sender: publicKey, nonce: 0, fee: 100, ticker: 'BNKR', maxSupply: 500, metadataHash: hash });
  assert.ok(ed25519.verify(bs58.decode(tx.signature), digest, publicKey));
});

test('update metadata signing hash matches the node byte layout', () => {
  // sender ‖ nonce_le ‖ fee_le ‖ 0x09 ‖ token_id(4, raw) ‖ metadata_hash(32)
  const sender = new Uint8Array(32).fill(1);
  const metadata = new Uint8Array(32).fill(0xcd);
  const hash = updateMetadataSigningHash({ sender, nonce: 7, fee: 100, tokenId: tokenIdBytes('01000000'), metadataHash: metadata });
  const expected = new Uint8Array([
    ...sender,
    7, 0, 0, 0, 0, 0, 0, 0,
    100, 0, 0, 0, 0, 0, 0, 0,
    0x09,
    1, 0, 0, 0,
    ...metadata,
  ]);
  assert.deepEqual(Buffer.from(hash), createHash('sha256').update(expected).digest());
  assert.throws(() => updateMetadataSigningHash({ sender, nonce: 0, fee: 0, tokenId: new Uint8Array(3), metadataHash: metadata }));
  assert.throws(() => updateMetadataSigningHash({ sender, nonce: 0, fee: 0, tokenId: new Uint8Array(4), metadataHash: new Uint8Array(31) }));
});

test('signed metadata update verifies and carries hex token id and hash', () => {
  const { privateKey, publicKey, address } = keypairFromMnemonic(createMnemonic());
  const tokenId = tokenIdBytes('0a000000');
  const hash = new Uint8Array(32).fill(0xab);
  const tx = signUpdateMetadata({ privateKey, publicKey, tokenId, metadataHash: hash, nonce: 3n, fee: 100n });
  assert.equal(tx.sender, address);
  assert.deepEqual(tx.body, { UpdateMetadata: { token_id: '0a000000', metadata_hash: 'ab'.repeat(32) } });
  const digest = updateMetadataSigningHash({ sender: publicKey, nonce: 3n, fee: 100n, tokenId, metadataHash: hash });
  assert.ok(ed25519.verify(bs58.decode(tx.signature), digest, publicKey));
});

test('the pre-service metadataHash stays sha256 of JSON.stringify', () => {
  const metadata = { name: 'Bunker Token', description: 'demo' };
  assert.equal(Buffer.from(metadataHash(metadata)).toString('hex'), createHash('sha256').update(JSON.stringify(metadata)).digest('hex'));
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

test('token transfer sends token_id as hex, as the node decodes it', () => {
  // decode_token_id() in the rpc crate does hex::decode — a byte array 422s.
  const { privateKey, publicKey } = keypairFromMnemonic(createMnemonic());
  const to = keypairFromMnemonic(createMnemonic()).address;
  const tx = signTokenTransfer({
    privateKey,
    publicKey,
    to,
    tokenId: Uint8Array.from([2, 0, 0, 0]),
    amount: 100n,
    nonce: 0n,
    fee: 100n,
  });
  assert.ok('TokenTransfer' in tx.body);
  assert.equal(tx.body.TokenTransfer.token_id, '02000000');
});

test('u64 fields above 2^53 sign exactly, and out-of-range values are refused', () => {
  const { privateKey, publicKey } = keypairFromMnemonic(createMnemonic());
  const to = keypairFromMnemonic(createMnemonic()).address;
  const amount = 9007199254740993n;
  const tx = signTransfer({ privateKey, publicKey, to, amount, nonce: 0n, fee: 100n });
  assert.ok('Transfer' in tx.body);
  assert.equal(tx.body.Transfer.amount, amount);
  const hash = transferSigningHash({ sender: publicKey, nonce: 0n, fee: 100n, to: decodeAddress(to), amount });
  assert.ok(ed25519.verify(bs58.decode(tx.signature), hash, publicKey));
  assert.throws(() => signTransfer({ privateKey, publicKey, to, amount: 1n << 64n, nonce: 0n, fee: 100n }), /u64/);
  assert.throws(() => signTransfer({ privateKey, publicKey, to, amount: -1n, nonce: 0n, fee: 100n }), /u64/);
});

test('tokenIdBytes decodes the node hex id as raw bytes and rejects anything else', () => {
  assert.deepEqual(tokenIdBytes('01000000'), Uint8Array.from([1, 0, 0, 0]));
  assert.deepEqual(tokenIdBytes('000000ff'), Uint8Array.from([0, 0, 0, 255]));
  for (const bad of ['', '0100', '0100000000', 'zz000000', '0100000G', 'ABCDEF01']) {
    assert.equal(isTokenId(bad), false, bad);
    assert.throws(() => tokenIdBytes(bad), /Token id/);
  }
});

test('asset identity never lets a token named like the native asset select native', () => {
  const bunkerToken = { kind: 'token' as const, tokenId: '02000000' };
  assert.notEqual(assetKey(bunkerToken), assetKey(NATIVE_ASSET));
  assert.notEqual(assetKey(bunkerToken), assetKey({ kind: 'token', tokenId: '03000000' }));
});

test('checkPhrase counts words, names the first unknown finished word and checks the checksum', async () => {
  const { checkPhrase } = await import('../src/lib/keys.ts');
  const phrase = createMnemonic();
  const words = phrase.split(' ');
  assert.deepEqual(checkPhrase(` ${phrase.toUpperCase()}\n`), { count: 24, unknown: null, valid: true });
  assert.deepEqual(checkPhrase(words.slice(0, 18).join(' ')), { count: 18, unknown: null, valid: false });
  assert.deepEqual(checkPhrase('abandon ab'), { count: 2, unknown: null, valid: false }, 'the word being typed is not judged');
  assert.deepEqual(checkPhrase('abandon ab '), { count: 2, unknown: { position: 2, word: 'ab' }, valid: false });
  const bad = [...words];
  bad[8] = 'hazrd';
  assert.deepEqual(checkPhrase(bad.join(' ')).unknown, { position: 9, word: 'hazrd' });
  assert.deepEqual(checkPhrase(Array(24).fill('abandon').join(' ')), { count: 24, unknown: null, valid: false }, 'checksum fails');
  assert.equal(checkPhrase(`${Array(23).fill('abandon').join(' ')} art`).valid, true);
  assert.equal(checkPhrase(`${words.slice(0, 23).join(' ')} zzzz`).unknown?.position, 24, 'the 24th word is judged');
});
