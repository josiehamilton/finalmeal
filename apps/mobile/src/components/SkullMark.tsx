import Svg, { Path } from 'react-native-svg';
import { skull } from '@finalmeal/ui-tokens';

interface SkullMarkProps {
  /** Height in points; the width follows the mark's aspect ratio. */
  size: number;
  color: string;
  /** When set, the mark is announced as an image with this label; otherwise it is decorative. */
  title?: string;
}

const [, , viewWidth, viewHeight] = skull.viewBox.split(' ').map(Number);

export function SkullMark({ size, color, title }: SkullMarkProps) {
  const a11y = title
    ? { accessible: true, accessibilityRole: 'image' as const, accessibilityLabel: title }
    : { accessible: false, importantForAccessibility: 'no-hide-descendants' as const };
  return (
    <Svg
      viewBox={skull.viewBox}
      width={size * ((viewWidth ?? 1) / (viewHeight ?? 1))}
      height={size}
      fill={color}
      {...a11y}
    >
      <Path d={skull.path} />
    </Svg>
  );
}
