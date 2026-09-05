import { MarkdownView, Notice, Plugin, TFile } from "obsidian";
import { BannerViewManager } from "./bannerView";
import { createEditorLockExtension, setEditorLockManager, updateEditorLockSettings } from "./editorExtension";
import { LockManager } from "./lockManager";
import { AgentLockOverviewModal } from "./lockModal";
import { AgentLockSettingTab } from "./settings";
import { StatusBarManager } from "./statusBar";
import { AgentLockSettings, DEFAULT_SETTINGS } from "./types";

export default class AgentLockGuardPlugin extends Plugin {
  settings: AgentLockSettings = DEFAULT_SETTINGS;
  lockManager!: LockManager;
  bannerViewManager!: BannerViewManager;
  statusBarManager!: StatusBarManager;
  private ribbonIconEl: HTMLElement | null = null;

  async onload() {
    console.log("Loading Agent Lock Guard plugin...");
    await this.loadSettings();

    // 1. Initialize Lock Manager
    this.lockManager = new LockManager(this.app, (file: TFile, lockedBy: string) => {
      if (this.settings.enableCompletionToasts) {
        new Notice(`✅ ${lockedBy} hat Bearbeitung von "${file.basename}" beendet.`);
      }
      this.refreshBanner();
    });

    // 2. Initialize In-Note Banner Manager
    this.bannerViewManager = new BannerViewManager(this.lockManager, this.settings);
    this.bannerViewManager.init();

    // 3. Register CodeMirror Read-Only Extension
    setEditorLockManager(this.app, this.lockManager, this.settings);
    this.registerEditorExtension(createEditorLockExtension());

    // 4. Register Ribbon Icon
    if (this.settings.enableRibbonIcon) {
      this.ribbonIconEl = this.addRibbonIcon("shield-check", "Agent Lock Guard: Gesperrte Dateien", () => {
        new AgentLockOverviewModal(this.app, this.lockManager).open();
      });
    }

    // 5. Register Status Bar Item
    if (this.settings.enableStatusBar) {
      const statusBarItem = this.addStatusBarItem();
      this.statusBarManager = new StatusBarManager(this.app, this.lockManager, this.settings);
      this.statusBarManager.init(statusBarItem);
    }

    // 6. Hook into Workspace Events for Active File Changes
    this.registerEvent(
      this.app.workspace.on("active-leaf-change", () => {
        this.refreshBanner();
      })
    );

    this.registerEvent(
      this.app.workspace.on("file-open", () => {
        this.refreshBanner();
      })
    );

    this.registerEvent(
      this.app.workspace.on("layout-change", () => {
        this.refreshBanner();
      })
    );

    // Re-render active banner when lockManager updates
    this.lockManager.subscribe(() => {
      this.refreshBanner();
    });

    // 7. Register Commands in Command Palette (Strg + P)
    this.addCommand({
      id: "open-agent-lock-overview",
      name: "Gesperrte Dateien verwalten (Modal öffnen)",
      callback: () => {
        new AgentLockOverviewModal(this.app, this.lockManager).open();
      },
    });

    this.addCommand({
      id: "unlock-active-note",
      name: "Aktuelle Notiz freigeben",
      checkCallback: (checking: boolean) => {
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (activeView && activeView.file) {
          const isLocked = this.lockManager.isFileLocked(activeView.file);
          if (isLocked) {
            if (!checking) {
              this.lockManager.unlockFile(activeView.file);
            }
            return true;
          }
        }
        return false;
      },
    });

    this.addCommand({
      id: "unlock-all-notes",
      name: "Alle gesperrten Dateien freigeben (Emergency Unlock All)",
      callback: async () => {
        await this.lockManager.unlockAll();
      },
    });

    // 8. Register Settings Tab
    this.addSettingTab(new AgentLockSettingTab(this.app, this));

    // Initialize lock manager after workspace is layout ready
    this.app.workspace.onLayoutReady(() => {
      this.lockManager.init(this.settings);
      this.refreshBanner();
    });
  }

  onunload() {
    console.log("Unloading Agent Lock Guard plugin...");
    this.bannerViewManager.destroy();
    this.lockManager.destroy();
    if (this.statusBarManager) {
      this.statusBarManager.destroy();
    }
  }

  public refreshBanner() {
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!activeView) return;

    const file = activeView.file;
    const isLocked = file ? this.lockManager.isFileLocked(file) : false;

    if (isLocked) {
      activeView.containerEl.addClass("is-agent-locked");

      // Automatically force Reading View (Preview Mode) if enabled
      if (this.settings.forceReadingModeOnLock && activeView.getMode() !== "preview") {
        activeView.setState({ ...activeView.getState(), mode: "preview" }, { history: false });
      }
    } else {
      activeView.containerEl.removeClass("is-agent-locked");
    }

    this.bannerViewManager.updateBannerForView(activeView);
  }

  public updateStatusBar() {
    if (this.statusBarManager) {
      this.statusBarManager.updateSettings(this.settings);
    }
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
    this.lockManager.updateSettings(this.settings);
    this.bannerViewManager.updateSettings(this.settings);
    updateEditorLockSettings(this.settings);
    this.updateStatusBar();
  }
}
