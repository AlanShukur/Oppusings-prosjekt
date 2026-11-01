# Romly

Tidlig produktversjon av et norsk oppussingsstudio. Eksisterende SVG-editor og responsive arbeidsflate er beholdt. Et Vinext/Cloudflare Worker-serverlag lagrer prosjekter i D1 og private vedlegg i R2.

Innloggingen leveres av Sites med ChatGPT-kontoen. Alle prosjekt- og filoperasjoner kontrollerer innlogget bruker på serveren. Nettstedets eksisterende private tilgang er beholdt.

## Lokal utvikling

Bruk Node.js 22.13 eller nyere, Git og tar. På Windows brukes `npm.cmd` for å unngå PowerShells sperre av npm.ps1.

```powershell
npm.cmd run install:ci
npm.cmd run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_windy_sunset_bain.sql
npm.cmd run dev
```

Åpne adressen serveren skriver ut, normalt http://127.0.0.1:5173. Hvis porten er opptatt: `npm.cmd run dev -- --port 5174`.

Lokal utvikling simulerer innlogging med testbrukeren `local_seedy`. Bruk innloggingslenken i appen. Denne simuleringen er kun aktiv i den lokale utviklingsserveren; publisert innlogging håndteres av Sites. Lokale D1/R2-data ligger i den ignorerte `.wrangler/state/` og er atskilt fra produksjonsdata.

## Det som fungerer

- Flere private prosjekter, kontovisning og utlogging.
- Automatisk serverlagring, synlig lagringsstatus og revisjonskontroll ved samtidige endringer. Konflikter kan løses ved å hente kontoversjonen eller lagre egne endringer som et nytt prosjekt.
- Gjenopprettingskopi ved avbrutt lagring, avgrenset til bruker og prosjekt i nettleseren.
- Varig opplasting av JPG, PNG, WebP og PDF: inntil 20 MB per fil og 12 vedlegg per prosjekt. Filtype, størrelse og eierskap kontrolleres på serveren.
- Importer en egen plantegning som underlag, velg PDF-side og sett målestokk med to punkter og en kjent avstand. Tegn egne rom oppå underlaget; rom, målestokk og valgt side lagres på kontoen. Opplasting alene tolker ikke rommene automatisk.
- Private forhåndsvisninger, nedlasting og sletting av vedlegg. Sletting av prosjekt fjerner vedleggene; feil ved opprydding kan prøves igjen. Avbrutte opplastinger kan ryddes etter en 15 minutters frist.
- Eksplisitt import av prosjektet fra prototypens `romly-project-v1`. Den gamle lokale kopien beholdes. JSON-import oppretter et eget prosjekt; JSON-eksport inkluderer tegning og ønsker, men ikke vedlegg.
- Romredigering, materialer, møbler, dører, vinduer, skillevegger, angre/gjør om, SVG-eksport og prosjektbrief.
- Ekte 3D med Three.js: romgulv, vegger med dør- og vindusåpninger, møbler, rotasjon, zoom og valg mellom åpne eller hele vegger. Egne opptegnede rom bruker samme modell som 2D-redigeringen.

Oppstarten bruker ett samlet serverkall. Musebevegelser samles til én opptegning per skjermbilde, og 3D tegner bare ved endringer. PDF.js og Three.js lastes først når de trengs; ingen nettbaserte skrifter eller CDN-er er nødvendige.

Arbeidsflaten følger vinduets bredde og høyde uten siderulling. Paneler og dialoginnhold ruller ved behov. På smale skjermer velges Tegning, Verktøy eller Egenskaper.

## Kode og verifisering

- `public/studio/`: editor, grensesnitt og klient for prosjektlagring. Dette er kildefilene; `dist/` genereres av byggingen.
- `scripts/build-studio-assets.mjs`: bygger den valgfrie 3D-modulen og kopierer PDF.js, worker og lokale ressurser til ignorert `public/studio/vendor/`. Kjøres automatisk ved utvikling og bygging.
- `app/api/[...path]/route.ts`: serverruter og innlogget identitet.
- `lib/projects-api.mjs`: validering, autorisasjon, revisjoner, D1 og R2.
- `db/schema.ts` og `drizzle/`: skjema og versjonerte migrasjoner.
- `.openai/hosting.json`: eksisterende Site-ID og logiske `DB`/`BUCKET`-bindinger. Sites oppretter ressursene og anvender migrasjoner ved publisering.

```powershell
npm.cmd run check
npm.cmd test
npm.cmd run build
```

Testene bruker faktisk SQLite med applikasjonens SQL-migrasjon. De dekker blant annet brukerisolasjon, samtidige oppdateringer, filgrenser, lagringsfeil, opprydding, lokal gjenoppretting, eierskap til underlag, målestokk og delt 2D-/3D-geometri.

## Gjenstående produktarbeid

Du kan starte med en egen importert plantegning eller en tydelig merket eksempelplan. AI-tolkning av egne plantegninger, automatiske forslag fra egen bolig, en teknisk bygningsmodell og automatisert regelkontroll er ikke implementert. TEK17-delen er en veiledende sjekkliste med DiBK-kilder.

Mål er skisseverdier og den romlige visningen er en illustrasjon. Bæring, brann, dagslys, våtrom og søknadsplikt må dokumenteres for det konkrete tiltaket. Appen sender ingen byggesøknad og gir ingen teknisk eller kommunal godkjenning.
