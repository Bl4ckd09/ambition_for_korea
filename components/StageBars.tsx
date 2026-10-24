import { STAGES, STAGE_LABEL, type Stage } from '@/lib/samples';

type Props = {
  values: Partial<Record<Stage, number>>;
  format: (v: number) => string;
  max?: number;
  chance?: number; // draws a reference line, e.g. 10% in a 10-profile lineup
  compact?: boolean;
};

// Emphasis bars: Into the Unknown in the accent, original and baseline in grays. Every bar is labeled.
export default function StageBars({ values, format, max = 1, chance, compact }: Props) {
  return (
    <div className={`bars${compact ? ' compact' : ''}`}>
      {STAGES.filter(st => values[st] !== undefined).map(st => {
        const v = values[st]!;
        return (
          <div key={st} className={`bar-row s-${st}`} title={`${STAGE_LABEL[st]}: ${format(v)}`}>
            <span className="bar-label">{STAGE_LABEL[st]}</span>
            <span className="bar-track">
              <i style={{ width: `${Math.max((v / max) * 100, 0.5)}%` }} />
              {chance !== undefined && <b className="chance" style={{ left: `${(chance / max) * 100}%` }} />}
            </span>
            <span className="bar-value">{format(v)}</span>
          </div>
        );
      })}
    </div>
  );
}
