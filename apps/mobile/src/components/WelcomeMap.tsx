import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';
import { colors, skull } from '@finalmeal/ui-tokens';
import { fontFamily } from '../lib/fonts';

// The map art is drawn once on a 390 x 400 board (the top of design/canvas-generator/gen.py
// `map_svg`) and scaled with `slice`, so every phone width shows it edge to edge.
const BOARD_WIDTH = 390;
export const MAP_HEIGHT = 400;

// Map-only tones from the canvas art. They are not brand colours and are used nowhere else.
const MAP = {
  land: '#141210',
  water: '#0F1A1F',
  park: '#16201A',
} as const;

const [, , SKULL_W = 1, SKULL_H = 1] = skull.viewBox.split(' ').map(Number);

interface Pin {
  x: number;
  y: number;
  size?: number;
  selected?: boolean;
}

/** Final Meal picks (ember discs with a skull), then Honorable Mentions (small bone dots). */
const FINAL_MEAL_PINS: readonly Pin[] = [
  { x: 150, y: 170, size: 44, selected: true },
  { x: 60, y: 260 },
  { x: 280, y: 120 },
];
const HONORABLE_PINS: readonly Pin[] = [
  { x: 110, y: 120 },
  { x: 220, y: 250 },
  { x: 320, y: 230 },
  { x: 40, y: 160 },
];

const LABEL = { left: 112, top: 222, text: 'Marutama · on 14 Final Meals' } as const;

function FinalMealPin({ x, y, size = 38, selected = false }: Pin) {
  const r = size / 2;
  const cx = x + r;
  const cy = y + r;
  const skullHeight = Math.round(size * 0.45);
  const k = skullHeight / SKULL_H;
  return (
    <G>
      {selected ? (
        <Circle cx={cx} cy={cy} r={r + 4} fill={colors.emberGlow} fillOpacity={0.35} />
      ) : null}
      <Circle cx={cx} cy={cy} r={r - 1} fill={colors.ember} stroke={colors.night} strokeWidth={2} />
      <G transform={`translate(${cx - (SKULL_W * k) / 2} ${cy - skullHeight / 2}) scale(${k})`}>
        <Path d={skull.path} fill={colors.white} fillRule="evenodd" />
      </G>
    </G>
  );
}

function HonorablePin({ x, y }: Pin) {
  return (
    <Circle
      cx={x + 9}
      cy={y + 9}
      r={7.5}
      fill={colors.honorable}
      stroke={colors.night}
      strokeWidth={3}
    />
  );
}

export function WelcomeMap() {
  const { width } = useWindowDimensions();
  // `xMidYMin slice` scales by the larger of the two ratios and centres horizontally.
  const scale = Math.max(width / BOARD_WIDTH, 1);
  const offsetX = (width - BOARD_WIDTH * scale) / 2;

  return (
    <View
      style={styles.container}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg
        width="100%"
        height={MAP_HEIGHT}
        viewBox={`0 0 ${BOARD_WIDTH} ${MAP_HEIGHT}`}
        preserveAspectRatio="xMidYMin slice"
      >
        <Rect width={BOARD_WIDTH} height={MAP_HEIGHT} fill={MAP.land} />
        <Path
          d="M0 520 C 80 500 120 560 210 540 S 340 470 390 500 L 390 640 C 300 660 240 610 160 640 S 40 690 0 660 Z"
          fill={MAP.water}
        />
        <Path d="M260 0 C 270 80 330 120 390 130 L 390 0 Z" fill={MAP.water} />
        <G stroke={colors.bone} strokeOpacity={0.07} strokeWidth={1.5} fill="none">
          <Path d="M0 120 L390 160" />
          <Path d="M0 260 L390 230" />
          <Path d="M0 380 L390 400" />
          <Path d="M60 0 L90 844" />
          <Path d="M170 0 L150 520" />
          <Path d="M290 140 L320 844" />
        </G>
        <G stroke={colors.bone} strokeOpacity={0.12} strokeWidth={3} fill="none">
          <Path d="M0 330 C 120 300 240 340 390 300" />
          <Path d="M120 0 C 140 200 100 400 140 844" />
        </G>
        <Rect x={190} y={280} width={70} height={60} rx={6} fill={MAP.park} />
        {HONORABLE_PINS.map((pin) => (
          <HonorablePin key={`${pin.x}-${pin.y}`} {...pin} />
        ))}
        {FINAL_MEAL_PINS.map((pin) => (
          <FinalMealPin key={`${pin.x}-${pin.y}`} {...pin} />
        ))}
      </Svg>
      <View style={[styles.label, { left: offsetX + LABEL.left * scale, top: LABEL.top * scale }]}>
        <Text style={styles.labelText}>{LABEL.text}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { height: MAP_HEIGHT, overflow: 'hidden', backgroundColor: MAP.land },
  label: {
    position: 'absolute',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: colors.bone,
  },
  labelText: { fontFamily: fontFamily.uiBold, fontSize: 12, color: colors.night },
});
