'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { diffChunks, type Stage } from '@/lib/samples';

export type Phase = 'mark' | 'swap';
const MARK_MS = 1100;

export const reducedMotion = () => typeof window !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

// Stage transitions: highlight what is about to change ('mark'), then swap in the new text ('swap').
export function useStageMorph(initial: Stage) {
  const [state, setState] = useState<{ from: Stage; to: Stage; phase: Phase }>({ from: initial, to: initial, phase: 'swap' });
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const go = useCallback((to: Stage) => {
    clearTimeout(timer.current);
    const instant = reducedMotion();
    setState(s => ({ from: s.to, to, phase: instant ? 'swap' : 'mark' }));
    if (!instant) timer.current = setTimeout(() => setState(s => ({ ...s, phase: 'swap' })), MARK_MS);
  }, []);

  const jump = useCallback((to: Stage) => {
    clearTimeout(timer.current);
    setState({ from: to, to, phase: 'swap' });
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);
  return { ...state, go, jump };
}

// Renders <TYPE> placeholders as chips.
export const Tagged = ({ text }: { text: string }) => (
  <>{text.split(/(<[A-Z_]+>)/).map((part, i) => (/^<[A-Z_]+>$/.test(part) ? <span key={i} className="mk-tag">{part}</span> : part))}</>
);

export function Morph({ from, to, phase }: { from: string; to: string; phase: Phase }) {
  const chunks = useMemo(() => diffChunks(from, to), [from, to]);
  return (
    <>
      {chunks.map((c, i) =>
        c.same ? <Tagged key={i} text={c.text} /> : (
          <span key={`${i}-${from.length}-${to.length}`} className={`chg ${phase}${c.to ? '' : ' drop'}${c.from ? '' : ' add'}`}>
            <span className="a"><Tagged text={c.from} /></span>
            <span className="b"><Tagged text={c.to} /></span>
          </span>
        ),
      )}
    </>
  );
}
