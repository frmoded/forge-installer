// GitHub Releases API client. Unauthenticated — 60 requests/hour
// per IP is plenty for the closed-beta install flow (each Obsidian
// session makes at most one call).
//
// If we ever cross that rate-limit boundary, the migration path is
// to add an optional PAT field in settings, sent as
// `Authorization: token <PAT>` — but for closed beta the simpler
// shape is correct.

import { requestUrl } from 'obsidian';

export { versionGreater } from './version';

const REPO = 'frmoded/forge-client-obsidian';

export interface ReleaseAsset {
  name: string;
  browser_download_url: string;
  size?: number;
}

export interface Release {
  tag_name: string;
  assets: ReleaseAsset[];
}

export async function fetchRelease(pinnedTag?: string): Promise<Release> {
  // GitHub's API distinguishes "latest" (highest non-prerelease,
  // non-draft) from a specific tag lookup. We use the explicit
  // tag-lookup form whenever the user pins.
  const url = pinnedTag
    ? `https://api.github.com/repos/${REPO}/releases/tags/${pinnedTag}`
    : `https://api.github.com/repos/${REPO}/releases/latest`;

  const res = await requestUrl({ url, method: 'GET', throw: false });

  if (res.status !== 200) {
    // Decode the GitHub error body so the user gets the real reason
    // (rate limit, not-found, etc.) rather than a bare status code.
    const detail = (res.json && typeof res.json.message === 'string')
      ? res.json.message
      : `HTTP ${res.status}`;
    throw new Error(`GitHub API: ${detail}`);
  }

  return res.json as Release;
}

