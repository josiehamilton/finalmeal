import { skull } from '@finalmeal/ui-tokens';

interface SkullMarkProps {
  size: number;
  color: string;
  /** When set, the mark is announced as an image with this label; otherwise it is decorative. */
  title?: string;
}

export function SkullMark({ size, color, title }: SkullMarkProps) {
  const [, , width, height] = skull.viewBox.split(' ').map(Number);
  const a11y = title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true };
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={skull.viewBox}
      width={size * ((width ?? 1) / (height ?? 1))}
      height={size}
      fill={color}
      {...a11y}
    >
      <path d={skull.path} />
    </svg>
  );
}
