'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const SECTIONS = [
  ['problem', 'Problem'],
  ['how', 'How it works'],
  ['dataset', 'Dataset'],
  ['compliance', 'U.S. path'],
  ['roadmap', 'Roadmap'],
] as const;

export default function Nav() {
  const onDemo = usePathname() === '/demo';
  return (
    <header className="nav">
      <div className="wrap nav-in">
        <Link className="logo" href="/" aria-label="Sotto home">
          <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2.5" />
            <path d="M12 2a10 10 0 0 1 0 20z" fill="currentColor" />
          </svg>
          <span>Sotto</span>
        </Link>
        <nav aria-label="Primary">
          {SECTIONS.map(([id, label]) => <Link key={id} href={`/#${id}`}>{label}</Link>)}
          <Link className="demo-link" href="/demo" aria-current={onDemo ? 'page' : undefined}>Demo</Link>
        </nav>
      </div>
    </header>
  );
}
