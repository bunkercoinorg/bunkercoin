export type SlotStatus = 'pending' | 'proposed' | 'notarized' | 'finalized';

// Timestamps are epoch milliseconds; absent when the node does not know them.
export interface Block {
  type: 'block' | 'skip';
  slot: number;
  hash: string;
  producer?: number;
  proposed_timestamp?: number;
  finalized_timestamp?: number;
  parent_slot?: number;
  parent_hash?: string;
  status: SlotStatus;
}

export interface Node {
  node_id: number;
  finalized_slot: number;
}

export interface TransactionBody {
  type: string;
  to?: string;
  amount?: bigint;
  token_id?: string;
  ticker?: string;
  max_supply?: bigint;
  metadata_hash?: string;
}

// Mirrors the node's `status.location`: mempool -> confirmed (in a block) -> finalized.
export interface TransactionStatus {
  location: 'mempool' | 'confirmed' | 'finalized';
  slot?: number;
  block_hash?: string;
  executed?: boolean;
  success?: boolean;
  error?: string;
}

export interface TransactionDetails {
  hash: string;
  sender: string;
  nonce: bigint;
  fee: bigint;
  body?: TransactionBody;
  status: TransactionStatus;
}

export interface AccountDetails {
  pubkey: string;
  native_balance: bigint;
  token_balances: Record<string, bigint>;
  nonce: bigint;
}

export interface TokenSummary {
  id: string;
  ticker: string;
  current_supply: bigint;
  max_supply?: bigint;
  creator?: string;
  metadata_hash?: string;
}

export interface TokenHolder {
  pubkey: string;
  balance: bigint;
}

export interface HolderPage {
  holders: TokenHolder[];
  total: number;
  offset: number;
  limit: number;
}

// Windowed totals from the radio sampler. `packets_dropped_2s` counts ARQ
// retries and `packet_loss_rate_2s` is retries / attempts as a 0..1 ratio.
export interface RadioStats {
  packets_sent_2s: number;
  packets_dropped_2s: number;
  packets_transmitted_2s: number;
  packets_queued: number;
  bytes_transmitted_2s: number;
  bytes_received_2s: number;
  effective_throughput_bps_2s: number;
  packet_loss_rate_2s: number;
  link_speed_level: number;
  received_at: number;
}

export type SearchKind = 'transaction' | 'account' | 'block' | 'token';

export interface SearchMatch {
  kind: SearchKind;
  id: string;
  label: string;
  // An account the node knows nothing about yet: any valid key answers zeroed.
  inactive?: boolean;
}
