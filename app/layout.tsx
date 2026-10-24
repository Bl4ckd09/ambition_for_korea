import type { Metadata } from 'next';
import { Inter, Instrument_Serif } from 'next/font/google';
import Nav from '@/components/Nav';
import RevealObserver from '@/components/RevealObserver';
import './globals.css';

const sans = Inter({ subsets: ['latin'], variable: '--font-sans' });
const serif = Instrument_Serif({ subsets: ['latin'], weight: '400', style: ['normal', 'italic'], variable: '--font-serif' });

const description =
  'Sotto transforms sensitive mental health conversations into data for AI training and evaluation, while preserving the context that matters. Interactive prototype using synthetic conversations.';

export const metadata: Metadata = {
  title: { default: 'Sotto — Protect identity. Preserve meaning.', template: '%s — Sotto' },
  description,
  openGraph: { title: 'Sotto — Protect identity. Preserve meaning.', description },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: the inline script adds a `js` class before hydration (gates scroll-reveal styles).
    <html lang="en" className={`${sans.variable} ${serif.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('js')" }} />
      </head>
      <body>
        <Nav />
        <main id="top">{children}</main>
        <footer>
          <div className="wrap">
            <span>© 2026 Sotto (working name) · Interactive prototype using synthetic conversations</span>
            <span>This site describes no real patients, partners, customers, or certified performance. Not legal advice.</span>
          </div>
        </footer>
        <RevealObserver />
      </body>
    </html>
  );
}
