# Forge Installer

One-paste BRAT-installable bootstrap for the
[Forge Client](https://github.com/frmoded/forge-client-obsidian)
Obsidian plugin.

Forge Client ships ~11 MB of assets (Pyodide WASM, bundled engine,
iframe) that BRAT can't carry. This plugin is a few KB of code that
BRAT *can* carry; on enable it downloads the latest Forge Client
release zip from GitHub, unpacks it into
`.obsidian/plugins/forge-client-obsidian/`, and activates the plugin.

## Install via BRAT

1. In Obsidian, install **BRAT** (Beta Reviewer's Auto-update Tool)
   from Community plugins.
2. **Cmd-P** → **BRAT: Add a beta plugin to install**.
3. Paste `frmoded/forge-installer` and confirm.
4. Forge Installer auto-runs on enable. After ~30 seconds you'll
   see "Forge Client installed — fresh → vX.Y.Z".
5. Reload Obsidian (**Cmd-P** → "Reload app without saving").
6. Paste your transpile token in **Settings → Forge → Transpile
   service → Transpile service token**.

That's it.

## Settings

- **Pin to specific version** — leave empty for latest. Useful for
  cohort-wide rollback to a known-good release (e.g. `v0.2.12`).
- **Disable this installer after first install** — opt-in
  self-disable after a clean fresh-install. Off by default so you
  can keep running update checks without re-enabling.

## Re-running

To check for updates manually: **Cmd-P** → **"Check for Forge Client
updates now"**, or click the button in the installer's settings tab.

## What about data.json?

Your Forge Client settings (transpile token, etc.) are stored in
`.obsidian/plugins/forge-client-obsidian/data.json`. The installer
**preserves data.json across updates** — your token won't disappear
on an upgrade. The release zip never contains data.json (it's
per-vault state).

## License

MIT, matching Forge Client.
