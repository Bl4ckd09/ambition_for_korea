'use client';

import { useState } from 'react';
import { CASES } from '@/lib/cases';
import { build, turnIds, verify, type Status } from '@/lib/pipeline';
import Transcript from './Transcript';

const STATUS_TEXT: Record<Status, (flags: number) => string> = {
  demo_checks_passed: () => 'Every defined demo check ran and passed. This is not a certification or a release approval.',
  needs_review: n => `${n} item${n > 1 ? 's' : ''} can't be settled automatically and ${n > 1 ? 'are' : 'is'} routed to a human reviewer.`,
  blocked: () => 'Residual identifiers were found in the output. Release is held until they are fixed.',
};

const MODES = {
  live: ['m-live', 'Live'],
  pre: ['m-pre', 'Preconfigured'],
  human: ['m-human', 'Human-authored'],
  not: ['m-not', 'Not run'],
} as const;

const Check = ({ mode, title, note }: { mode: keyof typeof MODES; title: string; note: string }) => (
  <li className="li">
    <span className={`mini ${MODES[mode][0]}`}>{MODES[mode][1]}</span>
    <div>{title}<small>{note}</small></div>
  </li>
);

export default function DemoApp() {
  const [caseIdx, setCaseIdx] = useState(0);
  const [processed, setProcessed] = useState(false);
  const [sel, setSel] = useState<string | null>(null);

  const c = CASES[caseIdx];
  const v = verify(c);
  const span = c.spans.find(s => s.id === sel);

  const reset = () => { setProcessed(false); setSel(null); };
  const pickCase = (i: number) => { setCaseIdx(i); reset(); };
  // ponytail: the plan is preconfigured; swap for a server route calling Haiku + Jev once keys exist.
  const run = () => setProcessed(true);

  const download = () => {
    const blob = new Blob([JSON.stringify(build(c), null, 2)], { type: 'application/json' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `sotto-synthetic-${c.id}.json` });
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  return (
    <div className="demo">
      <div className="demo-bar">
        <div className="cases" role="group" aria-label="Choose a synthetic case">
          {CASES.map((x, i) => (
            <button key={x.id} type="button" className="case" aria-pressed={i === caseIdx} onClick={() => pickCase(i)}>{x.label}</button>
          ))}
        </div>
        <span className="spacer" />
        <span className="badge">Synthetic conversation</span>
        <span className="badge warn">Preconfigured plan</span>
        <button className="btn btn-primary btn-sm" type="button" onClick={run} disabled={processed}>
          {processed ? 'Processed ✓' : 'Process conversation'}
        </button>
        <button className="btn btn-ghost btn-sm" type="button" onClick={reset}>Reset</button>
      </div>

      <p className="case-summary">{c.summary}</p>

      <div className="panes">
        <div className="pane">
          <h4>Original <span className="badge">synthetic</span></h4>
          <Transcript c={c} processed={false} selected={sel} onSelect={setSel} />
        </div>
        <div className="pane">
          <h4>Processed <span className="badge">{processed ? 'plan applied' : 'not run'}</span></h4>
          {processed
            ? <Transcript c={c} processed selected={sel} onSelect={setSel} />
            : <p className="empty">Press “Process conversation”<br />to apply the transformation plan.</p>}
        </div>
      </div>

      <div className="demo-legend">
        <span><i className="sw id" />Identifier (planned change)</span>
        <span><i className="sw new" />Transformed</span>
        <span><i className="sw ctx" />Context to preserve</span>
      </div>

      <div className="detail" aria-live="polite">
        {!span ? (
          <p className="hint">Click any highlighted span to see what it is, how it is handled, and why.</p>
        ) : (
          <>
            <div className="kv">
              <div><span className="k">Original</span><b className="tok id">{span.match}</b></div>
              <div><span className="k">{processed ? 'Replacement' : 'Planned replacement'}</span><b className="tok new">{span.to}</b></div>
              <div><span className="k">Type</span>{span.type}</div>
              <div><span className="k">Method</span>{span.method}</div>
              <div><span className="k">Detected by</span>{span.by}{span.by === 'Model proposal' && ' (preconfigured)'}</div>
              <div><span className="k">Turns</span>{turnIds(c, span).join(', ')}</div>
            </div>
            <p className="why">{span.why}</p>
            {span.review && <p className="flag-note"><b>Needs review.</b> {span.review}</p>}
          </>
        )}
      </div>

      {processed && (
        <div className="report">
          <div className="status" data-s={v.status}>
            <code>{v.status}</code>
            <p>{STATUS_TEXT[v.status](v.flags.length)}</p>
          </div>
          <div>
            <h5>Changes <span>{c.spans.length}</span></h5>
            <ul>
              {c.spans.map(s => (
                <li key={s.id}>
                  <button type="button" className={`chg${sel === s.id ? ' active' : ''}`} onClick={() => setSel(s.id)}>
                    <small>{s.type} · {s.method}</small>
                    <code>{s.to}</code>
                    {s.review && <span className="mini m-flag">Review</span>}
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h5>Context review <span>human-authored</span></h5>
            <ul>
              {c.context.map(([item, verdict, note]) => (
                <li key={item} className="li">
                  <span className={`mini v-${verdict}`}>{verdict}</span>
                  <div>{item}<small>{note}</small></div>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h5>Checks</h5>
            <ul>
              <Check mode="live" title="Format rules (phone, email, URL, SSN)" note={`${v.inOriginal.length} in the original → ${v.residual.length} in the output`} />
              <Check mode="live" title="Original identifier strings" note={`${v.leaks.length} found in the output`} />
              <Check mode="pre" title="Transformation plan" note="Stands in for Claude Haiku proposals. Applied by code." />
              <Check mode="human" title="Context preservation" note="Stands in for per-item TypeSafe Jev checks." />
              <Check mode="not" title="Candidate linkage test" note="No comparison numbers are shown until this is measured." />
            </ul>
          </div>
          <div>
            <h5>Evaluation dimensions</h5>
            <ul>
              {c.dims.map(([d, ctx]) => (
                <li key={d} className="li"><div><b>{d}</b><small>{ctx}</small></div></li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="demo-foot">
        <p>The JSON matches what&apos;s on screen. It contains processed text only, with no original identifiers or mapping tables.</p>
        <button className="btn btn-primary btn-sm" type="button" onClick={download} disabled={!processed}>Download JSON</button>
      </div>
    </div>
  );
}
