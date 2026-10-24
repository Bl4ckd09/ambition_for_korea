import Link from 'next/link';
import HeroCard from '@/components/HeroCard';
import MarkedText from '@/components/MarkedText';
import StageBars from '@/components/StageBars';
import { loadSamples } from '@/lib/load-samples';
import { exportRecord, pct, STAGES, STAGE_LABEL, STAGE_STEP, titleOf, type Sample, type Stage } from '@/lib/samples';

// Our own JSON, escaped before highlighting.
const esc = (s: string) => s.replace(/[&<>"']/g, ch => `&#${ch.charCodeAt(0)};`);
const highlightJson = (json: string) =>
  esc(json)
    .replace(/(&#34;[^&]*?&#34;)(\s*:)/g, '<span class="k">$1</span>$2')
    .replace(/:\s(&#34;.*?&#34;)(,?)$/gm, ': <span class="s">$1</span>$2')
    .replace(/:\s(true|false|null|[\d.]+)(,?)$/gm, ': <span class="n">$1</span>$2');

const samples = loadSamples();
const s1 = samples.find(s => s.id === 'S1') ?? samples[0];
const turnWith = (s: Sample, needle: string) => s.transcript.original.findIndex(t => t.text.includes(needle));
const textsAt = (s: Sample, i: number) => Object.fromEntries(STAGES.map(st => [st, s.transcript[st][i].text])) as Record<Stage, string>;

const sums = samples.map(s => s.evaluation.summary);
const shTotal = sums[0].safe_harbor_passed.final.total;
const shWorstFinal = Math.min(...sums.map(x => x.safe_harbor_passed.final.passed));
const avgRetention = sums.reduce((a, x) => a + x.clinical_retention.final, 0) / sums.length;
const stageName = (st: Stage) => (st === 'original' ? 'Original' : `${STAGE_LABEL[st]} · ${STAGE_STEP[st]}`);

function CompareRows({ s, turn, verdicts }: { s: Sample; turn: number; verdicts: Record<Stage, [string, string]> }) {
  return (
    <>
      {STAGES.map(st => (
        <div key={st} className={`crow${st === 'final' ? ' us' : ''}`}>
          <span className="tag">{stageName(st)}</span>
          <p><MarkedText s={s} stage={st} text={s.transcript[st][turn].text} /></p>
          <span className={`verdict ${verdicts[st][0]}`}>{verdicts[st][1]}</span>
        </div>
      ))}
    </>
  );
}

export default function Home() {
  const r1 = s1.evaluation.summary.reidentification_probability;
  return (
    <>
      {/* HERO */}
      <section className="hero">
        <div className="wrap center">
          <Link className="pill" href="/demo"><span className="dot" />Interactive prototype · synthetic sessions <span aria-hidden="true">→</span></Link>
          <h1>Protect identity.<br /><em>Preserve meaning.</em></h1>
          <p className="lede">Transform sensitive mental health conversations into data for AI training and evaluation—while preserving the context that matters.</p>
          <div className="ctas">
            <Link className="btn btn-primary" href="/demo">Try the demo <span aria-hidden="true">→</span></Link>
            <a className="btn btn-ghost" href="#results">See the results</a>
          </div>
          <HeroCard label={`${s1.id} · synthetic session`} texts={textsAt(s1, turnWith(s1, 'tornado'))} reid={r1} />
          <div className="strip reveal">
            <div><b>0</b><span>real patient records</span></div>
            <div><b>{samples.length}</b><span>stress-test sessions</span></div>
            <div><b>{shWorstFinal}/{shTotal}</b><span>Safe Harbor categories passed</span></div>
            <div><b>{pct(avgRetention)}</b><span>clinical facts kept</span></div>
          </div>
        </div>
      </section>

      {/* PROBLEM */}
      <section id="problem">
        <div className="wrap">
          <p className="eyebrow reveal">The problem</p>
          <h2 className="reveal">Masking misses what identifies <em>and breaks what matters.</em></h2>

          <h3 className="cmp-title reveal">What masking misses</h3>
          <div className="compare reveal">
            <CompareRows s={s1} turn={turnWith(s1, 'tornado')} verdicts={{ original: ['bad', 'Identifiable'], stage1: ['bad', 'Still searchable'], final: ['good', 'Rewritten'] }} />
          </div>

          <h3 className="cmp-title reveal">What masking breaks</h3>
          <div className="compare reveal">
            <CompareRows s={s1} turn={turnWith(s1, 'PHQ-9')} verdicts={{ original: ['bad', 'Identifiable'], stage1: ['warn', 'Score lost'], final: ['good', 'Score kept'] }} />
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="tight">
        <div className="wrap">
          <p className="eyebrow reveal">How it works</p>
          <h2 className="reveal">Two stages, <em>then a hard test.</em></h2>
          <div className="bento">
            <div className="card reveal"><span className="step-n">Stage 1 · Masking</span><h3>Catch the obvious</h3><p>Pattern rules replace names, numbers, and dates with tags.</p></div>
            <div className="card reveal"><span className="step-n">Stage 2 · Rewrite</span><h3>Fix what masking can&apos;t</h3><p>A de-identification sheet, written once with full context, guides a rewrite eight turns at a time.</p></div>
            <div className="card reveal"><span className="step-n">Evaluate</span><h3>Score every claim</h3><p>Safe Harbor, mosaic clues, clinical facts, and quality, each scored separately.</p></div>
            <div className="card reveal"><span className="step-n">Lineup</span><h3>Try to find the client</h3><p>Can a model pick the client out of 10 profiles? Chance is 10%.</p></div>
            <div className="card dark full reveal"><p className="quote">“We never call a dataset anonymous.”</p></div>
          </div>
        </div>
      </section>

      {/* RESULTS */}
      <section id="results">
        <div className="wrap">
          <p className="eyebrow reveal">Results</p>
          <h2 className="reveal">Three hard sessions, <em>measured.</em></h2>
          <div className="results">
            {samples.map(s => {
              const sum = s.evaluation.summary;
              return (
                <article key={s.id} className="rcard reveal">
                  <header>
                    <span className="rid">{s.id}</span>
                    <h3>{titleOf(s)}</h3>
                  </header>
                  <div>
                    <h4>Re-identification · chance {pct(sum.chance)}</h4>
                    <StageBars values={sum.reidentification_probability} format={pct} chance={sum.chance} compact />
                  </div>
                  <div>
                    <h4>Clinical facts kept</h4>
                    <StageBars values={sum.clinical_retention} format={pct} compact />
                  </div>
                  <div>
                    <h4>Safe Harbor</h4>
                    <div className="sh-row">
                      {STAGES.map(st => (
                        <span key={st} className={st === 'final' ? 'em' : ''}>{STAGE_LABEL[st]} {sum.safe_harbor_passed[st].passed}/{sum.safe_harbor_passed[st].total}</span>
                      ))}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* DEMO TEASER */}
      <section className="teaser-sec">
        <div className="wrap teaser">
          <div>
            <p className="eyebrow reveal">Demo</p>
            <h2 className="reveal">Watch every change, <em>stage by stage.</em></h2>
            <Link className="btn btn-primary reveal" href="/demo">Open the demo <span aria-hidden="true">→</span></Link>
          </div>
          <Link className="peek reveal" href="/demo" aria-label="Open the demo">
            {(['original', 'final'] as const).map(st => (
              <div key={st} className="peek-row">
                <span>{stageName(st)}</span>
                <p><MarkedText s={s1} stage={st} text={s1.transcript[st][turnWith(s1, 'charge nurse')].text} /></p>
              </div>
            ))}
            <div className="peek-foot"><span>Re-identification {pct(r1.original)} → {pct(r1.final)}</span><b>Open demo →</b></div>
          </Link>
        </div>
      </section>

      {/* DATASET */}
      <section id="dataset" className="darksec">
        <div className="wrap">
          <p className="eyebrow reveal">The product</p>
          <h2 className="reveal">What a buyer <em>receives.</em></h2>
          <div className="ds">
            <div className="reveal">
              <ul className="ds-list">
                <li><b>Rewritten sessions</b><span>Consistent surrogates. Scores, doses, and risk statements kept exact.</span></li>
                <li><b>Retained attributes</b><span>Sex, age band, occupation category, living situation.</span></li>
                <li><b>Clinical facts</b><span>What each session can evaluate.</span></li>
                <li><b>Verification</b><span>Safe Harbor, mosaic exposure, lineup, rule checks, quality.</span></li>
              </ul>
              <div className="never"><b>Never included:</b> originals, identifiers, the lineup answer key, audio.</div>
            </div>
            <div className="code reveal">
              <div className="code-h"><span>into-the-unknown-{s1.id}.json</span></div>
              <pre dangerouslySetInnerHTML={{ __html: highlightJson(JSON.stringify(exportRecord(s1), null, 2)) }} />
            </div>
          </div>
        </div>
      </section>

      {/* U.S. COMPLIANCE PATH */}
      <section id="compliance">
        <div className="wrap">
          <p className="eyebrow reveal">Built for the U.S. path</p>
          <h2 className="reveal">Designed around how health data can <em>actually move.</em></h2>
          <div className="law">
            <div className="card wide reveal">
              <span className="step-n">Core design choice</span>
              <h3>Expert Determination, not just Safe Harbor</h3>
              <p>Safe Harbor strips the context evaluations need. Expert Determination lets a qualified expert approve richer data for a defined recipient, and Into the Unknown&apos;s sheet, checks, and lineup results are the evidence that expert works from.</p>
            </div>
            <div className="card reveal">
              <span className="step-n">Sourcing</span>
              <h3>Two paths, both de-identified</h3>
              <ul><li>Existing records, licensed after Expert Determination</li><li>New sessions, collected with written authorization</li></ul>
            </div>
            <div className="card reveal">
              <span className="step-n">Excluded</span>
              <h3>High-risk categories stay out</h3>
              <ul><li>Minors</li><li>Psychotherapy notes</li><li>42 CFR Part 2 records</li><li>Audio and voiceprints</li></ul>
            </div>
            <div className="card reveal">
              <span className="step-n">Provenance</span>
              <h3>Evidence on every record</h3>
              <ul><li>Legal basis and source state</li><li>Consent or determination ID</li><li>Reviewer sign-off</li></ul>
            </div>
            <div className="card reveal">
              <span className="step-n">Buyer license</span>
              <h3>Guardrails downstream</h3>
              <ul><li>No re-identification or linkage</li><li>Equal terms downstream (CA AB 713)</li><li>No transfer to countries of concern</li></ul>
            </div>
          </div>
        </div>
      </section>

      {/* ROADMAP */}
      <section id="roadmap" className="tight">
        <div className="wrap">
          <p className="eyebrow reveal">Roadmap</p>
          <h2 className="reveal">From prototype to a <em>trusted supply.</em></h2>
          <div className="road reveal">
            <div className="now"><span className="when">Now</span><h3>Prototype</h3><ul><li>Two-stage pipeline</li><li>Evaluation and lineup</li><li>{samples.length} synthetic sessions</li></ul></div>
            <div><span className="when">Next</span><h3>Validate</h3><ul><li>Calibrate against human raters</li><li>Buyer and provider interviews</li></ul></div>
            <div><span className="when">Then</span><h3>Pilot</h3><ul><li>One state, one provider</li><li>Expert Determination on real data</li></ul></div>
            <div><span className="when">Later</span><h3>Supply</h3><ul><li>Licensed evaluation datasets</li><li>Recurring supply</li></ul></div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="tight">
        <div className="wrap">
          <p className="eyebrow center reveal">FAQ</p>
          <h2 className="center reveal">Straight answers.</h2>
          <div className="faq reveal">
            <details><summary>Is the output anonymous?</summary><p>We don&apos;t use that word. We report what was checked and what remains. Release of real data is decided by a qualified expert under HIPAA Expert Determination.</p></details>
            <details><summary>Is the demo live?</summary><p>Run pipeline calls our backend. By default it returns that pipeline&apos;s recorded output; with the pipeline configured on the server, it runs live. Sessions are synthetic: every person, number, and place is invented.</p></details>
            <details><summary>What do the percentages mean?</summary><p>Model probability judgments under fixed test conditions. In the lineup, chance is 10%. They are evidence for review, not real-world rates.</p></details>
            <details><summary>Why rewrite instead of mask?</summary><p>Masking removes strings. Risk lives in combinations of details, and value lives in exact clinical facts. Rewriting handles both.</p></details>
          </div>
        </div>
      </section>

      {/* CLOSING */}
      <section className="closing">
        <div className="wrap">
          <h2>Protect identity.<br /><em>Preserve meaning.</em></h2>
          <div className="ctas">
            <Link className="btn btn-primary" href="/demo">Open the demo <span aria-hidden="true">→</span></Link>
            <a className="btn btn-ghost" href="#top">Back to top</a>
          </div>
        </div>
      </section>
    </>
  );
}
