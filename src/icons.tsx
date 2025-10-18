import type { SVGProps } from 'react';

interface IconProps extends SVGProps<SVGSVGElement> {
  size?: number;
}

const createIcon = (paths: JSX.Element[]) =>
  function Icon({ size = 20, strokeWidth = 1.8, ...rest }: IconProps) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
        {...rest}
      >
        {paths}
      </svg>
    );
  };

export const IconPlus = createIcon([
  <path key="v" d="M12 5v14" />, 
  <path key="h" d="M5 12h14" />,
]);

export const IconLayout = createIcon([
  <rect key="outer" x="3" y="3" width="18" height="18" rx="2" />, 
  <path key="line1" d="M9 3v18" />, 
  <path key="line2" d="M3 9h18" />,
]);

export const IconDownload = createIcon([
  <path key="arr" d="M12 5v11" />, 
  <path key="tip" d="m7 11 5 5 5-5" />, 
  <path key="base" d="M5 19h14" />,
]);

export const IconUpload = createIcon([
  <path key="arr" d="M12 19V8" />, 
  <path key="tip" d="m17 13-5-5-5 5" />, 
  <path key="base" d="M5 5h14" />,
]);

export const IconTrash = createIcon([
  <path key="lid" d="M4 7h16" />, 
  <path key="top" d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />, 
  <path key="bin" d="M6 7v11a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7" />, 
  <path key="line1" d="M10 11v6" />, 
  <path key="line2" d="M14 11v6" />,
]);

export const IconPalette = createIcon([
  <path
    key="pal"
    d="M12 3a9 9 0 1 0 6.36 15.36c.56-.56.78-1.38.58-2.15-.29-1.1-1.32-1.89-2.46-1.89H15a1 1 0 0 1-1-1c0-1.1.9-2 2-2h1a2 2 0 0 0 0-4h-.26A9 9 0 0 0 12 3Z"
  />, 
  <path key="dot1" d="M8.5 10.5h.01" />, 
  <path key="dot2" d="M9.5 6.5h.01" />, 
  <path key="dot3" d="M14.5 6.5h.01" />, 
  <path key="dot4" d="M16.5 10.5h.01" />,
]);

export const IconSparkle = createIcon([
  <path key="star" d="m12 3 1.9 4.7L19 9l-3.5 3L16 17l-4-2.3L8 17l.5-5L5 9l5.2-.3L12 3Z" />, 
]);

export const IconMagicWand = createIcon([
  <path key="shaft" d="M5 21 19 7" />, 
  <path key="star1" d="m15 7 3 3" />, 
  <path key="star2" d="m14 4 1 3" />, 
  <path key="star3" d="m11 7 3 1" />, 
  <path key="star4" d="m18 2 1 3" />, 
]);

export const IconMore = createIcon([
  <path key="dots" d="M5 12h.01M12 12h.01M19 12h.01" />, 
])
;

export const IconUndo = createIcon([
  <path key="arrow" d="M9 14 4 9l5-5" />, 
  <path key="curve" d="M20 18v-1a7 7 0 0 0-7-7H4" />, 
]);

export const IconRedo = createIcon([
  <path key="arrow" d="m15 14 5-5-5-5" />, 
  <path key="curve" d="M4 18v-1a7 7 0 0 1 7-7h11" />, 
]);

export const IconCollapse = createIcon([
  <path key="arrow" d="m6 9 6 6 6-6" />,
]);

export const IconExpand = createIcon([
  <path key="arrow" d="m6 15 6-6 6 6" />,
]);
