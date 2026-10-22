'use client';

import { useEffect, useState } from 'react';
import { Button, CopyValue, Field, TextInput, Textarea } from '@bunkercoin/ui';
import { bytesToHex, canonicalMetadataJson } from '@bunkercoin/chain-format';
import { metadataHash as legacyHash } from '@/lib/keys';
import {
  localDocument,
  METADATA_ENABLED,
  METADATA_DESCRIPTION_MAX,
  METADATA_NAME_MAX,
  metadataHash,
  metadataTextProblem,
  prepareIcon,
  uploadMetadata,
} from '@/lib/metadata';

export interface MetadataDraft {
  name: string;
  description: string;
  icon: { blob: Blob; url: string } | null;
}

export const emptyDraft = (): MetadataDraft => ({ name: '', description: '', icon: null });
export const draftIsEmpty = (d: MetadataDraft) => d.name.trim() === '' && d.description.trim() === '' && d.icon === null;

/** Uploads the draft and returns the hash the service committed to, checked locally by the lib. */
export async function publishDraft(d: MetadataDraft, signal?: AbortSignal): Promise<string> {
  const { hash } = await uploadMetadata({ name: d.name.trim(), description: d.description.trim(), image: d.icon?.blob }, signal);
  return hash;
}

/**
 * The text-only document hashed locally: the upload failed and the user chose to go on without it, or the
 * metadata service is off and the mint commits the same hash as before the service existed.
 */
export const localHash = async (d: MetadataDraft, fallbackName: string) => {
  const name = d.name.trim() || fallbackName;
  if (!METADATA_ENABLED) return bytesToHex(legacyHash({ name, description: d.description.trim() }));
  return metadataHash(localDocument(name, d.description.trim()));
};

export function useLiveHash(d: MetadataDraft): string | null {
  const [hash, setHash] = useState<string | null>(null);
  useEffect(() => {
    setHash(null);
    if (d.icon || d.name.trim() === '' || metadataTextProblem(d.name.trim(), d.description.trim())) return;
    let live = true;
    void localHash(d, '').then(
      (h) => live && setHash(h),
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [d.name, d.description, d.icon]);
  return hash;
}

/** Name, description and an optional square icon; the live hash and metadata.json describe the text-only document. */
export function MetadataFields({
  draft,
  onChange,
  idPrefix,
  disabled,
  error,
}: {
  draft: MetadataDraft;
  onChange: (d: MetadataDraft) => void;
  idPrefix: string;
  disabled?: boolean;
  error?: string;
}) {
  const [iconError, setIconError] = useState('');
  const [preparing, setPreparing] = useState(false);
  const hash = useLiveHash(draft);
  const textProblem =
    draft.name.trim() || draft.description.trim() ? metadataTextProblem(draft.name.trim() || 'x', draft.description.trim()) : null;

  const pick = async (file: File | undefined) => {
    setIconError('');
    if (!file) return;
    setPreparing(true);
    try {
      const { blob } = await prepareIcon(file);
      if (draft.icon) URL.revokeObjectURL(draft.icon.url);
      onChange({ ...draft, icon: { blob, url: URL.createObjectURL(blob) } });
    } catch (e) {
      setIconError((e as Error).message);
    } finally {
      setPreparing(false);
    }
  };

  const download = () => {
    const doc = localDocument(draft.name.trim(), draft.description.trim());
    const url = URL.createObjectURL(new Blob([canonicalMetadataJson(doc)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'metadata.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="wl-stack wl-gap16">
      <Field id={`${idPrefix}-name`} label="name" error={error || (textProblem ?? undefined)} announce={false}>
        <TextInput
          value={draft.name}
          maxLength={METADATA_NAME_MAX}
          disabled={disabled}
          autoComplete="off"
          onChange={(e) => onChange({ ...draft, name: e.target.value })}
        />
      </Field>
      <Field id={`${idPrefix}-description`} label="description" meta={`${draft.description.length} / ${METADATA_DESCRIPTION_MAX}`}>
        <Textarea
          value={draft.description}
          maxLength={METADATA_DESCRIPTION_MAX}
          rows={3}
          disabled={disabled}
          onChange={(e) => onChange({ ...draft, description: e.target.value })}
        />
      </Field>
      {METADATA_ENABLED && (
        <Field
          id={`${idPrefix}-icon`}
          label="icon"
          hint={preparing ? 'preparing icon…' : 'PNG, WebP or JPEG. Cropped square to 256 × 256.'}
          error={iconError || undefined}
        >
          <input
            type="file"
            className="wl-file"
            accept="image/png,image/webp,image/jpeg"
            disabled={disabled || preparing}
            onChange={(e) => void pick(e.target.files?.[0])}
          />
        </Field>
      )}
      {draft.icon && (
        <div className="bc-row">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="wl-icon-preview" src={draft.icon.url} alt="icon preview" width={64} height={64} />
          <Button
            variant="ghost"
            size="sm"
            disabled={disabled}
            onClick={() => {
              if (draft.icon) URL.revokeObjectURL(draft.icon.url);
              onChange({ ...draft, icon: null });
            }}
          >
            remove icon
          </Button>
        </div>
      )}
      {draft.icon ? (
        <p className="bc-hint mono">hash after upload</p>
      ) : (
        hash && (
          <div className="bc-row">
            <span className="bc-hint mono">
              hash <CopyValue value={hash} label="metadata hash" />
            </span>
            {METADATA_ENABLED && (
              <Button variant="ghost" size="sm" onClick={download}>
                download metadata.json
              </Button>
            )}
          </div>
        )
      )}
    </div>
  );
}
