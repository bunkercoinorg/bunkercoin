# BunkerCoin
A low-bandwidth, shortwave radio-compatible blockchain protocol using Alpenglow consensus.

Validators run Alpenglow consensus over real HF radio links (PACTOR modems), with persistent state, native transactions and tokens. A private testnet backs the [explorer](https://explorer.bunkercoin.com) and the [wallet](https://wallet.bunkercoin.com).

Contributions welcomed!

## Quick Start

### Run a node pair locally (no radios)

Two validators over a simulated half-duplex PACTOR link:

```bash
cargo run -p bunker_coin_sim --bin pactor_consensus -- --simulated --half-duplex --rpc
```

- The RPC is served on http://localhost:3001 (override with `BUNKER_RPC_ADDR`)
- See [Explorer API Spec](docs/rpc_spec.md) and [Wallet RPC](docs/WALLET_RPC.md) for endpoints

### Run on air

Two SCS Dragon DR-7400 PACTOR modems on two machines, one node per machine:

```bash
cargo build --release -p bunker_coin_sim --bin pactor_consensus
target/release/pactor_consensus --port /dev/ttyUSB0 --node 0 --mycall NODE0 --peercall NODE1 --frequency 14050.0 --reset --rpc
target/release/pactor_consensus --port /dev/ttyUSB0 --node 1 --mycall NODE1 --peercall NODE0 --frequency 14050.0 --reset
```

Each node keeps its RocksDB state under `./data/` in its working directory, so give every node its own directory. Full guide: [Running consensus over PACTOR](crates/sim/RUNNING_PACTOR_CONSENSUS.md).

### Repo Overview

- `crates/core` (`bunker_coin_core`): accounts, transactions (transfers, tokens, staking), execution state, epochs
- `crates/bunkerglow`: Alpenglow consensus (Votor, Rotor, repair, BLS certificates, RocksDB storage), forked from the reference implementation
- `crates/radio`: radio networking: PACTOR framing, link mux, Reed-Solomon coding, simulated HF network
- `crates/scs_pactor`: SCS PACTOR modem driver (USB serial hostmode, TCP, simulator)
- `crates/rpc`: REST + WebSocket explorer API and Solana-style JSON-RPC for wallets
- `crates/sim`: the node binary (`pactor_consensus`), simulations and hardware probes
- `crates/vara`, `crates/lora_gateway`, `crates/gateway`: VARA TNC client, LoRa transaction ingest and a simulated relay, not yet wired into the node

### Apps

The web apps live in a bun workspace under `apps/`:

- `apps/explorer`: block explorer (Next.js)
- `apps/wallet`: local-only web wallet (Next.js static export)
- `apps/homepage`: the website at bunkercoin.com (Next.js on Cloudflare via OpenNext)
- `apps/app`: the web app (Next.js on Cloudflare via OpenNext)
- `packages/*`: shared UI components and ESLint/TypeScript configs for the website apps

```bash
bun install
bun run dev:explorer
bun run dev:wallet
bun run build
```


## Radio Networking

On air, nodes talk PACTOR between SCS DR-7400 modems over HF, with no internet. The modem arbitrates half-duplex turns, and the node paces writes to the on-air rate and rides out fades with link-liveness and repair.

The simulated network models HF (shortwave) conditions:
- **Global Bandwidth** >> 50-2400 bps (depending on conditions)
- **Packet Loss** >> 5-50% (ionospheric effects)
- **Latency** >> 100-1000ms (propagation) ++ jitter

Erasure coding: Rotor splits blocks into 4 data / 6 total shreds of 1 KiB; the radio layer adds Reed-Solomon (2 data + 4 parity).

## API

- [Explorer API Spec](docs/rpc_spec.md): REST + WebSocket on :3001
- [Wallet RPC](docs/WALLET_RPC.md): Solana-style JSON-RPC 2.0 and the native transaction format

## Next Steps

1. VARA and LoRa transports in the node
2. More than two validators on air
3. Remainders from the BunkerCoin spec\
... (many more)

>  **Core contributors welcomed!** If you'd like to help shape the protocol from the ground up, get in touch.


## References

- [Alpenglow](https://github.com/qkniep/alpenglow) (A true piece of art)
- BunkerCoin Whitepaper: `bunker_coin.tex`
- [BunkerCoin Whitepaper (PDF)](./bunker_coin.pdf)

## Building

Ensure you have a recent stable Rust toolchain installed.

```bash
rustup update stable
cargo check
```

The testnet is private and nothing is stabilised yet, expect rapid iteration.
