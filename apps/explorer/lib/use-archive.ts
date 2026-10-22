'use client';

import { useEffect } from 'react';
import { useStore } from 'jotai';
import { api } from './api';
import { applyChainAtom, archiveAtom, archiveReadyAtom, blocksFeedAtom, chainAtom, radioBucketsAtom } from './atoms';
import { backfillCursor, decodeArchive, encodeArchive, mergeArchive, topRun } from './archive';
import { archiveKey, loadArchive, saveArchive } from './archive-store';
import { applyCached, fetchOlderThan } from './chain';
import { NODE_API_URL } from './config';
import { joinBuckets } from './strip';

const BACKFILL_PAGE = 100;
const BACKFILL_MAX_PAGES = 10;
const BACKFILL_SPACING_MS = 2000;
const SAVE_EVERY_MS = 20_000;

const pause = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    const t = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => (clearTimeout(t), resolve()), { once: true });
  });

/** Hydrates the chain view and archive from storage, folds live blocks in, saves, and backfills the last day once. */
export function useArchive() {
  const store = useStore();

  useEffect(() => {
    const key = archiveKey(NODE_API_URL);
    const ctrl = new AbortController();
    let saveTimer: ReturnType<typeof setTimeout> | undefined;
    let backfilling = false;

    const flush = () => {
      clearTimeout(saveTimer);
      saveTimer = undefined;
      if (!store.get(archiveReadyAtom)) return;
      void saveArchive(key, encodeArchive({ archive: store.get(archiveAtom), radio: store.get(radioBucketsAtom) }, Date.now()));
    };
    const save = () => {
      if (saveTimer === undefined) saveTimer = setTimeout(flush, SAVE_EVERY_MS);
    };
    const absorb = () => {
      const a = store.get(archiveAtom);
      const next = mergeArchive(a, store.get(chainAtom).blocks, Date.now());
      if (next !== a) store.set(archiveAtom, next);
    };

    // Polite and bounded: one page at a time, spaced, stopping once the window is covered or nothing moves.
    const backfill = async () => {
      if (backfilling || !store.get(archiveReadyAtom) || store.get(blocksFeedAtom).lastSuccess === null) return;
      backfilling = true;
      for (let i = 0; i < BACKFILL_MAX_PAGES && !ctrl.signal.aborted; i++) {
        const cursor = backfillCursor(store.get(archiveAtom), Date.now());
        if (cursor === null) break;
        const head = store.get(chainAtom).blocks[0]?.slot ?? cursor;
        try {
          const page = await fetchOlderThan(cursor, Math.max(0, head - cursor), BACKFILL_PAGE, (offset, limit) =>
            api.getBlocks(offset, limit, { signal: ctrl.signal }),
          );
          if (ctrl.signal.aborted) break;
          const merged = mergeArchive(store.get(archiveAtom), page.blocks, Date.now());
          const floor = page.exhausted ? (page.blocks.length ? page.blocks[page.blocks.length - 1].slot : cursor) : merged.floor;
          store.set(archiveAtom, floor === merged.floor ? merged : { ...merged, floor });
        } catch {
          break;
        }
        if (backfillCursor(store.get(archiveAtom), Date.now()) === cursor) break;
        await pause(BACKFILL_SPACING_MS, ctrl.signal);
      }
      flush();
    };

    void loadArchive(key).then((text) => {
      if (ctrl.signal.aborted) return;
      const stored = decodeArchive(text, Date.now());
      store.set(applyChainAtom, (v) => applyCached(v, topRun(stored.archive.blocks)));
      store.set(archiveAtom, mergeArchive(stored.archive, store.get(chainAtom).blocks, Date.now()));
      store.set(radioBucketsAtom, joinBuckets(stored.radio, store.get(radioBucketsAtom)));
      store.set(archiveReadyAtom, true);
      void backfill();
    });

    const unsubs = [
      store.sub(chainAtom, absorb),
      store.sub(archiveAtom, save),
      store.sub(radioBucketsAtom, save),
      store.sub(blocksFeedAtom, () => void backfill()),
    ];
    const onHide = () => document.visibilityState === 'hidden' && flush();
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      ctrl.abort();
      unsubs.forEach((u) => u());
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onHide);
      flush();
    };
  }, [store]);
}
