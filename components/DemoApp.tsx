'use client';

import { Fragment, useEffect, useRef, useState } from 'react';
import { exportRecord, pct, STAGES, STAGE_LABEL, STAGE_STEP, titleOf, type Sample, type Stage } from '@/lib/samples';
import { Morph, useStageMorph } from './Morph';
import Report from './Report';

const STEP_MS = 3600;

export default function DemoApp({ samples }: { samples: Sample[] }) {
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const { from, to, phase, go, jump } = useStageMorph('original');
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const s = samples[idx];
  const sum = s.evaluation.summary;
  const at = STAGES.indexOf(to);

  const stop = () => { clearTimeout(timer.current); setPlaying(false); };
  const step = (st: Stage) => { stop(); go(st); };
  const pick = (i: number) => { stop(); setIdx(i); jump('original'); };
  const play = () => {
    stop();
    setPlaying(true);
    jump('original');
    const after = (ms: number, f: () => void) => { timer.current = setTimeout(f, ms); };
    after(700, () => { go('stage1'); after(STEP_MS, () => { go('final'); after(1200, () => setPlaying(false)); }); });
  };

  const download = () => {
    const blob = new Blob([JSON.stringify(exportRecord(s), null, 2)], { type: 'application/json' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `into-the-unknown-${s.id}.json` });
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  // Metrics move when the text swaps, not while changes are still being marked.
  const shown = phase === 'mark' ? from : to;
  const sh = sum.safe_harbor_passed[shown], ids = sum.direct_identifiers_left[shown];
  const tiles: [string, number, string, number?][] = [
    ['Re-identification', sum.reidentification_probability[shown], pct(sum.reidentification_probability[shown]), sum.chance],
    ['Mosaic exposure', sum.mosaic_exposure[shown], pct(sum.mosaic_exposure[shown])],
    ['Clinical facts kept', sum.clinical_retention[shown], pct(sum.clinical_retention[shown])],
    ['Safe Harbor', sh.passed / sh.total, `${sh.passed}/${sh.total}`],
    ['Identifiers left', ids.left / ids.total, `${ids.left}/${ids.total}`],
  ];

  return (
    <div className="demo">
      <div className="picker" role="group" aria-label="Session">
        {samples.map((x, i) => (
          <button key={x.id} type="button" className="pick" aria-pressed={i === idx} onClick={() => pick(i)}>
            <span className="pick-id">{x.id}</span>
            <b>{titleOf(x)}</b>
          </button>
        ))}
      </div>

      <div className="player-bar panel">
        <div className="stepper" role="group" aria-label="Stage">
          {STAGES.map((st, i) => (
            <Fragment key={st}>
              {i > 0 && <span className={`step-line${at >= i ? ' on' : ''}`} />}
              <button type="button" className={`step${at >= i ? ' on' : ''}`} aria-pressed={to === st} onClick={() => step(st)}>
                <i>{i}</i><b>{STAGE_LABEL[st]}</b><small>{STAGE_STEP[st]}</small>
              </button>
            </Fragment>
          ))}
        </div>
        <button className="btn btn-primary btn-sm" type="button" onClick={play} disabled={playing}>
          {playing ? 'Playing…' : to === 'final' ? '↺ Replay' : '▶ Play'}
        </button>
      </div>

      <div className="stage-grid">
        <div className="panel morph-panel">
          {s.transcript.original.map((t, i) => (
            <div key={i} className={`mrow${t.role === 'C' ? ' client' : ''}`}>
              <span className="who">{t.role === 'T' ? 'Therapist' : 'Client'}</span>
              <p><Morph from={s.transcript[from][i].text} to={s.transcript[to][i].text} phase={phase} /></p>
            </div>
          ))}
        </div>
        <aside className={`panel tiles s-${shown}`} aria-live="polite">
          {tiles.map(([label, ratio, value, chance]) => (
            <div key={label} className="tile">
              <span>{label}</span>
              <b>{value}</b>
              <div className="tile-bar">
                <i style={{ width: `${Math.max(ratio * 100, 1)}%` }} />
                {chance !== undefined && <em style={{ left: `${chance * 100}%` }} title={`Chance ${pct(chance)}`} />}
              </div>
            </div>
          ))}
        </aside>
      </div>

      <Report s={s} stage={to} />

      <div className="export">
        <button className="btn btn-ghost btn-sm" type="button" onClick={download}>Download {s.id} JSON</button>
      </div>
    </div>
  );
}
