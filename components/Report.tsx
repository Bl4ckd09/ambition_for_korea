'use client';

import { useState } from 'react';
import { LINEUP_MODE, pct, SAFE_HARBOR_LABEL, STAGES, STAGE_LABEL, type CheckStatus, type Sample, type Stage } from '@/lib/samples';
import StageBars from './StageBars';

const TABS = ['Safe Harbor', 'Mosaic clues', 'Clinical facts', 'Lineup', 'Sheet', 'Quality'] as const;
type Tab = (typeof TABS)[number];

const STATUS: Record<CheckStatus, [string, string]> = { pass: ['✓', 'Pass'], review: ['!', 'Review'], fail: ['✕', 'Fail'] };
const Status = ({ status }: { status: CheckStatus }) => (
  <span className={`st st-${status}`}><i aria-hidden="true">{STATUS[status][0]}</i>{STATUS[status][1]}</span>
);
const Bool = ({ ok }: { ok: boolean }) => <Status status={ok ? 'pass' : 'fail'} />;

type P = { s: Sample; stage: Stage };
const human = (v: string | number) => String(v).replaceAll('_', ' ');

export default function Report({ s, stage }: P) {
  const [tab, setTab] = useState<Tab>('Safe Harbor');
  return (
    <div className="panel report">
      <div className="tabs" role="tablist" aria-label="Report">
        {TABS.map(t => (
          <button key={t} type="button" role="tab" id={`tab-${t}`} aria-selected={t === tab} aria-controls="report-panel" onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>
      <div className="tab-panel" role="tabpanel" id="report-panel" aria-labelledby={`tab-${tab}`}>
        {tab === 'Safe Harbor' && <SafeHarbor s={s} stage={stage} />}
        {tab === 'Mosaic clues' && <ProbList rows={s.evaluation.mosaic.map(m => [m.id, m.description, m.probability])} />}
        {tab === 'Clinical facts' && <ProbList rows={s.evaluation.clinical.map(c => [c.id, c.fact, c.probability])} />}
        {tab === 'Lineup' && <Lineup s={s} stage={stage} />}
        {tab === 'Sheet' && <Sheet s={s} />}
        {tab === 'Quality' && <Quality s={s} stage={stage} />}
      </div>
    </div>
  );
}

// Header and cells highlight the stage currently shown in the player.
const Head = ({ first, stage }: { first: string; stage: Stage }) => (
  <thead><tr><th>{first}</th>{STAGES.map(st => <th key={st} className={st === stage ? 'cur' : ''}>{STAGE_LABEL[st]}</th>)}</tr></thead>
);

function SafeHarbor({ s, stage }: P) {
  return (
    <div className="tbl-wrap">
      <table className="tbl">
        <Head first="Category" stage={stage} />
        <tbody>
          {s.evaluation.safe_harbor.map(h => (
            <tr key={h.code}>
              <td><code>{h.code}</code> {SAFE_HARBOR_LABEL[h.code] ?? h.label}</td>
              {STAGES.map(st => <td key={st} className={st === stage ? 'cur' : ''}><Status status={h.result[st].status} /></td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ProbList({ rows }: { rows: [string, string, Record<Stage, number>][] }) {
  return (
    <ul className="prob-list">
      {rows.map(([id, text, p]) => (
        <li key={id}>
          <div><code>{id}</code><p>{text}</p></div>
          <StageBars values={p} format={pct} compact />
        </li>
      ))}
    </ul>
  );
}

const FIELD_LABEL: Record<string, string> = { sex: 'Sex', age: 'Age', marital_status: 'Marital', education_level: 'Education', occupation: 'Occupation', city: 'City', state: 'State' };

function Lineup({ s, stage }: P) {
  const l = s.evaluation.lineup;
  return (
    <>
      <div className="tbl-wrap">
        <table className="tbl">
          <Head first={`Decoys · chance ${pct(l.chance)}`} stage={stage} />
          <tbody>
            {Object.entries(l.modes).map(([k, m]) => (
              <tr key={k}>
                <td>{LINEUP_MODE[k] ?? m.label}</td>
                {STAGES.map(st => <td key={st} className={`num${st === stage ? ' cur' : ''}`}>{pct(m.p_true[st])}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="cards">
        {l.cards.map(c => (
          <div key={c.label} className={`pcard${c.is_client ? ' client' : ''}`}>
            <div className="pcard-h"><b>{c.label}</b>{c.is_client && <span className="tagc">Client</span>}</div>
            <dl>{l.card_fields.map(f => <div key={f}><dt>{FIELD_LABEL[f] ?? f}</dt><dd>{human(c.fields[f])}</dd></div>)}</dl>
            <div className="pbar"><i style={{ width: `${Math.max(c.probability[stage] * 100, 1)}%` }} /></div>
            <span className="pval">{pct(c.probability[stage])}</span>
          </div>
        ))}
      </div>
    </>
  );
}

function Sheet({ s }: { s: Sample }) {
  const d = s.deid_sheet;
  return (
    <div className="sheet">
      <div className="sh"><h4>Retained</h4><dl className="kvs">{Object.entries(d.retained).map(([k, v]) => <div key={k}><dt>{human(k)}</dt><dd>{v}</dd></div>)}</dl></div>
      <div className="sh"><h4>Surrogates</h4><ul className="arrows">{d.surrogates.map(x => <li key={x.refers_to}><span>{x.refers_to}</span><b>{x.use}</b></li>)}</ul></div>
      <div className="sh full"><h4>Generalize</h4><ul className="gen">{d.generalize.map(g => <li key={g.risk}><span>{g.risk}</span><b>{g.rewrite_as}</b></li>)}</ul></div>
      <div className="sh"><h4>Keep exact</h4><ul className="dots-list">{d.keep_exact.map(x => <li key={x}>{x}</li>)}</ul></div>
      <div className="sh"><h4>Remove</h4><ul className="dots-list">{d.remove.map(x => <li key={x}>{x}</li>)}</ul></div>
    </div>
  );
}

function Quality({ s, stage }: P) {
  const q = s.evaluation.quality;
  const r = s.evaluation.rule_checks;
  const terms = Object.keys(r.original.risk_terms_kept);
  const scores = Object.keys(r.original.scores_and_doses_kept);
  const td = (st: Stage, child: React.ReactNode, num = false) => <td key={st} className={`${num ? 'num' : ''}${st === stage ? ' cur' : ''}`}>{child}</td>;
  return (
    <>
      <div className="q-grid">
        <div><h4>Natural conversation</h4><StageBars values={q.natural_conversation} format={pct} compact /></div>
        <div><h4>Clinical facts added</h4><StageBars values={q.clinical_facts_added} format={pct} compact /></div>
        <div><h4>Risk meaning changed</h4><StageBars values={q.risk_changed} format={pct} compact /></div>
      </div>
      <div className="tbl-wrap">
        <table className="tbl">
          <Head first="Rule check" stage={stage} />
          <tbody>
            {terms.map(t => <tr key={t}><td>{t}</td>{STAGES.map(st => td(st, <Bool ok={r[st].risk_terms_kept[t]} />))}</tr>)}
            {scores.map(t => <tr key={t}><td>{t}</td>{STAGES.map(st => td(st, <Bool ok={r[st].scores_and_doses_kept[t]} />))}</tr>)}
            <tr><td>Tags left</td>{STAGES.map(st => td(st, r[st].tags_left, true))}</tr>
            <tr><td>Turn structure</td>{STAGES.map(st => td(st, <Bool ok={r[st].turn_structure_kept} />))}</tr>
          </tbody>
        </table>
      </div>
    </>
  );
}
