'use client';

import { useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';

/** One time bucket: `stack` oldest at the bottom (`f` finalized, `s` skipped); `known: false` = no data (dashed). */
export type TimelineColumn = { stack: ('f' | 's')[]; more?: boolean; known: boolean; label: string };

export type TimelineRow = { time: string; blocks: string };

export type CadenceLine = {
  /** 0..1 per interval, oldest first; 1 = at or above the cap. */
  points: number[];
  /** 0..1 height of the median line. */
  median: number;
  label: ReactNode;
};

const ROWS = 6;
const H = ROWS * 10 + 4;

function columnsSvg(
  columns: TimelineColumn[],
  active: number | null,
  className: string,
  onPointerMove: (e: PointerEvent<SVGSVGElement>) => void,
) {
  const fills: string[] = [];
  const off: string[] = [];
  const skips: ReactNode[] = [];
  const gaps: ReactNode[] = [];
  columns.forEach((c, i) => {
    const x = i * 10 + 1;
    if (!c.known) {
      gaps.push(<rect key={i} className="bc-t-g" x={x + 0.5} y={4.5} width={7} height={H - 5} />);
      return;
    }
    for (let r = 0; r < ROWS; r++) {
      const y = H - 10 - r * 10 + 1;
      const k = c.stack[r];
      if (k === 'f') fills.push(`M${x} ${y}h8v8h-8z`);
      else if (k === 's') skips.push(<rect key={`${i}-${r}`} className="bc-t-s" x={x + 0.5} y={y + 0.5} width={7} height={7} />);
      else off.push(`M${x} ${y}h8v8h-8z`);
    }
    if (c.more) fills.push(`M${x} 0h8v2h-8z`);
  });
  return (
    <svg
      className={className}
      viewBox={`0 0 ${Math.max(1, columns.length) * 10} ${H}`}
      preserveAspectRatio="none"
      shapeRendering="crispEdges"
      aria-hidden="true"
      onPointerMove={onPointerMove}
    >
      <path className="bc-t-o" d={off.join('')} />
      <path className="bc-t-f" d={fills.join('')} />
      {skips}
      {gaps}
      {active !== null && active >= 0 && active < columns.length && (
        <rect className="bc-t-x" x={active * 10 + 0.5} y={0.5} width={9} height={H - 1} vectorEffect="non-scaling-stroke" />
      )}
    </svg>
  );
}

function sparkline(c: CadenceLine) {
  const n = c.points.length;
  const x = (i: number) => (n === 1 ? 50 : (i / (n - 1)) * 100);
  const y = (v: number) => 23 - v * 20;
  return (
    <svg className="bc-tl-sp" viewBox="0 0 100 26" preserveAspectRatio="none" aria-hidden="true">
      <line className="bc-tl-md" x1={0} x2={100} y1={y(c.median)} y2={y(c.median)} vectorEffect="non-scaling-stroke" />
      <polyline className="bc-tl-ln" points={c.points.map((v, i) => `${x(i).toFixed(2)},${y(v).toFixed(2)}`).join(' ')} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/**
 * The overview history: one column per time bucket over the last day, a square per finalized block,
 * dashed where the archive has no data. Hover, or focus and arrow keys, read a column out below.
 */
export function BlockTimeline({
  title,
  summary,
  columns,
  axis,
  phoneAxis,
  rows,
  meta,
  idle,
  cadence,
}: {
  title: string;
  summary: string;
  columns: TimelineColumn[];
  /** Left, middle, right labels; phones show the newer half with `phoneAxis`. */
  axis: [string, string, string];
  phoneAxis: [string, string, string];
  rows: TimelineRow[];
  meta?: ReactNode;
  /** Readout while nothing is hovered or focused. */
  idle: ReactNode;
  cadence?: CadenceLine | null;
}) {
  const [active, setActive] = useState<number | null>(null);
  const half = Math.floor(columns.length / 2);
  const last = columns.length - 1;

  const point = (offset: number, count: number) => (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    if (r.width <= 0) return;
    setActive(offset + Math.min(count - 1, Math.max(0, Math.floor(((e.clientX - r.left) / r.width) * count))));
  };

  const keys = (e: KeyboardEvent<HTMLDivElement>) => {
    const step: Record<string, (i: number) => number> = {
      ArrowLeft: (i) => Math.max(0, i - 1),
      ArrowRight: (i) => Math.min(last, i + 1),
      Home: () => 0,
      End: () => last,
    };
    if (e.key === 'Escape') return setActive(null);
    const f = step[e.key];
    if (!f || last < 0) return;
    e.preventDefault();
    setActive((i) => f(i ?? last));
  };

  const readout = active !== null && columns[active] ? columns[active].label : idle;

  return (
    <section className="bc-strip bc-tl" aria-label={title}>
      <div className="bc-pn-h">
        <h2 className="bc-lbl">{title}</h2>
        <span className="bc-lg" aria-hidden="true">
          <span>
            <i data-k="a" />
            finalized
          </span>
          <span>
            <i data-k="g" />
            skipped
          </span>
          <span>
            <i data-k="n" />
            no data
          </span>
        </span>
        {meta}
      </div>
      <div
        className="bc-strip-b bc-tl-b"
        tabIndex={0}
        aria-label={`${title}: use arrow keys to read each column`}
        onKeyDown={keys}
        onBlur={() => setActive(null)}
        onPointerLeave={() => setActive(null)}
      >
        <div role="img" aria-label={summary}>
          {columnsSvg(columns, active, 'bc-sv-d', point(0, columns.length))}
          {columnsSvg(columns.slice(half), active === null ? null : active - half, 'bc-sv-p', point(half, columns.length - half))}
        </div>
      </div>
      <div className="bc-strip-ax" aria-hidden="true">
        <span className="bc-ph-hide">{axis[0]}</span>
        <span className="bc-ph-only">{phoneAxis[0]}</span>
        <span className="bc-ph-hide">{axis[1]}</span>
        <span className="bc-ph-only">{phoneAxis[1]}</span>
        <span>{axis[2]}</span>
      </div>
      <p className="bc-tl-ro" aria-live="polite">
        {readout}
      </p>
      {cadence && (
        <div className="bc-tl-cd">
          <span className="bc-lbl">block interval</span>
          {sparkline(cadence)}
          <span className="bc-tl-cl">{cadence.label}</span>
        </div>
      )}
      {rows.length > 0 && (
        <table className="bc-sr">
          <caption>{title}: blocks by time</caption>
          <thead>
            <tr>
              <th scope="col">time</th>
              <th scope="col">blocks</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td>{r.time}</td>
                <td>{r.blocks}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
