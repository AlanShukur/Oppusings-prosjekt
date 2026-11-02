# Romly – sprint plan to launch

*Written 2 November 2026. Assumes 1–2 developers and two-week sprints. Finding IDs (ED-, API-, TEK-, PG-, LB-) refer to the code review done the same day; the full verified list is at the end.*

## 1. Where Romly stands against the vision

| Vision step | Today | Gap to launch |
|---|---|---|
| 1. Photograph a home or floor plan and have it understood | Upload JPG/PNG/WebP/PDF, set scale with two points, trace rooms by hand | No AI interpretation. Photos can't be rotated, cropped or perspective-corrected |
| 2. Plan suggestions for your needs (more bedrooms, an extra bathroom) | Three hard-coded variants of the example home. Your wishes are saved as text | No generator for the user's own plan |
| 3. Check feasibility against TEK17, including what can be demolished | **New:** an indicative check based on the drawing, covering about 15 rules from TEK17, SAK10 and pbl, with verified thresholds and sources | No baseline ("today's layout"), no load-bearing walls in the model, one floor only |
| 4. Floorplanner-style sandbox | 2D/3D editor. **New:** pan and zoom, moving rooms, snapping, rotating, duplicating, measured windows and doors | Rectangular rooms only, 4 furniture types, no wall thickness, no PDF drawings |
| 5. "Is this ready for the municipality?" | **New:** questions on whether an application is needed and a brief that records the inputs, sources and ruleset version | No municipality or zoning lookup, no drawing package, nothing submitted |

What already works well and should be kept: the security model (server-side authorization, file-type checks by content, sandboxed downloads, revision control on saves, local recovery), the shared 2D/3D geometry, and the test suite.

## 2. Sprint 0 – done in this session

All changes are in the working tree, not committed. 110 automated tests pass (74 before) and 23 browser checks pass against the local Worker.

**Editor correctness**
- Shared walls were being stored twice, so 3D doors were walled over (ED-M1). Fixed in `deriveWalls`.
- Resizing a room no longer leaves gaps or overlaps between rooms (ED-1, ED-7).
- Renaming or recolouring a room no longer resizes it.
- The example home's doors and windows are now real plan items. They survive drawing a new room, and 2D, 3D and the check now agree (ED-2, TEK-2). The entrance hall now opens to the living room instead of a bedroom (TEK-M4).
- Doors and windows stay on their wall when it moves and slide along walls when dragged. If one ends up away from a wall it gets a red warning. A window can't be placed away from a wall (ED-4, TEK-M2).
- Doors are drawn in the same place in 2D and 3D and swing the same way. "Snu" flips a door (R3D-1, ED-10).
- The wall tool respects the server's 300-element limit, and a second finger no longer corrupts undo (ED-8, ED-12).
- SVG export always contains the whole plan, unaffected by zoom or the traced underlay (ED-11).

**Sandbox, closer to Floorplanner**
- The view stays where you leave it, with wheel zoom (25–400 %), a pan tool (H) and drag-to-pan (ED-3).
- In your own plans, rooms can be moved, and their edges snap to neighbouring rooms (ED-5, ED-M2).
- Walls can be drawn as a continuous chain.
- Items can be rotated (Q/E), duplicated (Ctrl+D) and nudged with the arrow keys (ED-6).
- An inspector sets window glass size and sill height, door free width, and entrance and escape-window flags.
- New Bod room type, plus per-room ceiling height and "used today as".
- Room labels show their dimensions (ED-15).

**TEK17 check** (`public/studio/tek17-check.js`, 12 tests)
- Covers utsyn § 13-8, daylight § 13-7, room height § 12-7, turning space § 12-7/12-8, bathroom § 12-9, doors § 12-13, escape windows § 11-13, storage § 12-10, ventilation § 13-2, wet rooms § 13-15, and whether an application is needed (pbl § 20-1/20-5, SAK10 § 2-1/4-1).
- Applies the relief for converting rooms in homes applied for before 1 July 2011 (§ 1-2 eighth paragraph).
- Every threshold was checked against dibk.no and lovdata.no on 1 November 2026, and each result links its source.
- When an input is missing, it reports "mangler opplysninger" instead of guessing. It never says "godkjent".
- The downloadable brief records the ruleset version, your answers and the assumptions.

**Client and server**
- Dialog text is always escaped.
- Delete no longer fires while a button has focus.
- Decimal commas are accepted everywhere.
- Control characters can no longer block saving.
- Switching suggestion asks before discarding your edits.
- An expired login offers sign-in.
- A save whose response was lost is no longer reported as a conflict.
- Only true revision conflicts stop autosave, and short outages are retried.
- A failed underlay no longer re-downloads on every edit.
- On the server: new optional fields are allowlisted, there's a 1 GB per-account storage quota, and failure logs are diagnosable.
- CI: `.github/workflows/ci.yml`. It hasn't run on GitHub yet.

## 3. Decisions only you can make, before Sprint 1

1. **Sign-in and hosting.** *Decided 2 November 2026: sign-in is removed for now.* The studio stores projects and files in the browser, using IndexedDB through `public/studio/local-store.js`, and never calls the server. The server code is kept, unused, for when accounts return. That later work is a users table, then email magic-link sign-in, then Vipps Login, plus a "move my projects to my account" import from the local store.
2. **AI provider and data processing.** Floor plans and photos contain addresses and, in their EXIF data, GPS position (LB-5). Pick a provider with an EU data processing agreement and zero data retention, and decide whether users must opt in.
3. **Legal.** Romly gives regulatory guidance to consumers. You need a privacy policy, terms of use and a liability disclaimer, all reviewed by a Norwegian lawyer before public launch (LB-3). Company details must appear on the site.
4. **Business model.** *Recommendation:* sketching and the check are free. Paid: AI interpretation, the drawing and PDF package, and hand-off to an architect or structural engineer (RIB). B2B for contractors comes later.

## 4. Sprints

### Sprint 1 (9–20 Nov): launch foundations
Done on branch `sprint-1-local-first` (2 Nov):
- Sign-in removed. Projects and files are stored on the device, with the same revision, limit and file-sniffing rules as the server.
- Full backup and restore, "Delete all data" behind a confirmation, and storage usage shown to the user. This covers export and delete of all data (LB-4, API-6) for as long as there are no accounts.
- A landing page at `/`, with no login popup (LB-10).
- Draft privacy and terms pages, linked from the landing page and the studio footer (LB-3). They still need company details, the hosting provider's name and a legal review.
- Verified by 119 tests, a production build, and 36 browser checks. One of the checks confirms the studio makes no requests to `/api`.

No longer needed while data stays on the device: EXIF stripping (photos never leave the device), server rate limiting, and D1/R2 backups. They come back with accounts.

Remaining:
- Staging and production environments.
- Error monitoring that collects no personal data.
- Optionally, privacy-friendly analytics. The privacy page must be updated first.
- Fill in the company details and get the legal review.
- *Acceptance:* a new user can use Romly from the landing page with no account, take a backup, delete everything, and restore from the backup.

### Sprint 2: plan model v2 and sandbox quality
- `plan.schemaVersion` and migrations (M-1, API-1).
- Walls become their own entities with *existing / new / demolish* status and a *load-bearing yes/no/unknown* flag. Wall annotations survive a resize (ED-16, TEK-M3).
- **"This is today's layout"** saves a baseline. The check compares against it to find removed walls, new windows, new bathrooms and change of use (TEK-16).
- More furniture with real sizes, a door hinge-side flag, and an overlap check.
- Pinch zoom on mobile, keyboard access to the drawing (REG-1), larger text and better contrast (ED-7).
- Split `app.js` into modules: dialogs, projects, check and studio. Add Playwright tests for pointer and touch.
- *Acceptance:* trace a real plan, mark a wall as removed, and the check asks whether it is load-bearing and flags that an application may be needed.

### Sprint 3: AI floor-plan interpretation (vision step 1)
- Server endpoint `POST /api/projects/:id/analyze`. It sends the uploaded plan to a vision model and returns rooms, walls, openings and a scale guess with confidence, using the same plan JSON. Quotas per user, cost logging, and stored results (PG-1, PG-7).
- A correction step: AI results appear as a suggestion over the traced underlay, and the user accepts, adjusts or rejects each one. Nothing is saved without confirmation.
- Photo import gets rotation, cropping and perspective correction (R3D-3), plus a scale picked from a dimension in the drawing.
- An evaluation set of 50 Norwegian floor plans, tracking room count, area error and opening recall per release.
- *Acceptance:* on 80 % of the evaluation plans, a user gets a correct room layout in under 3 minutes of corrections.

### Sprint 4: plan suggestions (vision step 2)
- A rule-based generator working from the baseline: split rooms, change room types, place a new bathroom near the existing wet zone, keep load-bearing walls unless the user allows otherwise (PG-3).
- Every candidate is scored by the TEK17 engine (utsyn, daylight, turning space, storage) and by your wishes. An AI model explains the trade-offs but never decides compliance.
- Open a suggestion in the sandbox as an undoable change.
- *Acceptance:* "one more bedroom" on a typical 3-room flat gives at least two suggestions that pass utsyn and daylight.

### Sprint 5: ready for the municipality (vision step 4)
- Pick the municipality by kommunenummer and look up the address through the Geonorge address API (TEK-M5). Research APIs for zoning and municipal plan lookups.
- The application-needed triage is driven by the baseline diff, with the user confirming.
- A drawing package: PDF at 1:50/1:100 with title block, north arrow and dimensions, showing today's and the new plan side by side. Guidance on what to attach (SAK10 § 5-4) and on notifying neighbours (§ 5-2).
- Map Romly's rules to DiBK's national building-case checklists. Use the wording "klar for faglig gjennomgang", never "klar til innsending".
- Hand-off to an architect or structural engineer with the brief prefilled.
- *Acceptance:* a non-load-bearing change inside one unit produces a complete PDF package and a clear "probably no application needed" with sources.

### Sprint 6: beta and launch
- Closed beta with 20–50 households, five moderated usability tests, and fixes from both.
- Legal review signed off. Pricing live. Performance budget and SEO.
- Process for keeping the ruleset current: watch DiBK's change history, add a CI test that every rule has a source and a check date, and tie each saved report to the ruleset version it used.
- Public launch.

## 5. Remaining verified backlog (not done in Sprint 0)

- **Editor:** auto-generated furniture can't be edited (ED-13). Re-rendering on every drag frame is slow (ED-20). Rectangular rooms only, and a wall graph with thickness is needed (Sprint 2).
- **3D:** GPU memory and cache are never pruned (R3D-11). WebGL context-loss handling (R3D-4). Underlay is re-rasterised on every open (R3D-7). Shadows from cut-away walls (R3D-12). Corner notches (R3D-13). No selection highlight or keyboard control in 3D (R3D-15). No image export (R3D-16). Duplicated geometry in the 3D bundle (R3D-14).
- **Client:** focus handling when one dialog opens another (ED-5c). Incomplete ARIA on tabs and swatches (ED-17c). Import to the open project replaces its plan without asking (MISS-3). The project list shows the example thumbnail for imported plans (MISS-5).
- **Server:** uploads share the 45 s timeout (API-4). Immutable files are sent `no-store` (API-7). Uploads are fully buffered in memory (API-10). Stuck pending/deleting files are never cleaned up automatically (API-M3). Inline PDFs may render blank (API-9, unverified). Security headers for the static studio (API-2).
- **Repo hygiene:**
  - An empty outer git repo wraps the nested `romly/.git`, which also needs `git -c safe.directory` because of mismatched folder ownership (HYG-1).
  - About 136 MB of QA Chrome profiles and a deploy tarball sit in the folder (HYG-1).
  - Unused template code: the shadcn kit, examples and connectors (HYG-2).

## 6. Main risks

| Risk | Mitigation |
|---|---|
| Users read the check as approval | "Veiledende" framing everywhere, no "godkjent", sources on every result, legal review |
| TEK17 guidance changes | Versioned ruleset, check date on every rule, reports tied to their ruleset |
| AI interpretation is inaccurate on real plans | Human correction step, evaluation set, confidence shown to the user |
| Projects are lost when browser data is cleared (no accounts yet) | Backup and restore, persistent-storage request, clear warnings in the storage dialog and the terms; accounts later |
| Personal data in plans and photos | EXIF stripping, data processing agreement, data export and delete |
