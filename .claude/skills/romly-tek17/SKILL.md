---
name: romly-tek17
description: Add, change or verify rules in Romly's TEK17 check (public/studio/tek17-check.js). Covers the result format, statuses, how inputs reach the engine, verifying thresholds against DiBK and Lovdata, the ruleset version, Norwegian wording, and tests. Use for anything touching the "Sjekk prosjektet" results, the facts form, the project brief report or building-regulation logic.
---

# The TEK17 check

`public/studio/tek17-check.js` is a pure module with no DOM:

```js
evaluatePlan(plan, project) → {ruleset, results, summary, assumptions}
```

It compares the drawing and the user's answers with DiBK's *preaksepterte ytelser* (preaccepted performance levels). It is indicative only and never approves anything. Users plan real building work from it, so a wrong "ok" is the worst possible bug.

## Results

Inside `evaluatePlan`, every finding goes through one helper:

```js
add(ruleId, ref, title, status, message, {roomId})
```

**The first three arguments:**
- **`ruleId`:** the form is `tek17-<section>`, optionally with `-<word>` (for example `tek17-13-8`, `tek17-plan`). The section must be a key in `SOURCES`, which gives the link. For non-TEK sources, pass `{url}` in the last argument.
- **`ref`:** what the user sees, for example `'TEK17 § 13-8'`.
- **`title`:** a short topic such as `'Utsyn'`. When a `roomId` is set, the UI adds " · <room name>" itself.

**`status`:** one of `brudd`, `soknad`, `advarsel`, `ukjent`, `ok`, `info`. `STATUS_ORDER` sorts them.
- `brudd`: the drawing clearly does not meet the preaccepted level.
- `soknad`: the change probably needs a building application (pbl § 20-1 / SAK10).
- `advarsel`: uncertain from the drawing, for example a wall that might not be exterior.
- `ukjent`: an input is missing. **Never assume a value.** Ask for it, and say where to enter it ("Oppgi … under «Om boligen»").
- `ok`: met, based on what was drawn and entered.
- `info`: context only.

**Last two arguments:**
- **`message`:** a full Norwegian sentence that names the room as «…». Format numbers with `fmt()`, which gives nb-NO decimal commas.
- **`roomId`:** links the result to a room, which enables "Vis i tegningen" in the UI.
- **`wallKey`:** links the result to a wall instead; "Vis i tegningen" then selects that wall. A wall question (`ukjent`) with a `wallKey` is answered on the wall, so it gets no "Legg inn opplysninger" button.

## Inputs

- **From the plan:** `rooms`, plus `walls` and `openings` derived through `scene-geometry.js`. Use `windowsOf`, `doorsOf` and `exteriorIsUncertain` rather than re-deriving them.
- **Per room:** `ceilingHeight` and `previousUse`. Per opening: `width`, `height`, `sillHeight`, `entrance` and `escape`.
- **Per wall:** `status` (existing/new/demolish) and `loadBearing` (unknown/yes/no) on every wall from `deriveWalls`, read from `plan.walls`.
  - Group walls by `wall.key`, so a wall drawn in several pieces is reported once.
  - The drawing may only make the questionnaire's answer stricter.
- **Changes since the baseline:** `diff = compareToBaseline(plan)` is computed once at the top of `evaluatePlan`, and is `null` without a baseline.
  - **Removed walls** carry the baseline's load-bearing note. Results about them pass `{baselineWallKey}`, and the check dialog then shows Ja/Nei buttons that call `editor.updateBaselineWall`.
  - **Other changes:** exterior opening changes, new bathrooms (less than half of the room was a bathroom today) and storage→stay rooms (at least half of a `storage` room) answer the facade, bathroom and change-of-use questions from the drawing. For example, `bearingWall` is the stricter of `measures.bearingWall` and what the demolished walls say.
- **Per project:** `project.building` (for example `lightTransmission`, `permitBefore2011`) and `project.measures` (for example `useChange`).
- **A new input needs all of these:**
  1. A question in `FACT_QUESTIONS` in `app.js`, or a field in the room or item inspector.
  2. An entry in the allowlist in `lib/projects-api.mjs`, with a range.
  3. A test.

  See **romly-studio** for which files change together.

## Changing a threshold or adding a rule

1. **Verify the source before writing code.** Fetch the `SOURCES` URL (dibk.no veiledning or lovdata.no) and read the current text. Don't rely on memory: DiBK revises the guidance.
2. **Comment the code.** Above the check, write a short comment naming the paragraph and the exact preaccepted level, like the existing ones.
3. **Update the ruleset.**
   - Set `RULESET.version` to today whenever the rules change; the downloaded report records it, so old reports stay tied to the ruleset they were made with. Update the test that pins it.
   - Change `RULESET.verified` only after re-checking every source. Users see it as "regelverk kontrollert" in `DISCLAIMER`, the check dialog and the report. Checking one page for a new rule is not enough: record that date in the rule's comment instead.
   - If the rule refers to a section not yet listed, add it to `SOURCES`.
4. **Existing buildings:** requirements apply only to the parts of the building the change affects (pbl § 31-2). Respect the relief in § 1-2 åttende ledd: `exempt128`, which covers a change of use from tilleggsdel to hoveddel in homes applied for before 1 July 2011.
5. **Wording:**
   - Never write "godkjent", "lovlig" or anything that sounds like approval.
   - The tiltakshaver (the person ordering the work) is responsible.
   - "Ser ut til å oppfylle" is the strongest positive phrasing.
   - Keep the `DISCLAIMER` meaning intact.

## Tests (`tests/tek17-check.test.mjs`)

- **Helpers:**
  - `room(id, x, y, w, h, type, extra)` builds a room in plan units.
  - `examplePlan()` is the studio's example home.
  - `find(report, ruleId, roomId)` returns the results for one rule.
- **Cover each status a rule can produce,** at least `ok`, the failing status, and `ukjent` when the input is missing. Put values exactly on the threshold.
- **The example home must keep zero `brudd`** (the first test). If a real rule change breaks that, fix the example (`exampleOpenings` in `plan.js`) and say so.
- **Run** `npm test`, then open the check dialog with **romly-browser-qa** to see the wording in context.
