import { marksFor, segment, type Sample, type Stage } from '@/lib/samples';

const TITLE = { id: 'Identifier', tag: 'Presidio placeholder', leak: 'Identifier left behind', sur: 'Surrogate' } as const;

export default function MarkedText({ s, stage, text }: { s: Sample; stage: Stage; text: string }) {
  const { terms, tags } = marksFor(s, stage);
  return (
    <>
      {segment(text, terms, tags).map((g, i) =>
        g.mark ? <mark key={i} className={`mk mk-${g.mark}`} title={TITLE[g.mark]}>{g.text}</mark> : g.text,
      )}
    </>
  );
}

export const MarkLegend = ({ stages }: { stages: Stage[] }) => (
  <div className="mk-legend">
    {stages.includes('original') && <span><mark className="mk mk-id">Name</mark>Identifier in the original</span>}
    {stages.includes('stage1') && <span><mark className="mk mk-tag">&lt;PERSON&gt;</mark>Presidio placeholder</span>}
    {stages.includes('stage1') && <span><mark className="mk mk-leak">Name</mark>Identifier left behind</span>}
    {stages.includes('final') && <span><mark className="mk mk-sur">Sam</mark>Surrogate from the sheet</span>}
  </div>
);
