// Diagnostic shape, rules-table shape and print format (design 3.4, 3.5.2; plan section 4).

export type Level = 'error' | 'warning' | 'note';

export interface Diagnostic {
  readonly code: string;
  readonly level: Level;
  readonly file: string;
  readonly entry?: string;
  readonly field?: string;
  readonly message: string;
}

/** One row of the rules table (`rules.ts`, task 008). */
export interface Rule {
  readonly code: string;
  readonly local: Level;
  readonly strict: Level;
  /** For `sample = true` entities: a warning even under strict when samples are allowed (design 3.3). */
  readonly sampleExempt?: boolean;
  /** Quotes the ux 7.12 validation row or brief row this rule implements. */
  readonly uxRow: string;
  readonly message: (ctx: Record<string, string>) => string;
}

export interface LevelContext {
  readonly strict: boolean;
  readonly allowSamples: boolean;
  readonly isSample: boolean;
}

export function resolveLevel(rule: Rule, { strict, allowSamples, isSample }: LevelContext): Level {
  if (rule.sampleExempt === true && strict && allowSamples && isSample) return 'warning';
  return strict ? rule.strict : rule.local;
}

/** `LEVEL <file> [<entry>] <field>: <message>`; entry and field are omitted when absent. */
export function formatDiagnostic(d: Diagnostic): string {
  const where = [d.file, d.entry === undefined ? undefined : `[${d.entry}]`, d.field].filter(
    (part) => part !== undefined,
  );
  return `${d.level.toUpperCase()} ${where.join(' ')}: ${d.message}`;
}

export function hasErrors(ds: readonly Diagnostic[]): boolean {
  return ds.some((d) => d.level === 'error');
}
