'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { BunkerConnection, type ChainTransaction, type TokenBalance } from '@/lib/connection';
import { signTransfer, isValidAddress, addressToHex, hexToBase58, type Keypair } from '@/lib/keys';
import { clearKeystore, decryptMnemonic, loadKeystore } from '@/lib/keystore';
import { formatUnits, parseBunker, shortAddress, elapsedLabel } from '@/lib/format';
import { loadPending, addPending, removePending, type PendingTx } from '@/lib/pending';
import { copyText } from '@/lib/clipboard';

const BALANCE_POLL_MS = 20_000;
const FAUCET_UNITS = 1_000_000; // 1 BUNKER per tap

interface DashboardProps {
  keypair: Keypair;
  onLock: () => void;
  onWalletRemoved: () => void;
}

export default function Dashboard({ keypair, onLock, onWalletRemoved }: DashboardProps) {
  const conn = useRef(new BunkerConnection()).current;
  const [balance, setBalance] = useState<number | null>(null);
  const [tokens, setTokens] = useState<TokenBalance[]>([]);
  const [pending, setPending] = useState<PendingTx[]>([]);
  const [history, setHistory] = useState<ChainTransaction[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [slot, setSlot] = useState<number | null>(null);
  const [, tick] = useState(0);

  const refresh = useCallback(async () => {
    const meHex = addressToHex(keypair.address);
    try {
      setBalance(await conn.getBalance(keypair.address));
      setTokens(await conn.getTokenBalances(keypair.address));
      setSlot(await conn.getSlot());
      const txs = await conn.getTransactions(200, 0);
      setHistory(txs.filter((t) => t.sender === meHex || t.body?.to === meHex).slice(0, 10));
    } catch {
      // Keep the last known values through RPC blips.
    }
  }, [conn, keypair.address]);

  useEffect(() => {
    setPending(loadPending());
    void refresh();
    const balancePoll = setInterval(refresh, BALANCE_POLL_MS);
    const clock = setInterval(() => tick((n) => n + 1), 1000);
    return () => {
      clearInterval(balancePoll);
      clearInterval(clock);
    };
  }, [refresh]);

  const trackConfirmation = useCallback(
    async (entry: PendingTx, signal?: AbortSignal) => {
      try {
        await conn.confirm(entry.txId, { signal });
        setPending(removePending(entry.txId));
        void refresh();
      } catch (e) {
        if (String((e as Error).message).includes('cancelled')) return;
        setPending((prev) =>
          prev.map((p) => (p.txId === entry.txId ? { ...p, failed: String((e as Error).message) } : p)),
        );
      }
    },
    [conn, refresh],
  );

  // Resume confirmation polling for every pending tx (incl. after reload).
  useEffect(() => {
    const abort = new AbortController();
    for (const entry of loadPending()) {
      void trackConfirmation(entry, abort.signal);
    }
    return () => abort.abort();
  }, [trackConfirmation]);

  const submitted = (entry: PendingTx) => {
    setPending(addPending(entry));
    void trackConfirmation(entry);
  };

  return (
    <>
      <div className="topbar">
        <span className="telemetry">
          <span className="dot" />
          {slot === null ? 'linking…' : `slot ${slot}`}
        </span>
        <span className="spacer" />
        <button className="btn-ghost btn-small" onClick={onLock}>
          Lock
        </button>
      </div>

      <div className="card">
        <div className="balance">
          <span className="amount">{balance === null ? '—' : formatUnits(balance)}</span>
          <span className="unit">BUNKER</span>
        </div>
        <div className="address-line">
          <span title={keypair.address}>{shortAddress(keypair.address, 8)}</span>
          <button
            className="btn-ghost btn-small"
            onClick={async () => {
              await copyText(keypair.address);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        {tokens.length > 0 && (
          <>
            <hr className="divider" />
            {tokens.map((t, i) => (
              <div className="token-row" key={i}>
                <span>{t.ticker || `Token ${t.tokenId ?? t.token_id ?? i}`}</span>
                <span className="mono">{formatUnits(t.amount ?? t.balance ?? 0)}</span>
              </div>
            ))}
          </>
        )}
      </div>

      <Faucet conn={conn} address={keypair.address} onSubmitted={submitted} />
      <Send conn={conn} keypair={keypair} balance={balance} onSubmitted={submitted} />

      {(pending.length > 0 || history.length > 0) && (
        <div className="card">
          <h2>Activity</h2>
          <p className="sub">
            Transactions finalize over the radio link — usually a few minutes. You can close this
            page; tracking resumes when you return.
          </p>
          {pending.map((p) => (
            <div key={p.txId}>
              <div
                className="pending-row clickable"
                onClick={() => setExpanded(expanded === p.txId ? null : p.txId)}
              >
                <span>
                  {p.kind === 'faucet' ? 'Faucet' : `Send ${formatUnits(p.amount)} → ${shortAddress(p.to ?? '')}`}
                  <span className="hint" style={{ marginLeft: 8 }}>
                    {elapsedLabel(p.at)}
                  </span>
                </span>
                {p.failed ? (
                  <span className="status failed" title={p.failed}>
                    failed
                    <button
                      className="btn-ghost btn-small"
                      style={{ marginLeft: 6 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setPending(removePending(p.txId));
                      }}
                    >
                      ✕
                    </button>
                  </span>
                ) : (
                  <span className="status processed">confirming…</span>
                )}
              </div>
              {expanded === p.txId && (
                <TxDetails
                  rows={[
                    ['Transaction id', p.txId],
                    p.to ? ['To', p.to] : null,
                    ['Amount', `${formatUnits(p.amount)} BUNKER`],
                    ['Submitted', new Date(p.at).toLocaleString()],
                    p.failed ? ['Error', p.failed] : null,
                  ]}
                />
              )}
            </div>
          ))}
          {history.map((t) => {
            const outgoing = t.sender === addressToHex(keypair.address);
            const counterparty = hexToBase58(outgoing ? t.body?.to ?? t.sender : t.sender);
            const failed = t.status?.success === false;
            return (
              <div key={t.hash}>
                <div
                  className="pending-row clickable"
                  onClick={() => setExpanded(expanded === t.hash ? null : t.hash)}
                >
                  <span>
                    {outgoing ? '↑ Sent' : '↓ Received'} {formatUnits(t.body?.amount ?? 0)}
                    <span className="hint" style={{ marginLeft: 8 }}>
                      {outgoing ? 'to' : 'from'} {shortAddress(counterparty)} · slot {t.slot}
                    </span>
                  </span>
                  <span className={failed ? 'status failed' : 'status finalized'} title={t.status?.error || ''}>
                    {failed ? 'failed' : '✓ finalized'}
                  </span>
                </div>
                {expanded === t.hash && (
                  <TxDetails
                    rows={[
                      ['Type', t.body?.type ?? 'Transfer'],
                      ['Hash', t.hash],
                      ['From', hexToBase58(t.sender)],
                      t.body?.to ? ['To', hexToBase58(t.body.to)] : null,
                      ['Amount', `${formatUnits(t.body?.amount ?? 0)} BUNKER`],
                      ['Fee', `${formatUnits(t.fee ?? 0)} BUNKER`],
                      ['Nonce', String(t.nonce)],
                      ['Slot', String(t.slot)],
                      ['Block', t.block_hash],
                      t.status?.error ? ['Error', String(t.status.error)] : null,
                    ]}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      <RecoveryPhrase />

      <div className="card">
        <h2>Danger zone</h2>
        <p className="sub">
          Removing the wallet erases the encrypted keys from this device. Funds are only
          recoverable with the 24-word phrase.
        </p>
        {confirmRemove ? (
          <div className="row">
            <button className="btn-ghost" onClick={() => setConfirmRemove(false)}>
              Keep wallet
            </button>
            <button
              className="btn-danger"
              onClick={() => {
                clearKeystore();
                onWalletRemoved();
              }}
            >
              Erase from this device
            </button>
          </div>
        ) : (
          <button className="btn-danger btn-small" onClick={() => setConfirmRemove(true)}>
            Remove wallet…
          </button>
        )}
      </div>
    </>
  );
}

function TxDetails({ rows }: { rows: ([string, string] | null)[] }) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  // Long values (hashes, addresses) get a copy affordance; short ones don't need it.
  return (
    <div className="tx-details">
      {rows
        .filter((r): r is [string, string] => r !== null)
        .map(([label, value]) => (
          <div className="tx-detail-row" key={label}>
            <span className="tx-detail-label">{label}</span>
            <span
              className={value.length > 20 ? 'mono clickable' : 'mono'}
              title={value.length > 20 ? 'Click to copy' : undefined}
              onClick={
                value.length > 20
                  ? async () => {
                      await copyText(value);
                      setCopiedKey(label);
                      setTimeout(() => setCopiedKey(null), 1200);
                    }
                  : undefined
              }
            >
              {copiedKey === label ? 'Copied' : value.length > 28 ? shortAddress(value, 10) : value}
            </span>
          </div>
        ))}
    </div>
  );
}

function RecoveryPhrase() {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [phrase, setPhrase] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const hide = useCallback(() => {
    setPhrase('');
    setPassword('');
    setOpen(false);
    setError('');
  }, []);

  // The phrase must never sit on screen unattended.
  useEffect(() => {
    if (!phrase) return;
    const timer = setTimeout(() => hide(), 60_000);
    return () => clearTimeout(timer);
  }, [phrase, hide]);

  const reveal = async () => {
    setBusy(true);
    setError('');
    try {
      setPhrase(await decryptMnemonic(loadKeystore(), password));
      setPassword('');
    } catch (e) {
      const msg = (e as Error).message;
      setError(msg === 'Incorrect password' ? 'Incorrect password.' : msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card">
      <h2>Recovery phrase</h2>
      {!open && !phrase && (
        <>
          <p className="sub">View or copy the 24 words this wallet was created with.</p>
          <button className="btn-ghost btn-small" onClick={() => setOpen(true)}>
            Show recovery phrase…
          </button>
        </>
      )}
      {open && !phrase && (
        <>
          <p className="sub">Enter your password to decrypt the phrase.</p>
          <input
            type="password"
            value={password}
            autoFocus
            disabled={busy}
            onChange={(e) => {
              setPassword(e.target.value);
              setError('');
            }}
            onKeyDown={(e) => e.key === 'Enter' && password && !busy && reveal()}
          />
          {error && <p className="error">{error}</p>}
          {busy && (
            <div className="progress">
              <span className="spinner" />
              Decrypting — intentionally takes a few seconds…
            </div>
          )}
          <hr className="divider" />
          <div className="row">
            <button className="btn-ghost" disabled={busy} onClick={hide}>
              Cancel
            </button>
            <button className="btn-primary" disabled={busy || !password} onClick={reveal}>
              Reveal
            </button>
          </div>
        </>
      )}
      {phrase && (
        <>
          <div className="warn">
            Anyone with these words controls your funds. Hide them as soon as you are done — they
            disappear automatically after a minute.
          </div>
          <div className="words">
            {phrase.split(' ').map((w, i) => (
              <span className="word" key={i}>
                <i>{i + 1}</i>
                {w}
              </span>
            ))}
          </div>
          <div className="row">
            <button
              className="btn-ghost"
              onClick={async () => {
                await copyText(phrase);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
            <button className="btn-primary" onClick={hide}>
              Hide
            </button>
          </div>
        </>
      )}
    </div>
  );
}

interface FaucetProps {
  conn: BunkerConnection;
  address: string;
  onSubmitted: (entry: PendingTx) => void;
}

function Faucet({ conn, address, onSubmitted }: FaucetProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const request = async () => {
    setBusy(true);
    setError('');
    try {
      const txId = await conn.requestAirdrop(address, FAUCET_UNITS);
      onSubmitted({ txId, kind: 'faucet', amount: FAUCET_UNITS, at: Date.now() });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="card">
      <h2>Faucet</h2>
      <p className="sub">Testnet tokens, free. 1 BUNKER per request.</p>
      <button className="btn-ghost" disabled={busy} onClick={request}>
        {busy ? 'Requesting…' : 'Request 1 BUNKER'}
      </button>
      {error && <p className="error">{error}</p>}
    </div>
  );
}

interface SendProps {
  conn: BunkerConnection;
  keypair: Keypair;
  balance: number | null;
  onSubmitted: (entry: PendingTx) => void;
}

function Send({ conn, keypair, balance, onSubmitted }: SendProps) {
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [fee, setFee] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    conn.getFee().then(setFee).catch(() => {});
  }, [conn]);

  const submit = async () => {
    setError('');
    let units: number;
    try {
      units = parseBunker(amount);
    } catch (e) {
      setError((e as Error).message);
      return;
    }
    if (!isValidAddress(to)) {
      setError('That is not a valid BunkerCoin address.');
      return;
    }
    if (to.trim() === keypair.address) {
      setError('That is your own address.');
      return;
    }
    const currentFee = fee ?? 100;
    if (balance !== null && units + currentFee > balance) {
      setError(`Insufficient balance (fee is ${formatUnits(currentFee)} BUNKER).`);
      return;
    }
    setBusy(true);
    try {
      // Nonce is fetched at send time: it must match the account's current value.
      const nonce = await conn.getNonce(keypair.address);
      const tx = signTransfer({
        privateKey: keypair.privateKey,
        publicKey: keypair.publicKey,
        to: to.trim(),
        amount: units,
        nonce,
        fee: currentFee,
      });
      const txId = await conn.sendTransaction(tx);
      onSubmitted({ txId, kind: 'send', to: to.trim(), amount: units, at: Date.now() });
      setTo('');
      setAmount('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card">
      <h2>Send</h2>
      <label>Recipient address</label>
      <input
        value={to}
        placeholder="base58 address"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        onChange={(e) => {
          setTo(e.target.value);
          setError('');
        }}
      />
      <label>Amount (BUNKER)</label>
      <input
        value={amount}
        placeholder="0.25"
        inputMode="decimal"
        onChange={(e) => {
          setAmount(e.target.value);
          setError('');
        }}
      />
      {fee !== null && <p className="hint">Network fee: {formatUnits(fee)} BUNKER</p>}
      {error && <p className="error">{error}</p>}
      <hr className="divider" />
      <button className="btn-primary" disabled={busy || !to || !amount} onClick={submit}>
        {busy ? 'Signing & sending…' : 'Send'}
      </button>
    </div>
  );
}
