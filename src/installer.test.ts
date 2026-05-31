// Pure-core tests for the zip-path stripper. The download / write /
// activate paths are obsidian-API-coupled and exercised by the
// manual smoke step in the originating prompt; only the
// canonicalization helper is testable without a shim.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stripZipTopDir } from './zip-paths.ts';

test('stripZipTopDir: standard release-zip layout', () => {
  // Release zip's top-level entry is `forge-client-obsidian/` —
  // strip it so files land at the plugin dir root, not nested twice.
  assert.equal(stripZipTopDir('forge-client-obsidian/main.js'), 'main.js');
  assert.equal(stripZipTopDir('forge-client-obsidian/manifest.json'), 'manifest.json');
});

test('stripZipTopDir: nested asset paths', () => {
  // The 11 MB Pyodide bundle lives under assets/pyodide/. The
  // stripper only touches the top dir; nested structure is preserved
  // verbatim so writePluginFiles' mkdir-p loop sees the right ancestry.
  assert.equal(
    stripZipTopDir('forge-client-obsidian/assets/pyodide/pyodide.asm.wasm'),
    'assets/pyodide/pyodide.asm.wasm',
  );
  assert.equal(
    stripZipTopDir('forge-client-obsidian/assets/iframe/index.html'),
    'assets/iframe/index.html',
  );
  assert.equal(
    stripZipTopDir('forge-client-obsidian/assets/engine/forge/core/executor.py'),
    'assets/engine/forge/core/executor.py',
  );
});

test('stripZipTopDir: zip with no top-level dir is a no-op', () => {
  // Defensive — if a future release-zip script changes its layout to
  // omit the top-level dir, the stripper must not corrupt paths by
  // assuming the prefix was always present.
  assert.equal(stripZipTopDir('main.js'), 'main.js');
  assert.equal(stripZipTopDir('assets/pyodide/x.wasm'), 'assets/pyodide/x.wasm');
});

test('stripZipTopDir: unrelated top-level dir is not stripped', () => {
  // The regex is anchored to the EXACT `forge-client-obsidian/`
  // prefix. A misnamed zip should NOT silently mangle its contents.
  assert.equal(
    stripZipTopDir('forge-installer/main.js'),
    'forge-installer/main.js',
  );
  assert.equal(
    stripZipTopDir('forge-client-obsidian-staging/main.js'),
    'forge-client-obsidian-staging/main.js',
  );
});

test('stripZipTopDir: only the FIRST occurrence is stripped', () => {
  // A path like `forge-client-obsidian/forge-client-obsidian/main.js`
  // (already-nested zip) should retain the inner dir, not collapse
  // both. The regex is `/^forge-client-obsidian\//` — anchored, single
  // match.
  assert.equal(
    stripZipTopDir('forge-client-obsidian/forge-client-obsidian/main.js'),
    'forge-client-obsidian/main.js',
  );
});
