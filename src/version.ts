// Pure-core version comparator. Lives in its own file so
// `node --test` can import it without pulling the obsidian package
// (which is a types-only stub and fails at runtime when node tries
// to resolve it for ESM).

/** Strict semver-ish comparison: returns true iff a > b.
 *
 *  Tolerates leading 'v' on either side. Compares the first three
 *  numeric segments. Missing segments coerce to 0
 *  (so "1.0" === "1.0.0"). Trailing pre-release / build suffix
 *  ("-beta.1", "+build42") is stripped before parsing — release-zip
 *  tags don't use them, and a future migration to per-channel tags
 *  shouldn't break the comparator silently.
 *
 *  Malformed input that can't yield a number for any segment is
 *  treated as 0 for that segment — defensive rather than throwing,
 *  because the caller's fallback ("show 'unknown' and skip update")
 *  is more useful than an exception bubbling to a Notice. */
export function versionGreater(a: string, b: string): boolean {
  const parse = (s: string): number[] => {
    const norm = s.replace(/^v/, '').split(/[-+]/, 1)[0];
    const parts = norm.split('.').map((p) => {
      const n = Number(p);
      return Number.isFinite(n) ? n : 0;
    });
    return parts;
  };

  const aP = parse(a);
  const bP = parse(b);

  for (let i = 0; i < 3; i++) {
    const av = aP[i] ?? 0;
    const bv = bP[i] ?? 0;
    if (av > bv) return true;
    if (av < bv) return false;
  }
  return false;
}
