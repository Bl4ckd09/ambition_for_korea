import type { Metadata } from 'next';
import DemoApp from '@/components/DemoApp';
import Team from '@/components/Team';
import { loadSamples } from '@/lib/load-samples';

export const metadata: Metadata = { title: 'Demo' };

export default function DemoPage() {
  return (
    <section className="demo-page">
      <div className="wrap">
        <p className="eyebrow">Our team</p>
        <Team />
        <h1>Demo</h1>
        <DemoApp samples={loadSamples()} />
      </div>
    </section>
  );
}
