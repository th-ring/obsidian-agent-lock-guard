import { TFile } from "obsidian";

export interface LockInfo {
  file: TFile;
  path: string;
  title: string;
  agentState: "processing" | "idle" | "done";
  lockedBy: string;
  lockedAt: string | null;
  lockedAtDate: Date | null;
}

export interface AgentLockSettings {
  // 1. Sperr- & Sicherheitsverhalten
  forceReadingModeOnLock: boolean;
  enableHardBlock: boolean;
  autoUnlockTimeoutMinutes: number; // 0 = Aus (Manuell)

  // 2. Notiz-Banner UI
  showBanner: boolean;
  showTimer: boolean;
  stickyBanner: boolean;
  bannerStyle: "glassmorphism" | "solid" | "minimal";

  // 3. Statusleiste & Navigation
  enableStatusBar: boolean;
  hideStatusBarWhenZero: boolean;
  enableRibbonIcon: boolean;

  // 4. Benachrichtigungen
  enableCompletionToasts: boolean;
  enableBlockedEditToasts: boolean;
}

export const DEFAULT_SETTINGS: AgentLockSettings = {
  forceReadingModeOnLock: true,
  enableHardBlock: true,
  autoUnlockTimeoutMinutes: 0,

  showBanner: true,
  showTimer: true,
  stickyBanner: true,
  bannerStyle: "glassmorphism",

  enableStatusBar: true,
  hideStatusBarWhenZero: false,
  enableRibbonIcon: true,

  enableCompletionToasts: true,
  enableBlockedEditToasts: true,
};
