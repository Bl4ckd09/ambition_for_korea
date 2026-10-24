'use client';

import { useState } from 'react';
import { LINEUP_MODE, pct, SAFE_HARBOR_LABEL, STAGES, STAGE_LABEL, type CheckStatus, type Sample, type Stage } from '@/lib/samples';
import StageBars from './StageBars';

const TABS = ['Safe Harbor', 'Mosaic clues', 'Clinical facts', 'Persona lineup', 'De-identification sheet', 'Quality & rules'] as const;
type Tab = (typeof TABS)[number];

const STATUS: Record<CheckStatus, [string, string]> = { pass: ['✓', 'Pass'], review: ['!', 'Review'], fail: ['✕', 'Fail'] };
const Status = ({ status }: { status: CheckStatus }) => (
  <span className={`st st-${status}`}><i aria-hidden="true">{STATUS[status][0]}</i>{STATUS[status][1]}</span>
);
const Bool = ({ ok }: { ok: boolean }) => <Status status={ok ? 'pass' : 'fail'} />;

export default function Report({ s }: { s: Sample }) {
  const [tab, setTab] = useState<Tab>('Safe Harbor');
  return (
    <div className="panel report">
      <div className="tabs" role="tablist" aria-label="Evaluation report">
        {TABS.map(t => (
          <button key={t} type="button" role="tab" id={`tab-${t}`} aria-selected={t === tab} aria-controls="report-panel" onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>
      <div className="tab-panel" role="tabpanel" id="report-panel" aria-labelledby={`tab-${tab}`}>
        {tab === 'Safe Harbor' && <SafeHarbor s={s} />}
        {tab === 'Mosaic clues' && <ProbList intro="Details that are harmless alone but identifying in combination. Claude Haiku estimates how likely each clue still singles out the person. Lower is better." rows={s.evaluation.mosaic.map(m => [m.id, m.description, m.probability])} />}
        {tab === 'Clinical facts' && <ProbList intro="Clinically important facts from the original. Claude Haiku estimates how likely each one is still present. Higher is better." rows={s.evaluation.clinical.map(c => [c.id, c.fact, c.probability])} />}
        {tab === 'Persona lineup' && <LineupPanel s={s} />}
        {tab === 'De-identification sheet' && <Sheet s={s} />}
        {tab === 'Quality & rules' && <Quality s={s} />}
      </div>
    </div>
  );
}

function SafeHarbor({ s }: { s: Sample }) {
  return (
    <>
      <p className="intro">HIPAA Safe Harbor&apos;s 18 identifier types, grouped into 8 categories. Each category is checked by rules, by known test identifiers left in the text, and by a Claude Haiku probability judgment.</p>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead><tr><th>Category</th>{STAGES.map(st => <th key={st}>{STAGE_LABEL[st]}</th>)}</tr></thead>
          <tbody>
            {s.evaluation.safe_harbor.map(h => (
              <tr key={h.code}>
                <td><code>{h.code}</code> {SAFE_HARBOR_LABEL[h.code] ?? h.label}</td>
                {STAGES.map(st => {
                  const r = h.result[st];
                  return (
                    <td key={st}>
                      <Status status={r.status} />
                      <small>
                        {r.rule_hits.length > 0 && <span title={r.rule_hits.join(', ')}>{r.rule_hits.length} rule hit{r.rule_hits.length > 1 && 's'}</span>}
                        {r.llm_probability !== null && <span>Haiku {pct(r.llm_probability)}</span>}
                      </small>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function ProbList({ intro, rows }: { intro: string; rows: [string, string, Record<Stage, number>][] }) {
  return (
    <>
      <p className="intro">{intro}</p>
      <ul className="prob-list">
        {rows.map(([id, text, p]) => (
          <li key={id}>
            <div><code>{id}</code><p>{text}</p></div>
            <StageBars values={p} format={pct} compact />
          </li>
        ))}
      </ul>
    </>
  );
}

type View = 'control' | Stage;
const LINEUP_VIEWS: [View, string][] = [['control', 'No transcript'], ...STAGES.map((st): [View, string] => [st, STAGE_LABEL[st]])];
const FIELD_LABEL: Record<string, string> = { sex: 'Sex', age: 'Age', marital_status: 'Marital', education_level: 'Education', occupation: 'Occupation', city: 'City', state: 'State' };
const human = (v: string | number) => String(v).replaceAll('_', ' ');

function LineupPanel({ s }: { s: Sample }) {
  const l = s.evaluation.lineup;
  const [view, setView] = useState<View>('original');
  return (
    <>
      <p className="intro">A model reads the session and {l.cards.length} synthetic profiles, then estimates which profile is the client. Chance is {pct(l.chance)}. Decoys come in three strengths:</p>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead><tr><th>Decoys</th><th>No transcript</th>{STAGES.map(st => <th key={st}>{STAGE_LABEL[st]}</th>)}</tr></thead>
          <tbody>
            {Object.entries(l.modes).map(([k, m]) => (
              <tr key={k}>
                <td><b>{LINEUP_MODE[k]?.label ?? m.label}</b><small className="block">{LINEUP_MODE[k]?.meaning ?? m.meaning}</small></td>
                <td className="num">{pct(m.p_true.control)}</td>
                {STAGES.map(st => <td key={st} className={`num${st === 'final' ? ' em' : ''}`}>{pct(m.p_true[st])}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="lineup-head">
        <h4>Matched-decoy lineup · probability per profile</h4>
        <div className="seg" role="group" aria-label="Transcript shown to the model">
          {LINEUP_VIEWS.map(([k, label]) => (
            <button key={k} type="button" aria-pressed={view === k} onClick={() => setView(k)}>{label}</button>
          ))}
        </div>
      </div>
      <div className="cards">
        {l.cards.map(c => (
          <div key={c.label} className={`pcard${c.is_client ? ' client' : ''}`}>
            <div className="pcard-h"><b>{c.label}</b>{c.is_client && <span className="tagc">Actual client</span>}</div>
            <dl>{l.card_fields.map(f => <div key={f}><dt>{FIELD_LABEL[f] ?? f}</dt><dd>{human(c.fields[f])}</dd></div>)}</dl>
            <div className="pbar" title={`${pct(c.probability[view])}`}><i style={{ width: `${Math.max(c.probability[view] * 100, 1)}%` }} /></div>
            <span className="pval">{pct(c.probability[view])}</span>
          </div>
        ))}
      </div>
    </>
  );
}

function Sheet({ s }: { s: Sample }) {
  const d = s.deid_sheet;
  return (
    <>
      <p className="intro">Claude Sonnet writes this sheet once, from the full session and intake information. The rewrite then works only from it.</p>
      <div className="sheet">
        <div className="sh"><h4>Retained attributes</h4><dl className="kvs">{Object.entries(d.retained).map(([k, v]) => <div key={k}><dt>{human(k)}</dt><dd>{v}</dd></div>)}</dl></div>
        <div className="sh"><h4>Surrogates</h4><ul className="arrows">{d.surrogates.map(x => <li key={x.refers_to}><span>{x.refers_to}</span><b>{x.use}</b></li>)}</ul></div>
        <div className="sh full"><h4>Generalize</h4><ul className="gen"><li className="gen-h"><span>Risk</span><b>Rewritten as</b></li>{d.generalize.map(g => <li key={g.risk}><span>{g.risk}</span><b>{g.rewrite_as}</b></li>)}</ul></div>
        <div className="sh"><h4>Keep exact</h4><ul className="dots-list">{d.keep_exact.map(x => <li key={x}>{x}</li>)}</ul></div>
        <div className="sh"><h4>Remove</h4><ul className="dots-list">{d.remove.map(x => <li key={x}>{x}</li>)}</ul></div>
        <div className="sh full"><h4>Allowed inferences</h4><div className="chips">{d.allowed_inferences.map(x => <span key={x} className="chip">{x}</span>)}</div></div>
      </div>
    </>
  );
}

function Quality({ s }: { s: Sample }) {
  const q = s.evaluation.quality;
  const r = s.evaluation.rule_checks;
  const terms = Object.keys(r.original.risk_terms_kept);
  const scores = Object.keys(r.original.scores_and_doses_kept);
  return (
    <>
      <div className="q-grid">
        <div><h4>Natural conversation <small>higher is better</small></h4><StageBars values={q.natural_conversation} format={pct} compact /></div>
        <div><h4>Clinical facts added <small>lower is better</small></h4><StageBars values={q.clinical_facts_added} format={pct} compact /></div>
        <div><h4>Risk meaning changed <small>lower is better</small></h4><StageBars values={q.risk_changed} format={pct} compact /></div>
      </div>
      <h4 className="sub">Rule checks</h4>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead><tr><th>Check</th>{STAGES.map(st => <th key={st}>{STAGE_LABEL[st]}</th>)}</tr></thead>
          <tbody>
            {terms.map(t => <tr key={t}><td>Risk term kept: <b>{t}</b></td>{STAGES.map(st => <td key={st}><Bool ok={r[st].risk_terms_kept[t]} /></td>)}</tr>)}
            {scores.map(t => <tr key={t}><td>Score or dose kept: <b>{t}</b></td>{STAGES.map(st => <td key={st}><Bool ok={r[st].scores_and_doses_kept[t]} /></td>)}</tr>)}
            <tr><td>Placeholder tags left</td>{STAGES.map(st => <td key={st} className="num">{r[st].tags_left}</td>)}</tr>
            <tr><td>Turn structure kept</td>{STAGES.map(st => <td key={st}><Bool ok={r[st].turn_structure_kept} /></td>)}</tr>
          </tbody>
        </table>
      </div>
    </>
  );
}
