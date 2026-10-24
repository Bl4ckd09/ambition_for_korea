import Link from 'next/link';
import HeroCard from '@/components/HeroCard';
import Transcript from '@/components/Transcript';
import { CASES } from '@/lib/cases';
import { build, verify } from '@/lib/pipeline';

// Our own constant data, escaped before highlighting.
const esc = (s: string) => s.replace(/[&<>"']/g, ch => `&#${ch.charCodeAt(0)};`);
const highlightJson = (json: string) =>
  esc(json)
    .replace(/(&#34;[^&]*?&#34;)(\s*:)/g, '<span class="k">$1</span>$2')
    .replace(/:\s(&#34;.*?&#34;)(,?)$/gm, ': <span class="s">$1</span>$2')
    .replace(/:\s(true|false|\d+)(,?)$/gm, ': <span class="n">$1</span>$2');

// Teaser: the two client turns from case B, rendered with the same pipeline as the demo.
const peekCase = { ...CASES[1], turns: [CASES[1].turns[3], CASES[1].turns[5]] };
const peek = verify(CASES[1]);

export default function Home() {
  return (
    <>
      {/* HERO */}
      <section className="hero">
        <div className="wrap center">
          <Link className="pill" href="/demo"><span className="dot" />Interactive prototype · synthetic conversations only <span aria-hidden="true">→</span></Link>
          <h1>Protect identity.<br /><em>Preserve meaning.</em></h1>
          <p className="lede">Transform sensitive mental health conversations into data for AI training and evaluation—while preserving the context that matters.</p>
          <div className="ctas">
            <Link className="btn btn-primary" href="/demo">Try the demo <span aria-hidden="true">→</span></Link>
            <a className="btn btn-ghost" href="#dataset">See the dataset format</a>
          </div>
          <HeroCard />
          <p className="legend">
            <span><i className="sw id" />Identifier detected</span>
            <span><i className="sw new" />Transformed</span>
            <span><i className="sw ctx" />Context preserved</span>
          </p>
          <div className="strip reveal">
            <div><b>0</b><span>real patient records used in this prototype</span></div>
            <div><b>2</b><span>axes, privacy and meaning, checked separately and never averaged</span></div>
            <div><b>3</b><span>honest outcomes: passed, needs review, blocked</span></div>
            <div><b>1:1</b><span>every change logged with its reason</span></div>
          </div>
        </div>
      </section>

      {/* PROBLEM */}
      <section id="problem">
        <div className="wrap">
          <p className="eyebrow reveal">The problem</p>
          <h2 className="reveal">The conversations AI most needs to be evaluated on are the <em>hardest to share.</em></h2>
          <p className="lede reveal">A single counseling turn carries both the emotional signal that tests a model and the details that identify a person, plus everyone they mention.</p>
          <div className="compare reveal">
            <div className="crow">
              <span className="tag">Original</span>
              <p>I&apos;m <span className="m-id">Megan Brooks</span>, a <span className="m-ctx">night-shift nurse</span> at <span className="m-id">St. Agnes Medical Center</span> in <span className="m-id">Fresno</span>. Since my <span className="m-ctx">divorce last month</span> I&apos;ve <span className="m-ctx">barely slept</span>.</p>
              <span className="verdict bad">Identifiable</span>
            </div>
            <div className="crow">
              <span className="tag">Blanket redaction</span>
              <p>I&apos;m <span className="m-red">REDACTED</span>, a <span className="m-red">REDACTED</span> at <span className="m-red">REDACTED</span> in <span className="m-red">REDACTED</span>. Since my <span className="m-red">REDACTED</span> <span className="m-red">REDACTED</span> I&apos;ve barely slept.</p>
              <span className="verdict warn">Context lost</span>
            </div>
            <div className="crow us">
              <span className="tag">Sotto</span>
              <p>I&apos;m <span className="m-new">[Client A]</span>, a <span className="m-ctx">night-shift nurse</span> at <span className="m-new">a hospital</span> in <span className="m-new">California</span>. Since my <span className="m-ctx">divorce last month</span> I&apos;ve <span className="m-ctx">barely slept</span>.</p>
              <span className="verdict good">Identity transformed · meaning kept</span>
            </div>
          </div>
          <div className="three">
            <div className="reveal"><h3><i>01</i>Rich signal</h3><p>Triggers, symptoms, timelines, relationships, and how a counselor responds. This is what empathy, risk recognition, and follow-up quality are measured on.</p></div>
            <div className="reveal"><h3><i>02</i>Real exposure</h3><p>The same turn names people, employers, places, and dates, about the client and about third parties like family and coworkers.</p></div>
            <div className="reveal"><h3><i>03</i>A false choice</h3><p>Strip everything and the data can no longer evaluate anything. Keep everything and it can&apos;t be shared. The fix is to handle each span by its role.</p></div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="tight">
        <div className="wrap">
          <p className="eyebrow reveal">How it works</p>
          <h2 className="reveal">Change only what identifies. <em>Keep what it means.</em></h2>
          <p className="lede reveal">Every span is handled according to its role in the conversation. Then something other than the model that made the change checks it.</p>
          <div className="bento">
            <div className="card reveal"><span className="step-n">01 · Detect</span><h3>Find identifiers and context</h3><p>Format rules catch phones, emails, and ID numbers. A language model reads the whole conversation for names, institutions, rare events, and clue combinations, and marks the context worth keeping.</p><span className="role">Rules + Claude Haiku (pipeline design)</span></div>
            <div className="card reveal"><span className="step-n">02 · Transform</span><h3>Minimal, span-level edits</h3><p>Code masks, pseudonymizes, or generalizes only the planned spans. The same person gets the same token everywhere. No free rewriting, so a nurse never becomes a teacher.</p><span className="role">Deterministic code</span></div>
            <div className="card reveal"><span className="step-n">03 · Verify</span><h3>Independent checks</h3><p>Re-scan the output, ask narrow questions about residual clues and preserved meaning, and test whether a synthetic candidate can be linked.</p><span className="role">Rules + TypeSafe Jev (pipeline design)</span></div>
            <div className="card reveal"><span className="step-n">04 · Package</span><h3>Evaluation-ready records</h3><p>Each record ships with its transformation log, verification report, evaluation dimensions, and provenance.</p><span className="role">JSON per conversation</span></div>
            <div className="card dark wide reveal">
              <p className="quote">“We never call a dataset anonymous.”</p>
              <p>We report what was checked, what remains, and what needs a human. A strong privacy result can&apos;t hide a meaning failure, and the reverse is also true. The two are scored separately.</p>
            </div>
            <div className="card wide reveal">
              <h3>Code decides the outcome, not a model&apos;s overall opinion</h3>
              <div className="states">
                <div className="state"><code className="s-pass">demo_checks_passed</code><span>Every required check ran and passed the defined policy. This is not a certification.</span></div>
                <div className="state"><code className="s-review">needs_review</code><span>The result is uncertain, the checks conflict, or a check didn&apos;t run. A human decides.</span></div>
                <div className="state"><code className="s-block">blocked</code><span>An identifier leaked or required context was contradicted. The output is held.</span></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* DEMO TEASER */}
      <section className="teaser-sec">
        <div className="wrap teaser">
          <div>
            <p className="eyebrow reveal">Interactive demo</p>
            <h2 className="reveal">Watch a session go <em>through the pipeline.</em></h2>
            <p className="lede reveal">Two synthetic counseling sessions. Process them, inspect every change, and download the record a buyer would receive.</p>
            <ol className="reveal">
              <li>Pick a case and run the transformation plan</li>
              <li>Click any span to see what changed and why</li>
              <li>Review checks, context, and the final status</li>
              <li>Export the buyer-facing JSON</li>
            </ol>
            <Link className="btn btn-primary reveal" href="/demo">Open the demo <span aria-hidden="true">→</span></Link>
          </div>
          <Link className="peek reveal" href="/demo" aria-label="Open the interactive demo">
            <div className="panes">
              <div className="pane"><h4>Original <span className="badge">synthetic</span></h4><Transcript c={peekCase} processed={false} /></div>
              <div className="pane"><h4>Processed <span className="badge">plan applied</span></h4><Transcript c={peekCase} processed /></div>
            </div>
            <div className="peek-foot"><code>{peek.status}</code><span>{peek.flags.length} span routed to a human</span><b>Open demo →</b></div>
          </Link>
        </div>
      </section>

      {/* DATASET */}
      <section id="dataset" className="darksec">
        <div className="wrap">
          <p className="eyebrow reveal">The product</p>
          <h2 className="reveal">What an AI data buyer <em>actually receives.</em></h2>
          <p className="lede reveal">A licensed dataset of processed conversations, each paired with what it can evaluate and evidence of how it was made.</p>
          <div className="ds">
            <div className="reveal">
              <ul className="ds-list">
                <li><b>Processed conversations</b><span>Speaker-attributed turns, with consistent pseudonyms across the whole delivery.</span></li>
                <li><b>Evaluation dimensions</b><span>What each conversation can test, such as empathic response, risk-signal recognition, and follow-up quality, plus the context that supports it.</span></li>
                <li><b>Transformation log</b><span>The entity type, method, and reason for every change. The original string is never included.</span></li>
                <li><b>Verification report</b><span>Which checks ran, failed, or were skipped. Residual flags and a final status.</span></li>
                <li><b>Provenance</b><span>Legal basis, source state, policy and model versions, and review history.</span></li>
              </ul>
              <div className="never"><b>Never included:</b> raw transcripts, re-identification maps, original identifiers, audio or voiceprints, internal review notes.</div>
            </div>
            <div className="code reveal">
              <div className="code-h"><span>synthetic-A.json</span><span>generated by the demo pipeline</span></div>
              <pre dangerouslySetInnerHTML={{ __html: highlightJson(JSON.stringify(build(CASES[0]), null, 2)) }} />
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
              <p>Safe Harbor strips dates, sub-state geography, and unique characteristics, which is exactly the context evaluations need. Under Expert Determination, a qualified expert can approve richer data for a defined recipient. Sotto&apos;s transformation logs, residual-risk flags, and review records are designed to give that expert evidence they can work with.</p>
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
              <ul><li>Legal basis and source state</li><li>Consent version or determination ID, with expiry</li><li>Exclusion filters and rule versions</li><li>Reviewer sign-off</li></ul>
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
            <div className="now"><span className="when">Now</span><h3>Prototype</h3><ul><li>Synthetic conversations</li><li>Span-level transforms with consistent pseudonyms</li><li>Live rule re-scan, review states, JSON export</li></ul></div>
            <div><span className="when">Next</span><h3>Validate</h3><ul><li>Interviews with U.S. AI training and evaluation data buyers on use cases, formats, and quality bar</li><li>Provider interviews on rights and data shape</li><li>Clinical criteria for meaning loss</li><li>Live Haiku planning and Jev checks, measured on labeled cases</li></ul></div>
            <div><span className="when">Then</span><h3>Pilot</h3><ul><li>One state, one provider, proper agreements</li><li>Expert Determination on a small dataset</li><li>Measure detection recall, residual leakage, and context loss</li></ul></div>
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
            <details><summary>Is the output anonymous?</summary><p>We don&apos;t use that word, and nobody selling health data should. Sotto reduces exposure risk, documents every change, and reports what remains. Whether a real dataset can be released is decided by a qualified expert under HIPAA&apos;s Expert Determination, for a defined recipient.</p></details>
            <details><summary>Is the demo calling Claude or Jev?</summary><p>No. In this build, each synthetic case has a transformation plan written in advance and a context review written by a person. Applying the plan and running the rule re-scan are real code executing in your browser. Every result is labeled with how it was produced.</p></details>
            <details><summary>Where would real data come from?</summary><p>There are two paths, and both license only de-identified outputs. The first is existing records de-identified under Expert Determination with provider partners. The second is new sessions collected with written authorization from clients and counselors. No provider partnerships are in place yet. Establishing them is the next stage.</p></details>
            <details><summary>Who buys this?</summary><p>Our hypothesis is U.S. companies that build AI training and evaluation datasets, and teams evaluating models on mental-health-adjacent conversations: empathy, risk-signal recognition, and follow-up questioning. We&apos;re testing this hypothesis with buyer interviews before we set pricing.</p></details>
            <details><summary>What does “demo_checks_passed” mean?</summary><p>It means the defined demo checks ran and passed, and nothing more. It is not a certification, a release approval, or a guarantee against re-identification. A check that errors, times out, or doesn&apos;t run never counts as a pass.</p></details>
          </div>
        </div>
      </section>

      {/* CLOSING */}
      <section className="closing">
        <div className="wrap">
          <h2>Protect identity.<br /><em>Preserve meaning.</em></h2>
          <p>Evaluation data for mental health AI, with every check it ran and every check it didn&apos;t run on the record.</p>
          <div className="ctas">
            <Link className="btn btn-primary" href="/demo">Open the demo <span aria-hidden="true">→</span></Link>
            <a className="btn btn-ghost" href="#top">Back to top</a>
          </div>
        </div>
      </section>
    </>
  );
}
