export const DEFAULT_RPC_URL: string;
export function loadBuildEnv(dir: string): NodeJS.ProcessEnv;
export function inlineScriptHashes(htmls: string[]): string[];
export function buildHeaders(opts: { hashes: string[]; rpcUrl: string; metadataUrl?: string | null }): string;
