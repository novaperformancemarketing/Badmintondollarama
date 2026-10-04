import type { Metadata, Viewport } from 'next';
import { Figtree, Rubik } from 'next/font/google';
import './globals.css';

const rubik = Rubik({ subsets: ['latin'], weight: ['500', '700', '800', '900'], variable: '--font-rubik' });
const figtree = Figtree({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-figtree' });

export const metadata: Metadata = {
  title: 'Smash Champs Dollarama',
  description: 'Doubles round robin, a dollar a game. Tally, settle up, and track who is really carrying who.',
  appleWebApp: { capable: true, title: 'Smash Champs', statusBarStyle: 'black-translucent' },
};

export const viewport: Viewport = {
  themeColor: '#036230',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${rubik.variable} ${figtree.variable}`}>
      <body>{children}</body>
    </html>
  );
}
