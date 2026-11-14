# Security

StudyFlow is a static, local-first browser application. It has no server-side user accounts or database.

## Reporting a vulnerability

Please do not open a public issue for a security vulnerability. Report it privately to the maintainer listed in the repository profile, including:

- a short description of the issue;
- reproduction steps;
- browser and OS version;
- the affected version or commit.

## Scope

- HTML/CSS/JavaScript injection through resource titles, notes or program labels.
- Unsafe URL handling or iframe/media embedding.
- Data loss or unintended file deletion in the IndexedDB file store.
- IndexedDB/file-storage cleanup bugs.
- Cross-site scripting or clickjacking in the hosted build.

## Known boundaries

- Attached files are stored in the browser profile and are not encrypted at rest by StudyFlow.
- External links, YouTube/Vimeo embeds and PDF sources may have their own policies and security behaviour.
- A JSON backup contains library metadata, not attached file blobs.
- The app loads Google Fonts from a third-party domain after paint; self-host the fonts if that is not acceptable for your deployment.
- Security headers for the hosted build are in `public/_headers`. A strict CSP needs additional testing because the app intentionally uses inline CSS/JS and user-supplied media embeds.
