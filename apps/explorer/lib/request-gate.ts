export interface Ticket {
  signal: AbortSignal;
  current: () => boolean;
}

export interface RequestGate {
  busy: () => boolean;
  begin: () => Ticket;
  finish: (t: Ticket) => void;
  cancel: () => void;
}

// One request at a time per gate: `begin` aborts and supersedes the previous
// ticket, and only the current ticket may write results back.
export function createGate(): RequestGate {
  let gen = 0;
  let ctrl: AbortController | null = null;
  return {
    busy: () => ctrl !== null,
    begin() {
      ctrl?.abort();
      const mine = ++gen;
      const c = new AbortController();
      ctrl = c;
      return { signal: c.signal, current: () => mine === gen };
    },
    finish(t) {
      if (t.current()) ctrl = null;
    },
    cancel() {
      ctrl?.abort();
      ctrl = null;
      gen++;
    },
  };
}
