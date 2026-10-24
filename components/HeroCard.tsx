'use client';

import { useEffect, useState } from 'react';

const STAGES = [
  ['Raw transcript', 1300],
  ['Detecting identifiers & context', 1900],
  ['Transforming identity', 1900],
  ['Evaluation record ready', 3400],
] as const;

const Swap = ({ from, to }: { from: string; to: string }) => (
  <span className="swap"><span className="a">{from}</span><span className="b">{to}</span></span>
);

export default function HeroCard() {
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
    <figure className="hero-card" data-stage={stage} aria-label="Illustration: a synthetic counseling sentence where identifiers are transformed and clinical context is kept">
      <div className="chrome">
        <span className="dots"><i /><i /><i /></span>
        <span>session_0142 · synthetic</span>
        <span className="stage" aria-hidden="true">{STAGES[stage][0]}</span>
      </div>
      <p className="hero-utt">
        <span className="who">Client</span>
        I&apos;m <Swap from="Megan Brooks" to="[Client A]" />, a <span className="keep">night-shift nurse</span> at{' '}
        <Swap from="St. Agnes Medical Center" to="a hospital" /> in <Swap from="Fresno" to="California" />. Since my{' '}
        <span className="keep">divorce last month</span> I&apos;ve <span className="keep">barely slept</span>, and before every
        shift <span className="keep">my chest gets tight</span>.
      </p>
      <div className="hero-out">
        <span className="chip new">3 identifiers transformed</span>
        <span className="chip ctx">4 context cues kept</span>
        <span className="chip">Evaluates: empathy · follow-up · occupational stress</span>
      </div>
    </figure>
  );
}
