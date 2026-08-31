import { App, EventRef, Notice, TFile } from "obsidian";
import { AgentLockSettings, DEFAULT_SETTINGS, LockInfo } from "./types";

export type LockListener = (locks: LockInfo[]) => void;

export class LockManager {
  private app: App;
  private locks: Map<string, LockInfo> = new Map();
  private listeners: Set<LockListener> = new Set();
  private eventRefs: EventRef[] = [];
  private onFileCompletedCallback?: (file: TFile, lockedBy: string) => void;
  private autoUnlockTimer: number | null = null;
  private settings: AgentLockSettings = DEFAULT_SETTINGS;

  constructor(app: App, onFileCompleted?: (file: TFile, lockedBy: string) => void) {
    this.app = app;
    this.onFileCompletedCallback = onFileCompleted;
  }

  public updateSettings(settings: AgentLockSettings) {
    this.settings = settings;
    this.restartAutoUnlockLoop();
  }

  public init(settings?: AgentLockSettings) {
    if (settings) this.settings = settings;
    this.scanVault();

    // Listen for metadata cache updates
    const cacheRef = this.app.metadataCache.on("changed", (file) => {
      if (file instanceof TFile && file.extension === "md") {
        this.evaluateFile(file);
      }
    });
    this.eventRefs.push(cacheRef);

    // Listen for file rename
    const renameRef = this.app.vault.on("rename", (file, oldPath) => {
      if (this.locks.has(oldPath)) {
        const oldLock = this.locks.get(oldPath)!;
        this.locks.delete(oldPath);
        if (file instanceof TFile) {
          oldLock.file = file;
          oldLock.path = file.path;
          this.locks.set(file.path, oldLock);
          this.notifyListeners();
        }
      }
    });
    this.eventRefs.push(renameRef);

    // Listen for file deletion
    const deleteRef = this.app.vault.on("delete", (file) => {
      if (this.locks.has(file.path)) {
        this.locks.delete(file.path);
        this.notifyListeners();
      }
    });
    this.eventRefs.push(deleteRef);

    this.restartAutoUnlockLoop();
  }

  public destroy() {
    this.stopAutoUnlockLoop();
    for (const ref of this.eventRefs) {
      this.app.metadataCache.offref(ref);
      this.app.vault.offref(ref);
    }
    this.eventRefs = [];
    this.locks.clear();
    this.listeners.clear();
  }

  private restartAutoUnlockLoop() {
    this.stopAutoUnlockLoop();
    if (this.settings.autoUnlockTimeoutMinutes > 0) {
      this.autoUnlockTimer = window.setInterval(() => {
        this.checkStaleLocks();
      }, 10000); // check every 10s
    }
  }

  private stopAutoUnlockLoop() {
    if (this.autoUnlockTimer !== null) {
      window.clearInterval(this.autoUnlockTimer);
      this.autoUnlockTimer = null;
    }
  }

  private async checkStaleLocks() {
    if (this.settings.autoUnlockTimeoutMinutes <= 0) return;
    const maxSec = this.settings.autoUnlockTimeoutMinutes * 60;
    const now = Date.now();

    for (const lock of this.getAllActiveLocks()) {
      if (lock.lockedAtDate) {
        const diffSec = Math.floor((now - lock.lockedAtDate.getTime()) / 1000);
        if (diffSec >= maxSec) {
          await this.unlockFile(lock.file);
          new Notice(
            `⏱️ Sperre für "${lock.title}" nach ${this.settings.autoUnlockTimeoutMinutes} Min. automatisch freigegeben.`,
            5000
          );
        }
      }
    }
  }

  public scanVault() {
    const files = this.app.vault.getMarkdownFiles();
    this.locks.clear();
    for (const file of files) {
      const lockInfo = this.extractLockInfo(file);
      if (lockInfo && lockInfo.agentState === "processing") {
        this.locks.set(file.path, lockInfo);
      }
    }
    this.notifyListeners();
  }

  public evaluateFile(file: TFile) {
    const previousLock = this.locks.get(file.path);
    const currentLock = this.extractLockInfo(file);

    if (currentLock && currentLock.agentState === "processing") {
      this.locks.set(file.path, currentLock);
      this.notifyListeners();
    } else {
      if (previousLock) {
        this.locks.delete(file.path);
        this.notifyListeners();

        // If it transitioned from processing to idle/done, fire completion
        if (this.onFileCompletedCallback) {
          this.onFileCompletedCallback(file, previousLock.lockedBy);
        }
      }
    }
  }

  public extractLockInfo(file: TFile): LockInfo | null {
    const cache = this.app.metadataCache.getFileCache(file);
    if (!cache || !cache.frontmatter) return null;

    const fm = cache.frontmatter;
    const agentState = fm.agent_state;
    const lockedBy = fm.locked_by || "KI-Agent";
    const lockedAt = fm.locked_at || null;

    if (agentState === "processing") {
      let lockedAtDate: Date | null = null;
      if (lockedAt) {
        const parsed = new Date(lockedAt);
        if (!isNaN(parsed.getTime())) {
          lockedAtDate = parsed;
        }
      }

      return {
        file,
        path: file.path,
        title: fm.title || file.basename,
        agentState: "processing",
        lockedBy,
        lockedAt,
        lockedAtDate,
      };
    }

    return null;
  }

  public getLockInfo(file: TFile | null): LockInfo | null {
    if (!file) return null;
    return this.locks.get(file.path) || null;
  }

  public isFileLocked(file: TFile | null): boolean {
    if (!file) return false;
    return this.locks.has(file.path);
  }

  public getAllActiveLocks(): LockInfo[] {
    return Array.from(this.locks.values());
  }

  public async unlockFile(file: TFile): Promise<boolean> {
    try {
      await this.app.fileManager.processFrontMatter(file, (fm) => {
        fm.agent_state = "idle";
        delete fm.locked_by;
        delete fm.locked_at;
      });

      this.locks.delete(file.path);
      this.notifyListeners();
      new Notice(`🔓 Notiz "${file.basename}" wurde freigegeben.`);
      return true;
    } catch (err) {
      console.error("Fehler beim Freigeben der Datei:", err);
      new Notice(`❌ Fehler beim Freigeben von "${file.basename}".`);
      return false;
    }
  }

  public async unlockAll(): Promise<number> {
    const activeLocks = this.getAllActiveLocks();
    if (activeLocks.length === 0) {
      new Notice("Keine gesperrten Dateien vorhanden.");
      return 0;
    }

    let unlockedCount = 0;
    for (const lock of activeLocks) {
      try {
        await this.app.fileManager.processFrontMatter(lock.file, (fm) => {
          fm.agent_state = "idle";
          delete fm.locked_by;
          delete fm.locked_at;
        });
        this.locks.delete(lock.path);
        unlockedCount++;
      } catch (err) {
        console.error(`Fehler beim Entsperren von ${lock.path}:`, err);
      }
    }

    this.notifyListeners();
    new Notice(`🔓 ${unlockedCount} Datei(en) erfolgreich freigegeben.`);
    return unlockedCount;
  }

  public subscribe(listener: LockListener): () => void {
    this.listeners.add(listener);
    // Initial call
    listener(this.getAllActiveLocks());
    return () => this.listeners.delete(listener);
  }

  private notifyListeners() {
    const active = this.getAllActiveLocks();
    for (const listener of this.listeners) {
      listener(active);
    }
  }
}
