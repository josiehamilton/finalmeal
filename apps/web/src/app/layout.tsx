import type { Metadata } from 'next';
import { Instrument_Serif, Manrope, Newsreader } from 'next/font/google';
import { WORDMARK_TEXT, cssVariables } from '@finalmeal/ui-tokens';
import './globals.css';

const wordmark = Instrument_Serif({
  weight: '400',
  subsets: ['latin'],
  variable: '--fm-font-wordmark',
});

const display = Newsreader({
  weight: ['300', '400', '500'],
  style: ['normal', 'italic'],
  subsets: ['latin'],
  variable: '--fm-font-display',
});

const ui = Manrope({
  weight: ['400', '500', '600', '700', '800'],
  subsets: ['latin'],
  variable: '--fm-font-ui',
});

export const metadata: Metadata = {
  title: WORDMARK_TEXT,
  description: 'Five dishes. That’s it. Choose.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${wordmark.variable} ${display.variable} ${ui.variable}`}>
      <head>
        <style dangerouslySetInnerHTML={{ __html: cssVariables() }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
