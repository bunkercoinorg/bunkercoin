import { spawn, type ChildProcess } from 'node:child_process';
import { createWriteStream, existsSync, mkdirSync } from 'node:fs';
import { mkdtemp, rename, rm } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Rpc } from './rpc';
import { serveStatic } from './static-server';

const E2E_DIR = path.resolve(import.meta.dirname, '..');
const ROOT = path.resolve(E2E_DIR, '..');
const WALLET_DIR = path.join(ROOT, 'apps/wallet');
// The export (baked with the local RPC URL) moves out of out/ into node_modules so it is never mistaken for a deployable build.
const WALLET_BUILD_DIR = 'node_modules/.cache/e2e-wallet';
const LOG_DIR = path.join(E2E_DIR, 'logs');
const READY_TIMEOUT_MS = 5 * 60_000;

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.once('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address() as { port: number };
      srv.close(() => resolve(port));
    });
  });
}

function run(cmd: string, args: string[], opts: { cwd: string; env?: NodeJS.ProcessEnv; log: string }) {
  return new Promise<void>((resolve, reject) => {
    const out = createWriteStream(path.join(LOG_DIR, opts.log));
    const child = spawn(cmd, args, { cwd: opts.cwd, env: { ...process.env, ...opts.env } });
    child.stdout.pipe(out);
    child.stderr.pipe(out);
    child.once('error', reject);
    child.once('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`${cmd} ${args.join(' ')} exited ${code}; see logs/${opts.log}`)),
    );
  });
}

/** macOS: bindgen (rocksdb) finds libclang only in the Command Line Tools. */
function cargoEnv(): NodeJS.ProcessEnv {
  const clt = '/Library/Developer/CommandLineTools/usr/lib';
  if (process.platform !== 'darwin' || process.env.LIBCLANG_PATH || !existsSync(`${clt}/libclang.dylib`)) return {};
  return { LIBCLANG_PATH: clt, DYLD_FALLBACK_LIBRARY_PATH: clt };
}

async function buildNode(): Promise<string> {
  if (process.env.E2E_NODE_BIN) return process.env.E2E_NODE_BIN;
  const targetDir = process.env.CARGO_TARGET_DIR || path.join(ROOT, 'target');
  await run('cargo', ['build', '--release', '-p', 'bunker_coin_sim', '--bin', 'pactor_consensus'], {
    cwd: ROOT,
    env: { CARGO_TARGET_DIR: targetDir, ...cargoEnv() },
    log: 'cargo-build.log',
  });
  return path.join(targetDir, 'release/pactor_consensus');
}

async function buildWallet(rpcUrl: string): Promise<void> {
  await run('bun', ['x', 'next', 'build'], {
    cwd: WALLET_DIR,
    env: { NEXT_PUBLIC_RPC_URL: rpcUrl, NEXT_TELEMETRY_DISABLED: '1' },
    log: 'wallet-build.log',
  });
  const target = path.join(WALLET_DIR, WALLET_BUILD_DIR);
  await rm(target, { recursive: true, force: true });
  mkdirSync(path.dirname(target), { recursive: true });
  await rename(path.join(WALLET_DIR, 'out'), target);
}

async function waitForChain(rpc: Rpc, node: ChildProcess): Promise<void> {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (node.exitCode !== null) throw new Error(`node exited ${node.exitCode}; see logs/node.log`);
    // A finalized slot, not just a bound socket: airdrops only land once consensus is moving.
    const slot = await rpc.getSlot().catch(() => 0);
    if (slot > 0) return;
    await new Promise((r) => setTimeout(r, 1_000));
  }
  throw new Error(`node did not finalize a slot within ${READY_TIMEOUT_MS}ms; see logs/node.log`);
}

function stopNode(node: ChildProcess): Promise<void> {
  if (node.exitCode !== null) return Promise.resolve();
  return new Promise((resolve) => {
    const kill = setTimeout(() => node.kill('SIGKILL'), 20_000);
    node.once('exit', () => {
      clearTimeout(kill);
      resolve();
    });
    node.kill('SIGINT');
  });
}

export default async function globalSetup() {
  mkdirSync(LOG_DIR, { recursive: true });
  const [rpcPort, walletPort] = await Promise.all([freePort(), freePort()]);
  const rpcUrl = `http://127.0.0.1:${rpcPort}/`;
  // localhost (not 127.0.0.1): the node's CORS allowlist only admits http://localhost* origins.
  const walletUrl = `http://localhost:${walletPort}`;

  const [nodeBin] = await Promise.all([buildNode(), buildWallet(rpcUrl)]);

  const workDir = await mkdtemp(path.join(tmpdir(), 'bunker-e2e-node-'));
  const node = spawn(nodeBin, ['--simulated', '--half-duplex', '--rpc'], {
    cwd: workDir,
    env: { ...process.env, BUNKER_RPC_ADDR: `127.0.0.1:${rpcPort}`, RUST_LOG: process.env.RUST_LOG ?? 'info' },
  });
  const nodeLog = createWriteStream(path.join(LOG_DIR, 'node.log'));
  node.stdout!.pipe(nodeLog);
  node.stderr!.pipe(nodeLog);

  let server: Server | undefined;
  const teardown = async () => {
    await new Promise((r) => (server ? server.close(r) : r(undefined)));
    await stopNode(node);
    if (!process.env.E2E_KEEP_NODE_DIR) await rm(workDir, { recursive: true, force: true });
  };

  try {
    await waitForChain(new Rpc(rpcUrl), node);
    server = await serveStatic(path.join(WALLET_DIR, WALLET_BUILD_DIR), walletPort);
  } catch (e) {
    await teardown();
    throw e;
  }

  process.env.E2E_RPC_URL = rpcUrl;
  process.env.E2E_WALLET_URL = walletUrl;
  return teardown;
}
