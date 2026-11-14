# Privacy

**Effective:** 14 November 2026

StudyFlow is a local-first application. It has no account system, backend API or database server.

## What stays on your device

- Programs, sessions, checklist progress, notes and settings are stored in your browser's `localStorage`.
- Library files you attach (video, audio, image, PDF or document) are stored in your browser's IndexedDB.
- Nothing in the core planner is uploaded to a StudyFlow server.
- Exporting a daily log or JSON backup downloads a file directly to your device.

## External requests

The app itself does not include analytics, advertising or tracking pixels. However:

- **Typography** is requested from Google Fonts after the page has painted; your browser sends a request to Google. The app falls back to system fonts if that request fails.
- **Links and embeds** you open, including YouTube, Vimeo, ICAZ, IFRS and other sites, are third-party requests governed by those sites' privacy policies.
- **Uploaded media** is loaded from a local object URL and is not sent to a third party by StudyFlow.
- **Hosting**: when the app is served from Cloudflare Pages, Cloudflare processes requests and may keep standard access logs (IP address, user agent, timestamp) for security and operations. See Cloudflare's privacy documentation.

If you enable Cloudflare Web Analytics or any other analytics later, update this page and add the relevant disclosure before publishing.

## Your controls

- **Settings → Reset all data** clears sessions, focus logs and library data.
- Clearing site data in your browser removes `localStorage`, IndexedDB files and the saved focus timer.
- Export a backup before clearing data. JSON backups include library metadata but **not attached file contents**.

## Children

The app is a general study tool and does not knowingly collect personal information from anyone.

## Contact

For privacy questions, open an issue in the project repository or contact the maintainer listed there.

## Changes

This policy may be updated when hosting, analytics or data features change. The effective date above will be revised.
