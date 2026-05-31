// Pure-core zip-path canonicalization. Split out of installer.ts so
// `node --test` can exercise it without pulling the obsidian package.

const ZIP_TOP_DIR_RE = /^forge-client-obsidian\//;

/** Strip the top-level `forge-client-obsidian/` directory from a zip
 *  entry path. The release zip's standard layout nests every file
 *  under that directory; the installer writes them at the plugin dir
 *  root, so the prefix has to come off first.
 *
 *  Exported for testing because zip layout drift would silently break
 *  the strip and produce nested `plugins/forge-client-obsidian/forge-client-obsidian/main.js`
 *  installs that don't load. The regex is anchored to the EXACT
 *  prefix — misnamed zips (e.g. forge-client-obsidian-staging/) pass
 *  through untouched rather than getting half-mangled. */
export function stripZipTopDir(path: string): string {
  return path.replace(ZIP_TOP_DIR_RE, '');
}
