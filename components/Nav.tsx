'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import LogoMark from './LogoMark';

const SECTIONS = [
  ['problem', 'Problem'],
  ['how', 'How it works'],
  ['results', 'Results'],
  ['dataset', 'Dataset'],
  ['compliance', 'U.S. path'],
  ['roadmap', 'Roadmap'],
] as const;

export default function Nav() {
  const onDemo = usePathname() === '/demo';
  return (
    <header className="nav">
      <div className="wrap nav-in">
        <Link className="logo" href="/" aria-label="Into the Unknown home">
          <LogoMark />
          <span>Into <em>the</em> Unknown</span>
        </Link>
        <nav aria-label="Primary">
          {SECTIONS.map(([id, label]) => <Link key={id} href={`/#${id}`}>{label}</Link>)}
          <Link className="demo-link" href="/demo" aria-current={onDemo ? 'page' : undefined}>Demo</Link>
        </nav>
      </div>
    </header>
  );
}
