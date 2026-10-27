import { WORDMARK_TEXT, colors } from '@finalmeal/ui-tokens';
import { SkullMark } from './SkullMark';

const TAGLINE = 'Five dishes. That’s it. Choose.';
const UNREACHABLE = 'Can’t reach the kitchen right now.';

const SWATCHES = [
  { label: 'Ember', token: 'ember' },
  { label: 'Ember Glow', token: 'ember-glow' },
  { label: 'Bone', token: 'bone' },
  { label: 'Night', token: 'night' },
] as const;

interface FoundationProps {
  /** e.g. "6 people · 14 places · 17 dishes"; null when the API could not be reached. */
  statsLine: string | null;
}

export function Foundation({ statsLine }: FoundationProps) {
  return (
    <main className="foundation">
      <SkullMark size={96} color={colors.ember} title={WORDMARK_TEXT} />
      <h1 className="wordmark">{WORDMARK_TEXT}</h1>
      <p className="tagline">{TAGLINE}</p>
      <ul className="swatches">
        {SWATCHES.map(({ label, token }) => (
          <li key={token} className="swatch">
            <span
              className="swatch-chip"
              style={{ backgroundColor: `var(--fm-${token})` }}
              aria-hidden="true"
            />
            <span className="swatch-label">{label}</span>
          </li>
        ))}
      </ul>
      <p className="stats">{statsLine ?? UNREACHABLE}</p>
    </main>
  );
}
