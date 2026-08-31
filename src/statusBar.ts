import { App } from "obsidian";
import { LockManager } from "./lockManager";
import { AgentLockOverviewModal } from "./lockModal";
import { AgentLockSettings, DEFAULT_SETTINGS } from "./types";

export class StatusBarManager {
  private app: App;
  private lockManager: LockManager;
  private statusBarEl: HTMLElement | null = null;
  private unsubscribe: (() => void) | null = null;
  private settings: AgentLockSettings = DEFAULT_SETTINGS;

  constructor(app: App, lockManager: LockManager, settings?: AgentLockSettings) {
    this.app = app;
    this.lockManager = lockManager;
    if (settings) this.settings = settings;
  }

  public updateSettings(settings: AgentLockSettings) {
    this.settings = settings;
    const active = this.lockManager.getAllActiveLocks();
    this.update(active.length);
  }

  public init(statusBarEl: HTMLElement) {
    this.statusBarEl = statusBarEl;
    this.statusBarEl.addClass("agent-lock-status-bar");
    this.statusBarEl.setAttribute("aria-label", "Agent Lock Guard: Klicken für Übersicht");

    this.statusBarEl.addEventListener("click", () => {
      new AgentLockOverviewModal(this.app, this.lockManager).open();
    });

    this.unsubscribe = this.lockManager.subscribe((locks) => {
      this.update(locks.length);
    });
  }

  public destroy() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }

  public update(count: number) {
    if (!this.statusBarEl) return;
    this.statusBarEl.empty();

    if (!this.settings.enableStatusBar) {
      this.statusBarEl.style.display = "none";
      return;
    }

    if (this.settings.hideStatusBarWhenZero && count === 0) {
      this.statusBarEl.style.display = "none";
      return;
    }

    this.statusBarEl.style.display = "inline-flex";

    const iconSpan = this.statusBarEl.createSpan({ cls: "agent-lock-status-icon" });
    iconSpan.setText("🤖");

    const textSpan = this.statusBarEl.createSpan({ cls: "agent-lock-status-text" });

    if (count === 0) {
      this.statusBarEl.removeClass("has-active-locks");
      textSpan.setText("0 Locks");
    } else {
      this.statusBarEl.addClass("has-active-locks");
      textSpan.setText(`${count} Lock${count > 1 ? "s" : ""} aktiv`);
    }
  }
}
