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

## Writing a new check

Put one-off scripts in the scratchpad and import the harness by absolute path. Add a check to `smoke.mjs` only if it should guard every release.

```js
import {openBrowser} from 'C:/Users/alan_/fuckshit/oppussingsApp/Oppusings-prosjekt/romly/.claude/skills/romly-browser-qa/qa-harness.mjs';
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
