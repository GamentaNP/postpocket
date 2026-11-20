# Privacy Policy — PostPocket

**Effective date:** 2026-11-20

PostPocket is a local-first browser extension for organizing Facebook post photos. This document explains exactly what data it touches and where that data goes.

## 1. The short version

Nothing you collect is ever sent to the developer. There is no server, no account, no analytics, no logging service and no cloud sync. All images, metadata and preferences stay on your computer.

## 2. What stays on your device

| Data | Where it lives |
| --- | --- |
| Downloaded images | Your chosen folder (default: `Downloads/PostPocket/...`) |
| Image copies for the library | IndexedDB in your browser profile |
| Post records (title, caption, author, date, source name/type, post ID, post URL) | IndexedDB |
| Queue state and job history | IndexedDB |
| Preferences | `chrome.storage.local` |
| File/folder selections for import | Your browser session only |
| Backup files | A location you choose |

## 3. What the extension accesses

- **Current Facebook tab** — a content script reads the DOM of the Facebook page you are viewing when you press Scan. It does not browse other pages or run in the background.
- **Facebook CDN images** — requested only when you start a collection, using your normal browser session (the same access your browser already has).
- **Local files/folders/ZIPs** — only ones you explicitly select in the file picker.
- **Chrome APIs** — `downloads` (save files), `storage` (preferences), `tabs` / `activeTab` (read the active page), `notifications` (optional completion notices).

PostPocket does **not** use `chrome.cookies`. It never reads, exports or transmits cookie values, session tokens, passwords or login codes.

## 4. Network activity

The only network requests are:
- Loading the Facebook page you navigate to yourself.
- Fetching images you asked to save.
- Chrome Web Store update checks (handled by Chrome, not by PostPocket code).

PostPocket makes no requests to the developer, to analytics providers, or to any third-party SDK. It ships no remote JavaScript or fonts.

## 5. Facebook / Meta compliance

Meta restricts automated collection without written permission. PostPocket is designed as a user-directed tool: you open a post, you review it, you press save. It does not crawl profiles or groups, does not bypass privacy settings or login walls, and contains no stealth or anti-detection mechanisms. For automated use, an authorized Meta API connector or your own Facebook archive import is the appropriate route.

## 6. Sharing and deletion

- PostPocket does not sell, share or upload your images or metadata.
- You can delete individual posts, move them to a recycle bin, clear the entire local library from **Settings → Privacy**, and delete downloaded files from your file system at any time.
- Backups and exports are files you control.

## 7. Permissions summary

| Permission | Why |
| --- | --- |
| `downloads` | Save images and ZIPs into organized folders |
| `storage` | Remember your preferences locally |
| `tabs`, `activeTab` | Read the current Facebook post you choose to scan |
| `notifications` | Optional "collection finished" notice |
| `scripting` | Read the Facebook photo viewer opened by the `+N` tile in a background tab |
| `facebook.com`, `fbcdn.net` host access | Load images you already have access to |

## 8. Contact

PostPocket is provided as-is for personal organization of content you are entitled to save. There is no developer-operated service to contact about collection data, because none is collected.
