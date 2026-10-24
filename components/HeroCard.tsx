'use client';

import { useEffect, useState } from 'react';

const STAGES = [
  ['Original session', 1400],
  ['Finding identifying details', 2000],
  ['Rewriting from the sheet', 2000],
  ['Evaluated', 3600],
] as const;

// An empty `to` means the detail is dropped rather than replaced.
const Swap = ({ from, to }: { from: string; to: string }) => (
  <span className={`swap${to ? '' : ' drop'}`}><span className="a">{from}</span><span className="b">{to}</span></span>
);

type Props = { reid: { original: number; final: number; chance: number } };
const pct = (v: number) => `${Math.round(v * 100)}%`;

export default function HeroCard({ reid }: Props) {
  // Starts on the final stage so server HTML and reduced-motion users see the full result.
  const [stage, setStage] = useState(3);

  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let i = 0;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      setStage(i);
      timer = setTimeout(tick, STAGES[i][1]);
      i = (i + 1) % STAGES.length;
    };
    tick();
    return () => clearTimeout(timer);
  }, []);

  return (
    <figure className="hero-card" data-stage={stage} aria-label="Illustration: a line from synthetic session S1, rewritten so the public event no longer identifies the family while the bereavement is kept">
      <div className="chrome">
        <span className="dots"><i /><i /><i /></span>
        <span>S1 · night-shift ER nurse · synthetic</span>
        <span className="stage" aria-hidden="true">{STAGES[stage][0]}</span>
      </div>
      <p className="hero-utt">
        <span className="who">Client</span>
        <span className="keep">My dad</span><Swap from=", Ernesto," to="" /> <span className="keep">died</span>{' '}
        <Swap from="in the Moore tornado on May 20, 2025" to="suddenly about a year ago" />. He was{' '}
        <span className="keep">helping</span> <Swap from="a neighbor get into their storm shelter" to="someone else get to safety" />.{' '}
        <Swap from="It was on the news, they called him a hero on KOCO" to="It got a lot of public attention, and people called him a hero" />.
      </p>
      <div className="hero-out">
        <span className="chip new">4 identifying details rewritten</span>
        <span className="chip ctx">Kept: bereavement · helping others · public grief</span>
        <span className="chip">Lineup re-identification {pct(reid.original)} → {pct(reid.final)} · chance {pct(reid.chance)}</span>
      </div>
    </figure>
  );
}
