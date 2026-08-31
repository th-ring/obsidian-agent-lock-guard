import { App, PluginSettingTab, Setting } from "obsidian";
import type AgentLockGuardPlugin from "./main";

export class AgentLockSettingTab extends PluginSettingTab {
  plugin: AgentLockGuardPlugin;

  constructor(app: App, plugin: AgentLockGuardPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "🛡️ Agent Lock Guard Einstellungen" });
    containerEl.createEl("p", {
      cls: "setting-item-description",
      text: "Multi-Agent Concurrency Control, Live In-Note Locking Banners und Kollisionsschutz für Obsidian WorkOS.",
    });

    // --------------------------------------------------------------------------
    // 1. SPERR- & SICHERHEITSVERHALTEN
    // --------------------------------------------------------------------------
    containerEl.createEl("h3", { text: "🔒 Sperr- & Sicherheitsverhalten" });

    new Setting(containerEl)
      .setName("Automatischer Lesemodus bei Sperre")
      .setDesc("Schaltet gesperrte Notizen beim Öffnen automatisch in den Lesemodus (Preview), sodass die Bearbeitung physisch gesperrt ist.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.forceReadingModeOnLock)
          .onChange(async (value) => {
            this.plugin.settings.forceReadingModeOnLock = value;
            await this.plugin.saveSettings();
            this.plugin.refreshBanner();
          })
      );

    new Setting(containerEl)
      .setName("CodeMirror Engine Hard-Block")
      .setDesc("Blockiert Textänderungen auf CodeMirror-Engine-Ebene (Transaktions-Filter), selbst wenn sich die Notiz im Quelltext-Modus befindet.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.enableHardBlock)
          .onChange(async (value) => {
            this.plugin.settings.enableHardBlock = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Automatischer Timeout (Deadlock-Schutz)")
      .setDesc("Gibt gesperrte Dateien automatisch frei, wenn seit dem Sperr-Zeitpunkt keine Aktivität mehr stattgefunden hat (z. B. nach Agenten-Absturz).")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("0", "Aus (Streng manuell - Empfohlen)")
          .addOption("1", "Nach 1 Minute")
          .addOption("2", "Nach 2 Minuten")
          .addOption("3", "Nach 3 Minuten")
          .addOption("5", "Nach 5 Minuten")
          .addOption("10", "Nach 10 Minuten")
          .setValue(String(this.plugin.settings.autoUnlockTimeoutMinutes))
          .onChange(async (value) => {
            this.plugin.settings.autoUnlockTimeoutMinutes = parseInt(value, 10);
            await this.plugin.saveSettings();
            this.plugin.lockManager.updateSettings(this.plugin.settings);
          })
      );

    // --------------------------------------------------------------------------
    // 2. VISUELLER NOTIZ-BANNER
    // --------------------------------------------------------------------------
    containerEl.createEl("h3", { text: "🏷️ Visueller Notiz-Banner (Header-UI)" });

    new Setting(containerEl)
      .setName("Schwebenden Header-Banner anzeigen")
      .setDesc("Blendet den eleganten Status-Banner oben in jeder durch einen Agenten gesperrten Notiz ein.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.showBanner)
          .onChange(async (value) => {
            this.plugin.settings.showBanner = value;
            await this.plugin.saveSettings();
            this.plugin.refreshBanner();
          })
      );

    new Setting(containerEl)
      .setName("Live-Timer im Banner")
      .setDesc("Zeigt sekundengenau an, wie lange die Notiz durch den Agenten bereits in Bearbeitung ist.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.showTimer)
          .onChange(async (value) => {
            this.plugin.settings.showTimer = value;
            await this.plugin.saveSettings();
            this.plugin.refreshBanner();
          })
      );

    new Setting(containerEl)
      .setName("Sticky Banner beim Scrollen")
      .setDesc("Hält den Banner beim Scrollen durch lange Notizen dezent am oberen Bildschirmrand fixiert.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.stickyBanner)
          .onChange(async (value) => {
            this.plugin.settings.stickyBanner = value;
            await this.plugin.saveSettings();
            this.plugin.refreshBanner();
          })
      );

    new Setting(containerEl)
      .setName("Banner-Designstil")
      .setDesc("Wähle das visuelle Erscheinungsbild des In-Note Banners.")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("glassmorphism", "Modern Glassmorphism (Gradient + Blur)")
          .addOption("solid", "Kompakter Solid Card")
          .addOption("minimal", "Minimalistischer Text-Header")
          .setValue(this.plugin.settings.bannerStyle)
          .onChange(async (value: any) => {
            this.plugin.settings.bannerStyle = value;
            await this.plugin.saveSettings();
            this.plugin.refreshBanner();
          })
      );

    // --------------------------------------------------------------------------
    // 3. STATUSLEISTE & MENÜLEISTE
    // --------------------------------------------------------------------------
    containerEl.createEl("h3", { text: "📊 Statusleiste & Navigation" });

    new Setting(containerEl)
      .setName("Statusleisten-Element")
      .setDesc("Zeigt ein Icon mit der Anzahl aktiver Agenten-Locks in der unteren Obsidian-Statusleiste an.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.enableStatusBar)
          .onChange(async (value) => {
            this.plugin.settings.enableStatusBar = value;
            await this.plugin.saveSettings();
            this.plugin.updateStatusBar();
          })
      );

    new Setting(containerEl)
      .setName("Statusleiste bei 0 Locks ausblenden")
      .setDesc("Versteckt das Statusleisten-Icon komplett, solange keine Dateien gesperrt sind.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.hideStatusBarWhenZero)
          .onChange(async (value) => {
            this.plugin.settings.hideStatusBarWhenZero = value;
            await this.plugin.saveSettings();
            this.plugin.updateStatusBar();
          })
      );

    new Setting(containerEl)
      .setName("Ribbon-Icon (Linke Leiste)")
      .setDesc("Zeigt ein Roboter-Icon in der linken Menüleiste an, um das Lock-Modal mit 1 Klick zu öffnen.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.enableRibbonIcon)
          .onChange(async (value) => {
            this.plugin.settings.enableRibbonIcon = value;
            await this.plugin.saveSettings();
          })
      );

    // --------------------------------------------------------------------------
    // 4. BENACHRICHTIGUNGEN & TOASTS
    // --------------------------------------------------------------------------
    containerEl.createEl("h3", { text: "🔔 Benachrichtigungen & Feedback" });

    new Setting(containerEl)
      .setName("Abschluss-Benachrichtigungen")
      .setDesc("Zeigt einen Hinweis an ('✅ [Agent] hat [Notiz] fertiggestellt'), sobald eine Sperre aufgehoben wird.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.enableCompletionToasts)
          .onChange(async (value) => {
            this.plugin.settings.enableCompletionToasts = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Tippversuch-Hinweise")
      .setDesc("Zeigt eine Toast-Meldung an, wenn versucht wird, in eine gesperrte Notiz zu tippen.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.enableBlockedEditToasts)
          .onChange(async (value) => {
            this.plugin.settings.enableBlockedEditToasts = value;
            await this.plugin.saveSettings();
          })
      );

    // --------------------------------------------------------------------------
    // 5. NOTFALL-WERKZEUGE (DANGER ZONE)
    // --------------------------------------------------------------------------
    containerEl.createEl("h3", { text: "🚨 Notfall-Werkzeuge (Emergency Utilities)" });

    const activeLocks = this.plugin.lockManager.getAllActiveLocks();

    const emergencySetting = new Setting(containerEl)
      .setName("Alle Sperren im Vault aufheben")
      .setDesc(`Aktuell gesperrte Dateien im Vault: ${activeLocks.length}`)
      .addButton((btn) =>
        btn
          .setButtonText("🔓 Alle sofort freigeben")
          .setWarning()
          .onClick(async () => {
            btn.setDisabled(true);
            btn.setButtonText("Wird freigegeben...");
            const count = await this.plugin.lockManager.unlockAll();
            this.display(); // Refresh settings tab UI
          })
      );
  }
}
