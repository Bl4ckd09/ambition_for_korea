import type { Metadata } from 'next';
import { Inter, Instrument_Serif } from 'next/font/google';
import Nav from '@/components/Nav';
import RevealObserver from '@/components/RevealObserver';
import './globals.css';

const sans = Inter({ subsets: ['latin'], variable: '--font-sans' });
const serif = Instrument_Serif({ subsets: ['latin'], weight: '400', style: ['normal', 'italic'], variable: '--font-serif' });

const description =
  'Into the Unknown transforms sensitive mental health conversations into data for AI training and evaluation, while preserving the context that matters. Interactive prototype using synthetic conversations.';

export const metadata: Metadata = {
  title: { default: 'Into the Unknown | Protect identity. Preserve meaning.', template: '%s | Into the Unknown' },
  description,
  openGraph: { title: 'Into the Unknown | Protect identity. Preserve meaning.', description },
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
            <span>© 2026 Into the Unknown</span>
            <span>Prototype · synthetic data only · not legal advice</span>
          </div>
        </footer>
        <RevealObserver />
      </body>
    </html>
  );
}
