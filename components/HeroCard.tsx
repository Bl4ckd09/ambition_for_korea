'use client';

import { useEffect } from 'react';
import { pct, STAGE_LABEL, STAGE_STEP, type Stage } from '@/lib/samples';
import { Morph, reducedMotion, useStageMorph } from './Morph';

type Props = { label: string; texts: Record<Stage, string>; reid: Record<Stage, number> };

// Loops one client turn through Original → Stage 1 → Stage 2.
export default function HeroCard({ label, texts, reid }: Props) {
  // Server HTML and reduced-motion users see the finished rewrite.
  const { from, to, phase, go, jump } = useStageMorph('final');

  useEffect(() => {
    if (reducedMotion()) return;
    const seq: [() => void, number][] = [[() => jump('original'), 1800], [() => go('stage1'), 3400], [() => go('final'), 4800]];
    let i = 0;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      seq[i][0]();
      timer = setTimeout(tick, seq[i][1]);
      i = (i + 1) % seq.length;
    };
    tick();
    return () => clearTimeout(timer);
  }, [go, jump]);

  return (
    <figure className="hero-card" data-stage={to} aria-label="A line from a synthetic session, shown as written, after masking, and after rewriting">
      <div className="chrome">
        <span className="dots"><i /><i /><i /></span>
        <span>{label}</span>
        <span className="stage" aria-hidden="true">{to === 'original' ? 'Original' : `${STAGE_LABEL[to]} · ${STAGE_STEP[to]}`}</span>
      </div>
      <p className="hero-utt"><span className="who">Client</span><Morph from={texts[from]} to={texts[to]} phase={phase} /></p>
      <div className="hero-out">
        <span className="chip new">Re-identification {pct(reid.original)} → {pct(reid.final)}</span>
      </div>
    </figure>
  );
}
