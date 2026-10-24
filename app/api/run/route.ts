import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { loadSamples } from '@/lib/load-samples';

const run = promisify(execFile);
const PIPELINE = join(process.cwd(), 'pipeline');

// POST { id } -> { mode, sample }. Runs pipeline/ (python -m counsel_deid) when PIPELINE_LIVE=1,
// otherwise serves the recorded output of that pipeline from data/examples.jsonl.
// ponytail: one run per click, no queue or cache; add both before turning live mode on for public traffic.
export async function POST(req: Request) {
  const { id } = await req.json().catch(() => ({}));
  const recorded = loadSamples().find(s => s.id === id);
  if (!recorded) return Response.json({ error: `unknown session ${id}` }, { status: 404 });
  if (process.env.PIPELINE_LIVE !== '1') return Response.json({ mode: 'recorded', sample: recorded });

  const dir = await mkdtemp(join(tmpdir(), 'deid-'));
  try {
    const out = join(dir, 'out.jsonl');
    await run(process.env.PIPELINE_PYTHON ?? join(PIPELINE, '.venv/bin/python'),
      ['-m', 'counsel_deid', 'run', '--only', recorded.id, '--out', out], { cwd: PIPELINE, timeout: 10 * 60_000 });
    return Response.json({ mode: 'live', sample: JSON.parse(await readFile(out, 'utf8')) });
  } catch (e) {
    const err = e as { stderr?: string; message: string };
    return Response.json({ error: (err.stderr || err.message).trim().split('\n').pop() }, { status: 502 });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
