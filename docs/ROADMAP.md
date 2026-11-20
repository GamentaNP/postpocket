# PostPocket — Research-backed roadmap

Compiled from 10 parallel research agents (competitor matrix, Chrome/Meta policy, Facebook DOM, UX benchmark, privacy/security, performance, growth, feature gap, testing, accessibility/i18n). Source chat: `docs/chatgpt-full-chat.md`.

---

## 0. Executive verdict

We lead the category on the things competitors get wrong: per-post floating widget, `+N` expansion, local-first library, naming templates, ZIP/CSV/JSON export, no signup, no caps, no review gates, monochrome UI. The market's #1 complaint is carousel/multi-image failure; our wedge is exactly that.

### Honest feature audit (vs. full spec)

- ✅ ~45 features implemented, 🟡 ~35 partial, ❌ ~25 missing.
- **16 settings are cosmetic** — stored and shown in the UI but never read by the worker (`destination`, `quality`, `formats`, `quantity`, `dateFilter`, `existingFiles`, `imageOrder`, `duplicateMode`, `previewMode`, `gridSize`, `concurrency`, `saveMetadata`, `metaDate`, `metaPostId`, `folderHandleName`…). This is worse than a missing feature: users believe options work.
- **3 of 6 collection methods are stubs**: post URL queue, archive import, local files/folder/ZIP import. `PPZip.readZip` and `SourceCard` are implemented but unreachable.
- Store listing currently overclaims those stubs — must fix before launch.
- Remaining effort to full spec parity: **~40–60 dev-days** (excluding approval-dependent Meta connector).

But there are **five P0 blockers** before any store submission:

1. **Chrome policy risk:** the background-tab photo viewer is hidden functionality and likely a rejection/takedown item.
2. **Permissions:** `tabs` + `notifications` + fbcdn host access are broader than needed.
3. **Downloads:** base64 data URLs for images are memory-heavy and can be silently truncated.
4. **Resume:** jobs restart from image #1 after a service-worker kill → duplicates.
5. **No in-product consent / privacy-policy URL** — required even with zero backend.

---

## 1. P0 — must fix before launch

| # | Action | Why | Where |
| --- | --- | --- | --- |
| P0-1 | Replace hidden background-tab expansion with a **visible, user-clicked "Open photo viewer" tab** (or drop it and use current DOM only). Disclose it in listing + privacy policy. | "Misleading or Unexpected Behavior", Limited Use §4, Meta ToS §3.2 | `src/background/service-worker.js` `PP_EXPAND_POST`, `src/content/content.js` |
| P0-2 | Remove `tabs` and `notifications` permissions; keep `activeTab`, `scripting`, `downloads`, `storage`. Narrow host access to `facebook.com` patterns only. | Minimum-permission policy | `manifest.json` |
| P0-3 | Replace image `data:` URLs with **blob URLs from an offscreen document** (`reasons: ['BLOBS']`). Keep data URLs only for tiny JSON/CSV. | ~6–8× memory spike, 64 MB IPC cap, silent truncation | `src/shared/utils.js`, `src/background/queue.js`, `src/background/exports.js` |
| P0-4 | Add a persisted **download cursor** `{postIndex, imageIndex}`; skip completed images on resume; reconcile in-flight `downloadId`s on cold start. | Chrome kills SW after ~30 s idle / 5 min max → duplicate files | `src/background/queue.js` |
| P0-5 | Add **in-product disclosure + affirmative consent** on first use; host `PRIVACY.md` at a public URL; fill CWS privacy fields and Limited Use statement. | CWS requires it even for local-only | `src/ui-react/`, `docs/PRIVACY.md` |
| P0-6 | Graceful failure when Facebook DOM changes; never silently collect avatars/emoji or report false success. | Minimum Functionality policy | `src/shared/scanner.js` |

**Safer strategic alternative (strongest approval path):** reframe as an *offline archive organizer* — import Facebook's own "Download Your Information" export and organize those files locally. No scraping, no host permissions, no Meta ToS exposure. Can coexist with the user-directed current-post flow.

---

## 2. P1 — features competitors have that we should add

Ranked by market demand (from competitor review analysis):

1. **Caption / post-text sidecar as a real file** (`post-text.txt`) — competitors do this; our metadata JSON only.
2. **Skip-already-downloaded / SHA-256 dedupe** with a "already in library" state.
3. **Sequence numbering / auto-increment** in naming templates (direct user request in top-rated extension).
4. **Original-resolution URLs** — prefer `currMedia.image.uri`-style full-res over thumbnails; dedupe by photo ID, not URL.
5. **Pause/resume/retry already exists → surface it better** (status in widget + badge, cancel in progress UI).
6. **Polite pacing + "FullSpeed" toggle** — concurrency 2–4, exponential backoff with jitter, 429/503 handling.
7. **Groups / Pages / search-result source detection** improvements in `detectSource`.
8. **Album / whole-profile batch** — biggest competitor feature we lack, but conflicts with P0-1 policy stance; defer until the compliant path is decided.
9. **Video/Reels/Stories** — largest adjacent demand; new product scope, not v2.2.
10. **EXIF/original timestamp restoration** — $5 upsell in a competitor; nice Pro feature.

**Do NOT add:** cloud sync, accounts, ads, analytics, other social networks — breaks single-purpose and privacy positioning.

---

## 3. P2 — UX, accessibility, i18n

### UX (from AI Exporter / Koptan benchmark)
- Popup should be a **3-second quick card**, not a full grid: context sentence ("12 images found"), 3-thumbnail proof strip + "+9 more", one full-width primary action ("Collect 12 images"), two links (Review & choose → side panel, Open dashboard).
- Fixed 360×420 box, scroll only the middle strip; body 14px, two weights; skeleton-first, <200 ms interactive.
- Floating widget: custom element + **closed shadow root**, draggable, position persisted per hostname, "Hide on this site", teardown on invalidation to prevent duplicates.
- Progress: counts + ETA for >10 s jobs ("Downloading 7 of 42 · ~1 min left"), cancel in the same surface, throttle UI to ≤2–4 updates/sec.
- State order: `first-run → not-applicable → error → loading → offline → empty → list`. One sentence + one action each.

### Accessibility (WCAG 2.2 AA)
- `ThumbGrid`: roving tabindex + arrow/Home/End, `aria-selected`, live region for count, two-tone focus ring.
- `Modal`/`Lightbox`: `role="dialog"`, focus trap, Escape, focus restored to trigger; never open a new window from the popup.
- Toast: persistent `role="status"` live region mounted at app start; errors use `role="alert"`.
- Sidebar: `<nav aria-label>`, `aria-current="page"`, skip link.
- Monochrome contrast: body ≥4.5:1, UI boundaries ≥3:1; don't use pure #FFF body text on #000 for long copy (halation).

### i18n
- `chrome.i18n` does **not support Nepali (`ne`)** → use a custom runtime catalog with `en`/`ne`, stored language setting, `<html lang>` sync.
- First 40 strings catalogued in the accessibility agent report; include Nepali translations.
- Add Devanagari font stack and avoid fixed-height tiles.

---

## 4. P3 — engineering debt

- **Offscreen document** for blob URLs and ZIP building (no 5-min SW cap, no memory spike).
- **fflate streaming ZIP** (STORE/level 0) instead of custom in-memory writer; add caps (`maxZipBytes`, `maxImages`).
- **`unlimitedStorage`** permission, `QuotaExceededError` handling, `navigator.storage.persist()`, retention/prune job.
- **Fetch hardening**: `AbortSignal.timeout(15000)`, Retry-After, exponential backoff + jitter, per-host concurrency 2–4.
- **Tests (P0)**: Vitest for naming/zip/scanner/utils; Playwright on demo pages + widget on mocked FB fixture; jsdom chrome mock. Full plan in the testing agent report.
- **Security**: encrypt image blobs at rest with non-extractable AES-GCM key; `storage.local.setAccessLevel('TRUSTED_CONTEXTS')`; validate all page-originated data; real "delete all" including exported files.

---

## 5. Store launch (from growth research)

- **Title:** keep `PostPocket – Facebook Photo Organizer`.
- **Summary:** "One post. One folder. Every image together. Save every photo in a Facebook post, name files your way, and export a ZIP."
- **Category:** Art & Design (image organization), not Social Media.
- **Avoid "downloader" framing** in CWS listing — it collides with restricted product categories; use *organize / save / export / local-first* on-store, target "download" keywords on our own site.
- **Assets:** 5 screenshots at 1280×800, 440×280 promo tile (required to avoid ranking behind), 1400×560 marquee, 60–90 s demo video.
- **Monetization:** free core + optional $9.99 one-time Pro (intro $6.99/90 days), no account, no ads. Core must work without payment (Featured eligibility).
- **Growth:** 90-day plan: launch → community + SEO content → localization (es/pt-BR) → decision gates based on impressions vs installs vs uninstalls.
- **No guaranteed Featured placement** — curators decide; trial nomination only after clean record.

---

## 6. Suggested next sprint (in order)

0. **Honesty pass:** either wire or hide the 16 dead settings; fix store-listing overclaims; make the 3 stub collection methods real or remove them from the UI.
1. P0-2 permissions trim + P0-5 consent/privacy page (cheap, unblocks review).
2. P0-1 viewer disclosure/visible-tab rewrite **or** commit to archive-import-only positioning — **needs your decision**.
3. P0-3 offscreen blob URLs + P0-4 resume cursor.
4. P1 quick wins: post-text.txt, dedupe, sequence numbering, full-res URL scoring.
5. P2 popup redesign + a11y/i18n foundations.
6. P3 tests + ZIP streaming + hardening.
7. Store assets + listing + launch.

---

## 7. Decision required from you

**Which compliance path do you want?**

- **A. User-directed current-post only** — keep the floating widget and `+N` expansion, but make the viewer tab **visible and explicitly user-clicked**, disclose it, trim permissions. Faster to market, residual ToS grey area.
- **B. Archive-organizer first** — lead with Facebook "Download Your Information" import + local files; current-post saving becomes a secondary user-directed feature. Cleanest review path, no scraping.
- **C. Both, clearly separated** — archive import as the headline, current-post widget as an obviously manual companion with a visible viewer. Most work, strongest product.

My recommendation: **C**, phased — ship B first (clean approval), then add the user-directed widget in a follow-up update once the publisher account has a clean record.
