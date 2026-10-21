import { EXPLORER_API_URL } from '../config.ts';
import { obj, str } from '../guards.ts';
import { parseJson } from '../json.ts';
import { buildPath, joinUrl } from '../routes.ts';

export type LabStreamStatus = {
  inputId: string | null;
  live: boolean | null;
  activeVideoUid: string | null;
  iframeUrl: string | null;
};

const optStr = (v: unknown, path: string) => (v === null || v === undefined ? null : str(v, path));

function asLabStatus(v: unknown): LabStreamStatus {
  const data = obj(obj(v, 'response').data, 'data');
  const playback = data.playback === null || data.playback === undefined ? null : obj(data.playback, 'data.playback');
  return {
    inputId: optStr(data.inputId, 'data.inputId'),
    live: typeof data.live === 'boolean' ? data.live : null,
    activeVideoUid: optStr(data.activeVideoUid, 'data.activeVideoUid'),
    iframeUrl: playback ? optStr(playback.iframeUrl, 'data.playback.iframeUrl') : null,
  };
}

export async function requestLabStatus(signal?: AbortSignal): Promise<LabStreamStatus> {
  const response = await fetch(joinUrl(EXPLORER_API_URL, buildPath(['api', 'lab', 'status'])), {
    cache: 'no-store',
    signal,
  });
  let payload: unknown = null;
  try {
    payload = parseJson(await response.text());
  } catch {
    payload = null;
  }
  if (!response.ok) {
    const err = payload && typeof payload === 'object' && 'error' in payload ? (payload as { error: unknown }).error : null;
    throw new Error(typeof err === 'string' && err ? err : `Explorer API failed with ${response.status}`);
  }
  return asLabStatus(payload);
}
