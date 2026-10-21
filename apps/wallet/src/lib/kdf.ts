import { argon2id } from 'hash-wasm';

export interface KdfParams {
  iterations: number;
  memorySizeKiB: number;
  parallelism: number;
}

export async function argon2Raw(password: string, salt: Uint8Array, params: KdfParams): Promise<Uint8Array> {
  return (await argon2id({
    password,
    salt,
    iterations: params.iterations,
    memorySize: params.memorySizeKiB,
    parallelism: params.parallelism,
    hashLength: 32,
    outputType: 'binary',
  })) as Uint8Array;
}

export interface KdfRequest {
  password: string;
  salt: Uint8Array;
  params: KdfParams;
}

/** `started` arrives first: proof the worker loaded, so only a dead worker trips the watchdog. */
export type KdfResponse = { started: true } | { ok: true; raw: Uint8Array } | { ok: false; message: string };
