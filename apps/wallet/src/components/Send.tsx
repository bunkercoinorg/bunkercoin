'use client';

import { useState } from 'react';
import { Button, CopyValue, Field, FlowBar, Icon, List, ListRow, TextInput } from '@bunkercoin/ui';
import { AmountError, parseUnits, shortId } from '@bunkercoin/chain-format';
import { isValidAddress, signTokenTransfer, signTransfer, tokenIdBytes } from '@/lib/keys';
import type { Signer } from '@/lib/signer';
import { useReview } from '@/hooks/useReview';
import { activityItems, tickerMap } from '@/components/activity-model';
import { bunker, count, NATIVE, NativeMark, TokenMark, tokenIdentity, tokenName } from '@/components/assets';
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
  const { balance, tokens, fee, feeError } = state;
  const [step, setStep] = useState<Step>('to');
  const [tokenId, setTokenId] = useState<string | null>(preset);
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
  const review = useReview(state, actions, fee);

  const token = tokenId === null ? null : (tokens.find((t) => t.tokenId === tokenId) ?? null);
  const scale = tokenId === null ? 6 : 0;
  const held = tokenId === null ? balance : (token?.balance ?? null);
  const unit = token ? tokenName(token) : NATIVE;
  const recipient = to.trim();
  const known = activityItems(state.pending, state.history, state.addressHex, tickerMap(tokens, state.registry)).some(
    (i) => i.counterparty?.label === 'to' && i.counterparty.address === recipient,
  );
  const back = () => actions.go('#home');

  const recipientProblem = () => {
    if (!isValidAddress(recipient)) return 'Not a BunkerCoin address.';
    if (recipient === state.address) return "That's this wallet.";
    return '';
  };

  const amountProblem = (text: string, f: bigint): [string, bigint] => {
    let value: bigint;
    try {
      value = parseUnits(text.trim(), scale);
    } catch (e) {
      return [e instanceof AmountError ? e.message : 'Enter an amount above 0.', 0n];
    }
    if (tokenId !== null && !token) return ['That token is no longer in this wallet.', value];
    if (held !== null && value > held) return ['Amount exceeds balance.', value];
    if (tokenId === null && balance !== null && value + f > balance) return [`Not enough BUNKER for the ${bunker(f)} fee.`, value];
    if (tokenId !== null && balance !== null && balance < f) {
      return [`Token sends pay the fee in BUNKER. You hold ${bunker(balance)}.`, value];
    }
    return ['', value];
  };

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
    const what = `${token ? count(units) : bunker(units)} ${unit}`;
    return (
      <Outcome
        sent={sent}
        state={state}
        actions={actions}
        onRetry={() => setStep('amount')}
        copy={{ sending: `Sending ${what}.`, done: 'Sent.', lead: `${what} to ${shortId(recipient)}`, line: `to ${shortId(recipient)}` }}
      />
    );
  }

  if (step === 'review' && review.reviewed) {
    const f = review.reviewed.fee;
    const short = tokenId === null ? balance !== null && units + f > balance : balance !== null && balance < f;
    const sign = async () => {
      setBusy(true);
      setSignError('');
      const result = await review.sign(
        (nonce, signedFee) =>
          signer.use((privateKey, publicKey) =>
            token
              ? signTokenTransfer({ privateKey, publicKey, to: recipient, tokenId: tokenIdBytes(token.tokenId), amount: units, nonce, fee: signedFee })
              : signTransfer({ privateKey, publicKey, to: recipient, amount: units, nonce, fee: signedFee }),
          ),
        { kind: token ? 'token-send' : 'send', to: recipient, amount: units, ticker: token ? tokenName(token) : undefined },
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
        <Receipt
          rows={[
            { label: 'to', value: <CopyValue value={recipient} mode="full" label="recipient" /> },
            ...(token ? [{ label: 'token', value: tokenIdentity(token) }] : []),
            { label: 'amount', value: `${token ? count(units) : bunker(units)} ${unit}` },
          ]}
          fee={review.reviewed}
          total={token ? undefined : units + f}
          plan={review.plan}
          planError={review.planError}
          footLabel="from"
          address={state.address}
          busy={busy}
          error={signError || (short ? `Not enough BUNKER for the ${bunker(f)} fee.` : '')}
          signLabel="sign and send"
          busyLabel="signing…"
          onEdit={() => setStep('amount')}
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

  if (step === 'amount') {
    const quoted = fee === null && feeError ? quotedFee(feeError) : null;
    const max = held === null ? null : tokenId === null ? (fee === null ? null : held - fee) : held;
    const line = amountError ? (
      <p className="bc-err text-center" role="alert">
        {amountError}
      </p>
    ) : quoted ? (
      <p className="bc-err text-center" role="alert">
        The node quoted {bunker(BigInt(quoted))} BUNKER. Review stopped.
      </p>
    ) : fee === null ? (
      <p className="bc-hint mono text-center">
        Fee unavailable ·{' '}
        <Button variant="quiet" size="sm" onClick={actions.refreshFee}>
          retry
        </Button>
      </p>
    ) : (
      <p className="bc-hint mono text-center">
        available {held === null ? '–' : token ? count(held) : bunker(held)} · fee {bunker(fee)}
      </p>
    );
    const next = () => {
      if (fee === null) return;
      const [problem, value] = amountProblem(amount, fee);
      setAmountError(problem);
      if (problem) return;
      setUnits(value);
      setSignError('');
      if (review.open()) setStep('review');
    };
    return (
      <div className="wl-stack wl-gap24">
        <FlowBar title="send" step={[2, 3]} onBack={() => setStep('to')} />
        <h1 className="bc-sr">Amount.</h1>
        <div className="wl-bi">
          <div className="wl-bi-row">
            <input
              id="send-amount"
              aria-label={`amount in ${unit}`}
              aria-invalid={amountError ? true : undefined}
              inputMode={tokenId === null ? 'decimal' : 'numeric'}
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
              setAmount(token ? max.toString() : bunker(max).replace(/,/g, ''));
              setAmountError('');
            }}
          >
            max
          </Button>
        </div>
        {line}
        <Button block onClick={next} disabled={fee === null || amount.trim() === ''}>
          review
        </Button>
      </div>
    );
  }

  const assets = [
    { id: null as string | null, mark: <NativeMark />, title: NATIVE, held: balance === null ? '–' : bunker(balance) },
    ...tokens.map((t) => ({
      id: t.tokenId as string | null,
      mark: <TokenMark ticker={t.ticker} tokenId={t.tokenId} metadataHash={t.metadataHash} />,
      title: tokenIdentity(t),
      held: count(t.balance),
    })),
  ];
  const current = assets.find((a) => a.id === tokenId) ?? {
    id: tokenId,
    mark: <>{tokenId?.slice(0, 2)}</>,
    title: `token ${tokenId}`,
    held: '–',
  };
  const goAmount = () => {
    const problem = recipientProblem();
    setToError(problem);
    if (!problem) setStep('amount');
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
                      setTokenId(a.id);
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
      </div>
      <Field
        id="send-to"
        label="to"
        error={toError}
        hint={!toError && recipient && isValidAddress(recipient) && recipient !== state.address && !known ? 'First send to this address.' : undefined}
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
