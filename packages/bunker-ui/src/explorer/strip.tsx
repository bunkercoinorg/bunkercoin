'use client';

import type { ReactNode } from 'react';
import { StatusTag } from '../status.tsx';

/** One telemetry column (a sample or a bucket mean). `level` 0-8 lit cells, `null` = no sample (dashed gap). `finalized` labels a finalized column. */
export type StripColumn = { level: number | null; finalized?: string };

export type StripSample = { time: string; value: string; finalized?: string };

function stripSvg(columns: StripColumn[], className: string) {
  const groups = new Map<string, string[]>();
  const add = (key: string, x: number, y: number) => {
    const list = groups.get(key) ?? [];
    list.push(`M${x} ${y}h8v8h-8z`);
    groups.set(key, list);
  };
  const gaps: ReactNode[] = [];
  const caps: ReactNode[] = [];
  columns.forEach((c, i) => {
    const x = i * 10 + 1;
    if (c.level === null) {
      gaps.push(<rect key={i} className="bc-c-g" x={x + 0.5} y={14.5} width={7} height={77} />);
      return;
    }
    const level = Math.max(0, Math.min(8, Math.round(c.level)));
    if (c.finalized) {
      caps.push(
        <rect key={i} className="bc-c-a" x={x} y={1} width={8} height={8}>
          <title>{c.finalized}</title>
        </rect>,
      );
    }
    const lit = c.finalized ? 'bc-c-f' : 'bc-c-l';
    for (let r = 0; r < 8; r++) add(r < level ? `${lit}|${(0.3 + 0.085 * r).toFixed(2)}` : 'bc-c-o|', x, 14 + (7 - r) * 10);
  });
  return (
    <svg className={className} viewBox={`0 0 ${Math.max(1, columns.length) * 10} 94`} preserveAspectRatio="none" shapeRendering="crispEdges" aria-hidden="true">
      {[...groups].map(([key, d]) => {
        const [cls, opacity] = key.split('|');
        return <path key={key} className={cls} opacity={opacity || undefined} d={d.join('')} />;
      })}
      {caps}
      {gaps}
    </svg>
  );
}

/**
 * The explorer signature: a still SVG of the last 2 minutes, one column per 2s sample. Draws only what
 * the node reported; phones show the last half. `summary` is the role="img" label.
 */
export function TransmissionStrip({
  columns,
  summary,
  state = 'live',
  staleFor,
  peak,
  samples,
  title = 'transmission · 2 min',
  span = ['-2m', '-1m'],
}: {
  columns: StripColumn[];
  summary: string;
  state?: 'live' | 'stale' | 'awaiting';
  staleFor?: string;
  peak?: string;
  /** Latest samples for the visually hidden table (the spec keeps 10). */
  samples?: StripSample[];
  title?: string;
  /** Left axis label on desktop and on phones (which show the newer half). */
  span?: [string, string];
}) {
  const half = columns.slice(Math.floor(columns.length / 2));
  const tag = state === 'live' ? <StatusTag status="live" /> : state === 'stale' ? <StatusTag status="stale" detail={staleFor} /> : <StatusTag status="awaiting" />;
  return (
    <section className="bc-strip" aria-label={title}>
      <div className="bc-pn-h">
        <h2 className="bc-lbl">{title}</h2>
        <span className="bc-lg" aria-hidden="true">
          <span>
            <i data-k="l" />
            kb/s
          </span>
          <span>
            <i data-k="a" />
            finalized
          </span>
          <span>
            <i data-k="g" />
            no sample
          </span>
        </span>
        {tag}
      </div>
      <div className="bc-strip-b" role="img" aria-label={summary}>
        {stripSvg(columns, 'bc-sv-d')}
        {stripSvg(half, 'bc-sv-p')}
      </div>
      <div className="bc-strip-ax" aria-hidden="true">
        <span className="bc-ph-hide">{span[0]}</span>
        <span className="bc-ph-only">{span[1]}</span>
        <span>{peak ? `peak ${peak}` : ''}</span>
        <span>now</span>
      </div>
      {samples && samples.length > 0 && (
        <table className="bc-sr">
          <caption>latest samples</caption>
          <thead>
            <tr>
              <th scope="col">time</th>
              <th scope="col">throughput</th>
              <th scope="col">finalized</th>
            </tr>
          </thead>
          <tbody>
            {samples.map((s, i) => (
              <tr key={i}>
                <td>{s.time}</td>
                <td>{s.value}</td>
                <td>{s.finalized ?? '–'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
