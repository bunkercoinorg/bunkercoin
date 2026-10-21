'use client';

import type { ReactNode } from 'react';
import { Link } from '../link.tsx';
import { EmptyState, Skeleton } from '../status.tsx';

export type Column<T> = {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  align?: 'left' | 'right';
};

/**
 * Real <table> with caption and scope="col". With `rowHref` the first cell is the link and stretches over
 * the row. With `phone` the table becomes one linked record per row below 40rem.
 */
export function DataTable<T>({
  caption,
  captionVisible,
  columns,
  rows,
  rowKey,
  rowHref,
  rowState,
  phone,
  empty,
  state = 'ready',
  loadingLabel,
}: {
  caption: string;
  captionVisible?: boolean;
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  rowHref?: (row: T) => string | undefined;
  rowState?: (row: T) => { isNew?: boolean; dim?: boolean };
  phone?: (row: T) => ReactNode;
  empty: ReactNode;
  state?: 'loading' | 'ready';
  loadingLabel?: ReactNode;
}) {
  if (rows.length === 0) {
    return state === 'loading' ? <Skeleton label={loadingLabel} /> : <EmptyState>{empty}</EmptyState>;
  }
  return (
    <div className="bc-tbw" data-phone={phone ? '' : undefined}>
      <table className="bc-tb">
        <caption className={captionVisible ? 'bc-lbl' : 'bc-sr'}>{caption}</caption>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} scope="col" data-align={c.align === 'right' ? 'right' : undefined}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const href = rowHref?.(row);
            const st = rowState?.(row) ?? {};
            return (
              <tr key={rowKey(row)} data-href={href ? '' : undefined} data-new={st.isNew ? '' : undefined} data-dim={st.dim ? '' : undefined}>
                {columns.map((c, i) => (
                  <td key={c.key} data-align={c.align === 'right' ? 'right' : undefined}>
                    {i === 0 && href ? <Link href={href}>{c.cell(row)}</Link> : c.cell(row)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      {phone && (
        <ul className="bc-recs" aria-label={caption}>
          {rows.map((row) => {
            const href = rowHref?.(row);
            const st = rowState?.(row) ?? {};
            return (
              <li key={rowKey(row)} data-new={st.isNew ? '' : undefined}>
                {href ? <Link href={href}>{phone(row)}</Link> : <div>{phone(row)}</div>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
