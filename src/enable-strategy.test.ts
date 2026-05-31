// Pure-core tests for the enable-strategy decision. Catches future
// Obsidian API renames / removals at suite time rather than at the
// student's reload-after-install moment.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectEnableStrategy } from './enable-strategy.ts';

test('selectEnableStrategy: prefers enablePluginAndSave when present', () => {
  // Standard Obsidian 1.4+ shape. Both APIs are present; we should
  // pick the single-call one because it's the documented persistence
  // contract and avoids the two-call race in the fallback path.
  const plugins = {
    enablePluginAndSave: async (_id: string) => {},
    enablePlugin: async (_id: string) => {},
    saveData: async () => {},
  };
  assert.equal(selectEnableStrategy(plugins), 'enablePluginAndSave');
});

test('selectEnableStrategy: falls back when enablePluginAndSave missing', () => {
  // Hypothetical future Obsidian release that drops or renames the
  // single-call API but keeps the older enablePlugin + saveData pair.
  // The fallback exists exactly for this — we shouldn't silently
  // regress to v0.1.0's no-persist bug.
  const plugins = {
    enablePlugin: async (_id: string) => {},
    saveData: async () => {},
  };
  assert.equal(selectEnableStrategy(plugins), 'enablePluginWithSaveData');
});

test('selectEnableStrategy: returns null when neither shape is present', () => {
  // Caller is expected to throw a clear error rather than silently
  // skipping — surfacing as a user-facing Notice is much better than
  // a phantom install that vanishes on reload.
  const plugins = {};
  assert.equal(selectEnableStrategy(plugins), null);
});

test('selectEnableStrategy: enablePlugin alone (no saveData) is not enough', () => {
  // The fallback REQUIRES saveData. enablePlugin alone is the v0.1.0
  // bug class — enables current session, doesn't persist. Treat it as
  // "no usable strategy" so the caller errors out.
  const plugins = {
    enablePlugin: async (_id: string) => {},
  };
  assert.equal(selectEnableStrategy(plugins), null);
});

test('selectEnableStrategy: saveData alone (no enablePlugin) is not enough', () => {
  // Defensive — saveData without enablePlugin is nonsensical, but
  // verify the decision is null rather than something undefined.
  const plugins = {
    saveData: async () => {},
  };
  assert.equal(selectEnableStrategy(plugins), null);
});

test('selectEnableStrategy: non-function fields are rejected', () => {
  // typeof check guards against future Obsidian releases that change
  // the field shape (e.g., a config object rather than a function).
  const plugins = {
    enablePluginAndSave: 'not a function',
    enablePlugin: 42,
    saveData: { value: true },
  };
  assert.equal(selectEnableStrategy(plugins), null);
});

test('selectEnableStrategy: null input returns null', () => {
  assert.equal(selectEnableStrategy(null), null);
});

test('selectEnableStrategy: non-object inputs return null', () => {
  // Defensive against the caller passing something they thought was
  // (app as any).plugins but actually wasn't.
  assert.equal(selectEnableStrategy(undefined), null);
  assert.equal(selectEnableStrategy('plugins'), null);
  assert.equal(selectEnableStrategy(42), null);
  assert.equal(selectEnableStrategy([]), null);
  // Note: [] is typeof 'object' so the function-presence check kicks
  // in next — empty array has no enablePluginAndSave/enablePlugin, so
  // null falls through naturally.
});
