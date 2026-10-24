import type { Metadata } from 'next';
import DemoApp from '@/components/DemoApp';
import { loadSamples } from '@/lib/load-samples';

export const metadata: Metadata = { title: 'Interactive demo' };

export default function DemoPage() {
  const samples = loadSamples();
  return (
    <section className="demo-page">
      <div className="wrap">
        <p className="eyebrow">Interactive demo</p>
        <h1>Three sessions, three versions, one report.</h1>
        <p className="lede">Compare each synthetic therapy session as written, after an off-the-shelf PII scrub, and after Sotto. Then open the evaluation report behind the numbers.</p>
        <div className="notice" role="note">
          <b>Recorded pipeline output on synthetic sessions.</b>{' '}
          Every person, number, and place is invented. The pipeline (Presidio, Claude Sonnet, Claude Haiku) ran offline; nothing is called from your browser. Percentages are Claude Haiku&apos;s probability judgments under these test conditions, not measured real-world re-identification rates.
        </div>
        <DemoApp samples={samples} />
      </div>
    </section>
  );
}
