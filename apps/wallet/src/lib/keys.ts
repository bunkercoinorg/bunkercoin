import { ed25519 } from '@noble/curves/ed25519.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { generateMnemonic, mnemonicToSeedSync, validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';
import { base58ToBytes, bytesToBase58, bytesToHex, canonicalMetadataJson, decodeId, hexToBytes, isTokenId, U64_MAX } from '@bunkercoin/chain-format';

export { isTokenId };

export const MNEMONIC_WORDS = 24;

export interface Keypair {
  privateKey: Uint8Array;
  publicKey: Uint8Array;
  address: string;
}

export const MIN_TICKER_LEN = 3;
export const MAX_TICKER_LEN = 8;

export interface SignedTransaction {
  sender: string;
  nonce: bigint;
  fee: bigint;
  signature: string;
  body:
    | { Transfer: { to: string; amount: bigint } }
    | { TokenTransfer: { to: string; token_id: string; amount: bigint } }
    | { Mint: { ticker: string; max_supply: bigint; metadata_hash: string } }
    | { UpdateMetadata: { token_id: string; metadata_hash: string } };
}

/** Native BUNKER and custom tokens are told apart by kind, never by ticker. */
export type Asset = { kind: 'native' } | { kind: 'token'; tokenId: string };

export const NATIVE_ASSET: Asset = { kind: 'native' };

export function assetKey(asset: Asset): string {
  return asset.kind === 'native' ? 'native' : `token:${asset.tokenId}`;
}

/** Token ids are 4 raw bytes, hex-encoded by the node ("01000000"). */
export function tokenIdBytes(id: string): Uint8Array {
  if (!isTokenId(id)) throw new Error('Token id must be 8 lowercase hex characters');
  return hexToBytes(id)!;
}

export function createMnemonic(): string {
  return generateMnemonic(wordlist, 256);
}

export function isValidMnemonic(phrase: string): boolean {
  return validateMnemonic(normalizeMnemonic(phrase), wordlist);
}

export function normalizeMnemonic(phrase: string): string {
  return phrase.trim().toLowerCase().split(/\s+/).join(' ');
}

export const WORDLIST: readonly string[] = wordlist;
const WORDS = new Set(wordlist);

export interface PhraseCheck {
  count: number;
  /** First finished word outside the list; the word still being typed is not judged. */
  unknown: { position: number; word: string } | null;
  valid: boolean;
}

export function checkPhrase(text: string): PhraseCheck {
  const words = text.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const typing = words.length > 0 && !/\s$/.test(text) && words.length < MNEMONIC_WORDS;
  const judged = typing ? words.slice(0, -1) : words;
  const at = judged.findIndex((w) => !WORDS.has(w));
  return {
    count: words.length,
    unknown: at === -1 ? null : { position: at + 1, word: judged[at] },
    valid: words.length === MNEMONIC_WORDS && at === -1 && validateMnemonic(words.join(' '), wordlist),
  };
}

/** Mnemonic -> ed25519 keypair. Seed's first 32 bytes are the private scalar. */
export function keypairFromMnemonic(phrase: string, passphrase = ''): Keypair {
  const normalized = normalizeMnemonic(phrase);
  if (!validateMnemonic(normalized, wordlist)) throw new Error('Invalid recovery phrase');
  const seed = mnemonicToSeedSync(normalized, passphrase);
  const privateKey = seed.slice(0, 32);
  seed.fill(0);
  const publicKey = ed25519.getPublicKey(privateKey);
  return { privateKey, publicKey, address: bytesToBase58(publicKey) };
}

export function addressFromPublicKey(publicKey: Uint8Array): string {
  return bytesToBase58(publicKey);
}

/** Accepts base58 or hex, as the node does. */
export function decodeAddress(address: string): Uint8Array {
  const bytes = decodeId(address, 32);
  if (!bytes) throw new Error('Address must be 32 bytes');
  return bytes;
}

/** Node tx listings use hex; the wallet displays base58. */
export function addressToHex(address: string): string {
  return bytesToHex(decodeAddress(address));
}

export function hexToBase58(hex: string): string {
  const bytes = hexToBytes(hex);
  if (!bytes) throw new Error('not hex');
  return bytesToBase58(bytes);
}

export function isValidAddress(address: string): boolean {
  try {
    decodeAddress(address);
    return true;
  } catch {
    return false;
  }
}

// setBigUint64 wraps silently; an out-of-range value must never sign as a different one.
const u64le = (value: number | bigint): Uint8Array => {
  const big = BigInt(value);
  if (big < 0n || big > U64_MAX) throw new RangeError('value does not fit in a u64');
  const bytes = new Uint8Array(8);
  new DataView(bytes.buffer).setBigUint64(0, big, true);
  return bytes;
};

interface TransferHashInput {
  sender: Uint8Array;
  nonce: number | bigint;
  fee: number | bigint;
  to: Uint8Array;
  amount: number | bigint;
}

// Mirrors Transaction::signing_hash byte-for-byte — any drift = silently invalid signatures.
export function transferSigningHash({ sender, nonce, fee, to, amount }: TransferHashInput): Uint8Array {
  return sha256(new Uint8Array([...sender, ...u64le(nonce), ...u64le(fee), 0x00, ...to, ...u64le(amount)]));
}

// token_id is a raw [u8; 4] on the node, NOT a little-endian u32.
export function tokenTransferSigningHash({
  sender,
  nonce,
  fee,
  to,
  tokenId,
  amount,
}: TransferHashInput & { tokenId: Uint8Array }): Uint8Array {
  if (tokenId.length !== 4) throw new Error('tokenId must be 4 bytes');
  return sha256(
    new Uint8Array([...sender, ...u64le(nonce), ...u64le(fee), 0x01, ...to, ...tokenId, ...u64le(amount)]),
  );
}

const u32le = (value: number): Uint8Array => {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value, true);
  return bytes;
};

// Mint layout: sender ‖ nonce ‖ fee ‖ 0x02 ‖ ticker_len(4 LE) ‖ ticker ‖ max_supply ‖ metadata_hash(32).
export function mintSigningHash({
  sender,
  nonce,
  fee,
  ticker,
  maxSupply,
  metadataHash,
}: {
  sender: Uint8Array;
  nonce: number | bigint;
  fee: number | bigint;
  ticker: string;
  maxSupply: number | bigint;
  metadataHash: Uint8Array;
}): Uint8Array {
  if (metadataHash.length !== 32) throw new Error('metadataHash must be 32 bytes');
  const encoded = new TextEncoder().encode(ticker);
  return sha256(
    new Uint8Array([
      ...sender,
      ...u64le(nonce),
      ...u64le(fee),
      0x02,
      ...u32le(encoded.length),
      ...encoded,
      ...u64le(maxSupply),
      ...metadataHash,
    ]),
  );
}

/** @deprecated Use lib/metadata. Canonical hash of an image-less {name, description} document; throws when invalid. */
export function metadataHash(metadata: { name: string; description: string }): Uint8Array {
  const doc = { v: 1, name: metadata.name.normalize('NFC'), description: metadata.description.normalize('NFC'), image: null } as const;
  return sha256(new TextEncoder().encode(canonicalMetadataJson(doc)));
}

// UpdateMetadata layout: sender ‖ nonce ‖ fee ‖ 0x09 ‖ token_id(4) ‖ metadata_hash(32).
export function updateMetadataSigningHash({
  sender,
  nonce,
  fee,
  tokenId,
  metadataHash,
}: {
  sender: Uint8Array;
  nonce: number | bigint;
  fee: number | bigint;
  tokenId: Uint8Array;
  metadataHash: Uint8Array;
}): Uint8Array {
  if (tokenId.length !== 4) throw new Error('tokenId must be 4 bytes');
  if (metadataHash.length !== 32) throw new Error('metadataHash must be 32 bytes');
  return sha256(new Uint8Array([...sender, ...u64le(nonce), ...u64le(fee), 0x09, ...tokenId, ...metadataHash]));
}

/** Transaction::hash: sha256(sender ‖ nonce ‖ fee ‖ signature), base58 as the RPC returns it. Known before sending. */
export function transactionId(tx: SignedTransaction): string {
  const sender = base58ToBytes(tx.sender, 32);
  const signature = base58ToBytes(tx.signature, 64);
  if (!sender || !signature) throw new Error('malformed signed transaction');
  return bytesToBase58(sha256(new Uint8Array([...sender, ...u64le(tx.nonce), ...u64le(tx.fee), ...signature])));
}

export const toHex = bytesToHex;

export function isValidTicker(ticker: string): boolean {
  return /^[A-Z0-9]{3,8}$/.test(ticker);
}

export function signMint({
  privateKey,
  publicKey,
  ticker,
  maxSupply,
  metadataHash: hash,
  nonce,
  fee,
}: {
  privateKey: Uint8Array;
  publicKey: Uint8Array;
  ticker: string;
  maxSupply: bigint;
  metadataHash: Uint8Array;
  nonce: bigint;
  fee: bigint;
}): SignedTransaction {
  const digest = mintSigningHash({
    sender: publicKey,
    nonce,
    fee,
    ticker,
    maxSupply,
    metadataHash: hash,
  });
  return {
    sender: bytesToBase58(publicKey),
    nonce,
    fee,
    signature: bytesToBase58(ed25519.sign(digest, privateKey)),
    // The node's REST layer decodes metadata_hash from hex, not a byte array.
    body: { Mint: { ticker, max_supply: maxSupply, metadata_hash: toHex(hash) } },
  };
}

export function signTransfer({
  privateKey,
  publicKey,
  to,
  amount,
  nonce,
  fee,
}: {
  privateKey: Uint8Array;
  publicKey: Uint8Array;
  to: string;
  amount: bigint;
  nonce: bigint;
  fee: bigint;
}): SignedTransaction {
  const recipient = decodeAddress(to);
  const hash = transferSigningHash({ sender: publicKey, nonce, fee, to: recipient, amount });
  return {
    sender: bytesToBase58(publicKey),
    nonce,
    fee,
    signature: bytesToBase58(ed25519.sign(hash, privateKey)),
    body: { Transfer: { to: bytesToBase58(recipient), amount } },
  };
}

export function signTokenTransfer({
  privateKey,
  publicKey,
  to,
  tokenId,
  amount,
  nonce,
  fee,
}: {
  privateKey: Uint8Array;
  publicKey: Uint8Array;
  to: string;
  tokenId: Uint8Array;
  amount: bigint;
  nonce: bigint;
  fee: bigint;
}): SignedTransaction {
  const recipient = decodeAddress(to);
  const hash = tokenTransferSigningHash({ sender: publicKey, nonce, fee, to: recipient, tokenId, amount });
  return {
    sender: bytesToBase58(publicKey),
    nonce,
    fee,
    signature: bytesToBase58(ed25519.sign(hash, privateKey)),
    body: {
      TokenTransfer: {
        // The node's REST layer decodes token_id from hex, not a byte array.
        to: bytesToBase58(recipient),
        token_id: toHex(tokenId),
        amount,
      },
    },
  };
}

export function signUpdateMetadata({
  privateKey,
  publicKey,
  tokenId,
  metadataHash: hash,
  nonce,
  fee,
}: {
  privateKey: Uint8Array;
  publicKey: Uint8Array;
  tokenId: Uint8Array;
  metadataHash: Uint8Array;
  nonce: bigint;
  fee: bigint;
}): SignedTransaction {
  const digest = updateMetadataSigningHash({ sender: publicKey, nonce, fee, tokenId, metadataHash: hash });
  return {
    sender: bytesToBase58(publicKey),
    nonce,
    fee,
    signature: bytesToBase58(ed25519.sign(digest, privateKey)),
    body: { UpdateMetadata: { token_id: toHex(tokenId), metadata_hash: toHex(hash) } },
  };
}
