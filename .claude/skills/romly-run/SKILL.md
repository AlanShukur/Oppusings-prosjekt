---
name: romly-run
description: Start Romly locally (dev server or a production build served by wrangler) and open the landing page, legal pages or studio. Use when asked to run, start, preview or look at the app, before browser QA, or to reproduce a bug that only shows on the deployed site.
---

# Running Romly locally

All commands run from the repo root (`romly/`). Start servers with `run_in_background: true` and stop them with TaskStop when you are done.

## Dev server (fast, hot reload)

```bash
node scripts/run-framework.mjs dev --port 5174 --strictPort
```

- `run-framework.mjs` first bundles three.js into `public/studio/vendor/` (`scripts/build-studio-assets.mjs`), then starts vinext. Without `--port` it uses 5173.
- **3D is bundled once, at start.** `vendor/viewer3d.js` holds its own copy of `viewer3d.js` and everything it imports (`scene-geometry.js`, `furniture.js`). After changing any of those, restart the dev server, or 3D keeps running the old code while 2D already shows the new one.
- Wait until it answers, without using `sleep`:
  ```bash
  for i in $(seq 1 60); do curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:5174/studio/index.html | grep -q 200 && echo ready && break; sleep 1; done
  ```
- Pages:
  - `/` is the landing page.
  - `/personvern` and `/vilkar` are the legal pages.
  - `/studio/index.html` is the studio. It is static files from `public/studio/` with no build step, so a reload picks up edits (except in 3D, see above).

## Production build (what Cloudflare runs)

Use this when a change touches `app/`, `components/` or the deploy, or when something works in dev but not on staging. Some vinext beta bugs only show up in production builds. For example, `<Link>` does not navigate there.

```bash
npm run build
npm start -- --port 8790
```

`npm start` runs `wrangler dev --local` against `dist/server/wrangler.json`. The `dist/` folder is stale until you rebuild.

## What you should see

- **First visit to the studio:** the projects dialog opens with a "first project" button, and there is no sign-in. Projects and files live in this browser's IndexedDB. The status line says "Lagret på denne enheten" after autosave.
- **The example home:** 5 rooms (ids include `living`, `bed1`, `bed2`), 5 doors and 7 windows.
- **Test hooks:** these are on `window.romly`:
  - `editor`: the PlanEditor, with `getState()`, `updateRoom(id, patch)` and `setTool(name)`.
  - `getProject()`, `getUploads()`, `getSession()` and `getActiveRecord()`.
  - `getSync()`, which returns `{dirty, state, revision, …}`.
  - `flush()`.

To look at the page or check it automatically, use the **romly-browser-qa** skill. It drives headless Chrome against any of these URLs.

## Windows notes

- **PowerShell:** call `npm.cmd`, not `npm`.
- **Bash:** `npm` works as usual.
- **`npm run build` fails with `syscall: 'rm'`** right after you stopped a dev or preview server: Windows is still releasing files in `dist/` or `public/studio/vendor/`. Run the build again; it has passed on the second try every time so far.
- **Port already in use:** `--strictPort` makes the server fail instead of silently moving to another port. Stop the old server, or pick another port and pass that URL to QA.
- **`ERR_UNSUPPORTED_ESM_URL_SCHEME`:** `node --import` needs a `file://` URL on Windows, not a path. `scripts/deploy-cloudflare.mjs` shows the pattern: `new URL(..., import.meta.url).href`.
