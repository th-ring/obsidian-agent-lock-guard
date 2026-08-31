import { MarkdownView, setIcon, TFile } from "obsidian";
import { LockManager } from "./lockManager";
import { AgentLockSettings, DEFAULT_SETTINGS, LockInfo } from "./types";

export class BannerViewManager {
  private lockManager: LockManager;
  private settings: AgentLockSettings = DEFAULT_SETTINGS;
  private timerInterval: number | null = null;
  private currentBannerEl: HTMLElement | null = null;
  private currentLockedFile: TFile | null = null;

  constructor(lockManager: LockManager, settings?: AgentLockSettings) {
    this.lockManager = lockManager;
    if (settings) this.settings = settings;
  }

  public updateSettings(settings: AgentLockSettings) {
    this.settings = settings;
  }

  public init() {
    this.startTimerLoop();
  }

  public destroy() {
    this.stopTimerLoop();
    this.removeBanner();
  }

  public updateBannerForView(view: MarkdownView | null) {
    if (!view || !view.file || !this.settings.showBanner) {
      this.removeBanner();
      return;
    }

    const file = view.file;
    const lockInfo = this.lockManager.getLockInfo(file);

    if (lockInfo && lockInfo.agentState === "processing") {
      this.renderBanner(view, lockInfo);
    } else {
      this.removeBanner();
    }
  }

  private renderBanner(view: MarkdownView, lockInfo: LockInfo) {
    this.currentLockedFile = lockInfo.file;

    // Use view-content as container
    const container = view.contentEl;
    let wrapperEl = container.querySelector(".agent-lock-banner-wrapper") as HTMLElement | null;

    if (!wrapperEl) {
      wrapperEl = createDiv({ cls: "agent-lock-banner-wrapper" });
      container.prepend(wrapperEl);
    }

    // Apply sticky preference
    if (!this.settings.stickyBanner) {
      wrapperEl.addClass("not-sticky");
    } else {
      wrapperEl.removeClass("not-sticky");
    }

    let bannerEl = wrapperEl.querySelector(".agent-lock-banner") as HTMLElement | null;
    if (!bannerEl) {
      bannerEl = wrapperEl.createDiv({ cls: "agent-lock-banner" });
      this.currentBannerEl = bannerEl;
    }

    // Apply style theme
    bannerEl.removeClass("style-glassmorphism", "style-solid", "style-minimal");
    bannerEl.addClass(`style-${this.settings.bannerStyle || "glassmorphism"}`);

    bannerEl.empty();

    // 1. Left Side: Pulsing Dot + Icon + Agent Badge + Label
    const leftEl = bannerEl.createDiv({ cls: "agent-lock-banner-left" });
    
    // Pulsing Dot
    const pulseWrapper = leftEl.createDiv({ cls: "agent-lock-pulse-wrapper" });
    pulseWrapper.createDiv({ cls: "agent-lock-pulse-core" });
    pulseWrapper.createDiv({ cls: "agent-lock-pulse-ring" });

    // Bot Icon
    const iconEl = leftEl.createSpan({ cls: "agent-lock-icon" });
    setIcon(iconEl, "bot");

    // Title / Status
    const badgeEl = leftEl.createSpan({ cls: "agent-lock-badge", text: "AGENT AKTIV" });
    const nameEl = leftEl.createSpan({ cls: "agent-lock-agent-name", text: lockInfo.lockedBy });

    const dividerEl = leftEl.createSpan({ cls: "agent-lock-divider", text: "•" });
    const descEl = leftEl.createSpan({ cls: "agent-lock-status-desc", text: "Schreibgeschützt" });

    // 2. Right Side: Timer + Action Button
    const rightEl = bannerEl.createDiv({ cls: "agent-lock-banner-right" });

    // Timer Badge (if enabled)
    if (this.settings.showTimer) {
      const timerBadge = rightEl.createDiv({ cls: "agent-lock-timer-badge" });
      const timerIcon = timerBadge.createSpan({ cls: "agent-lock-timer-icon" });
      setIcon(timerIcon, "clock");
      const timerText = timerBadge.createSpan({ cls: "agent-lock-timer-text" });
      timerText.setText(this.calculateDurationText(lockInfo.lockedAtDate));
    }

    // Unlock Button
    const unlockBtn = rightEl.createEl("button", {
      cls: "agent-lock-unlock-btn",
    });
    const unlockIcon = unlockBtn.createSpan({ cls: "agent-lock-unlock-btn-icon" });
    setIcon(unlockIcon, "unlock");
    unlockBtn.createSpan({ text: "Freigeben" });

    unlockBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      unlockBtn.disabled = true;
      unlockBtn.setText("Wird freigegeben...");
      await this.lockManager.unlockFile(lockInfo.file);
    });
  }

  public removeBanner() {
    if (this.currentBannerEl) {
      const wrapper = this.currentBannerEl.closest(".agent-lock-banner-wrapper");
      if (wrapper) {
        wrapper.remove();
      } else {
        this.currentBannerEl.remove();
      }
      this.currentBannerEl = null;
    }
    this.currentLockedFile = null;
  }

  private startTimerLoop() {
    this.stopTimerLoop();
    this.timerInterval = window.setInterval(() => {
      if (!this.currentBannerEl || !this.currentLockedFile || !this.settings.showTimer) return;

      const lock = this.lockManager.getLockInfo(this.currentLockedFile);
      if (!lock) return;

      const timerTextEl = this.currentBannerEl.querySelector(".agent-lock-timer-text");
      if (timerTextEl) {
        timerTextEl.setText(this.calculateDurationText(lock.lockedAtDate));
      }
    }, 1000);
  }

  private stopTimerLoop() {
    if (this.timerInterval !== null) {
      window.clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  private calculateDurationText(lockedAtDate: Date | null): string {
    if (!lockedAtDate) return "aktiv";
    const now = new Date();
    const diffSec = Math.max(0, Math.floor((now.getTime() - lockedAtDate.getTime()) / 1000));

    if (diffSec < 60) {
      return `vor ${diffSec}s`;
    }
    const mins = Math.floor(diffSec / 60);
    const remainingSec = diffSec % 60;
    return `vor ${mins}m ${remainingSec}s`;
  }
}
