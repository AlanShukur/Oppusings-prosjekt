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

To read a downloaded file in a check, replace `URL.createObjectURL` for one call and read the Blob's text; `walls.mjs` does this for the brief.

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
