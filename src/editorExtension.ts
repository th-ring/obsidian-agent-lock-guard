import { Extension, EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { Notice } from "obsidian";
import { LockManager } from "./lockManager";
import { AgentLockSettings, DEFAULT_SETTINGS } from "./types";

let activeLockManager: LockManager | null = null;
let activeSettings: AgentLockSettings = DEFAULT_SETTINGS;
let lastNoticeTime = 0;

export function setEditorLockManager(manager: LockManager, settings?: AgentLockSettings) {
  activeLockManager = manager;
  if (settings) activeSettings = settings;
}

export function updateEditorLockSettings(settings: AgentLockSettings) {
  activeSettings = settings;
}

function showLockNotice() {
  if (!activeSettings.enableBlockedEditToasts) return;
  const now = Date.now();
  if (now - lastNoticeTime > 2000) {
    lastNoticeTime = now;
    new Notice("🔒 Notiz ist durch KI-Agent gesperrt (Schreibschutz aktiv). Klicke oben auf 'Freigeben' zum Bearbeiten.", 3000);
  }
}

export function createEditorLockExtension(): Extension {
  // 1. Transaction filter: Hard block on ANY document changes when locked
  const transactionBlocker = EditorState.transactionFilter.of((tr) => {
    if (!activeLockManager || !tr.docChanged || !activeSettings.enableHardBlock) return tr;

    // Check if any lock is active
    const isLocked = activeLockManager.getAllActiveLocks().length > 0;
    if (!isLocked) return tr;

    // Check DOM for lock banner in active workspace leaf
    const activeLeaf = document.querySelector(".workspace-leaf.mod-active");
    const hasLockBanner = activeLeaf?.querySelector(".agent-lock-banner") !== null;

    if (hasLockBanner) {
      showLockNotice();
      return []; // Cancels transaction completely!
    }

    return tr;
  });

  // 2. DOM Event handlers for keystrokes, paste, cut, drop
  const domHandlers = EditorView.domEventHandlers({
    keydown(event, view) {
      if (!activeLockManager) return false;

      // Ignore pure navigation / modifier keys
      if (
        event.key === "ArrowUp" ||
        event.key === "ArrowDown" ||
        event.key === "ArrowLeft" ||
        event.key === "ArrowRight" ||
        event.key === "PageUp" ||
        event.key === "PageDown" ||
        event.key === "Home" ||
        event.key === "End" ||
        event.key === "Escape" ||
        event.key === "Control" ||
        event.key === "Alt" ||
        event.key === "Shift" ||
        event.key === "Meta"
      ) {
        return false;
      }

      // Check if this specific leaf is locked
      const dom = view.dom.closest(".workspace-leaf");
      const hasLockBanner = dom?.querySelector(".agent-lock-banner") !== null;

      if (hasLockBanner) {
        event.preventDefault();
        event.stopPropagation();
        showLockNotice();
        return true;
      }

      return false;
    },
    paste(event, view) {
      const dom = view.dom.closest(".workspace-leaf");
      const hasLockBanner = dom?.querySelector(".agent-lock-banner") !== null;

      if (hasLockBanner) {
        event.preventDefault();
        event.stopPropagation();
        showLockNotice();
        return true;
      }
      return false;
    },
    cut(event, view) {
      const dom = view.dom.closest(".workspace-leaf");
      const hasLockBanner = dom?.querySelector(".agent-lock-banner") !== null;

      if (hasLockBanner) {
        event.preventDefault();
        event.stopPropagation();
        showLockNotice();
        return true;
      }
      return false;
    },
    drop(event, view) {
      const dom = view.dom.closest(".workspace-leaf");
      const hasLockBanner = dom?.querySelector(".agent-lock-banner") !== null;

      if (hasLockBanner) {
        event.preventDefault();
        event.stopPropagation();
        showLockNotice();
        return true;
      }
      return false;
    },
  });

  return [transactionBlocker, domHandlers];
}
