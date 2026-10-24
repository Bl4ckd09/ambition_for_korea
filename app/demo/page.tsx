import type { Metadata } from 'next';
import DemoApp from '@/components/DemoApp';
import { loadSamples } from '@/lib/load-samples';

export const metadata: Metadata = { title: 'Demo' };

export default function DemoPage() {
  return (
    <section className="demo-page">
      <div className="wrap">
        <p className="eyebrow">Demo · synthetic sessions</p>
        <h1>Watch a session change, stage by stage.</h1>
        <DemoApp samples={loadSamples()} />
      </div>
    </section>
  );
}
