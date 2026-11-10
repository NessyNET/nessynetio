// "Did you mean" paths for the 404 page (R23, ux 4.5). No DOM, no Node APIs.

/** Edit distance using two rolling rows. */
export function levenshtein(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min((prev[j] ?? 0) + 1, (cur[j - 1] ?? 0) + 1, (prev[j - 1] ?? 0) + cost);
    }
    prev = cur;
  }
  return prev[b.length] ?? 0;
}

const normalise = (path: string): string => path.toLowerCase().replace(/\/{2,}/g, '/').replace(/\/$/, '');
const lastSegment = (path: string): string => path.slice(path.lastIndexOf('/') + 1);

export function suggest(badPath: string, knownPaths: readonly string[], max = 3): string[] {
  const bad = normalise(badPath);
  const badLast = lastSegment(bad);
  const limit = Math.max(3, Math.floor(badLast.length / 3));
  return knownPaths
    .map((path) => ({ path, norm: normalise(path) }))
    .filter(({ norm }) => norm !== '')
    .map(({ path, norm }) => ({ path, d: Math.min(levenshtein(bad, norm), levenshtein(badLast, lastSegment(norm))) }))
    .filter(({ d }) => d <= limit)
    .sort((x, y) => x.d - y.d || (x.path < y.path ? -1 : x.path > y.path ? 1 : 0))
    .slice(0, max)
    .map(({ path }) => path);
}
