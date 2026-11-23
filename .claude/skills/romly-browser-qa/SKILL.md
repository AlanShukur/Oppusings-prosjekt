---
name: romly-browser-qa
description: Check Romly in a real headless Chrome (local dev, a local production build, staging or production). Has a ready smoke test and a small DevTools-protocol harness for writing new checks and taking screenshots. Use after changing the studio or public pages, after a deploy, or whenever unit tests can't show that something works in the browser.
---

# Browser QA for Romly

Unit tests (`npm test`) cover the pure modules. This skill covers what only shows up in a browser:
- IndexedDB
- real clicks and navigation
- uncaught errors
- vinext production-build bugs

## Everything at once, and CI

```bash
npm run build && npm run test:browser      # all ten checks below, against a local production build
npm run test:browser -- https://romly-staging.romly.workers.dev   # or against a running site
npm run test:e2e                            # Playwright: pointer, keyboard and touch in Chromium, Firefox and WebKit
```

- **CI:** the "Browser checks" job runs both on every PR and on `main`. A new check script must be added to `CHECKS` in `scripts/browser-checks.mjs`, or CI won't run it.
- **Reading a CI failure:** the job log needs a GitHub login, but the runner writes each failing check as an error annotation. Read them from the public API: find the "Browser checks" check run under `/commits/<sha>/check-runs`, then `/check-runs/<id>/annotations`.
- **Fonts differ on CI:** GitHub's Linux runners use a wider font than Windows. A layout that only just fits locally can overlap there, as the phone step bar did. To reproduce locally, enlarge the text's `font-size` by 25 % in the page and look for the overlap.
- **Playwright (`e2e/`):** use it for behaviour that must hold in Firefox and Safari's engine. The checks in this skill use Chrome only.
  - It starts its own dev server on port 5176; set `ROMLY_URL` to test a running site.
  - Playwright has multi-touch only in Chromium. In WebKit the pinch test sends touch pointer events to `#floorplan`. Send them to the container, not the SVG inside it: the editor replaces the SVG on every render.
  - Wait for `romly.getSync().dirty === false` before a reload; the status text can still say "saved" from before the last change.

## Smoke test (run this first)

```bash
node .claude/skills/romly-browser-qa/smoke.mjs <base-url>
```

| Target | Base URL |
|---|---|
| Dev server (see **romly-run**) | `http://127.0.0.1:5174` (the default) |
| Local production build | `http://127.0.0.1:8790` |
| Staging | `https://romly-staging.romly.workers.dev` |
| Production | `https://romly.romly.workers.dev` |

It checks:
- **Public pages:** the landing page and its links (clicking "Personvern" must navigate), `/vilkar`, and no sign-in text.
- **Studio:** a first visit with no sign-in, creating a project, uploading a file to IndexedDB, autosave, reloading, and the TEK17 check dialog.
- **Whole run:** zero `/api/` requests and zero uncaught errors.

Screenshots and `results.json` go to `%TEMP%\romly-qa`. Read the PNGs to actually look at the result, and show the user any that matter. The exit code is 0 only when every check passes. Each run uses a fresh temporary Chrome profile, so it never sees the user's own projects and never leaves data behind.

## Dialog check

```bash
node .claude/skills/romly-browser-qa/dialogs.mjs <base-url>
```

Run this after moving or changing studio UI code. It opens every dialog from its own button and runs its main action:
- **Steps 1 and 2:** creating a project, naming it in Grunnlag, and choosing a plan variant in Planforslag.
- **Small dialogs:** help, shortcuts, the wall advice, inspiration (colours the selected room) and "Legg til rom".
- **Zoom and tools:** the zoom buttons, and the R and Escape keys.
- **Export:** SVG, the brief and the project file. Then it imports that file as a new project.
- **Storage:** the space used, a full backup, and "Slett alle data" with its confirm step. It then restores the backup, deletes one project and opens the other.
- **Plan import:** uploading a floor plan, marking two points 6 m apart, and using it as the drawing reference.

To download a file, it replaces `URL.createObjectURL` for one call, as `walls.mjs` does. "Importer prosjektfil" builds a detached `<input type=file>`, so the script catches it with a one-time `document.createElement` hook and puts it in the page for `setFiles`. File-chooser interception (`Page.setInterceptFileChooserDialog`) stops any real chooser from opening.

## Readability check

```bash
node .claude/skills/romly-browser-qa/a11y.mjs <base-url>
```

Run this after any CSS change or new UI text. At desktop (1366), tablet (900) and phone (390) widths it checks the projects dialog, Grunnlag, the studio (each phone tab), a selected element and the check dialog:
- **Size:** every visible text is at least 11px.
- **Contrast:** every visible text meets WCAG AA against what is actually behind it (layers blended). The threshold is 4.5:1, or 3:1 for text of 24px, or 18.66px bold.
- **Overlap:** no text overlaps other text or a control it isn't part of.
- **Sideways scrolling:** none.

It skips disabled controls (exempt from contrast rules), SVG text in the drawing, and the toast. A text-size change can push neighbours into each other without clipping anything; the overlap test catches that. Boxes are cut to their scrolling ancestors first, so text scrolled out of a panel doesn't count.

It also skips `.visually-hidden` text, which is for screen readers only.

## Roadmap check

```bash
node .claude/skills/romly-browser-qa/roadmap.mjs <base-url>
```

Run this after changing the roadmap, the check's application rules, or anything a roadmap step reads (uploads, the baseline, wall marks, the questions). It follows one project from start to finish:
- **New project:** it opens on «Veien til søknad» with 7 steps, a split, and «Send søknad» last; only «Opprett prosjektet» is done.
- **Ticking off:** drawing a home, saving today's layout from the step, marking a load-bearing wall and answering the questions tick the steps off, and the header button counts along.
- **The branch:** the chart takes «Krever trolig søknad»; the other way says «Ikke aktuelt nå».
- **Finishing:** the manual ticks, the brief, and the «Send søknad» hand-off (DiBK links, "Romly sender ingenting", never "godkjent").
- **Reload and switch:** a reload reopens the roadmap with the same ticks; a non-load-bearing wall switches to «Ser ikke ut til å kreve søknad».

**New projects open on the roadmap,** not on Grunnlag. A check that needs the studio closes it with `#roadmap-close`; one that needs Grunnlag clicks the step's `[data-roadmap-action="ground"]` button.

## Photo tools check

```bash
node .claude/skills/romly-browser-qa/photo-tools.mjs <base-url>
```

Run this after changing the import dialog, `photo-correct.js` or the calibration in `reference-loader.js`. It builds its own test photo in the page: a 12 × 8 m plan, warped onto a grey table with the real `homography` from `photo-correct.js` (loaded with a dynamic `import('/studio/photo-correct.js')`), turned sideways and saved as a JPEG. Then:
- **Rotate and straighten:** «Roter mot høyre» turns it upright. The four corner handles are dragged with real mouse events onto the plan's corners, and one is moved with the arrow keys. «Rett opp» must leave no grey table along the edges.
- **Scale:** 10 000 mm one way and 6 000 mm across must give exactly 12 × 8 m. Without the second dimension the proportions are only the side-length estimate, so don't assert them.
- **Saving:** the reference is the «(rettet).jpg» copy, it reloads from IndexedDB, and Grunnlag lists both files.
- **Phone:** at 390 px the dialog has no sideways scroll, and a corner drags with touch events (`Input.dispatchTouchEvent` after `Emulation.setTouchEmulationEnabled`).

To place a click at a point in the picture, map it through `#calibration-svg`'s `getScreenCTM()`. The SVG letterboxes the image and, while straightening, adds a margin around it.

## Touch and keyboard check

```bash
node .claude/skills/romly-browser-qa/touch-keyboard.mjs <base-url>
```

Run this after changing pointer handling in `plan.js`, the keyboard handler, or the elements and wall lists. It checks:
- **Pinch (phone):** two real touch points (`Input.dispatchTouchEvent`, after `Emulation.setTouchEmulationEnabled`) zoom in and back out, change nothing in the drawing, and don't zoom the page.
- **Keyboard (desktop):**
  - the drawing is a tab stop with a name and instructions;
  - «Elementer i tegningen» selects an element and moves focus to the drawing;
  - arrows, N / Shift+N, E, Delete, + and - work there;
  - the live region (`#canvas-status`) announces selections and "Går gjennom en vegg.";
  - «Vegger i rommet» selects a wall and focuses Status.

## Furniture check

```bash
node .claude/skills/romly-browser-qa/furniture.mjs <base-url>
```

Run this after changing furniture, the overlap check, doors or the Interiør list. It checks:
- **The list:** the Interiør tab lists all 16 pieces in 4 groups, with sizes.
- **Sizes:** a new double bed is 1,6 × 2 m; resizing it to 1,8 m changes the drawing; an out-of-range size is refused; the size survives a reload.
- **Overlaps:** a sofa through a wall and a chair where a door swings get red outlines (`[data-item-problem]`). Egenskaper says why, and the door names the chair.
- **The door:** «Bytt hengselside» mirrors it. «Slå andre veien» turns it, keeps the hinge end and clears the chair.
- **3D:** it opens with the furniture.

Restart the dev server before running it if you changed anything 3D imports (see **romly-run**).

## Plan format check

```bash
node .claude/skills/romly-browser-qa/plan-version.mjs <base-url>
```

Run this after any change to the saved plan format (`PLAN_VERSION`). It puts two projects straight into IndexedDB: one saved before versioning and one marked version 99. It then checks:
- **The old project:** it opens with its doors and windows and is re-saved in the current version.
- **The version-99 project:** it is refused on startup and from the project list with the "reload" message, and is never overwritten.

When a migration adds new fields, extend the script so it checks the migrated values too.

## Wall check

```bash
node .claude/skills/romly-browser-qa/walls.mjs <base-url>
```

Run this after changing walls, the 2D editor's click handling or the inspector. It clicks the Stue / Soverom 1 wall with a real mouse event, then checks:
- **The panel and drawing:** the "Vegg" panel opens; "Rives" and "Bærende" give the dashed red line, the right hint and the legend.
- **Keys:** Delete removes nothing and Escape closes the panel.
- **Persistence and 3D:** the note survives a reload, and 3D opens.
- **The TEK17 check:** "Riving av bærende vegg" is reported as needing an application, the downloaded project brief lists the wall under "ENDRINGER I VEGGER", and "Vis i tegningen" selects the wall again.
- **Resetting:** going back to the default stores nothing.

To read a downloaded file in a check, replace `URL.createObjectURL` for one call and read the Blob's text; `walls.mjs` does this for the brief. The harness refuses real downloads (`Browser.setDownloadBehavior: deny`). Before that, every run saved copies of the brief and SVG into the user's Downloads folder.

## Baseline check

```bash
node .claude/skills/romly-browser-qa/baseline.mjs <base-url>
```

Run this after changing "Dagens planløsning", `plan-diff.js` or the check rules that use it. It sets up Stue + Bod, saves the baseline through the dialog, then merges the Bod into a bedroom. It checks:
- **Drawing:** the ghost of the removed wall.
- **The check:** "Var veggen bærende?" with Ja/Nei; answering Ja turns it into "Fjernet bærende vegg", and "Bod blir oppholdsrom" is reported.
- **Brief, reload and dialog:** the brief's "DAGENS PLANLØSNING" section, a reload, and the dialog summary.
- **Removal:** the two-step Fjern, then Ctrl+Z.

When a check tests that something is hidden, use the computed `display`, not the `hidden` attribute. `.info-banner` once overrode `hidden`, and only a screenshot caught it.

On a phone the panel is under the *Egenskaper* tab (`[data-workspace-panel="properties"]`), like the room and element panels.

## Writing a new check

Put one-off scripts in the scratchpad and import the harness by absolute path. On Windows that path must be a `file:///` URL: a bare `C:/…` import fails with `ERR_UNSUPPORTED_ESM_URL_SCHEME`. Add a check to `smoke.mjs` only if it should guard every release.

When a new check guards a refactor, run it against staging (the old code) first. If it passes there, a failure on the refactored code points at the change, not at the check.

```js
import {openBrowser} from 'file:///C:/Users/alan_/fuckshit/oppussingsApp/Oppusings-prosjekt/romly/.claude/skills/romly-browser-qa/qa-harness.mjs';
const b = await openBrowser({base: 'http://127.0.0.1:5174', width: 390, height: 844, mobile: true});
try {
  await b.go('/studio/index.html');
  await b.until(`!!window.romly`, 'studio loaded', 30000);
  const rooms = await b.evaluate(`romly.editor.getState().rooms.length`);
  b.check('example home has five rooms', rooms === 5, String(rooms));
  await b.shot('mobile-studio');
} catch (error) { b.check('script completed', false, error.message); }
process.exit(await b.finish() ? 0 : 1);
```

The harness returns:

| Name | What it does |
|---|---|
| `go(path)` | Navigates to the base URL plus `path`. |
| `evaluate(expr)` | Runs `expr` in the page. It is awaited, and the result is returned by value. |
| `until(expr, label, ms)` | Polls until `expr` is truthy. Prefer this to fixed sleeps. |
| `shot(name)` | Saves a screenshot and returns its path. |
| `setFiles(selector, [paths])` | Fills a real `<input type=file>`. |
| `check(name, ok, detail)` | Records one result. |
| `finish()` | Adds the page-error check, writes `results.json`, closes Chrome, and returns whether everything passed. |
| `send(method, params)` | Sends a raw DevTools-protocol command. |
| `errors`, `apiRequests` | Collected while the script runs. |

## Driving the studio

- **Test hooks:** `window.romly` gives you `editor`, `getProject()`, `getUploads()`, `getActiveRecord()`, `getSync()` and `flush()`. Changing the plan through `romly.editor` (for example `updateRoom`, `setTool`, or `selectedItem = id; render()`) is more reliable than synthetic drags.
- **Pointer and wheel tests:** these dispatch `PointerEvent` and `WheelEvent` on `#floorplan`. `setPointerCapture` throws for synthetic pointers; `PlanEditor.capture()` already tolerates that.
- **Selectors that have been stable:**
  - Dialogs: `#app-dialog`, `#dialog-content`.
  - Projects and files: `#first-project-btn`, `#create-project-name`, `#create-project-submit`, `#file-input`, `#upload-list`, `#ground-cancel`.
  - Toolbar and status: `#save-status`, `#profile-btn` (the storage dialog), `#check-btn`, `#check-results .check-item[data-status]`.
  - Item inspector: `#item-properties`.
- **Rejected promises:** a promise rejected inside `evaluate` counts as handled, so it never reaches `errors`. To test the crash reporter, throw from a `setTimeout`.
- **Hidden elements:** to tell whether something is hidden, check `getComputedStyle(el).display` and not only `el.hidden`. CSS can override the `hidden` attribute.

If Chrome is not at `C:/Program Files/Google/Chrome/Application/chrome.exe`, set `CHROME_PATH`.
