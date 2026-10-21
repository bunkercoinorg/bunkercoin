'use client';

import { useMemo } from 'react';
import { encodeQr, type QrEcl } from './qr.ts';

const QUIET = 4;

/** Black modules on a white plate in both themes; 232px. */
export function QrCode({ value, label = 'QR code of the address', ecl = 'M' }: { value: string; label?: string; ecl?: QrEcl }) {
  const { size, d } = useMemo(() => {
    const qr = encodeQr(value, ecl);
    let path = '';
    for (let y = 0; y < qr.size; y++) for (let x = 0; x < qr.size; x++) if (qr.modules[y][x]) path += `M${x} ${y}h1v1h-1z`;
    return { size: qr.size, d: path };
  }, [value, ecl]);
  const box = size + QUIET * 2;
  return (
    <svg className="bc-qr" viewBox={`${-QUIET} ${-QUIET} ${box} ${box}`} shapeRendering="crispEdges" role="img" aria-label={label}>
      <rect x={-QUIET} y={-QUIET} width={box} height={box} fill="#fff" />
      <path fill="#0b0b0b" d={d} />
    </svg>
  );
}
