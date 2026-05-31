// Pure-core decision: which Obsidian plugin-manager API do we call
// to enable forge-client-obsidian persistently?
//
// History: v0.1.0 used `enablePlugin`, which enables the plugin in
// the current session but doesn't always write the id to
// `.obsidian/community-plugins.json`. On reload, Obsidian re-reads
// that file, sees the id missing, and doesn't enable the plugin —
// the install evaporates between sessions. Surfaced during first
// closed-beta smoke; v0.1.1 swaps to the persisting variant.
//
// `enablePluginAndSave` is present in Obsidian 1.4+. forge-installer's
// manifest targets minAppVersion 1.4.0, so it should always be
// available. The fallback exists as belt-and-suspenders so a
// hypothetical regression in a future Obsidian point release
// (rename, removal) doesn't silently revert v0.1.1 to v0.1.0's bug
// class without us noticing.
//
// Pure-core lives here so `node --test` can exercise it without an
// obsidian shim (same pattern as version.ts and zip-paths.ts).

export type EnableStrategy = 'enablePluginAndSave' | 'enablePluginWithSaveData';

/** Choose which enable-and-persist call to make against the
 *  Obsidian plugins manager. Accepts a duck-typed object so callers
 *  (installer.ts) can pass `(app as any).plugins` directly and tests
 *  can pass minimal stubs.
 *
 *  - `'enablePluginAndSave'` — single-call API; preferred when
 *    present.
 *  - `'enablePluginWithSaveData'` — fallback: call `enablePlugin`,
 *    then `saveData` to flush the enabled-plugins list to disk.
 *    Only fires when `enablePluginAndSave` is missing AND the
 *    fallback shape is intact.
 *
 *  Returns null when neither shape is present — caller should error
 *  with a clear message rather than silently swallow. */
export function selectEnableStrategy(
  plugins: unknown,
): EnableStrategy | null {
  if (plugins === null || typeof plugins !== 'object') return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = plugins as any;

  if (typeof p.enablePluginAndSave === 'function') {
    return 'enablePluginAndSave';
  }

  if (typeof p.enablePlugin === 'function' && typeof p.saveData === 'function') {
    return 'enablePluginWithSaveData';
  }

  return null;
}
