'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Actions, Button, CopyValue, Field, FlowBar, Icon, List, ListRow, Notice, TextInput } from '@bunkercoin/ui';
import { shortId } from '@bunkercoin/chain-format';
import { isValidAddress, sameAddress, signTokenTransfer, signTransfer, tokenIdBytes } from '@/lib/keys';
import { amountProblem, heldOf, NATIVE_SEND, pickAsset, sendProblem, TOKEN_GONE, tokenIdentity, type SendAsset } from '@/lib/send';
import type { Signer } from '@/lib/signer';
import { approvalKey, duplicatePrompt, findDuplicate, type SendIntent } from '@/lib/inflight';
import { useReview } from '@/hooks/useReview';
import { focusField, useFlowFocus } from '@/hooks/useFlowFocus';
import { activityItems, tickerMap } from '@/components/activity-model';
import { bunker, count, NATIVE, NativeMark, TokenMark } from '@/components/assets';
import Receipt from '@/components/Receipt';
import Outcome, { Rejected, type Broadcast } from '@/components/Outcome';
import type { WalletActions, WalletState } from '@/components/Dashboard';

type Step = 'to' | 'amount' | 'review' | 'done';

/** The node refused its own quote: `fee 250000 is above the wallet cap of …`. */
const quotedFee = (error: string) => /fee (\d+) is above/.exec(error)?.[1] ?? null;

export default function Send({
  state,
  actions,
  signer,
  preset,
}: {
  state: WalletState;
  actions: WalletActions;
  signer: Signer;
  preset: string | null;
}) {
  // Everything below validates against what is spendable now: in-flight sends and their fees are already spoken for.
  const { fee, feeError } = state;
  const balance = state.spendable.available;
  const tokens = state.spendableTokens;
  const [step, setStep] = useState<Step>('to');
  const [picked, setPicked] = useState<SendAsset | null>(preset === null ? NATIVE_SEND : null);
  const [assetError, setAssetError] = useState('');
  const [picking, setPicking] = useState(false);
  const [to, setTo] = useState('');
  const [toError, setToError] = useState('');
  const [amount, setAmount] = useState('');
  const [amountError, setAmountError] = useState('');
  const [units, setUnits] = useState(0n);
  const [busy, setBusy] = useState(false);
  const [signError, setSignError] = useState('');
  const [sent, setSent] = useState<Broadcast | null>(null);
  const [rejected, setRejected] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  // Bound to the exact intent and the in-flight tx it matched; any edit or step change drops it.
  const [approved, setApproved] = useState<string | null>(null);
  const review = useReview(state, actions, fee);
  const root = useFlowFocus<HTMLDivElement>(step);
  const wrap = (node: ReactNode) => (
    <div ref={root} className="contents">
      {node}
    </div>
  );

  // Until the first step is left a preset can still resolve as tokens load; from then on the asset is frozen.
  const asset = picked ?? (preset === null ? null : pickAsset(tokens, preset));
  const recipient = to.trim();
  useEffect(() => {
    setApproved(null);
    setAsking(false);
  }, [step, recipient, units, amount, picked]);
  const known = activityItems(state.pending, state.history, state.addressHex, tickerMap(tokens, state.registry)).some(
    (i) => i.counterparty?.label === 'to' && sameAddress(i.counterparty.address, recipient),
  );
  const back = () => actions.go('#home');

  const recipientProblem = () => {
    if (!isValidAddress(recipient)) return 'Not a BunkerCoin address.';
    if (sameAddress(recipient, state.address)) return "That's this wallet.";
    return '';
  };

  if (step !== 'to' && picked) return wrap(flow(picked));
  return wrap(pick());

  function flow(asset: SendAsset) {
    const fmt = (u: bigint) => (asset.kind === 'token' ? count(u) : bunker(u));
    const unit = asset.unit;
    const live = heldOf(asset, balance, tokens);
    const held = live === 'gone' ? null : live;

    if (step === 'done' && rejected !== null) {
      return (
        <Rejected
          reason={rejected}
          onRetry={() => {
            setRejected(null);
            setStep('amount');
          }}
        />
      );
  }

  if (step === 'done' && sent) {
    const what = `${fmt(units)} ${unit}`;
    return (
      <Outcome
        sent={sent}
        state={state}
        actions={actions}
        onRetry={() => setStep('amount')}
        copy={{ sending: `Sending ${what}.`, sent: 'Sent.', done: 'Sent.', lead: `${what} to ${shortId(recipient)}`, line: `to ${shortId(recipient)}` }}
      />
    );
  }

  if (step === 'review' && review.reviewed) {
    const f = review.reviewed.fee;
    const blocked = sendProblem(asset, units, f, balance, tokens);
    const intent: SendIntent =
      asset.kind === 'token' ? { kind: 'token-send', to: recipient, amount: units, tokenId: asset.tokenId } : { kind: 'send', to: recipient, amount: units };
    const dup = findDuplicate(state.pending, intent);
    const key = dup ? approvalKey(intent, dup.txId) : null;
    const sign = async (again = key !== null && approved === key) => {
      if (blocked) return;
      if (dup && !again) return setAsking(true);
      setAsking(false);
      setBusy(true);
      setSignError('');
      const result = await review.sign(
        (nonce, signedFee) =>
          signer.use((privateKey, publicKey) =>
            asset.kind === 'token'
              ? signTokenTransfer({ privateKey, publicKey, to: recipient, tokenId: tokenIdBytes(asset.tokenId), amount: units, nonce, fee: signedFee })
              : signTransfer({ privateKey, publicKey, to: recipient, amount: units, nonce, fee: signedFee }),
          ),
        asset.kind === 'token'
          ? { kind: 'token-send', to: recipient, amount: units, ticker: asset.unit, tokenId: asset.tokenId }
          : { kind: 'send', to: recipient, amount: units },
        dup && again ? dup.txId : null,
      );
      setBusy(false);
      if (result.kind === 'broadcast') {
        setSent(result.sent);
        setStep('done');
      } else if (result.kind === 'rejected') {
        setRejected(result.reason);
        setStep('done');
      } else setSignError(result.message);
    };
    return (
      <div className="wl-stack wl-gap24">
        <FlowBar title="send" step={[3, 3]} onBack={() => setStep('amount')} />
        <h1 className="bc-sr">Review before signing.</h1>
        {asking && dup && (
          <Notice
            tone="warn"
            role="alert"
            action={
              <Actions>
                <Button
                  size="sm"
                  onClick={() => {
                    setApproved(key);
                    void sign(true);
                  }}
                >
                  send again
                </Button>
                <Button size="sm" variant="ghost" onClick={back}>
                  cancel
                </Button>
              </Actions>
            }
          >
            {duplicatePrompt(`${fmt(units)} ${unit}`, recipient, dup.at, Date.now())}
          </Notice>
        )}
        <Receipt
          rows={[
            { label: 'to', value: <CopyValue value={recipient} mode="full" label="recipient" /> },
            ...(asset.kind === 'token' ? [{ label: 'token', value: asset.unit }] : []),
            { label: 'amount', value: `${fmt(units)} ${unit}` },
          ]}
          fee={review.reviewed}
          total={asset.kind === 'token' ? undefined : units + f}
          plan={review.plan}
          planError={review.planError}
          footLabel="from"
          address={state.address}
          busy={busy}
          error={signError || blocked}
          signLabel="sign and send"
          busyLabel="signing…"
          onEdit={() => setStep('amount')}
          onSign={() => void (blocked ? undefined : sign())}
          onCheck={(id) => {
            actions.resend(id);
            setTimeout(review.loadPlan, 1500);
          }}
          onRetryPlan={review.loadPlan}
        />
      </div>
    );
  }

  if (step === 'amount') {
    const quoted = fee === null && feeError ? quotedFee(feeError) : null;
    const max = held === null ? null : asset.kind === 'native' ? (fee === null ? null : held - fee) : held;
    const shownError = amountError || (live === 'gone' ? TOKEN_GONE : '');
    const line = shownError ? (
      <p id="send-amount-line" className="bc-err text-center" role="alert">
        {shownError}
      </p>
    ) : quoted ? (
      <p id="send-amount-line" className="bc-err text-center" role="alert">
        The node quoted {bunker(BigInt(quoted))} BUNKER. Review stopped.
      </p>
    ) : fee === null ? (
      <p id="send-amount-line" className="bc-hint mono text-center">
        Fee unavailable ·{' '}
        <Button variant="quiet" size="sm" onClick={actions.refreshFee}>
          retry
        </Button>
      </p>
    ) : (
      <p id="send-amount-line" className="bc-hint mono text-center">
        available {held === null ? '–' : fmt(held)} · fee {bunker(fee)}
      </p>
    );
    const next = () => {
      if (fee === null) return;
      const [problem, value] = amountProblem(asset, amount, fee, balance, tokens);
      setAmountError(problem);
      if (problem) return focusField('send-amount');
      setUnits(value);
      setSignError('');
      if (review.open()) setStep('review');
    };
    return (
      <div className="wl-stack wl-gap24">
        <FlowBar title="send" step={[2, 3]} onBack={() => setStep('to')} />
        <h1 className="bc-sr">Amount.</h1>
        <div className="wl-bi">
          <label htmlFor="send-amount" className="bc-hint mono">
            amount
          </label>
          <div className="wl-bi-row">
            <input
              id="send-amount"
              data-step-focus
              aria-describedby="send-amount-line"
              aria-invalid={shownError ? true : undefined}
              inputMode={asset.kind === 'native' ? 'decimal' : 'numeric'}
              autoComplete="off"
              placeholder="0"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setAmountError('');
              }}
              onKeyDown={(e) => e.key === 'Enter' && next()}
            />
            <span className="wl-u">{unit}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            disabled={max === null || max <= 0n}
            onClick={() => {
              if (max === null || max <= 0n) return;
              setAmount(asset.kind === 'token' ? max.toString() : bunker(max).replace(/,/g, ''));
              setAmountError('');
            }}
          >
            max
          </Button>
        </div>
        {line}
        <Button block onClick={next} disabled={fee === null || amount.trim() === '' || live === 'gone'}>
          review
        </Button>
      </div>
    );
  }
  return null;
  }

  function pick() {
    const assets = [
      { id: null as string | null, mark: <NativeMark />, title: NATIVE, held: balance === null ? '–' : bunker(balance) },
      ...tokens.map((t) => ({
        id: t.tokenId as string | null,
        mark: <TokenMark ticker={t.ticker} tokenId={t.tokenId} metadataHash={t.metadataHash} />,
        title: tokenIdentity(t),
        held: count(t.balance),
      })),
    ];
    const currentId = asset ? (asset.kind === 'token' ? asset.tokenId : null) : preset;
    const current = assets.find((a) => a.id === currentId) ?? {
      id: currentId,
      mark: <>{currentId?.slice(0, 2)}</>,
      title: `token ${currentId}`,
      held: '–',
    };
    const goAmount = () => {
      if (!asset) {
        setAssetError(state.fresh.tokens.okAt === null ? 'Token balances are still loading.' : TOKEN_GONE);
        return focusField('send-asset');
      }
      const problem = recipientProblem();
      setToError(problem);
      if (problem) return focusField('send-to');
      setPicked(asset);
      setStep('amount');
    };
    return (
      <div className="wl-stack wl-gap24">
        <FlowBar title="send" step={[1, 3]} onBack={back} />
        <h1 className="bc-sr">Send.</h1>
        <div className="bc-f">
          <div className="bc-f-h">
            <label htmlFor="send-asset">asset</label>
          </div>
          <div>
            <button
              id="send-asset"
              type="button"
              className="wl-pick"
              aria-expanded={picking}
              aria-controls="send-assets"
              onClick={() => setPicking((p) => !p)}
            >
              <span className="bc-tm" aria-hidden="true">
                {current.mark}
              </span>
              <span className="bc-grow">
                <b className="font-[560]">{current.title}</b> <span className="bc-hint mono">{current.held}</span>
              </span>
              <Icon name="chev" />
            </button>
            {picking && (
              <div className="wl-pick-list" id="send-assets">
                <List label="assets">
                  {assets.map((a) => (
                    <ListRow
                      key={a.id ?? 'native'}
                      mark={a.mark}
                      title={a.title}
                      value={a.held}
                      onClick={() => {
                        setPicked(pickAsset(tokens, a.id));
                        setAssetError('');
                        setAmount('');
                        setAmountError('');
                        setPicking(false);
                      }}
                    />
                  ))}
                </List>
              </div>
            )}
          </div>
          {assetError && (
            <p className="bc-err" role="alert">
              {assetError}
            </p>
          )}
        </div>
        <Field
          id="send-to"
          label="to"
          error={toError}
          hint={!toError && isValidAddress(recipient) && !sameAddress(recipient, state.address) && !known ? 'First send to this address.' : undefined}
          action={
            <Button
              variant="ghost"
              iconOnly
              aria-label="paste"
              onClick={() =>
                void navigator.clipboard?.readText().then(
                  (t) => {
                    setTo(t.trim());
                    setToError('');
                  },
                  () => undefined,
                )
              }
            >
              <Icon name="paste" />
            </Button>
          }
        >
          <TextInput
            mono
            data-step-focus
            value={to}
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => {
              setTo(e.target.value);
              setToError('');
            }}
            onKeyDown={(e) => e.key === 'Enter' && goAmount()}
          />
        </Field>
        <Button block onClick={goAmount} disabled={recipient === ''}>
          next
        </Button>
      </div>
    );
  }
}
