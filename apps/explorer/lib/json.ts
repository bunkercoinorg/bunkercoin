import { parseJson as parse, type Json } from '@bunkercoin/chain-format';

export type { Json };

// Unsafe integers come back as bigint; the node nests deeper than the wallet's default limit allows.
export const parseJson = (text: string): Json => parse(text, { bigints: 'unsafe', maxDepth: 512 });
