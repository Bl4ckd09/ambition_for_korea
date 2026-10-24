import Link from 'next/link';
import HeroCard from '@/components/HeroCard';
import MarkedText from '@/components/MarkedText';
import StageBars from '@/components/StageBars';
import { loadSamples } from '@/lib/load-samples';
import { exportRecord, noteOf, pct, STAGES, STAGE_LABEL, titleOf, topicsOf, type Sample, type Stage } from '@/lib/samples';

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

const sums = samples.map(s => s.evaluation.summary);
const shTotal = sums[0].safe_harbor_passed.final.total;
const shWorstFinal = Math.min(...sums.map(x => x.safe_harbor_passed.final.passed));
const shBestBaseline = Math.max(...sums.map(x => x.safe_harbor_passed.stage1.passed));
const avgRetention = sums.reduce((a, x) => a + x.clinical_retention.final, 0) / sums.length;
const worst = samples.reduce((a, s) => (s.evaluation.summary.reidentification_probability.final > a.evaluation.summary.reidentification_probability.final ? s : a));
const worstSum = worst.evaluation.summary;

function CompareRows({ s, turn, verdicts }: { s: Sample; turn: number; verdicts: Record<Stage, [string, string]> }) {
  return (
    <>
      {STAGES.map(st => (
        <div key={st} className={`crow${st === 'final' ? ' us' : ''}`}>
          <span className="tag">{STAGE_LABEL[st]}</span>
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
          <Link className="pill" href="/demo"><span className="dot" />Interactive prototype · synthetic sessions only <span aria-hidden="true">→</span></Link>
          <h1>Protect identity.<br /><em>Preserve meaning.</em></h1>
          <p className="lede">Transform sensitive mental health conversations into data for AI training and evaluation—while preserving the context that matters.</p>
          <div className="ctas">
            <Link className="btn btn-primary" href="/demo">Try the demo <span aria-hidden="true">→</span></Link>
            <a className="btn btn-ghost" href="#results">See the results</a>
          </div>
          <HeroCard reid={{ original: r1.original, final: r1.final, chance: s1.evaluation.summary.chance }} />
          <p className="legend">
            <span><i className="sw id" />Identifying detail</span>
            <span><i className="sw new" />Rewritten</span>
            <span><i className="sw ctx" />Context preserved</span>
          </p>
          <div className="strip reveal">
            <div><b>0</b><span>real patient records in these samples</span></div>
            <div><b>{samples.length}</b><span>synthetic stress-test sessions, each run end to end</span></div>
            <div><b>{shWorstFinal}/{shTotal}</b><span>Safe Harbor categories passed on every sample (Presidio baseline: at most {shBestBaseline}/{shTotal})</span></div>
            <div><b>{pct(avgRetention)}</b><span>average clinical-fact retention after rewriting</span></div>
          </div>
        </div>
      </section>

      {/* PROBLEM */}
      <section id="problem">
        <div className="wrap">
          <p className="eyebrow reveal">The problem</p>
          <h2 className="reveal">Off-the-shelf PII scrubbing misses what identifies <em>and destroys what matters.</em></h2>
          <p className="lede reveal">Therapy sessions are full of details that identify someone only in combination: a public event, a rare role, a small town. Pattern-based tools look for names and numbers. Here is the same synthetic session after Microsoft Presidio with default settings, and after Sotto.</p>

          <h3 className="cmp-title reveal">It misses what identifies</h3>
          <div className="compare reveal">
            <CompareRows s={s1} turn={turnWith(s1, 'tornado')} verdicts={{ original: ['bad', 'Identifiable'], stage1: ['bad', 'Event and station still searchable'], final: ['good', 'Identity rewritten · loss kept'] }} />
          </div>

          <h3 className="cmp-title reveal">And it destroys what matters</h3>
          <div className="compare reveal">
            <CompareRows s={s1} turn={turnWith(s1, 'PHQ-9')} verdicts={{ original: ['bad', 'Identifiable'], stage1: ['warn', 'PHQ-9 score lost'], final: ['good', 'Score kept · schedule generalized'] }} />
          </div>

          <div className="three">
            <div className="reveal"><h3><i>01</i>Rich signal</h3><p>Symptoms, scores, risk statements, relationships, and how a therapist responds. This is what empathy, risk recognition, and follow-up quality are measured on.</p></div>
            <div className="reveal"><h3><i>02</i>Mosaic risk</h3><p>A named tornado, a TV station, &ldquo;the only Filipino charge nurse on nights.&rdquo; None of these is a name, but together they find the person.</p></div>
            <div className="reveal"><h3><i>03</i>Collateral damage</h3><p>Pattern tools tagged this PHQ-9 score of 17 as a date. The clinical value is gone, while the named tornado and TV station are still there.</p></div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="tight">
        <div className="wrap">
          <p className="eyebrow reveal">How it works</p>
          <h2 className="reveal">Decide once with full context. <em>Rewrite from the sheet.</em></h2>
          <p className="lede reveal">A strong model decides what has to change, a rewrite follows those decisions, and a separate evaluation judges privacy and meaning claim by claim.</p>
          <div className="bento">
            <div className="card reveal"><span className="step-n">01 · Sheet</span><h3>One de-identification sheet</h3><p>Claude Sonnet reads the whole session and intake information once. It writes down the demographics to retain, surrogate names, what to generalize and how, clinical facts to keep exact, and what to remove.</p><span className="role">Claude Sonnet</span></div>
            <div className="card reveal"><span className="step-n">02 · Rewrite</span><h3>Eight turns at a time</h3><p>Sonnet rewrites the session in 8-turn windows, working only from the public sheet. Surrogates stay consistent, scores and doses stay exact, and the turn structure is preserved.</p><span className="role">Claude Sonnet</span></div>
            <div className="card reveal"><span className="step-n">03 · Evaluate</span><h3>Judge every claim separately</h3><p>Rule checks catch leftover tags, lost risk terms, and changed scores. Claude Haiku answers short probability questions per window and per session: Safe Harbor categories, mosaic clues, clinical facts, quality.</p><span className="role">Rules + Claude Haiku</span></div>
            <div className="card reveal"><span className="step-n">04 · Lineup</span><h3>Try to pick the client out</h3><p>A model reads the processed session next to 10 synthetic profiles, including decoys that share the client&apos;s retained demographics, and guesses who it is. Chance is 10%.</p><span className="role">Persona lineup</span></div>
            <div className="card dark wide reveal">
              <p className="quote">“We never call a dataset anonymous.”</p>
              <p>We report what was checked, what remains, and where we&apos;re still above chance. A strong privacy result can&apos;t hide a meaning failure, and the reverse is also true. The two are scored separately.</p>
            </div>
            <div className="card wide reveal">
              <span className="step-n">Built-in baseline</span>
              <h3>Every sample also runs through Microsoft Presidio</h3>
              <p>Default settings: regular expressions plus spaCy named-entity recognition, with each hit replaced by a &lt;TYPE&gt; tag. Every number we report has an off-the-shelf comparison next to it, scored by the same evaluation.</p>
            </div>
          </div>
        </div>
      </section>

      {/* RESULTS */}
      <section id="results">
        <div className="wrap">
          <p className="eyebrow reveal">Results</p>
          <h2 className="reveal">Measured sample by sample, <em>against a baseline.</em></h2>
          <p className="lede reveal">Three synthetic sessions built to be hard: a publicly reported death, a state title won by a minor, a 93-year-old veteran. Each one is evaluated as written, after Presidio, and after Sotto.</p>
          <div className="results">
            {samples.map(s => {
              const sum = s.evaluation.summary;
              return (
                <article key={s.id} className="rcard reveal">
                  <header>
                    <span className="rid">{s.id} · synthetic</span>
                    <h3>{titleOf(s)}</h3>
                    <p className="topics">{topicsOf(s)}</p>
                  </header>
                  <div>
                    <h4>Re-identification in lineup · chance {pct(sum.chance)}</h4>
                    <StageBars values={sum.reidentification_probability} format={pct} chance={sum.chance} compact />
                  </div>
                  <div>
                    <h4>Clinical facts retained</h4>
                    <StageBars values={sum.clinical_retention} format={pct} compact />
                  </div>
                  <div>
                    <h4>Safe Harbor categories passed</h4>
                    <div className="sh-row">
                      {STAGES.map(st => (
                        <span key={st} className={st === 'final' ? 'em' : ''}>{STAGE_LABEL[st]} {sum.safe_harbor_passed[st].passed}/{sum.safe_harbor_passed[st].total}</span>
                      ))}
                    </div>
                  </div>
                  {noteOf(s) && <p className="rnote">{noteOf(s)}</p>}
                </article>
              );
            })}
          </div>
          {worstSum.reidentification_probability.final > 2 * worstSum.chance && (
            <div className="callout reveal">
              <b>Where we&apos;re not done.</b>
              <span>The {titleOf(worst).toLowerCase()} still scores {pct(worstSum.reidentification_probability.final)} in the lineup, about {(worstSum.reidentification_probability.final / worstSum.chance).toFixed(0)}× chance. Rare demographics stay rare even after every detail is generalized. Cases like this go to expert review instead of shipping on a score.</span>
            </div>
          )}
          <p className="fine reveal">Percentages are Claude Haiku probability judgments on synthetic sessions under fixed test conditions. They are evidence for review, not a benchmark of real-world re-identification risk. <Link href="/demo">Open the full report for each session →</Link></p>
        </div>
      </section>

      {/* DEMO TEASER */}
      <section className="teaser-sec">
        <div className="wrap teaser">
          <div>
            <p className="eyebrow reveal">Interactive demo</p>
            <h2 className="reveal">Read every session <em>three ways.</em></h2>
            <p className="lede reveal">Line up the original, the Presidio baseline, and Sotto turn by turn. Then open the report behind every number.</p>
            <ol className="reveal">
              <li>Pick one of three synthetic sessions</li>
              <li>Compare all three versions turn by turn</li>
              <li>Inspect Safe Harbor, mosaic clues, clinical facts, and the lineup</li>
              <li>Read the de-identification sheet and export the buyer record</li>
            </ol>
            <Link className="btn btn-primary reveal" href="/demo">Open the demo <span aria-hidden="true">→</span></Link>
          </div>
          <Link className="peek reveal" href="/demo" aria-label="Open the interactive demo">
            {(['original', 'final'] as const).map(st => (
              <div key={st} className="peek-row">
                <span>{STAGE_LABEL[st]}</span>
                <p><MarkedText s={s1} stage={st} text={s1.transcript[st][turnWith(s1, 'charge nurse')].text} /></p>
              </div>
            ))}
            <div className="peek-foot"><span>Lineup re-identification {pct(r1.original)} → {pct(r1.final)}</span><b>Open demo →</b></div>
          </Link>
        </div>
      </section>

      {/* DATASET */}
      <section id="dataset" className="darksec">
        <div className="wrap">
          <p className="eyebrow reveal">The product</p>
          <h2 className="reveal">What an AI data buyer <em>actually receives.</em></h2>
          <p className="lede reveal">A licensed dataset of rewritten sessions, each paired with the facts it preserves and the evidence of how it was checked.</p>
          <div className="ds">
            <div className="reveal">
              <ul className="ds-list">
                <li><b>Rewritten sessions</b><span>Speaker-attributed turns with consistent surrogates. Scores, doses, and risk statements are kept exact.</span></li>
                <li><b>Retained attributes</b><span>The demographics the sheet allowed to stay: sex, age band, occupation category, living situation.</span></li>
                <li><b>Clinical facts</b><span>What each session can be evaluated on, with the probability that each fact survived the rewrite.</span></li>
                <li><b>Verification</b><span>Safe Harbor status by category, mosaic exposure, lineup result against chance, rule checks, and quality.</span></li>
                <li><b>Provenance</b><span>Legal basis, pipeline and model versions, and review history.</span></li>
              </ul>
              <div className="never"><b>Never included:</b> the original session, the baseline output, identifier highlights, descriptions of the original mosaic clues, the lineup answer key, audio or voiceprints.</div>
            </div>
            <div className="code reveal">
              <div className="code-h"><span>sotto-{s1.id}.json</span><span>exported by the demo</span></div>
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
          <p className="lede reveal">Selling identifiable therapy records requires each patient&apos;s written authorization. The practical route is licensing de-identified data. Keeping clinical context in that data requires HIPAA&apos;s Expert Determination pathway, because checklist redaction removes it.</p>
          <div className="law">
            <div className="card wide reveal">
              <span className="step-n">Core design choice</span>
              <h3>Expert Determination, not just Safe Harbor</h3>
              <p>Safe Harbor strips dates, sub-state geography, and unique characteristics, which is exactly the context evaluations need. Under Expert Determination, a qualified expert can approve richer data for a defined recipient. Sotto&apos;s de-identification sheet, Safe Harbor category checks, mosaic-clue scores, and lineup results are designed to give that expert evidence they can work with.</p>
            </div>
            <div className="card reveal">
              <span className="step-n">Sourcing</span>
              <h3>Two paths, both de-identified</h3>
              <ul><li>Existing records, de-identified under Expert Determination with provider partners</li><li>New sessions, collected with written authorizations that disclose licensing for compensation</li></ul>
            </div>
            <div className="card reveal">
              <span className="step-n">Excluded by default</span>
              <h3>High-risk categories stay out</h3>
              <ul><li>Minors</li><li>Psychotherapy notes</li><li>42 CFR Part 2 substance-use records</li><li>Audio and voiceprints</li><li>State-protected categories (e.g., HIV, genetic)</li></ul>
            </div>
            <div className="card reveal">
              <span className="step-n">Provenance</span>
              <h3>Evidence travels with every record</h3>
              <ul><li>Legal basis and source state</li><li>Consent version or determination ID, with expiry</li><li>Exclusion filters and pipeline versions</li><li>Reviewer sign-off</li></ul>
            </div>
            <div className="card reveal">
              <span className="step-n">Buyer license</span>
              <h3>Guardrails that travel downstream</h3>
              <ul><li>No re-identification or linkage</li><li>Downstream recipients must accept equal terms (CA AB 713)</li><li>No onward transfer to countries of concern (28 CFR Part 202)</li><li>No advertising, individual decisions, or voice cloning</li></ul>
            </div>
          </div>
          <p className="fine reveal">This summarizes our own research. It is not legal advice. Every item is pending review by U.S. health-privacy counsel.</p>
        </div>
      </section>

      {/* ROADMAP */}
      <section id="roadmap" className="tight">
        <div className="wrap">
          <p className="eyebrow reveal">Roadmap</p>
          <h2 className="reveal">From prototype to a <em>trusted supply.</em></h2>
          <p className="lede reveal">We separate what exists today from what we still have to prove.</p>
          <div className="road reveal">
            <div className="now"><span className="when">Now</span><h3>Prototype</h3><ul><li>Sheet-then-rewrite pipeline on Claude Sonnet</li><li>Rule checks, Claude Haiku judgments, persona lineup</li><li>Presidio baseline on {samples.length} synthetic sessions</li></ul></div>
            <div><span className="when">Next</span><h3>Validate</h3><ul><li>Calibrate Haiku judgments against human raters on labeled cases</li><li>Interviews with U.S. AI training and evaluation data buyers</li><li>Provider interviews on rights and data shape</li><li>Clinical criteria for meaning loss</li></ul></div>
            <div><span className="when">Then</span><h3>Pilot</h3><ul><li>One state, one provider, proper agreements</li><li>Expert Determination on a small dataset</li><li>Measure leakage, lineup risk, and clinical retention on real data</li></ul></div>
            <div><span className="when">Later</span><h3>Supply</h3><ul><li>Licensed evaluation datasets with provenance</li><li>Custom builds for specific evaluation goals</li><li>Recurring supply with quality review</li></ul></div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="tight">
        <div className="wrap">
          <p className="eyebrow center reveal">FAQ</p>
          <h2 className="center reveal">Straight answers.</h2>
          <div className="faq reveal">
            <details><summary>Is the output anonymous?</summary><p>We don&apos;t use that word, and nobody selling health data should. Sotto reduces exposure risk, records every decision in the de-identification sheet, and reports what remains, including where lineup risk is still above chance. Whether a real dataset can be released is decided by a qualified expert under HIPAA&apos;s Expert Determination, for a defined recipient.</p></details>
            <details><summary>Is the demo running live?</summary><p>No. The demo shows recorded output from our pipeline (Presidio, Claude Sonnet, and Claude Haiku) run offline on three synthetic sessions. Every person, number, and place in them is invented. Nothing is sent from your browser.</p></details>
            <details><summary>What do the percentages mean?</summary><p>They are Claude Haiku&apos;s probability judgments under defined test conditions: specific questions about each clue and fact, and a fixed lineup of 10 synthetic profiles where chance is 10%. They are evidence for an expert&apos;s review, not measured real-world re-identification rates.</p></details>
            <details><summary>Why rewrite instead of redact?</summary><p>Redaction removes strings. The risk in therapy sessions is often in combinations of details, and the value is in exact clinical facts. A sheet decided once with full context lets the rewrite generalize the clues and keep the facts, and the evaluation checks both.</p></details>
            <details><summary>Where would real data come from?</summary><p>There are two paths, and both license only de-identified outputs. The first is existing records de-identified under Expert Determination with provider partners. The second is new sessions collected with written authorization from clients and therapists. No provider partnerships are in place yet. Establishing them is the next stage.</p></details>
            <details><summary>Who buys this?</summary><p>Our hypothesis is U.S. companies that build AI training and evaluation datasets, and teams evaluating models on mental-health conversations: empathy, risk-signal recognition, and follow-up questioning. We&apos;re testing this hypothesis with buyer interviews before we set pricing.</p></details>
          </div>
        </div>
      </section>

      {/* CLOSING */}
      <section className="closing">
        <div className="wrap">
          <h2>Protect identity.<br /><em>Preserve meaning.</em></h2>
          <p>Evaluation data for mental health AI, with every check it ran and every number it didn&apos;t hit on the record.</p>
          <div className="ctas">
            <Link className="btn btn-primary" href="/demo">Open the demo <span aria-hidden="true">→</span></Link>
            <a className="btn btn-ghost" href="#top">Back to top</a>
          </div>
        </div>
      </section>
    </>
  );
}
