import { ed25519 } from '@noble/curves/ed25519.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { generateMnemonic, mnemonicToSeedSync, validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';
import bs58 from 'bs58';

export const MNEMONIC_WORDS = 24;

export function createMnemonic() {
  return generateMnemonic(wordlist, 256);
}

export function isValidMnemonic(phrase) {
  return validateMnemonic(normalizeMnemonic(phrase), wordlist);
}

export function normalizeMnemonic(phrase) {
  return phrase.trim().toLowerCase().split(/\s+/).join(' ');
}

/** Mnemonic -> ed25519 keypair. Seed's first 32 bytes are the private scalar. */
export function keypairFromMnemonic(phrase, passphrase = '') {
  const normalized = normalizeMnemonic(phrase);
  if (!validateMnemonic(normalized, wordlist)) throw new Error('Invalid recovery phrase');
  const privateKey = mnemonicToSeedSync(normalized, passphrase).slice(0, 32);
  const publicKey = ed25519.getPublicKey(privateKey);
  return { privateKey, publicKey, address: bs58.encode(publicKey) };
}

export function addressFromPublicKey(publicKey) {
  return bs58.encode(publicKey);
}

/** Accepts base58 or hex, as the node does. */
export function decodeAddress(address) {
  const value = address.trim();
  if (/^[0-9a-fA-F]{64}$/.test(value)) {
    return Uint8Array.from(value.match(/../g).map((b) => parseInt(b, 16)));
  }
  const bytes = bs58.decode(value);
  if (bytes.length !== 32) throw new Error('Address must be 32 bytes');
  return bytes;
}

/** Node tx listings use hex; the wallet displays base58. */
export function addressToHex(address) {
  return Array.from(decodeAddress(address), (b) => b.toString(16).padStart(2, '0')).join('');
}

export function hexToBase58(hex) {
  return bs58.encode(Uint8Array.from(hex.match(/../g).map((b) => parseInt(b, 16))));
}

export function isValidAddress(address) {
  try {
    decodeAddress(address);
    return true;
  } catch {
    return false;
  }
}

const u64le = (value) => {
  const bytes = new Uint8Array(8);
  new DataView(bytes.buffer).setBigUint64(0, BigInt(value), true);
  return bytes;
};

// Mirrors Transaction::signing_hash in crates/core/src/transaction.rs. The byte
// layout is consensus-critical: any drift produces silently invalid signatures.
export function transferSigningHash({ sender, nonce, fee, to, amount }) {
  return sha256(new Uint8Array([...sender, ...u64le(nonce), ...u64le(fee), 0x00, ...to, ...u64le(amount)]));
}

// token_id is a raw [u8; 4] on the node, NOT a little-endian u32.
export function tokenTransferSigningHash({ sender, nonce, fee, to, tokenId, amount }) {
  if (tokenId.length !== 4) throw new Error('tokenId must be 4 bytes');
  return sha256(
    new Uint8Array([...sender, ...u64le(nonce), ...u64le(fee), 0x01, ...to, ...tokenId, ...u64le(amount)]),
  );
}

export function signTransfer({ privateKey, publicKey, to, amount, nonce, fee }) {
  const recipient = decodeAddress(to);
  const hash = transferSigningHash({ sender: publicKey, nonce, fee, to: recipient, amount });
  return {
    sender: bs58.encode(publicKey),
    nonce: Number(nonce),
    fee: Number(fee),
    signature: bs58.encode(ed25519.sign(hash, privateKey)),
    body: { Transfer: { to: bs58.encode(recipient), amount: Number(amount) } },
  };
}

export function signTokenTransfer({ privateKey, publicKey, to, tokenId, amount, nonce, fee }) {
  const recipient = decodeAddress(to);
  const hash = tokenTransferSigningHash({ sender: publicKey, nonce, fee, to: recipient, tokenId, amount });
  return {
    sender: bs58.encode(publicKey),
    nonce: Number(nonce),
    fee: Number(fee),
    signature: bs58.encode(ed25519.sign(hash, privateKey)),
    body: {
      TokenTransfer: {
        to: bs58.encode(recipient),
        token_id: Array.from(tokenId),
        amount: Number(amount),
      },
    },
  };
}
