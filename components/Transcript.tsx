import { segments, type Case } from '@/lib/pipeline';

type Props = {
  c: Case;
  processed: boolean;
  selected?: string | null;
  onSelect?: (id: string) => void; // omit for a static, non-interactive render
};

export default function Transcript({ c, processed, selected, onSelect }: Props) {
  return (
    <>
      {c.turns.map(([who, text], i) => (
        <div key={i} className={`turn ${who}`}>
          <span className="who">{who === 'client' ? 'Client' : 'Counselor'}</span>
          <p>
            {segments(text, c).map((seg, j) => {
              if (seg.kind === 'text') return seg.text;
              if (seg.kind === 'ctx') return <span key={j} className="ctx">{seg.text}</span>;
              const s = seg.span;
              const cls = `tok ${processed ? 'new' : 'id'}${selected === s.id ? ' active' : ''}`;
              const label = processed ? s.to : s.match;
              if (!onSelect) return <span key={j} className={cls}>{label}</span>;
              return (
                <span
                  key={j} role="button" tabIndex={0} className={cls} title={s.type}
                  onClick={() => onSelect(s.id)}
                  onKeyDown={e => {
                    if (e.key !== 'Enter' && e.key !== ' ') return;
                    e.preventDefault();
                    onSelect(s.id);
                  }}
                >{label}</span>
              );
            })}
          </p>
        </div>
      ))}
    </>
  );
}
