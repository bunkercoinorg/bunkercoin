# BunkerCoin Wallet

Local-only web wallet for the BunkerCoin testnet: balances, sending BUNKER and
tokens, and a faucet. No server, no accounts — keys are created in the browser
and never leave the device.

## Security model

- A new wallet generates a **24-word BIP-39 phrase** (ed25519, base58 address —
  the same key infrastructure as Solana wallets).
- The phrase is encrypted with **Argon2id** (256 MiB, 14 iterations — tuned to
  take seconds per attempt by design) + AES-GCM under a user password, and only
  the encrypted record is stored in `localStorage`.
- The decrypted key exists in memory only while unlocked; the wallet
  auto-locks after 15 minutes idle.
- Recovery = re-entering the 24 words. There is no password reset.

## Chain integration

Talks Solana-style JSON-RPC to `rpc.bunkercoin.com` (see
`docs/WALLET_RPC.md` in the node repo). Transactions are BunkerCoin-native:
nonce-based with an ed25519 signature over the node's exact signing-hash byte
layout (`src/lib/keys.js` mirrors `Transaction::signing_hash`).

Finality rides an HF radio link: seconds when the band is clear, minutes when
it fades. The UI treats that as normal — submitted transactions are tracked in
a persistent activity list that survives reloads, not a blocking spinner.

## Develop

```
npm install
npm test        # crypto, keystore, connection tests
npm run dev     # http://localhost:3007
npm run build   # static export to out/
```

`NEXT_PUBLIC_RPC_URL` overrides the RPC endpoint at build time.

## Deploy

Static export — any static host works:

```
npm run build   # then serve out/
```
