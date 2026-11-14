# StudyFlow — Daily Study Tracker

[![build](https://github.com/AdsSh/studyflow-app/actions/workflows/build.yml/badge.svg)](https://github.com/AdsSh/studyflow-app/actions/workflows/build.yml)

A focused, single-file study planner and resource library for exam programs. It ships with three ICAZ 2026 Foundation programs — **Management Accounting**, **Corporate & Business Law** and **Financial Accounting** — and you can add any other course, module or qualification as its own program. Each study day becomes a small set of scheduled topics, each with its own checklist, so progress is measured step by step rather than guessed.

**Live app:** https://studyflow-app-8r1.pages.dev · **Single file:** [`StudyFlow.html`](StudyFlow.html)

**Open `StudyFlow.html` in any modern browser.** No install, build step, or server is needed for normal use.

## Build & deploy

For development or hosting, use Node.js 20+:

```powershell
npm run build
npm test
```

This builds `StudyFlow.html` and packages a Cloudflare Pages-ready `dist/index.html` plus `_headers`, `robots.txt` and `.nojekyll`. `npm test` runs the end-to-end suite against the built file and needs Chrome or Chromium; set `CHROME=/path/to/chrome` if it is not found automatically.

Recommended hosting: **GitHub + Cloudflare Pages**. Full setup, security headers, custom-domain and rollback instructions are in [DEPLOY.md](DEPLOY.md).

## What it does

- **Multiple programs** — open the enrolled-program card in the rail to switch between programs or add a new one. Give it a name, course, exam label and date, daily focus target, then build its sections and chapters. Every program keeps its own timetable, syllabus, focus log, streak and analytics.
- **Program builder** — add sections with exam weights and chapters with topics (separate topics with semicolons). Start blank or copy the current program's structure as a template; chapters that already have scheduled sessions are protected from removal, and program details and curriculum can be edited later.
- **Daily plan** — a week strip plus a dated session list. Schedule a topic with a chapter, time block, priority, note and checklist.
- **Fast planning** — repeat a session daily, on weekdays or weekly; copy a whole day to tomorrow; or bulk-plan a chapter by spreading its topics across consecutive 60–120 minute sessions.
- **Carry-over** — unfinished sessions from the last seven days sit in a compact tray. Move one or all into today, or reschedule any session from its options menu.
- **Checklist tracking** — every session is a checklist. Checking steps updates the day's focus time, completion percentage, week marker, streak and analytics immediately.
- **Today / next day** — navigate days, copy a previous plan, or start from an empty day.
- **Syllabus map** — the active program's chapters in their exam-weighted sections. A weighted specification grid, section mastery and chapter-level state make coverage obvious; open a chapter to see its topics, schedule one, or plan the whole chapter.
- **Study library** — keep documents, videos, audio, images and links beside each program. Search the collection, filter by content format and reading status, assign resources to chapters, change status straight from a card, and export a Markdown reading list. Videos, audio, images and PDFs open in an in-app preview when the link or file supports it; every resource still has an "open original" or download route. A starter collection is included for the ICAZ program; new programs begin with an empty library.
- **File uploads** — attach video, audio, image, PDF or Word files up to 250 MB directly to a resource. Files are stored in IndexedDB in this browser and previewed inline (native media players, images, PDF); Word documents download instead. Deleting a resource removes its file, and backups keep resource details but not the attached file contents.
- **Analytics** — 14-day focus chart, section mastery, chapter progress, focus log and rolling 7-day target, all scoped to the active program.
- **Focus timer** — 25/50-minute sprints with pause/reset. It survives page reloads, logs sprints completed while the app was closed, and shows a compact timer chip whenever the timer card is out of view.
- **Settings** — student name, active-program details, program management, JSON backup/import, sample program and a guarded data reset. Backups include every program, its sessions and its library.
- **Data safety** — a full or unavailable browser store raises a persistent "not saving" banner with a one-click backup; an unreadable save is copied to a recovery slot before the app starts fresh; imports can be undone; and a write from another tab raises a reload notice instead of overwriting silently.
- **Export** — download a day's plan as a Markdown study log.
- Search across sessions, chapters and checklist steps; keyboard shortcuts (`N`, `Ctrl/Cmd + K`, `Esc`).
- Responsive from 320px phones to wide desktops. All data is stored locally in the browser (`localStorage`); existing single-program saves migrate automatically.

## Design

White paper surfaces and near-black ink are the primary palette. Royal blue (`#2563EB`) is used only for progress: checked steps, progress bars, active sessions and the focus ring. Typography uses Plus Jakarta Sans for display and Inter for body text when the network is available, with a Segoe UI / system fallback that keeps the app fully offline-capable.

The program switcher is a compact workspace list with progress and exam countdown; the builder uses inline section blocks and chapter rows so a full curriculum can be entered without leaving the dialog. The library uses a dark "continue reading" panel, a collection summary and a card grid with inline reading-status controls. Documents, videos, audio, images and links share the same white/ink/blue language, with format-specific badges and an in-app preview for playable media and PDFs.

## Bundled programs

| Program | Curriculum | Structure |
| --- | --- | --- |
| ICAZ 2026 Foundation · Management Accounting | 17 chapters | Six exam-weighted sections (A–F) |
| ICAZ 2026 Foundation · Corporate & Business Law | 18 chapters / 160 topics | One whole-syllabus section |
| ICAZ 2026 Foundation · Financial Accounting | 19 chapters / 112 topics | One whole-syllabus section |

The Corporate & Business Law and Financial Accounting table-of-contents extracts do not publish section weightings, so they are bundled as single **whole-syllabus** sections rather than inventing exam percentages. Use **Edit program** to split them into parts or rebalance later.

Financial Accounting chapter 4 is untitled in the supplied extract; it is reconstructed as **“Books of prime entry and banking procedures”** from its subsections. The extract also omits chapter 5's 5.0, 5.2 and 5.5 entries; these are preserved as absent rather than invented.

## Project files

| File | Purpose |
| --- | --- |
| `StudyFlow.html` | The finished single-file app — the deployable artifact |
| `src/` | Readable source (`index.html`, `styles.css`, `views.css`, `data.js`, `render.js`, `app.js`) |
| `build.mjs` | Inlines the source into `StudyFlow.html` |
| `scripts/package.mjs` | Packages the build as `dist/index.html` with hosting files |
| `public/` | Cloudflare Pages `_headers` and `robots.txt` |
| `package.json` | `npm run build` / `npm run check` scripts |
| `.github/workflows/build.yml` | CI build, E2E checks and artifact upload |
| `tools/test.mjs` | End-to-end interaction checks using a local Chrome/Chromium install (`npm test`) |
| `tools/verify.mjs` | CDP screenshot tool |
| `shots/` | Verification screenshots |
| `DEPLOY.md` | GitHub and Cloudflare Pages deployment guide |
| `PRIVACY.md` / `SECURITY.md` | Privacy and vulnerability-reporting notes |
| `ref-extract/` | Local source extracts — excluded by `.gitignore` for copyright reasons |

The Management Accounting chapters and section weightings come from `DeepSeek_interprete,extractan_20261113-1213.zip`. The Corporate & Business Law table of contents comes from `DeepSeek_interpret,extractand_20261114-1612.zip`. The Financial Accounting table of contents comes from `DeepSeek_interpret,extractand_20261114-1649.zip`. The local reference extracts are **not** part of the public repository; confirm redistribution rights before making the bundled syllabus content public. Custom programs are created from within the app, and each program keeps its own resource library.

## Data & limits

- Library files are stored in **IndexedDB** in this browser. The JSON backup keeps the resource and file metadata, but not the file contents, so files must be re-attached after restoring on another device or browser profile.
- One file per resource, up to **250 MB**. Available space still depends on the browser's storage quota.
- Inline video/audio/image/PDF previews depend on the browser and source. Blocked embeds and Word/PowerPoint files fall back to an open-or-download action.
- All study data remains local: there is no account, cloud sync or server.
- A corrupt or unreadable saved state will not delete attached files; the file store is only pruned after a successful load or an explicit delete/reset operation.
- **130 automated end-to-end checks** run with `npm test` after `npm run build`. CI runs the syntax check, production build and the full Chrome E2E suite on every push and pull request.

## Privacy & licence

The app stores study data and attached files locally in the browser. See [PRIVACY.md](PRIVACY.md) for external font/link/hosting details and [SECURITY.md](SECURITY.md) for vulnerability reporting.

The software is released under the [MIT License](LICENSE). Bundled syllabus text and third-party content are **not** automatically covered by that licence; confirm redistribution rights before publishing.

