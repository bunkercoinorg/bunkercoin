import { ed25519 } from '@noble/curves/ed25519.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { generateMnemonic, mnemonicToSeedSync, validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';
import bs58 from 'bs58';

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
    | { Mint: { ticker: string; max_supply: bigint; metadata_hash: string } };
}

/** Native BUNKER and custom tokens are told apart by kind, never by ticker. */
export type Asset = { kind: 'native' } | { kind: 'token'; tokenId: string };

export const NATIVE_ASSET: Asset = { kind: 'native' };

export function assetKey(asset: Asset): string {
  return asset.kind === 'native' ? 'native' : `token:${asset.tokenId}`;
}

/** Token ids are 4 raw bytes, hex-encoded by the node ("01000000"). */
export function isTokenId(id: unknown): id is string {
  return typeof id === 'string' && /^[0-9a-f]{8}$/.test(id);
}

export function tokenIdBytes(id: string): Uint8Array {
  if (!isTokenId(id)) throw new Error('Token id must be 8 lowercase hex characters');
  return Uint8Array.from(id.match(/../g)!.map((b) => parseInt(b, 16)));
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

/** Mnemonic -> ed25519 keypair. Seed's first 32 bytes are the private scalar. */
export function keypairFromMnemonic(phrase: string, passphrase = ''): Keypair {
  const normalized = normalizeMnemonic(phrase);
  if (!validateMnemonic(normalized, wordlist)) throw new Error('Invalid recovery phrase');
  const seed = mnemonicToSeedSync(normalized, passphrase);
  const privateKey = seed.slice(0, 32);
  seed.fill(0);
  const publicKey = ed25519.getPublicKey(privateKey);
  return { privateKey, publicKey, address: bs58.encode(publicKey) };
}

export function addressFromPublicKey(publicKey: Uint8Array): string {
  return bs58.encode(publicKey);
}

/** Accepts base58 or hex, as the node does. */
export function decodeAddress(address: string): Uint8Array {
  const value = address.trim();
  if (/^[0-9a-fA-F]{64}$/.test(value)) {
    return Uint8Array.from(value.match(/../g)!.map((b) => parseInt(b, 16)));
  }
  const bytes = bs58.decode(value);
  if (bytes.length !== 32) throw new Error('Address must be 32 bytes');
  return bytes;
}

/** Node tx listings use hex; the wallet displays base58. */
export function addressToHex(address: string): string {
  return Array.from(decodeAddress(address), (b) => b.toString(16).padStart(2, '0')).join('');
}

export function hexToBase58(hex: string): string {
  return bs58.encode(Uint8Array.from(hex.match(/../g)!.map((b) => parseInt(b, 16))));
}

export function isValidAddress(address: string): boolean {
  try {
    decodeAddress(address);
    return true;
  } catch {
    return false;
  }
}

const U64_MAX = (1n << 64n) - 1n;

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

/** SHA-256 of the off-chain metadata JSON the chain commits to. */
export function metadataHash(metadata: unknown): Uint8Array {
  return sha256(new TextEncoder().encode(JSON.stringify(metadata)));
}

export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

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
    sender: bs58.encode(publicKey),
    nonce,
    fee,
    signature: bs58.encode(ed25519.sign(digest, privateKey)),
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
    sender: bs58.encode(publicKey),
    nonce,
    fee,
    signature: bs58.encode(ed25519.sign(hash, privateKey)),
    body: { Transfer: { to: bs58.encode(recipient), amount } },
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
    sender: bs58.encode(publicKey),
    nonce,
    fee,
    signature: bs58.encode(ed25519.sign(hash, privateKey)),
    body: {
      TokenTransfer: {
        // The node's REST layer decodes token_id from hex, not a byte array.
        to: bs58.encode(recipient),
        token_id: toHex(tokenId),
        amount,
      },
    },
  };
}
