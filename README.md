# 🛡️ Obsidian Agent Lock Guard

**Multi-Agent Concurrency Control & Live In-Note Locking Banners for Obsidian WorkOS.**

Prevents editing collisions between humans and autonomous AI agents (Antigravity, Claude Code, Cursor, Codex, CLI daemons).

---

## ⚡ Features
- **Dual-Layer Hard Read-Only Protection**:
  - Automatically switches locked notes to **Reading View (Preview Mode)** upon opening.
  - CodeMirror 6 **Transaction Filter** hard-blocks any typing or pasting programmatic edits while locked.
- **Glassmorphic Floating Banner**:
  - Floating pill header with real-time pulsing status indicator (`AGENT AKTIV`), agent name, live duration counter (`⏱️ seit Xs`), and 1-click **`[ 🔓 Freigeben ]`** button.
- **Status Bar & Overview Modal**:
  - Displays active locks in the bottom status bar (`🤖 X Locks aktiv`).
  - Global overview modal listing all locked notes with 1-click unlock and emergency unlock-all action.
- **Universal Concurrency Schema**:
  ```yaml
  agent_state: processing # or idle
  locked_by: "agent:antigravity"
  locked_at: "2026-08-30T22:40:00"
  ```
- **Deadlock Protection**: Optional auto-unlock timeout after inactivity.
