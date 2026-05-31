// forge-installer plugin entry.
//
// Layout mirrors the forge-client-obsidian repo's scaffold so future
// maintenance lands in familiar shapes — single onload, single
// settings tab, single command for explicit runs.
//
// Side effects on onload:
//   1. Settings load (creates DEFAULT_SETTINGS on first run).
//   2. Settings tab registers.
//   3. Auto-run install check. Idempotent — if forge-client-obsidian
//      is already at the latest release, runInstall short-circuits
//      to an "up to date" Notice without downloading anything.
//   4. Optional self-disable if the user set
//      `disableAfterFirstInstall` and we just fresh-installed.

import { App, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { checkAndInstall, InstallResult } from './installer';

interface ForgeInstallerSettings {
  /** Override the auto-resolved "latest" release with a specific tag
   *  (e.g. "v0.2.12"). Empty string means use latest. Trimmed on
   *  save; surfaces as a hint in the settings tab's description. */
  pinnedTag: string;
  /** Self-disable the installer after a successful fresh-install.
   *  Default OFF so the user can keep triggering update checks
   *  without re-enabling. Mostly useful for the "I never want to see
   *  this plugin again, just bootstrap forge-client and vanish"
   *  flow. */
  disableAfterFirstInstall: boolean;
}

const DEFAULT_SETTINGS: ForgeInstallerSettings = {
  pinnedTag: '',
  disableAfterFirstInstall: false,
};

export default class ForgeInstaller extends Plugin {
  settings!: ForgeInstallerSettings;

  async onload() {
    await this.loadSettings();
    this.addSettingTab(new ForgeInstallerSettingTab(this.app, this));

    this.addCommand({
      id: 'forge-installer-check-now',
      name: 'Check for Forge Client updates now',
      callback: () => this.runInstall(),
    });

    // Auto-run once per plugin enable. Skip on the very first
    // microtask so Obsidian's UI has paint cycles before the
    // download Notice fires; cosmetic, but the welcome flow looks
    // less abrupt this way.
    queueMicrotask(() => { void this.runInstall(); });
  }

  async runInstall(): Promise<void> {
    let result: InstallResult;
    try {
      result = await checkAndInstall(this.app, {
        pinnedTag: this.settings.pinnedTag || undefined,
        silent: false,
      });
    } catch (e) {
      // checkAndInstall catches its own errors and returns an error
      // envelope, but defensive: a thrown error here shouldn't take
      // down onload.
      console.error('Forge Installer: unexpected throw', e);
      new Notice(`Forge Installer failed: ${e instanceof Error ? e.message : String(e)}`);
      return;
    }

    switch (result.status) {
      case 'up-to-date':
        new Notice(`Forge Client is up to date — ${result.detail}`);
        break;
      case 'installed':
        new Notice(`Forge Client installed — ${result.detail}`, 8000);
        if (this.settings.disableAfterFirstInstall) {
          // The user opted in; honor it. They can re-enable later
          // for an update by toggling in Community plugins.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (this.app as any).plugins.disablePlugin(this.manifest.id);
        }
        break;
      case 'updated':
        new Notice(`Forge Client updated — ${result.detail}`, 8000);
        break;
      case 'error':
        console.error('Forge Installer failed:', result.detail);
        new Notice(`Forge Installer failed: ${result.detail}`, 10000);
        break;
    }
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }
}

class ForgeInstallerSettingTab extends PluginSettingTab {
  constructor(app: App, private plugin: ForgeInstaller) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl('h2', { text: 'Forge Installer' });

    containerEl.createEl('p', {
      text: 'This plugin downloads and installs Forge Client from GitHub Releases. '
        + 'Use "Check for Forge Client updates now" (Cmd-P) to re-run on demand.',
    });

    new Setting(containerEl)
      .setName('Pin to specific version')
      .setDesc('Leave empty for latest. Example: v0.2.12. Pinning is useful for cohort-wide rollback to a known-good release.')
      .addText((t) =>
        t
          .setPlaceholder('latest')
          .setValue(this.plugin.settings.pinnedTag)
          .onChange(async (v) => {
            this.plugin.settings.pinnedTag = v.trim();
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName('Disable this installer after first install')
      .setDesc('Once Forge Client is installed, the installer disables itself. Re-enable in Community plugins to run an update later.')
      .addToggle((t) =>
        t
          .setValue(this.plugin.settings.disableAfterFirstInstall)
          .onChange(async (v) => {
            this.plugin.settings.disableAfterFirstInstall = v;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .addButton((b) =>
        b
          .setButtonText('Check for updates now')
          .setCta()
          .onClick(() => this.plugin.runInstall()),
      );
  }
}
