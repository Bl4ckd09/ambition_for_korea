import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Sample } from './samples';

// ponytail: read at build time from the pipeline's JSONL output; move to an API once runs are live.
export const loadSamples = (): Sample[] =>
  readFileSync(join(process.cwd(), 'data/examples.jsonl'), 'utf8')
    .split('\n')
    .filter(line => line.trim())
    .map(line => JSON.parse(line));
