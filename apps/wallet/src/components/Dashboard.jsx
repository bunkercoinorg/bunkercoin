'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { BunkerConnection } from '@/lib/connection';
import { signTransfer, isValidAddress } from '@/lib/keys';
import { clearKeystore } from '@/lib/keystore';
import { formatUnits, parseBunker, shortAddress, elapsedLabel } from '@/lib/format';
import { loadPending, addPending, removePending } from '@/lib/pending';

const BALANCE_POLL_MS = 20_000;
const FAUCET_UNITS = 1_000_000; // 1 BUNKER per tap

export default function Dashboard({ keypair, onLock, onWalletRemoved }) {
  const conn = useRef(new BunkerConnection()).current;
  const [balance, setBalance] = useState(null);
  const [tokens, setTokens] = useState([]);
  const [pending, setPending] = useState([]);
  const [copied, setCopied] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [, tick] = useState(0);

  const refresh = useCallback(async () => {
    try {
      setBalance(await conn.getBalance(keypair.address));
      setTokens(await conn.getTokenBalances(keypair.address));
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

  // Resume confirmation polling for every pending tx (incl. after reload).
  useEffect(() => {
    const abort = new AbortController();
    for (const entry of loadPending()) {
      void trackConfirmation(entry, abort.signal);
    }
    return () => abort.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function trackConfirmation(entry, signal) {
    try {
      await conn.confirm(entry.txId, { signal });
      setPending(removePending(entry.txId));
      void refresh();
    } catch (e) {
      if (String(e.message).includes('cancelled')) return;
      setPending((prev) =>
        prev.map((p) => (p.txId === entry.txId ? { ...p, failed: String(e.message) } : p)),
      );
    }
  }

  const submitted = (entry) => {
    setPending(addPending(entry));
    void trackConfirmation(entry);
  };

  return (
    <>
      <div className="topbar">
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
              await navigator.clipboard.writeText(keypair.address);
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

      {pending.length > 0 && (
        <div className="card">
          <h2>Activity</h2>
          <p className="sub">
            Transactions finalize over the radio link — usually a few minutes. You can close this
            page; tracking resumes when you return.
          </p>
          {pending.map((p) => (
            <div className="pending-row" key={p.txId}>
              <span>
                {p.kind === 'faucet' ? 'Faucet' : `Send ${formatUnits(p.amount)} → ${shortAddress(p.to)}`}
                <span className="hint" style={{ marginLeft: 8 }}>
                  {elapsedLabel(p.at)}
                </span>
              </span>
              {p.failed ? (
                <span className="status failed" title={p.failed}>
                  failed
                  <button className="btn-ghost btn-small" style={{ marginLeft: 6 }} onClick={() => setPending(removePending(p.txId))}>
                    ✕
                  </button>
                </span>
              ) : (
                <span className="status processed">confirming…</span>
              )}
            </div>
          ))}
        </div>
      )}

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

function Faucet({ conn, address, onSubmitted }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const request = async () => {
    setBusy(true);
    setError('');
    try {
      const txId = await conn.requestAirdrop(address, FAUCET_UNITS);
      onSubmitted({ txId, kind: 'faucet', amount: FAUCET_UNITS, at: Date.now() });
    } catch (e) {
      setError(e.message);
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

function Send({ conn, keypair, balance, onSubmitted }) {
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [fee, setFee] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    conn.getFee().then(setFee).catch(() => {});
  }, [conn]);

  const submit = async () => {
    setError('');
    let units;
    try {
      units = parseBunker(amount);
    } catch (e) {
      setError(e.message);
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
      setError(e.message);
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
