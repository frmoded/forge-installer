// Pure-core tests for the version comparator. No Obsidian dep —
// `node --test` runs these without a shim.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { versionGreater } from './version.ts';

test('versionGreater: v-prefixed strict increment', () => {
  assert.equal(versionGreater('v0.2.12', 'v0.2.11'), true);
  assert.equal(versionGreater('v0.2.11', 'v0.2.12'), false);
});

test('versionGreater: bare semver', () => {
  assert.equal(versionGreater('0.2.12', '0.2.11'), true);
  assert.equal(versionGreater('0.2.11', '0.2.12'), false);
});

test('versionGreater: mixed v-prefix and bare', () => {
  // Closed-beta release tags use 'v' but a manifest.json's version
  // field uses bare. The comparator must normalize across both.
  assert.equal(versionGreater('v0.2.12', '0.2.11'), true);
  assert.equal(versionGreater('0.2.12', 'v0.2.11'), true);
});

test('versionGreater: equal versions return false', () => {
  // The up-to-date short-circuit in checkAndInstall relies on
  // equality NOT being greater — otherwise we'd re-download the same
  // 11 MB zip on every Obsidian startup.
  assert.equal(versionGreater('v0.2.12', 'v0.2.12'), false);
  assert.equal(versionGreater('0.2.12', '0.2.12'), false);
});

test('versionGreater: major bump beats large minor', () => {
  assert.equal(versionGreater('1.0.0', '0.99.99'), true);
  assert.equal(versionGreater('0.99.99', '1.0.0'), false);
});

test('versionGreater: minor bump beats large patch', () => {
  assert.equal(versionGreater('0.3.0', '0.2.99'), true);
});

test('versionGreater: missing patch segment coerces to 0', () => {
  // "0.2" should compare equal to "0.2.0".
  assert.equal(versionGreater('0.2', '0.2.0'), false);
  assert.equal(versionGreater('0.2.0', '0.2'), false);
  // And both should be < 0.2.1.
  assert.equal(versionGreater('0.2.1', '0.2'), true);
});

test('versionGreater: pre-release suffix is stripped before parsing', () => {
  // Release-zip tags don't use these today but a future migration
  // to per-channel tags shouldn't break the comparator silently.
  assert.equal(versionGreater('0.3.0-beta.1', '0.2.99'), true);
  assert.equal(versionGreater('0.2.12+build.42', '0.2.11'), true);
});

test('versionGreater: malformed input degrades gracefully', () => {
  // The caller's fallback ("show 'unknown' and skip update") is
  // more useful than an exception bubbling to a Notice. Confirm
  // we don't throw on garbage input.
  assert.doesNotThrow(() => versionGreater('not-a-version', '0.0.0'));
  assert.doesNotThrow(() => versionGreater('0.0.0', 'not-a-version'));
  // "not-a-version" parses as [NaN→0, ...] so comparator treats both
  // segments as 0 — comparison returns false either way. Documented
  // behavior; verified rather than asserted as a contract.
});

test('versionGreater: empty string treated as 0.0.0', () => {
  assert.equal(versionGreater('0.0.1', ''), true);
  assert.equal(versionGreater('', '0.0.1'), false);
});
