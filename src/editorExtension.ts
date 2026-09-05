import { Extension, EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { App, Notice } from "obsidian";
import { LockManager } from "./lockManager";
import { AgentLockSettings, DEFAULT_SETTINGS } from "./types";

let appInstance: App | null = null;
let activeLockManager: LockManager | null = null;
let activeSettings: AgentLockSettings = DEFAULT_SETTINGS;
let lastNoticeTime = 0;

export function setEditorLockManager(app: App, manager: LockManager, settings?: AgentLockSettings) {
  appInstance = app;
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

export function isCurrentViewLocked(viewDom?: HTMLElement): boolean {
  if (!activeLockManager || activeLockManager.getAllActiveLocks().length === 0) return false;

  // 1. Check DOM for lock banner in active leaf or given leaf
  const leafDom = viewDom ? viewDom.closest(".workspace-leaf") : document.querySelector(".workspace-leaf.mod-active");
  if (leafDom?.querySelector(".agent-lock-banner") !== null) {
    return true;
  }

  // 2. Fallback when banner is hidden or not rendered: verify active file
  if (appInstance) {
    const activeFile = appInstance.workspace.getActiveFile();
    if (activeFile && activeLockManager.isFileLocked(activeFile)) {
      return true;
    }
  }

  return false;
}

export function createEditorLockExtension(): Extension {
  // 1. Transaction filter: Hard block on ANY document changes when locked
  const transactionBlocker = EditorState.transactionFilter.of((tr) => {
    if (!activeLockManager || !tr.docChanged || !activeSettings.enableHardBlock) return tr;

    if (isCurrentViewLocked()) {
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

      if (isCurrentViewLocked(view.dom)) {
        event.preventDefault();
        event.stopPropagation();
        showLockNotice();
        return true;
      }

      return false;
    },
    paste(event, view) {
      if (isCurrentViewLocked(view.dom)) {
        event.preventDefault();
        event.stopPropagation();
        showLockNotice();
        return true;
      }
      return false;
    },
    cut(event, view) {
      if (isCurrentViewLocked(view.dom)) {
        event.preventDefault();
        event.stopPropagation();
        showLockNotice();
        return true;
      }
      return false;
    },
    drop(event, view) {
      if (isCurrentViewLocked(view.dom)) {
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
