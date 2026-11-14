# Deploying StudyFlow

Recommended path: **GitHub for source + Cloudflare Pages for the static build**.

The app is a single HTML file. Cloudflare Pages only needs:

- an `index.html` at the output root;
- no server or database;
- no environment secrets.

## 0. Before publishing

1. **Confirm content rights.** The bundled syllabus data is derived from supplied ICAZ extracts. Do not publish those extracts or a public build unless you have the right to redistribute the content. `ref-extract/` is excluded by `.gitignore`.
2. Decide whether the GitHub repository will be **private or public**. Start private if licensing is unresolved.
3. Review `PRIVACY.md` and `SECURITY.md`, and replace placeholder contact details.
4. Choose the app/domain name and check for trademark conflicts.
5. Replace the MIT copyright holder in `LICENSE` if needed.

## 1. Build locally

Requirements: Node.js 20 or newer.

```powershell
npm run build
```

This:

1. syntax-checks `src/data.js`, `src/render.js` and `src/app.js`;
2. builds the single-file `StudyFlow.html`;
3. packages `dist/index.html`;
4. copies `public/_headers`, `public/robots.txt` and `.nojekyll` into `dist/`.

Expected output:

```text
Packaged dist/index.html — … KB
```

Open `dist/index.html` or `StudyFlow.html` directly in a browser to smoke-test.

## 2. Create the GitHub repository

```powershell
git init
git branch -M main
git add .
git commit -m "StudyFlow v1.0.0"
git remote add origin https://github.com/YOUR_NAME/studyflow.git
git push -u origin main
```

Check `git status` before committing. `.test-profile/`, `.shots-profile/`, `dist/` and `ref-extract/` should not be staged.

Suggested repository settings:

- description: “A local-first daily study planner, syllabus tracker and resource library”;
- topics: `study-planner`, `education`, `local-first`, `static-site`;
- enable secret scanning and Dependabot;
- protect `main` and require the build check.

## 3. Create the Cloudflare Pages project

1. Open the Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
2. Select the repository.
3. Use these settings:

| Setting | Value |
| --- | --- |
| Project name | `studyflow` |
| Production branch | `main` |
| Framework preset | **None** |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Environment variable | `NODE_VERSION=22` |

4. Save and deploy.
5. Open the generated `https://studyflow.pages.dev` URL.
6. Smoke-test the deployed build (see below).
7. Enable preview deployments for pull requests.

No build secrets are required.

## 4. Custom domain

1. Add the domain to Cloudflare (or change its nameservers to Cloudflare).
2. In the Pages project → **Custom domains** → add the apex and/or `www` hostname.
3. Cloudflare creates the DNS record and certificate automatically.
4. Set the preferred redirect (for example, `www` → apex) if desired.
5. Re-test the production URL and HTTPS.

## 5. Headers and caching

`public/_headers` ships:

- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` without camera/microphone/geolocation
- `X-Frame-Options: DENY`
- `Cross-Origin-Opener-Policy: same-origin`
- HSTS
- `Cache-Control: max-age=0, must-revalidate` for `index.html`

A strict Content-Security-Policy is intentionally not included yet. The app uses inline CSS/JS and user-supplied media/PDF iframes; a CSP needs testing for `script-src 'unsafe-inline'`, `frame-src https:`, `media-src blob: https:`, `img-src blob: data: https:` and Google Fonts before enabling it.

## 6. CI

`.github/workflows/build.yml` runs the syntax check, build and the full Chrome E2E suite on pushes and pull requests, then uploads `dist` as an artifact.

The E2E suite is not part of the Cloudflare build step. Run it locally after a build:

```powershell
npm run build
npm test
```

The harness finds Google Chrome or Chromium automatically. Set `CHROME=/path/to/chrome` if your browser lives elsewhere.

## 7. Production smoke test

- Plan, checklist, timer, analytics and syllabus pages.
- All three bundled programs and creating a fourth.
- Schedule/edit/delete a session and reload.
- Upload image/audio/PDF files; preview, reload, delete.
- Export/import a backup and reset data.
- External links, embedded media and blocked embeds.
- Keyboard navigation, focus trap and `Ctrl/Cmd + K`.
- 320, 390, 768, 1024 and 1440 px widths.
- Firefox and Safari, especially IndexedDB and PDF preview.
- Lighthouse performance/accessibility.
- Confirm no excluded local files or extracts appear in the deployed output.

## 8. Rollback and releases

- Cloudflare Pages keeps deployment history; use **Rollback** to return to a previous deployment.
- Tag releases in Git (`v1.0.0`) and attach `StudyFlow.html` to a GitHub Release for a direct single-file download.
- Keep `main` deployable; use branches for larger changes.

## 9. Optional: direct upload with Wrangler

If Git integration is not available:

```powershell
npm run build
npx wrangler pages deploy dist --project-name studyflow
```

Git integration is preferred because it gives preview deployments and automatic rebuilds.

## 10. Licensing reminder

The MIT licence applies to the software. It does not grant rights to redistribute ICAZ syllabus text, screenshots of copyrighted pages, or third-party fonts. Resolve those rights before making the repository or site public.
