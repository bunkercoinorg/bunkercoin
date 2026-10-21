'use client';

import { useMemo, useState } from 'react';
import { shortId } from '@bunkercoin/chain-format';
import { Button, Checkbox, CopyValue, Facts, Field, FlowBar, Notice, Textarea } from '@bunkercoin/ui';
import { checkPhrase, keypairFromMnemonic, MNEMONIC_WORDS, normalizeMnemonic } from '@/lib/keys';

export interface Replacing {
  /** The stored text, replaced only if it is still exactly this. */
  raw: string;
  /** Known when this browser unlocked that record before. */
  address: string | null;
}

/** W07. With a saved record, nothing is replaced until the checkbox is ticked and the new password saved. */
export default function Import({
  replacing,
  onBack,
  onValid,
}: {
  replacing: Replacing | null;
  onBack: () => void;
  onValid: (phrase: string) => void;
}) {
  const [text, setText] = useState('');
  const [tried, setTried] = useState(false);
  const [replace, setReplace] = useState(false);
  const check = checkPhrase(text);
  const address = useMemo(() => {
    if (!check.valid) return null;
    const keypair = keypairFromMnemonic(text);
    keypair.privateKey.fill(0);
    return keypair.address;
  }, [check.valid, text]);

  const count =
    check.count === MNEMONIC_WORDS && check.valid ? `${MNEMONIC_WORDS} / ${MNEMONIC_WORDS} words · checksum ok` : `${check.count} / ${MNEMONIC_WORDS} words`;
  const error = check.unknown
    ? `Word ${check.unknown.position}, "${check.unknown.word}", is not in the word list.`
    : check.count === MNEMONIC_WORDS && !check.valid
      ? 'Checksum failed. Check the word order.'
      : tried && check.count !== MNEMONIC_WORDS
        ? `${check.count} of ${MNEMONIC_WORDS} words entered.`
        : undefined;

  const submit = () => {
    setTried(true);
    if (check.valid && (!replacing || replace)) onValid(normalizeMnemonic(text));
  };

  return (
    <div className="bc-col-app wl-stack wl-gap24">
      <FlowBar title="import wallet" step={[1, 2]} onBack={onBack} />
      <div>
        <h1 className="bc-t1">Enter your 24 words.</h1>
      </div>
      <Field id="recovery-phrase" label="recovery phrase" meta={count} error={error} announce={false}>
        <Textarea
          mono
          rows={4}
          className="min-h-[150px]"
          value={text}
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          onChange={(e) => setText(e.target.value)}
        />
      </Field>
      {address && <Facts items={[{ label: 'wallet address', value: <CopyValue value={address} mode="full" label="wallet address" /> }]} columns={1} />}
      {replacing && (
        <Notice tone="warn">
          {replacing.address ? `This replaces ${shortId(replacing.address)} in this browser.` : 'This replaces the saved wallet in this browser.'}
          <Checkbox id="replace-saved" label="replace saved wallet" checked={replace} onChange={setReplace} />
        </Notice>
      )}
      <Button block disabled={!!replacing && !replace} onClick={submit}>
        continue
      </Button>
    </div>
  );
}
