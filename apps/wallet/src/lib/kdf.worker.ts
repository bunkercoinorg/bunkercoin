import { argon2Raw, type KdfRequest, type KdfResponse } from './kdf.ts';

// hash-wasm runs Argon2id synchronously inside its async API; off the main thread the UI stays live.
const scope = self as unknown as {
  onmessage: ((e: MessageEvent<KdfRequest>) => void) | null;
  postMessage: (msg: KdfResponse, transfer?: Transferable[]) => void;
};

scope.onmessage = async ({ data }) => {
  scope.postMessage({ started: true });
  try {
    const raw = await argon2Raw(data.password, data.salt, data.params);
    scope.postMessage({ ok: true, raw }, [raw.buffer as ArrayBuffer]);
  } catch (e) {
    scope.postMessage({ ok: false, message: (e as Error).message || 'Key derivation failed' });
  }
};
