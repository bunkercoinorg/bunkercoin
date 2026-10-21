'use client';

import { useState } from 'react';
import { Actions, Button, ButtonLink, CopyValue, Facts, FlowBar, StatePanel } from '@bunkercoin/ui';
import { signUpdateMetadata, tokenIdBytes } from '@/lib/keys';
import { METADATA_ENABLED, metadataHashBytes } from '@/lib/metadata';
import type { Signer } from '@/lib/signer';
import { useReview } from '@/hooks/useReview';
import { useVerifiedMetadata } from '@/hooks/useVerifiedMetadata';
import { viewHref } from '@/hooks/useHashView';
import { count, registryEntry, TokenMark, tokenIdentity } from '@/components/assets';
import { emptyDraft, MetadataFields, publishDraft, type MetadataDraft } from '@/components/MetadataForm';
import Receipt from '@/components/Receipt';
import Outcome, { Rejected, type Broadcast } from '@/components/Outcome';
import { EXPLORER_URL, type WalletActions, type WalletState } from '@/components/Dashboard';

type Step = 'view' | 'edit' | 'review' | 'done';

export default function TokenDetail({
  tokenId,
  state,
  actions,
  signer,
}: {
  tokenId: string;
  state: WalletState;
  actions: WalletActions;
  signer: Signer;
}) {
  const held = state.tokens.find((t) => t.tokenId === tokenId) ?? null;
  const meta = registryEntry(state.registry, tokenId);
  const ticker = meta?.ticker ?? held?.ticker ?? null;
  const metadataHash = meta?.metadataHash ?? held?.metadataHash ?? null;
  const creator = meta?.creator ?? held?.creator ?? null;
  const doc = useVerifiedMetadata(metadataHash);
  const [step, setStep] = useState<Step>('view');
  const [draft, setDraft] = useState<MetadataDraft>(emptyDraft);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [hash, setHash] = useState('');
  const [busy, setBusy] = useState(false);
  const [signError, setSignError] = useState('');
  const [sent, setSent] = useState<Broadcast | null>(null);
  const [rejected, setRejected] = useState<string | null>(null);
  const review = useReview(state, actions, state.fee);
  const identity = tokenIdentity({ tokenId, ticker });
  const back = () => (step === 'view' ? actions.go(viewHref('home')) : setStep(step === 'review' ? 'edit' : 'view'));

  if (!held && !meta) {
    return (
      <div className="wl-stack wl-gap24">
        <FlowBar title="token" onBack={back} />
        {state.registry === null ? (
          <StatePanel state="loading" title="Loading token." heading="h1" />
        ) : (
          <StatePanel state="notfound" title="Token not found." message={`No token ${tokenId} on this network.`} heading="h1" />
        )}
      </div>
    );
  }

  if (step === 'done' && rejected !== null) return <Rejected title="Not updated." reason={rejected} onRetry={() => setStep('edit')} />;
  if (step === 'done' && sent) {
    return (
      <Outcome
        kind="Update"
        sent={sent}
        state={state}
        actions={actions}
        onRetry={() => setStep('edit')}
        copy={{ sending: `Updating ${identity}.`, done: 'Updated.', lead: `new details for ${identity}`, line: identity }}
      />
    );
  }

  if (step === 'review' && review.reviewed) {
    const sign = async () => {
      setBusy(true);
      setSignError('');
      const bytes = metadataHashBytes(hash);
      const result = await review.sign(
        (nonce, fee) =>
          signer.use((privateKey, publicKey) =>
            signUpdateMetadata({ privateKey, publicKey, tokenId: tokenIdBytes(tokenId), metadataHash: bytes, nonce, fee }),
          ),
        { kind: 'metadata', amount: 0n, ticker: ticker ?? undefined },
      );
      setBusy(false);
      if (result.kind === 'broadcast') {
        actions.promoteOnFinal(result.sent.txId, hash);
        setSent(result.sent);
        setStep('done');
      } else if (result.kind === 'rejected') {
        setRejected(result.reason);
        setStep('done');
      } else setSignError(result.message);
    };
    return (
      <div className="wl-stack wl-gap24">
        <FlowBar title="edit details" step={[2, 2]} onBack={back} />
        <h1 className="bc-sr">Review before signing.</h1>
        <Receipt
          rows={[
            { label: 'token', value: identity },
            { label: 'metadata', value: <CopyValue value={hash} label="metadata hash" /> },
          ]}
          fee={review.reviewed}
          plan={review.plan}
          planError={review.planError}
          footLabel="creator"
          address={state.address}
          busy={busy}
          error={signError}
          signLabel="sign and update"
          busyLabel="signing…"
          onEdit={() => setStep('edit')}
          onSign={() => void sign()}
          onCheck={(id) => {
            actions.resend(id);
            setTimeout(review.loadPlan, 1500);
          }}
          onRetryPlan={review.loadPlan}
        />
      </div>
    );
  }

  if (step === 'edit') {
    const next = async () => {
      setUploadError('');
      if (draft.name.trim() === '') {
        setUploadError('Add a name.');
        return;
      }
      setUploading(true);
      try {
        setHash(await publishDraft(draft));
        setSignError('');
        if (review.open()) setStep('review');
      } catch (e) {
        setUploadError((e as Error).message);
      } finally {
        setUploading(false);
      }
    };
    return (
      <div className="wl-stack wl-gap24">
        <FlowBar title="edit details" step={[1, 2]} onBack={back} />
        <h1 className="bc-t2 m-0">Edit {identity}.</h1>
        <MetadataFields draft={draft} onChange={setDraft} idPrefix="edit-meta" disabled={uploading} error={uploadError || undefined} />
        <Button block busy={uploading} onClick={() => void next()} disabled={state.fee === null || state.offline}>
          {uploading ? 'uploading…' : 'review'}
        </Button>
      </div>
    );
  }

  const isCreator = METADATA_ENABLED && creator !== null && creator === state.address;
  return (
    <div className="wl-stack wl-gap24">
      <FlowBar title="token" onBack={back} />
      <div className="bc-ctr">
        <span className="bc-tm size-14!" aria-hidden="true">
          <TokenMark ticker={ticker} tokenId={tokenId} metadataHash={metadataHash} />
        </span>
        <h1 className="bc-t1 m-0">{doc ? doc.name : (ticker ?? `token ${tokenId}`)}.</h1>
        {doc?.description && <p className="bc-lead">{doc.description}</p>}
      </div>
      <Facts
        variant="rows"
        items={[
          { label: 'token', value: <>{ticker ?? 'no ticker'} · <CopyValue value={tokenId} mode="full" label="token id" /></> },
          { label: 'held', value: held ? count(held.balance) : '0' },
          ...(meta ? [{ label: 'supply', value: <>{count(meta.currentSupply)} <span className="bc-s">of {count(meta.maxSupply)}</span></> }] : []),
          ...(creator ? [{ label: 'creator', value: <CopyValue value={creator} label="creator" /> }] : []),
          ...(metadataHash ? [{ label: 'metadata', value: <>{<CopyValue value={metadataHash} label="metadata hash" />} {METADATA_ENABLED && <span className="bc-s">· {doc ? 'verified' : 'not verified'}</span>}</> }] : []),
        ]}
      />
      <Actions align="end">
        <ButtonLink variant="quiet" href={`${EXPLORER_URL}/token?id=${tokenId}`} external>
          explorer ↗
        </ButtonLink>
        {isCreator && (
          <Button variant="ghost" onClick={() => setStep('edit')} disabled={state.offline}>
            edit details
          </Button>
        )}
        {held && held.balance > 0n && (
          <Button onClick={() => actions.go(viewHref('send', tokenId))} disabled={state.offline}>
            send
          </Button>
        )}
      </Actions>
    </div>
  );
}
