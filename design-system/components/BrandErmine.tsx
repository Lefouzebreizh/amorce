import type { CSSProperties } from 'react';

type BrandErmineProps = {
  size?: number;
  className?: string;
  style?: CSSProperties;
  title?: string;
};

/**
 * Canonical Lefouzebreizh ermine.
 * Geometry is locked to design-system/assets/hermine-master.svg.
 * Do not redraw or replace with generated approximations.
 */
export function BrandErmine({ size = 48, className, style, title = 'Hermine bretonne' }: BrandErmineProps) {
  return (
    <svg
      viewBox="0 0 200 320"
      width={size}
      height={size * 1.6}
      className={className}
      style={style}
      role="img"
      aria-label={title}
    >
      <g fill="currentColor">
        <path d="M100 10 126 62 100 116 74 62Z" />
        <path d="M10 126 62 100 96 126 62 152Z" />
        <path d="M190 126 138 100 104 126 138 152Z" />
        <path d="M100 130 154 258 126 246 114 278 100 310 86 278 74 246 46 258Z" />
      </g>
    </svg>
  );
}
