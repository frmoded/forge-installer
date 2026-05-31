// Install flow: GH API → zip download → vault adapter writes → plugin
// reload. All file-system writes go through Obsidian's
// `app.vault.adapter` so the same code path works on macOS, Windows,
// and Linux (the adapter normalizes path separators internally).
//
// Note on `(app as any).plugins`: Obsidian's public TS types don't
// surface `loadManifests`, `enablePlugin`, `disablePlugin`. They're
// runtime-stable APIs that BRAT, Obsidian Git, Dataview, and many
// others rely on. The `(app as any).plugins` cast is intentional and
// load-bearing; if Obsidian ever surfaces a public equivalent, the
// migration is a one-line type swap.

import { App, Notice, requestUrl } from 'obsidian';
import { unzipSync } from 'fflate';

import { fetchRelease, versionGreater } from './github-release';
import { stripZipTopDir } from './zip-paths';

export { stripZipTopDir };

const PLUGIN_ID = 'forge-client-obsidian';
const PLUGIN_DIR_REL = `.obsidian/plugins/${PLUGIN_ID}`;

export interface InstallResult {
  status: 'installed' | 'updated' | 'up-to-date' | 'error';
  detail: string;
}

export interface InstallOptions {
  pinnedTag?: string;
  silent?: boolean;
}

export async function checkAndInstall(
  app: App,
  options: InstallOptions = {},
): Promise<InstallResult> {
  try {
    const release = await fetchRelease(options.pinnedTag);
    const installed = await readInstalledVersion(app);

    // Up-to-date short-circuit: avoid downloading 11 MB just to write
    // the same bytes back. versionGreater treats equal versions as
    // not-greater, so "release == installed" lands here cleanly.
    if (installed && !versionGreater(release.tag_name, installed)) {
      return {
        status: 'up-to-date',
        detail: `v${installed} is current`,
      };
    }

    const asset = pickReleaseZip(release.assets);
    if (!asset) {
      return {
        status: 'error',
        detail: `No .zip asset on release ${release.tag_name}`,
      };
    }

    if (!options.silent) {
      new Notice(`Forge Installer: downloading ${release.tag_name} (${humanSize(asset.size)})…`);
    }

    const res = await requestUrl({ url: asset.browser_download_url, method: 'GET' });
    const zipBytes = new Uint8Array(res.arrayBuffer);

    const unzipped = unzipSync(zipBytes);
    await writePluginFiles(app, unzipped);
    await activatePlugin(app);

    return {
      status: installed ? 'updated' : 'installed',
      detail: `${installed ?? 'fresh'} → ${release.tag_name}`,
    };
  } catch (e) {
    return {
      status: 'error',
      detail: e instanceof Error ? e.message : String(e),
    };
  }
}

async function readInstalledVersion(app: App): Promise<string | null> {
  const manifestPath = `${PLUGIN_DIR_REL}/manifest.json`;
  if (!(await app.vault.adapter.exists(manifestPath))) return null;
  try {
    const raw = await app.vault.adapter.read(manifestPath);
    const m = JSON.parse(raw);
    return typeof m.version === 'string' ? m.version : null;
  } catch {
    // A corrupt manifest counts as "not installed" — the next install
    // will overwrite cleanly. Don't propagate the parse error; the
    // user-facing failure mode is "install proceeds" not "Notice spam."
    return null;
  }
}

function pickReleaseZip(assets: { name: string; browser_download_url: string; size?: number }[]):
  | { name: string; browser_download_url: string; size?: number }
  | null {
  // Prefer the canonical name shape `forge-client-obsidian-vX.Y.Z.zip`
  // over any other `.zip` so a future release with extra zips
  // (sourcemaps, docs) doesn't trip us. Falls back to the first .zip
  // if the canonical name isn't found.
  const canonical = assets.find((a) => /^forge-client-obsidian-v\d+\.\d+\.\d+\.zip$/.test(a.name));
  if (canonical) return canonical;
  return assets.find((a) => a.name.toLowerCase().endsWith('.zip')) ?? null;
}

/** Write each entry of an unzipped record into the plugin dir. The
 *  release zip's top-level `forge-client-obsidian/` prefix is stripped
 *  so files land at `.obsidian/plugins/forge-client-obsidian/main.js`
 *  rather than nested twice.
 *
 *  Preserves `data.json` across the wipe: that file holds the user's
 *  transpile token + settings, which we MUST NOT lose during an update.
 *  The release zip never contains data.json (it's per-vault state),
 *  so the save-restore sandwich is the right shape. */
export async function writePluginFiles(
  app: App,
  unzipped: Record<string, Uint8Array>,
): Promise<void> {
  let savedData: string | null = null;
  const dataPath = `${PLUGIN_DIR_REL}/data.json`;
  if (await app.vault.adapter.exists(dataPath)) {
    savedData = await app.vault.adapter.read(dataPath);
  }

  if (await app.vault.adapter.exists(PLUGIN_DIR_REL)) {
    // Recursive rmdir — Obsidian's adapter handles the cross-platform
    // walk. Without recursive=true, this fails on non-empty dirs.
    await app.vault.adapter.rmdir(PLUGIN_DIR_REL, true);
  }
  await app.vault.adapter.mkdir(PLUGIN_DIR_REL);

  for (const [path, bytes] of Object.entries(unzipped)) {
    if (path.endsWith('/')) continue;
    const stripped = stripZipTopDir(path);
    if (stripped === '') continue;
    const targetPath = `${PLUGIN_DIR_REL}/${stripped}`;
    await ensureParentDir(app, targetPath);
    await app.vault.adapter.writeBinary(targetPath, bytes.buffer);
  }

  if (savedData !== null) {
    await app.vault.adapter.write(dataPath, savedData);
  }
}

async function ensureParentDir(app: App, fullPath: string): Promise<void> {
  // Walk the path components and mkdir each ancestor that doesn't yet
  // exist. Cheaper to check-then-create per segment than to assume
  // mkdir is recursive on every platform's adapter.
  const lastSlash = fullPath.lastIndexOf('/');
  if (lastSlash <= 0) return;

  const parent = fullPath.slice(0, lastSlash);
  if (await app.vault.adapter.exists(parent)) return;

  // Build up segment by segment so deeply-nested zip entries
  // (assets/pyodide/...) get full ancestor chain.
  const segments = parent.split('/');
  let cursor = '';
  for (const seg of segments) {
    cursor = cursor === '' ? seg : `${cursor}/${seg}`;
    if (!(await app.vault.adapter.exists(cursor))) {
      await app.vault.adapter.mkdir(cursor);
    }
  }
}

async function activatePlugin(app: App): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const plugins = (app as any).plugins;
  if (!plugins) {
    throw new Error('Obsidian plugin manager not available — Forge Installer cannot enable the plugin automatically');
  }

  // If the plugin was already loaded (we just overwrote its files),
  // disable it first so Obsidian re-reads the new main.js + manifest
  // on the subsequent enable. Without the disable, Obsidian keeps the
  // old instance in memory and the user has to manually toggle.
  if (plugins.plugins?.[PLUGIN_ID]) {
    await plugins.disablePlugin(PLUGIN_ID);
  }

  // loadManifests re-scans `.obsidian/plugins/*/manifest.json` so the
  // freshly-written manifest becomes discoverable.
  if (typeof plugins.loadManifests === 'function') {
    await plugins.loadManifests();
  }

  await plugins.enablePlugin(PLUGIN_ID);
}

function humanSize(bytes?: number): string {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes)) return '?';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
