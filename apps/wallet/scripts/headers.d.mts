export const DEFAULT_RPC_URL: string;
export const DEFAULT_METADATA_URL: string;
export function loadBuildEnv(dir: string): NodeJS.ProcessEnv;
export function inlineScriptHashes(htmls: string[]): string[];
export function buildHeaders(opts: { hashes: string[]; rpcUrl: string; metadataUrl?: string }): string;
