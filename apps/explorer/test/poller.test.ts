import test from 'node:test';
import assert from 'node:assert/strict';
import { createPoller, type Timers } from '../lib/poller.ts';

function fakeTimers() {
  const pending = new Map<number, { fn: () => void; ms: number }>();
  let next = 0;
  const timers: Timers = {
    set: (fn, ms) => {
      pending.set(++next, { fn, ms });
      return next;
    },
    clear: (h) => void pending.delete(h as number),
  };
  const fire = () => {
    const [[id, t]] = [...pending];
    pending.delete(id);
    t.fn();
  };
  return { timers, pending, fire };
}

const tick = () => new Promise((r) => setImmediate(r));

function deferredTask() {
  const runs: { signal: AbortSignal; settle: (fail?: boolean) => void }[] = [];
  const task = (signal: AbortSignal) =>
    new Promise<void>((resolve, reject) => runs.push({ signal, settle: (fail) => (fail ? reject(new Error('x')) : resolve()) }));
  return { runs, task };
}

test('a poke during an in-flight run never starts a second one', async () => {
  const { timers, pending } = fakeTimers();
  const { runs, task } = deferredTask();
  const p = createPoller(task, () => 5000, timers);
  p.poke();
  p.poke();
  assert.equal(runs.length, 1);
  assert.equal(pending.size, 0);
  runs[0].settle();
  await tick();
  assert.equal([...pending.values()][0].ms, 5000);
});

test('the next run is scheduled after a failure, with the current interval', async () => {
  const { timers, pending, fire } = fakeTimers();
  const { runs, task } = deferredTask();
  let interval = 5000;
  const p = createPoller(task, () => interval, timers);
  p.poke();
  interval = 2000;
  runs[0].settle(true);
  await tick();
  assert.equal([...pending.values()][0].ms, 2000);
  fire();
  assert.equal(runs.length, 2);
});

test('a poke replaces the pending timer instead of adding one', async () => {
  const { timers, pending } = fakeTimers();
  const { runs, task } = deferredTask();
  const p = createPoller(task, () => 5000, timers);
  p.poke();
  runs[0].settle();
  await tick();
  p.poke();
  assert.equal(pending.size, 0);
  assert.equal(runs.length, 2);
});

test('dispose aborts the in-flight run and schedules nothing more', async () => {
  const { timers, pending } = fakeTimers();
  const { runs, task } = deferredTask();
  const p = createPoller(task, () => 5000, timers);
  p.poke();
  p.dispose();
  assert.equal(runs[0].signal.aborted, true);
  runs[0].settle();
  await tick();
  assert.equal(pending.size, 0);
  p.poke();
  assert.equal(runs.length, 1);
});
