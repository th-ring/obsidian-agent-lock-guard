import { App, Modal, setIcon, TFile } from "obsidian";
import { LockManager } from "./lockManager";
import { LockInfo } from "./types";

export class AgentLockOverviewModal extends Modal {
  private lockManager: LockManager;
  private timerInterval: number | null = null;

  constructor(app: App, lockManager: LockManager) {
    super(app);
    this.lockManager = lockManager;
  }

  onOpen() {
    this.render();
    this.startLiveTimer();
  }

  onClose() {
    this.stopLiveTimer();
    this.contentEl.empty();
  }

  private render() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("agent-lock-modal");

    const locks = this.lockManager.getAllActiveLocks();

    // 1. Header
    const headerEl = contentEl.createDiv({ cls: "agent-lock-modal-header" });
    const titleEl = headerEl.createEl("h2", { text: "🤖 Aktive Agenten-Sperren" });
    const countBadge = headerEl.createSpan({
      cls: "agent-lock-modal-count-badge",
      text: `${locks.length}`,
    });

    if (locks.length === 0) {
      const emptyEl = contentEl.createDiv({ cls: "agent-lock-modal-empty" });
      const emptyIcon = emptyEl.createDiv({ cls: "agent-lock-modal-empty-icon" });
      setIcon(emptyIcon, "shield-check");
      emptyEl.createEl("p", {
        cls: "agent-lock-modal-empty-text",
        text: "Keine Notizen durch Agenten gesperrt. Alles frei bearbeitbar!",
      });

      const closeBtn = contentEl.createEl("button", {
        cls: "mod-cta agent-lock-modal-close-btn",
        text: "Schließen",
      });
      closeBtn.addEventListener("click", () => this.close());
      return;
    }

    // 2. Lock items list
    const listContainer = contentEl.createDiv({ cls: "agent-lock-modal-list" });

    for (const lock of locks) {
      const itemEl = listContainer.createDiv({ cls: "agent-lock-modal-item" });

      // Left info
      const infoEl = itemEl.createDiv({ cls: "agent-lock-modal-item-info" });
      const fileRow = infoEl.createDiv({ cls: "agent-lock-modal-item-title-row" });
      const fileIcon = fileRow.createSpan({ cls: "agent-lock-file-icon" });
      setIcon(fileIcon, "file-text");

      const fileLink = fileRow.createEl("a", {
        cls: "agent-lock-modal-file-link",
        text: lock.title,
      });
      fileLink.addEventListener("click", (e) => {
        e.preventDefault();
        this.app.workspace.openLinkText(lock.path, "", false);
        this.close();
      });

      const metaRow = infoEl.createDiv({ cls: "agent-lock-modal-item-meta" });
      const agentBadge = metaRow.createSpan({
        cls: "agent-lock-modal-agent-badge",
        text: `🤖 ${lock.lockedBy}`,
      });

      const timerSpan = metaRow.createSpan({
        cls: "agent-lock-modal-timer-span",
        text: `⏱️ ${this.getDurationText(lock.lockedAtDate)}`,
      });
      timerSpan.setAttribute("data-path", lock.path);

      // Right actions
      const actionsEl = itemEl.createDiv({ cls: "agent-lock-modal-item-actions" });

      const openBtn = actionsEl.createEl("button", {
        cls: "agent-lock-btn-secondary",
        text: "Öffnen",
      });
      openBtn.addEventListener("click", () => {
        this.app.workspace.openLinkText(lock.path, "", false);
        this.close();
      });

      const unlockBtn = actionsEl.createEl("button", {
        cls: "agent-lock-btn-unlock-small",
        text: "🔓 Freigeben",
      });
      unlockBtn.addEventListener("click", async () => {
        unlockBtn.disabled = true;
        unlockBtn.setText("...");
        await this.lockManager.unlockFile(lock.file);
        this.render();
      });
    }

    // 3. Footer actions
    const footerEl = contentEl.createDiv({ cls: "agent-lock-modal-footer" });
    const unlockAllBtn = footerEl.createEl("button", {
      cls: "agent-lock-btn-danger",
      text: "🔓 Alle freigeben (Emergency Unlock)",
    });

    unlockAllBtn.addEventListener("click", async () => {
      unlockAllBtn.disabled = true;
      unlockAllBtn.setText("Alle werden freigegeben...");
      await this.lockManager.unlockAll();
      this.close();
    });
  }

  private startLiveTimer() {
    this.stopLiveTimer();
    this.timerInterval = window.setInterval(() => {
      const timerSpans = this.contentEl.querySelectorAll(".agent-lock-modal-timer-span");
      timerSpans.forEach((span) => {
        const path = span.getAttribute("data-path");
        if (path) {
          const file = this.app.vault.getAbstractFileByPath(path);
          if (file instanceof TFile) {
            const lock = this.lockManager.getLockInfo(file);
            if (lock) {
              span.setText(`⏱️ ${this.getDurationText(lock.lockedAtDate)}`);
            }
          }
        }
      });
    }, 1000);
  }

  private stopLiveTimer() {
    if (this.timerInterval !== null) {
      window.clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  private getDurationText(lockedAtDate: Date | null): string {
    if (!lockedAtDate) return "aktiv";
    const now = new Date();
    const diffSec = Math.max(0, Math.floor((now.getTime() - lockedAtDate.getTime()) / 1000));
    if (diffSec < 60) return `vor ${diffSec}s`;
    const mins = Math.floor(diffSec / 60);
    const remainingSec = diffSec % 60;
    return `vor ${mins}m ${remainingSec}s`;
  }
}
