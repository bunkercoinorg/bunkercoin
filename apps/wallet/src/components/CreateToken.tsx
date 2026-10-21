'use client';

import { useState } from 'react';
import { Button, CopyValue, Disclosure, Field, FlowBar, Notice, TextInput } from '@bunkercoin/ui';
import { AmountError, parseUnits } from '@bunkercoin/chain-format';
import { isValidTicker, signMint } from '@/lib/keys';
import { METADATA_ENABLED, metadataHashBytes } from '@/lib/metadata';
import type { Signer } from '@/lib/signer';
import { useReview } from '@/hooks/useReview';
import { bunker, count, NATIVE } from '@/components/assets';
import { draftIsEmpty, emptyDraft, localHash, MetadataFields, publishDraft, type MetadataDraft } from '@/components/MetadataForm';
import Receipt from '@/components/Receipt';
import Outcome, { Rejected, type Broadcast } from '@/components/Outcome';
import type { WalletActions, WalletState } from '@/components/Dashboard';

type Step = 'form' | 'review' | 'done';

/** Live symbol line: availability is a snapshot, never a reservation. */
function symbolStatus(symbol: string, taken: Set<string> | null): { hint?: string; error?: string } {
  if (symbol === '') return {};
  if (symbol === NATIVE) return { error: 'BUNKER is the native coin.' };
  if (!isValidTicker(symbol)) return { error: 'Use 3 to 8 letters or digits.' };
  if (taken === null) return { hint: 'checking availability…' };
  return taken.has(symbol) ? { error: `${symbol} is taken.` } : { hint: 'Available now · not reserved' };
}

export default function CreateToken({ state, actions, signer }: { state: WalletState; actions: WalletActions; signer: Signer }) {
  const [step, setStep] = useState<Step>('form');
  const [symbol, setSymbol] = useState('');
  const [supply, setSupply] = useState('');
  const [supplyError, setSupplyError] = useState('');
  const [draft, setDraft] = useState<MetadataDraft>(emptyDraft);
  const [total, setTotal] = useState(0n);
  const [hash, setHash] = useState('');
  const [uploaded, setUploaded] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [formError, setFormError] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [busy, setBusy] = useState(false);
  const [signError, setSignError] = useState('');
  const [sent, setSent] = useState<Broadcast | null>(null);
  const [rejected, setRejected] = useState<string | null>(null);
  const review = useReview(state, actions, state.fee);

  const taken = state.registry ? new Set(state.registry.map((t) => t.ticker)) : null;
  const status = symbolStatus(symbol, taken);

  const toReview = async (withMetadata: boolean) => {
    setFormError('');
    setUploadError('');
    let value: bigint;
    try {
      value = parseUnits(supply.trim(), 0);
    } catch (e) {
      setSupplyError(e instanceof AmountError ? e.message : 'Tokens use whole units.');
      return;
    }
    if (status.error || !isValidTicker(symbol)) {
      setFormError(status.error ?? 'Use 3 to 8 letters or digits.');
      return;
    }
    if (state.fee === null) {
      setFormError(state.feeError ? `Fee unavailable: ${state.feeError}` : 'Fee unavailable · retry');
      return;
    }
    if (state.balance !== null && state.balance < state.fee) {
      setFormError(`Not enough BUNKER for the ${bunker(state.fee)} fee.`);
      return;
    }
    if (draft.icon && draft.name.trim() === '') {
      setFormError('Add a name to publish an icon.');
      return;
    }
    setPreparing(true);
    try {
      // Tickers are unique chain-wide and first-come; check again right before paying a fee.
      if ((await state.conn.getTokens()).some((t) => t.ticker === symbol)) {
        setFormError(`${symbol} is taken.`);
        return;
      }
      let h: string;
      if (!METADATA_ENABLED || draftIsEmpty(draft) || !withMetadata) {
        h = await localHash(draft, symbol);
        setUploaded(false);
      } else {
        try {
          h = await publishDraft(draft);
          setUploaded(true);
        } catch (e) {
          setUploadError((e as Error).message);
          return;
        }
      }
      setHash(h);
      setTotal(value);
      setSignError('');
      if (review.open()) setStep('review');
    } catch (e) {
      setFormError((e as Error).message);
    } finally {
      setPreparing(false);
    }
  };

  if (step === 'done' && rejected !== null) {
    return <Rejected title="Not created." reason={rejected} onRetry={() => (setRejected(null), setStep('form'))} />;
  }
  if (step === 'done' && sent) {
    return (
      <Outcome
        kind="Create"
        sent={sent}
        state={state}
        actions={actions}
        onRetry={() => setStep('form')}
        copy={{
          sending: `Creating ${symbol}.`,
          done: 'Created.',
          lead: `${count(total)} ${symbol} to this wallet`,
          line: `supply ${count(total)}`,
        }}
      />
    );
  }

  if (step === 'review' && review.reviewed) {
    const f = review.reviewed.fee;
    const short = state.balance !== null && state.balance < f;
    const sign = async () => {
      setBusy(true);
      setSignError('');
      const bytes = metadataHashBytes(hash);
      const result = await review.sign(
        (nonce, signedFee) =>
          signer.use((privateKey, publicKey) =>
            signMint({ privateKey, publicKey, ticker: symbol, maxSupply: total, metadataHash: bytes, nonce, fee: signedFee }),
          ),
        { kind: 'mint', amount: total, ticker: symbol },
      );
      setBusy(false);
      if (result.kind === 'broadcast') {
        if (uploaded) actions.promoteOnFinal(result.sent.txId, hash);
        setSent(result.sent);
        setStep('done');
      } else if (result.kind === 'rejected') {
        setRejected(result.reason);
        setStep('done');
      } else setSignError(result.message);
    };
    return (
      <div className="wl-stack wl-gap24">
        <FlowBar title="create token" step={[2, 2]} onBack={() => setStep('form')} />
        <h1 className="bc-sr">Review before signing.</h1>
        <Receipt
          rows={[
            { label: 'symbol', value: symbol },
            { label: 'supply', value: count(total) },
            { label: 'metadata', value: <CopyValue value={hash} label="metadata hash" /> },
          ]}
          fee={review.reviewed}
          plan={review.plan}
          planError={review.planError}
          footLabel="creator"
          address={state.address}
          busy={busy}
          error={signError || (short ? `Not enough BUNKER for the ${bunker(f)} fee.` : '')}
          signLabel="sign and create"
          busyLabel="signing…"
          onEdit={() => setStep('form')}
          onSign={() => void (short ? undefined : sign())}
          onCheck={(id) => {
            actions.resend(id);
            setTimeout(review.loadPlan, 1500);
          }}
          onRetryPlan={review.loadPlan}
        />
      </div>
    );
  }

  return (
    <div className="wl-stack wl-gap24">
      <FlowBar title="create token" step={[1, 2]} onBack={() => actions.go('#home')} />
      <h1 className="bc-sr">Create token.</h1>
      <Field id="token-symbol" label="symbol" hint={status.hint && <span className="mono">{status.hint}</span>} error={status.error} announce={false}>
        <TextInput
          mono
          value={symbol}
          maxLength={8}
          autoCapitalize="characters"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          disabled={preparing}
          onChange={(e) => {
            setSymbol(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''));
            setFormError('');
          }}
        />
      </Field>
      <Field id="token-supply" label="supply" hint="Whole units. You receive the full supply." error={supplyError}>
        <TextInput
          mono
          inputMode="numeric"
          autoComplete="off"
          value={supply}
          disabled={preparing}
          onChange={(e) => {
            setSupply(e.target.value);
            setSupplyError('');
          }}
        />
      </Field>
      <Disclosure summary="metadata · optional">
        <MetadataFields draft={draft} onChange={setDraft} idPrefix="token-meta" disabled={preparing} />
      </Disclosure>
      {formError && (
        <p className="bc-err" role="alert">
          {formError}
        </p>
      )}
      {uploadError && (
        <Notice
          tone="error"
          role="alert"
          action={
            <Button variant="ghost" size="sm" onClick={() => void toReview(false)}>
              create without metadata
            </Button>
          }
        >
          {uploadError}
        </Notice>
      )}
      <Button block busy={preparing} onClick={() => void toReview(true)} disabled={symbol === '' || supply.trim() === ''}>
        {preparing ? (!METADATA_ENABLED || draftIsEmpty(draft) ? 'checking…' : 'uploading…') : 'review'}
      </Button>
    </div>
  );
}
