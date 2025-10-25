import type { SVGProps } from 'react';

interface IconProps extends SVGProps<SVGSVGElement> {
  size?: number;
}

const createIcon = (paths: JSX.Element[]) =>
  function Icon({ size = 20, strokeWidth = 1.8, ...rest }: IconProps) {
    return (
      <svg
        aria-hidden="true"
        fill="none"
        focusable="false"
        height={size}
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
        viewBox="0 0 24 24"
        width={size}
        {...rest}
      >
        {paths}
      </svg>
    );
  };

export const IconPlus = createIcon([
  <path d="M12 5v14" key="v" />,
  <path d="M5 12h14" key="h" />,
]);

export const IconLayout = createIcon([
  <rect height="18" key="outer" rx="2" width="18" x="3" y="3" />,
  <path d="M9 3v18" key="line1" />,
  <path d="M3 9h18" key="line2" />,
]);

export const IconAutoLayout = createIcon([
  <path d="M12 3v4" key="vert-top" />,
  <path d="M12 17v4" key="vert-bottom" />,
  <path d="M3 12h4" key="horiz-left" />,
  <path d="M17 12h4" key="horiz-right" />,
  <path d="m9 6 3 3 3-3" key="arrow-up" />,
  <path d="m9 18 3-3 3 3" key="arrow-down" />,
  <path d="m6 9 3 3-3 3" key="arrow-left" />,
  <path d="m18 9-3 3 3 3" key="arrow-right" />,
]);

export const IconDownload = createIcon([
  <path d="M12 5v11" key="arr" />,
  <path d="m7 11 5 5 5-5" key="tip" />,
  <path d="M5 19h14" key="base" />,
]);

export const IconUpload = createIcon([
  <path d="M12 19V8" key="arr" />,
  <path d="m17 13-5-5-5 5" key="tip" />,
  <path d="M5 5h14" key="base" />,
]);

export const IconTrash = createIcon([
  <path d="M4 7h16" key="lid" />,
  <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" key="top" />,
  <path d="M6 7v11a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7" key="bin" />,
  <path d="M10 11v6" key="line1" />,
  <path d="M14 11v6" key="line2" />,
]);

export const IconPalette = createIcon([
  <path
    d="M12 3a9 9 0 1 0 6.36 15.36c.56-.56.78-1.38.58-2.15-.29-1.1-1.32-1.89-2.46-1.89H15a1 1 0 0 1-1-1c0-1.1.9-2 2-2h1a2 2 0 0 0 0-4h-.26A9 9 0 0 0 12 3Z"
    key="pal"
  />,
  <path d="M8.5 10.5h.01" key="dot1" />,
  <path d="M9.5 6.5h.01" key="dot2" />,
  <path d="M14.5 6.5h.01" key="dot3" />,
  <path d="M16.5 10.5h.01" key="dot4" />,
]);

export const IconSparkle = createIcon([
  <path
    d="m12 3 1.9 4.7L19 9l-3.5 3L16 17l-4-2.3L8 17l.5-5L5 9l5.2-.3L12 3Z"
    key="star"
  />,
]);

export const IconMagicWand = createIcon([
  <path d="M5 21 19 7" key="shaft" />,
  <path d="m15 7 3 3" key="star1" />,
  <path d="m14 4 1 3" key="star2" />,
  <path d="m11 7 3 1" key="star3" />,
  <path d="m18 2 1 3" key="star4" />,
]);

export const IconMore = createIcon([
  <path d="M5 12h.01M12 12h.01M19 12h.01" key="dots" />,
]);

export const IconUndo = createIcon([
  <path d="M9 14 4 9l5-5" key="arrow" />,
  <path d="M20 18v-1a7 7 0 0 0-7-7H4" key="curve" />,
]);

export const IconRedo = createIcon([
  <path d="m15 14 5-5-5-5" key="arrow" />,
  <path d="M4 18v-1a7 7 0 0 1 7-7h11" key="curve" />,
]);

export const IconCollapse = createIcon([<path d="m6 9 6 6 6-6" key="arrow" />]);

export const IconExpand = createIcon([<path d="m6 15 6-6 6 6" key="arrow" />]);

export const IconX = createIcon([
  <path d="M18 6 6 18" key="line1" />,
  <path d="m6 6 12 12" key="line2" />,
]);

export const IconSend = createIcon([
  <path d="m22 2-9.5 9.5" key="line1" />,
  <path d="M22 2 15 22 11.5 13.5 3 10Z" key="body" />,
]);

export const IconNote = createIcon([
  <path
    d="M14 3H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V9z"
    key="body"
  />,
  <path d="M14 3v6h6" key="fold" />,
  <path d="M10 13h4" key="line1" />,
  <path d="M9 17h6" key="line2" />,
]);

export const IconAI = createIcon([
  <path
    d="M12 3L14.5 8.5L20 11L14.5 13.5L12 19L9.5 13.5L4 11L9.5 8.5L12 3Z"
    key="star"
  />,
  <path d="M19 3L20 5L22 6L20 7L19 9L18 7L16 6L18 5L19 3Z" key="spark1" />,
  <path d="M5 15L6 17L8 18L6 19L5 21L4 19L2 18L4 17L5 15Z" key="spark2" />,
]);

export const IconAlignLeft = createIcon([
  <path d="M21 6H3" key="line1" />,
  <path d="M15 12H3" key="line2" />,
  <path d="M17 18H3" key="line3" />,
]);
