'use client';

import type { SVGProps } from 'react';

const B_PATH =
  'M0 125.63V1.69995H64.6C77.6333 1.69995 87.2667 4.64662 93.5 10.5399C99.8467 16.3199 103.02 24.0266 103.02 33.66C103.02 39.8933 101.433 45.4466 98.26 50.32C95.2 55.1933 90.95 58.48 85.51 60.18V61.71C92.1967 63.1833 97.3533 66.47 100.98 71.57C104.607 76.67 106.42 82.6766 106.42 89.59C106.42 101.83 102.397 110.897 94.35 116.79C86.3033 122.683 74.8567 125.63 60.01 125.63H0ZM33.49 49.81H54.74C59.7267 49.81 63.24 48.79 65.28 46.75C67.32 44.5966 68.34 41.82 68.34 38.42C68.34 34.5666 67.0933 31.8466 64.6 30.2599C62.1067 28.56 58.7633 27.71 54.57 27.71H33.49V49.81ZM33.49 99.62H55.93C61.5967 99.62 65.5633 98.5433 67.83 96.39C70.21 94.1233 71.4 91.1766 71.4 87.55C71.4 82.9033 69.9833 79.6166 67.15 77.69C64.43 75.7633 60.8033 74.7999 56.27 74.7999H33.49V99.62Z';
const C_PATH =
  'M147.925 24.0237C151.808 29.0878 154.393 34.8558 155.659 41.39H128.253C126.399 37.0121 123.352 33.3847 119.217 30.5488C114.125 26.9401 108.017 25.24 101.119 25.24C92.8674 25.24 85.7432 27.5362 80.0189 32.2856C78.6468 28.8312 76.5048 25.1727 74.6147 21.9444C74.4698 21.6968 74.3263 21.4518 74.1848 21.2096C72.0568 17.5674 70.4284 14.6526 69.7802 12.4273C69.5307 11.5707 69.5199 11.1081 69.5348 10.9188C69.558 10.9049 69.5869 10.8887 69.6222 10.8706C78.4817 6.33535 88.9421 4 101.119 4C111.643 4 120.811 5.84314 128.708 9.42312L128.737 9.43632L128.766 9.44904C136.817 12.9449 143.164 17.8138 147.925 24.0237ZM69.4526 10.9759C69.4526 10.9758 69.4537 10.9748 69.456 10.9728C69.4539 10.9749 69.4527 10.9759 69.4526 10.9759ZM81.1654 95.9489C86.6844 100.086 93.4096 102.09 101.119 102.09C107.714 102.09 113.699 100.43 118.939 97.0238L118.949 97.0173L118.959 97.0107C123.394 94.0904 126.598 90.336 128.372 85.77H155.654C154.376 92.3052 151.744 98.1251 147.77 103.286C142.885 109.519 136.462 114.454 128.397 118.064C120.482 121.544 111.414 123.33 101.119 123.33C90.8363 123.33 81.7775 121.665 73.8731 118.416C73.8911 118.409 73.9092 118.403 73.9273 118.397C76.3478 117.547 79.6937 116.314 82.0228 114.378C83.254 113.355 84.5229 111.879 85.0244 109.845C85.5472 107.724 85.0799 105.645 84.0405 103.787C82.8939 101.738 81.9418 99.0675 81.1654 95.9489Z';

const ICONS = {
  copy: <><rect x="5.5" y="5.5" width="8" height="8" /><path d="M3.5 10.5h-1v-8h8v1" /></>,
  check: <><path d="M2.5 8.5l3.5 3.5 7.5-7.5" /></>,
  send: <><path d="M4 12l8-8M5.5 3.5H12.5V10.5" /></>,
  receive: <><path d="M12 4l-8 8M10.5 12.5H3.5V5.5" /></>,
  faucet: <><path d="M8 2v8.5M4.5 7l3.5 3.5L11.5 7M2.5 13.5h11" /></>,
  plus: <><path d="M8 2.5v11M2.5 8h11" /></>,
  home: <><path d="M2.5 7L8 2.5 13.5 7v6.5h-11z" /><path d="M6.5 13.5v-4h3v4" /></>,
  activity: <><rect x="2.5" y="2.5" width="11" height="11" /><path d="M8 5v3.5h2.5" /></>,
  settings: <><path d="M2 5h12M2 11h12" /><rect x="4.5" y="3.5" width="3" height="3" className="bc-ic-knob" /><rect x="8.5" y="9.5" width="3" height="3" className="bc-ic-knob" /></>,
  lock: <><rect x="3.5" y="7.5" width="9" height="6" /><path d="M5.5 7.5v-3h5v3" /></>,
  back: <><path d="M13.5 8h-11M6.5 4l-4 4 4 4" /></>,
  chev: <><path d="M6 3.5L10.5 8 6 12.5" /></>,
  paste: <><rect x="3.5" y="3.5" width="9" height="10" /><path d="M6 2.5h4v2H6z" /></>,
};

export type IconName = keyof typeof ICONS;
export const ICON_NAMES = Object.keys(ICONS) as IconName[];

/** One sprite per page: the brand symbol and every line icon. AppShell renders it. */
export function Sprite() {
  return (
    <svg className="bc-sprite" width="0" height="0" aria-hidden="true" focusable="false">
      <symbol id="bc-mark" viewBox="0 0 161 128">
        <path d={B_PATH} />
        <path d={C_PATH} fill="none" stroke="var(--mark)" strokeWidth={8} />
      </symbol>
      {ICON_NAMES.map((name) => (
        <symbol key={name} id={`bc-i-${name}`} viewBox="0 0 16 16">
          {ICONS[name]}
        </symbol>
      ))}
    </svg>
  );
}

/** 16px line icon, 1.5 stroke, square caps; decorative unless `title` is given. */
export function Icon({ name, title, className, ...rest }: { name: IconName; title?: string } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      className={className ? `bc-ic ${className}` : 'bc-ic'}
      viewBox="0 0 16 16"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
      {...rest}
    >
      <use href={`#bc-i-${name}`} />
    </svg>
  );
}

const MARK_SIZES = { 16: [20, 16], 24: [30, 24], 48: [60, 48] } as const;

/** The BunkerCoin logo as on the landing page: B filled, C an 8-unit `--mark` outline. Pass `title` when it is the only label. */
export function BrandMark({ size = 16, title, className }: { size?: 16 | 24 | 48; title?: string; className?: string }) {
  const [w, h] = MARK_SIZES[size];
  return (
    <svg
      className={className ? `bc-mark ${className}` : 'bc-mark'}
      width={w}
      height={h}
      viewBox="0 0 161 128"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      <path d={B_PATH} />
      <path d={C_PATH} fill="none" stroke="var(--mark)" strokeWidth={8} />
    </svg>
  );
}

/** Standalone favicon SVG (no sprite); `#007a55` light, `#00ffb2` dark. */
export const FAVICON_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 161 128"><style>path{fill:#007a55;stroke:#007a55}@media (prefers-color-scheme:dark){path{fill:#00ffb2;stroke:#00ffb2}}path+path{fill:none;stroke-width:8}path:first-of-type{stroke:none}</style>' +
  `<path d="${B_PATH}"/><path d="${C_PATH}"/></svg>`;
