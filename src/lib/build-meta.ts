// `dist/.build-meta.json` (design 3.4, 3.6.4, 3.6.5). `isReleasable` is the TypeScript twin of the
// server-side `activate` check (bash + python3, task 032); keep the two in step.
import { z } from 'zod';

export interface BuildMeta {
  readonly strict: boolean;
  readonly samplesAllowed: boolean;
  /** Full 40-hex SHA, or "unknown" outside git. */
  readonly commit: string;
  /** "main" only for release builds. */
  readonly ref: string;
  readonly source: 'local' | 'ci';
  readonly dirty: boolean;
  readonly builtAt: string;
  readonly astroVersion: string;
}

const buildMetaSchema = z.object({
  strict: z.boolean(),
  samplesAllowed: z.boolean(),
  commit: z.string(),
  ref: z.string(),
  source: z.enum(['local', 'ci']),
  dirty: z.boolean(),
  builtAt: z.string(),
  astroVersion: z.string(),
}) satisfies z.ZodType<BuildMeta>;

export function parseBuildMeta(json: unknown): BuildMeta {
  const result = buildMetaSchema.safeParse(json);
  if (result.success) return result.data;
  const problems = result.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`);
  throw new Error(`Invalid .build-meta.json: ${problems.join('; ')}`);
}

const RELEASE_ID = /^[0-9]{8}T[0-9]{6}Z-([0-9a-f]{7,12})$/;
const FULL_SHA = /^[0-9a-f]{40}$/;

export function isReleasable(meta: BuildMeta, releaseId: string): boolean {
  const shortSha = RELEASE_ID.exec(releaseId)?.[1];
  return (
    shortSha !== undefined &&
    meta.strict &&
    !meta.samplesAllowed &&
    meta.ref === 'main' &&
    FULL_SHA.test(meta.commit) &&
    meta.commit.startsWith(shortSha)
  );
}
