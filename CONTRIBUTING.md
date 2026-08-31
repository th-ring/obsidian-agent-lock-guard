# 🛡️ Developer Guide: Obsidian Agent Lock Guard

This guide explains how to develop, test, and contribute to **Obsidian Agent Lock Guard**.

---

## 🏛️ Architecture Overview

```text
src/
├── lockManager.ts        # MetadataCache watcher, lock state map, deadlock protection loop
├── bannerView.ts         # Sticky/Floating In-Note Header Banner with live timer
├── editorExtension.ts    # CodeMirror 6 Transaction Filter & DOM interceptor
├── lockModal.ts          # Global overview modal & emergency unlock actions
├── statusBar.ts          # Bottom status bar indicator
├── settings.ts           # Obsidian Settings Tab UI
├── types.ts              # Type definitions & DEFAULT_SETTINGS
├── styles.css            # Glassmorphic themes & animations
└── main.ts               # Plugin entry point & Obsidian workspace event wiring
```

---

## 🧪 Testing & Building

```bash
# Install dependencies
npm install

# Run automated tests
npm test

# Build production assets
npm run build
```
