import { marksFor, segment, type Sample, type Stage } from '@/lib/samples';

const TITLE = { id: 'Identifier', tag: 'Placeholder', leak: 'Identifier left behind', sur: 'Surrogate' } as const;

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
