import type { Metadata } from 'next';
import DemoApp from '@/components/DemoApp';

export const metadata: Metadata = { title: 'Interactive demo' };

export default function DemoPage() {
  return (
    <section className="demo-page">
      <div className="wrap">
        <p className="eyebrow">Interactive demo</p>
        <h1>Run a conversation through the pipeline.</h1>
        <p className="lede">Pick a synthetic case and process it. Click any highlighted span to see what changed and why, then export the record a buyer would receive.</p>
        <div className="notice" role="note">
          <b>Preconfigured demo result.</b>{' '}
          <span>Each case&apos;s transformation plan was written in advance and stands in for model proposals. Applying the plan and the rule re-scan run live in your browser. No model is called.</span>
        </div>

        <DemoApp />

        <div className="howto">
          <div><h3>1 · Process</h3><p>Code applies the transformation plan span by span. The same person gets the same token in every turn.</p></div>
          <div><h3>2 · Inspect</h3><p>Every change shows its type, method, and reason. Context reviews and checks are labeled with how they were produced.</p></div>
          <div><h3>3 · Export</h3><p>Download the buyer-facing JSON: processed text, transformation log, verification report, and evaluation dimensions.</p></div>
        </div>
      </div>
    </section>
  );
}
