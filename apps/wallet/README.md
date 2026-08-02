# BunkerCoin Wallet

Local-only web wallet for the BunkerCoin testnet: balances, sending BUNKER and
tokens, and a faucet. No server, no accounts — keys are created in the browser
and never leave the device.

Live at [wallet.bunkercoin.com](https://wallet.bunkercoin.com).

## Security model

- A new wallet generates a **24-word BIP-39 phrase** (ed25519, base58 address —
  the same key infrastructure as Solana wallets).
- The phrase is encrypted with **Argon2id** (256 MiB, 14 iterations — tuned to
  take seconds per attempt by design) + AES-GCM under a user password, and only
  the encrypted record is stored in `localStorage`
  ([src/lib/keystore.ts](src/lib/keystore.ts)).
- The decrypted key exists in memory only while unlocked; the wallet
  auto-locks after 15 minutes idle.
- Recovery = re-entering the 24 words. There is no password reset.

## Chain integration

Talks Solana-style JSON-RPC to `rpc.bunkercoin.com` — the contract is
documented in
[WALLET_RPC.md](https://github.com/TheBunkerCoin/bunker_coin/blob/main/docs/WALLET_RPC.md)
in the node repo. Transactions are BunkerCoin-native: nonce-based with an
ed25519 signature over the node's exact signing-hash byte layout
([src/lib/keys.ts](src/lib/keys.ts) mirrors `Transaction::signing_hash`).
The RPC client with radio-aware confirmation polling lives in
[src/lib/connection.ts](src/lib/connection.ts).

Finality rides an HF radio link: seconds when the band is clear, minutes when
it fades. The UI treats that as normal — submitted transactions are tracked in
a persistent activity list that survives reloads, not a blocking spinner.

## Develop

```
npm install
npm test           # crypto, keystore, connection tests
npm run typecheck  # strict TypeScript
npm run dev        # http://localhost:3007
npm run build      # static export to out/
```

`NEXT_PUBLIC_RPC_URL` and `NEXT_PUBLIC_EXPLORER_URL` override the RPC and
explorer endpoints at build time.

## Deploy

Every push to `main` builds and deploys automatically via Cloudflare Workers
Builds (`npm run build`, then `wrangler deploy` publishes `out/` as static
assets — see [wrangler.jsonc](wrangler.jsonc)). Any static host works too:
`npm run build` and serve `out/`.
