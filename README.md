# Romly

Tidlig produktversjon av et norsk oppussingsstudio, med forside, personvern- og vilkårssider (Vinext på Cloudflare Workers) og designstudioet i `public/studio/`.

**Innlogging er slått av inntil videre.** Studioet krever ingen konto: prosjekter og opplastede filer lagres i nettleserens IndexedDB på enheten (`public/studio/local-store.js`) og sendes ikke til serveren. Brukeren kan laste ned en sikkerhetskopi av alle prosjekter og slette alle data fra lagringsknappen i studioet.

Serverlaget fra forrige versjon er beholdt, men brukes ikke av studioet: `lib/projects-api.mjs` (D1/R2, ChatGPT-innlogging via Sites) og testene. Det er grunnlaget for kontoer senere. `local-store.js` følger samme kontrakt, så studioet kan bytte tilbake til serverlagring ved å gi `ProjectSync` skyklienten fra `cloud.js`.

## Lokal utvikling

Bruk Node.js 22.13 eller nyere, Git og tar. På Windows brukes `npm.cmd` for å unngå PowerShells sperre av npm.ps1.

```powershell
npm.cmd run install:ci
npm.cmd run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_windy_sunset_bain.sql
npm.cmd run dev
```

Åpne adressen serveren skriver ut, normalt http://127.0.0.1:5173. Hvis porten er opptatt: `npm.cmd run dev -- --port 5174`.

Studioet ligger på `/studio/index.html`, forsiden på `/`. D1-oppsettet over trengs bare for serverlaget og testene av det; studioet bruker det ikke så lenge innlogging er slått av.

## Det som fungerer

- Forside på `/` som forklarer Romly, og utkast til personvern (`/personvern`) og vilkår (`/vilkar`). Selskapsopplysninger mangler, og tekstene skal gjennomgås juridisk før lansering.
- Flere prosjekter uten konto, lagret i nettleseren. Lagringsknappen viser brukt plass og gir sikkerhetskopi (JSON med alle tegninger og ønsker) og «Slett alle data». Sikkerhetskopien kan hentes inn igjen med «Importer prosjektfil».
- Automatisk lagring, synlig lagringsstatus og revisjonskontroll, slik at to faner ikke overskriver hverandre. Konflikter kan løses ved å hente den lagrede versjonen eller lagre egne endringer som et nytt prosjekt.
- Gjenopprettingskopi ved avbrutt lagring.
- Opplasting av JPG, PNG, WebP og PDF til enheten: inntil 20 MB per fil og 12 filer per prosjekt. Filtypen kontrolleres ut fra innholdet.
- Importer en egen plantegning som underlag, velg PDF-side og sett målestokk med to punkter og en kjent avstand. Tegn egne rom oppå underlaget. Opplasting alene tolker ikke rommene automatisk.
- Forhåndsvisning og sletting av filer. Sletting av prosjekt fjerner filene samtidig. En fil som brukes som underlag, kan ikke slettes.
- Eksplisitt import av prosjektet fra prototypens `romly-project-v1`. JSON-import oppretter et eget prosjekt; JSON-eksport inkluderer tegning og ønsker, men ikke filer.
- Romredigering, materialer, møbler, dører, vinduer, skillevegger, angre/gjør om, SVG-eksport og prosjektbrief.
- Designstudioet: panorering og zoom med rullehjul (25–400 %), flytting av egne rom med festing til naborom, rotering (Q/E), duplisering (Ctrl+D) og flytting med piltaster. Dører og vinduer følger veggen de står på. Vinduer og dører har mål (glassbredde, glasshøyde, underkant, fri bredde), og rom kan ha takhøyde, tidligere bruk og romtypen Bod.
- Veiledende TEK17-kontroll (`public/studio/tek17-check.js`) beregnet fra tegningen og svarene i «Om boligen og tiltaket»: utsyn, dagslys, romhøyde, snuareal, bad, dørbredde, rømningsvindu, bod, ventilasjon, våtrom og søknadsplikt. Hver regel har kilde på dibk.no eller lovdata.no og kontrolldato. Mangler det opplysninger, vises det som ukjent, og kontrollen sier aldri «godkjent».
- Ekte 3D med Three.js: romgulv, vegger med dør- og vindusåpninger, møbler, rotasjon, zoom og valg mellom åpne eller hele vegger. Egne opptegnede rom bruker samme modell som 2D-redigeringen.

Oppstarten leser lagringen i nettleseren én gang. Musebevegelser samles til én opptegning per skjermbilde, og 3D tegner bare ved endringer. PDF.js og Three.js lastes først når de trengs; ingen nettbaserte skrifter eller CDN-er er nødvendige.

Arbeidsflaten følger vinduets bredde og høyde uten siderulling. Paneler og dialoginnhold ruller ved behov. På smale skjermer velges Tegning, Verktøy eller Egenskaper.

## Kode og verifisering

- `public/studio/`: editor, grensesnitt og prosjektlagring (`local-store.js` i nettleseren; `cloud.js` er klienten for serverlaget). Dette er kildefilene; `dist/` genereres av byggingen.
- `scripts/build-studio-assets.mjs`: bygger den valgfrie 3D-modulen og kopierer PDF.js, worker og lokale ressurser til ignorert `public/studio/vendor/`. Kjøres automatisk ved utvikling og bygging.
- `app/page.tsx`, `app/personvern/`, `app/vilkar/` og `components/site-chrome.tsx`: forsiden og de juridiske sidene.
- `app/api/[...path]/route.ts`: serverruter og innlogget identitet (brukes ikke av studioet nå).
- `lib/projects-api.mjs`: validering, autorisasjon, revisjoner, D1 og R2. Inntil 1 GB filer per konto.
- `public/studio/tek17-check.js`: regelmotoren for prosjektkontrollen. Terskler og kilder ble kontrollert 01.11.2026 og må kontrolleres på nytt når DiBK endrer veiledningen.
- `docs/SPRINTPLAN.md`: plan fra dagens prototype til lansering.
- `docs/DEPLOY.md` og `scripts/deploy-cloudflare.mjs`: staging (`romly-staging`) og produksjon (`romly`) på egen Cloudflare-konto. `.github/workflows/deploy.yml` publiserer staging ved hver sammenslåing til `main` og produksjon bare når den startes manuelt. Workflowen hopper over publisering til Cloudflare-hemmelighetene er lagt inn.
- `public/studio/error-reporter.js` og `/api/client-errors`: krasjrapporter fra studioet, uten prosjektinnhold, skrives til serverloggen (Workers Logs) merket med miljø.
- `lib/company.ts` og `docs/LEGAL-REVIEW.md`: selskapsopplysninger for personvern og vilkår på ett sted, og underlag til advokat.
- `.github/workflows/ci.yml`: syntakssjekk og tester uten installasjon, deretter lint og bygging.
- `db/schema.ts` og `drizzle/`: skjema og versjonerte migrasjoner.
- `.openai/hosting.json`: eksisterende Site-ID og logiske `DB`/`BUCKET`-bindinger. Sites oppretter ressursene og anvender migrasjoner ved publisering.

```powershell
npm.cmd run check
npm.cmd test
npm.cmd run build
```

Testene bruker faktisk SQLite med applikasjonens SQL-migrasjon. De dekker blant annet brukerisolasjon, samtidige oppdateringer, filgrenser, lagringsfeil, opprydding, lokal gjenoppretting, eierskap til underlag, målestokk og delt 2D-/3D-geometri.

## Gjenstående produktarbeid

Du kan starte med en egen importert plantegning eller en tydelig merket eksempelplan. AI-tolkning av egne plantegninger, automatiske forslag fra egen bolig, en teknisk bygningsmodell og kommunale oppslag er ikke implementert. TEK17-delen er en veiledende kontroll av tegningen mot preaksepterte ytelser; den har ingen bæringsmodell, ingen «dagens planløsning» å sammenligne med og bare én etasje.

Mål er skisseverdier og den romlige visningen er en illustrasjon. Bæring, brann, dagslys, våtrom og søknadsplikt må dokumenteres for det konkrete tiltaket. Appen sender ingen byggesøknad og gir ingen teknisk eller kommunal godkjenning.
