'use client';

import { useState } from 'react';
import { exportRecord, pct, STAGES, STAGE_LABEL, titleOf, topicsOf, type Sample, type Stage } from '@/lib/samples';
import MarkedText, { MarkLegend } from './MarkedText';
import Report from './Report';
import StageBars from './StageBars';

const byStage = <T,>(o: Record<Stage, T>, f: (v: T) => number) =>
  Object.fromEntries(STAGES.map(st => [st, f(o[st])])) as Record<Stage, number>;

const Metric = ({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) => (
  <div className="metric"><h4>{title}</h4><small>{hint}</small>{children}</div>
);

export default function DemoApp({ samples }: { samples: Sample[] }) {
  const [idx, setIdx] = useState(0);
  const [showBaseline, setShowBaseline] = useState(true);
  const s = samples[idx];
  const sum = s.evaluation.summary;
  const stages = showBaseline ? [...STAGES] : STAGES.filter(st => st !== 'stage1');
  const sh = sum.safe_harbor_passed.final.total;
  const ids = sum.direct_identifiers_left.final.total;

  const download = () => {
    const blob = new Blob([JSON.stringify(exportRecord(s), null, 2)], { type: 'application/json' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `into-the-unknown-${s.id}.json` });
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  return (
    <div className="demo">
      <div className="picker" role="group" aria-label="Choose a synthetic session">
        {samples.map((x, i) => (
          <button key={x.id} type="button" className="pick" aria-pressed={i === idx} onClick={() => setIdx(i)}>
            <span className="pick-id">{x.id} · synthetic</span>
            <b>{titleOf(x)}</b>
            <small>{topicsOf(x)}</small>
          </button>
        ))}
      </div>

      <div className="panel scorecard">
        <Metric title="Re-identification in lineup" hint={`Matched decoys · lower is better · line = chance (${pct(sum.chance)})`}>
          <StageBars values={sum.reidentification_probability} format={pct} chance={sum.chance} />
        </Metric>
        <Metric title="Mosaic exposure" hint="Combined clues · lower is better">
          <StageBars values={sum.mosaic_exposure} format={pct} />
        </Metric>
        <Metric title="Clinical facts retained" hint="Higher is better">
          <StageBars values={sum.clinical_retention} format={pct} />
        </Metric>
        <Metric title="Safe Harbor categories passed" hint="Higher is better">
          <StageBars values={byStage(sum.safe_harbor_passed, v => v.passed)} max={sh} format={v => `${v}/${sh}`} />
        </Metric>
        <Metric title="Direct identifiers left" hint="Known test identifiers · lower is better">
          <StageBars values={byStage(sum.direct_identifiers_left, v => v.left)} max={ids} format={v => `${v}/${ids}`} />
        </Metric>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h3>Session transcript</h3>
          <label className="toggle">
            <input type="checkbox" checked={showBaseline} onChange={e => setShowBaseline(e.target.checked)} />
            Show Presidio baseline
          </label>
        </div>
        <MarkLegend stages={stages} />
        <div className={`tx cols-${stages.length}`}>
          <div className="tx-head"><span />{stages.map(st => <span key={st}>{STAGE_LABEL[st]}</span>)}</div>
          {s.transcript.original.map((t, i) => (
            <div key={i} className={`tx-row${t.role === 'C' ? ' client' : ''}`}>
              <span className="who">{t.role === 'T' ? 'Therapist' : 'Client'}</span>
              {stages.map(st => (
                <p key={st} data-stage={STAGE_LABEL[st]}><MarkedText s={s} stage={st} text={s.transcript[st][i].text} /></p>
              ))}
            </div>
          ))}
        </div>
      </div>

      <Report s={s} />

      <div className="panel demo-foot">
        <p>Export the buyer-facing record: the Into the Unknown transcript, retained attributes, clinical facts, and verification results. The original, the baseline output, and the lineup answer key are never included.</p>
        <button className="btn btn-primary btn-sm" type="button" onClick={download}>Download {s.id} JSON</button>
      </div>
    </div>
  );
}
