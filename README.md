# MAXX AI Frontend (demo mode)

## Structure
```
index.html   css/style.css   js/app.js
assets/maxx-logo.svg  maxx-mark.svg  favicon.svg
```

## Run
Double-click `index.html`, or use VS Code "Live Server". No build step.

## What works
New chat, send, switch, rename, pin, delete, search (titles and content), grouped history, copy message/code, edit last user message, retry, delete message, stop button, attach/remove file chips (names only), collapsible sidebar and mobile drawer, model selector (UI only), export to .md, clear all, settings/About, toasts, Esc and Ctrl+K.

## Demo mode
No AI service is connected. Replies are labelled "(demo)" and the footer says "Demo mode — not connected to an AI service". Nothing is faked as a real answer.

## Storage
Chats and UI preferences are saved in browser `localStorage` (key `maxx.frontend.v1`). Corrupted data is ignored. This is demo storage; the Python desktop app should use SQLite. No secrets are stored.

## Logo
Files are in `assets/`. To replace them, overwrite the three SVGs with the same names (keep the mark square, transparent background). Used in sidebar, collapsed sidebar, welcome screen, favicon, loading pulse and Settings/About. They are hand-crafted SVG; no image generator was used.

## Python / PySide6 backend later
All backend access goes through `sendMessageToBackend(message, attachments)` in `js/app.js`. In a Qt WebEngine app, expose a bridge as `window.maxxBackend.send(text, fileNames)` returning a Promise of reply text. In a normal browser it is absent and demo mode is used. Keep API keys in Python only; never put them in HTML/JS.

## Known limitations
Rename/delete use browser prompt/confirm dialogs. Markdown is minimal (code, lists, headings, paragraphs; no tables or inline code). No microphone input, theme switching, or file content upload. Not tested in a real browser; see checklist below.

## Manual checklist
Open page, logo and favicon show; send a message; refresh and confirm it persists; rename/pin/delete a chat; search; collapse sidebar; narrow window to under 760px and open drawer; export; Escape closes menus.
