# Romly – underlag for juridisk gjennomgang

*Utarbeidet 2. november 2026 som underlag for advokat. Dokumentet beskriver hvordan tjenesten faktisk fungerer, og hvilke spørsmål vi trenger svar på. Det inneholder ingen juridiske vurderinger.*

## Hva Romly er

En gratis nettjeneste for privatpersoner som vil pusse opp. Brukeren tegner eller importerer plantegningen av boligen sin, prøver nye planløsninger i 2D og 3D, og får en **veiledende** kontroll av tegningen mot preaksepterte ytelser i DiBKs veiledning til byggteknisk forskrift (TEK17). Kontrollen omfatter blant annet utsyn, dagslys, romhøyde, dørbredder, rømningsvindu, bod og spørsmål om søknadsplikt (pbl § 20-1, SAK10). Hvert punkt viser kilde (dibk.no / lovdata.no) og dato for når regelgrunnlaget ble kontrollert. Tjenesten er en tidlig versjon og sender ingen byggesøknad.

## Dataflyt i dag

- **Ingen konto og ingen innlogging.**
- **Prosjektdata lagres bare lokalt i brukerens nettleser** (IndexedDB og localStorage): tegning, romnavn, mål, ønsker, kommune, svar i kontrollen og opplastede bilder/PDF-er av plantegninger. Dette sendes ikke til oss. Bilder kan inneholde metadata, for eksempel GPS-posisjon.
- **Feilrapporter:** ved krasj sender nettleseren en kort teknisk rapport til serveren. Den inneholder feiltekst, kodeposisjon, sidesti og versjon, aldri prosjektinnhold. E-postadresser og lange tallrekker fjernes. Rapporten skrives til driftsleverandørens logg.
- **Driftslogger:** driftsleverandøren (planlagt Cloudflare, Inc.) kan registrere IP-adresse og tidspunkt for forespørsler.
- Ingen sporingskapsler, analyseverktøy eller annonser.
- Brukeren kan laste ned en sikkerhetskopi (JSON) og slette alle data på enheten fra appen.

## Tekster som skal gjennomgås

| Tekst | Hvor |
|---|---|
| Personvernerklæring | `/personvern` (`app/personvern/page.tsx`) |
| Vilkår for bruk | `/vilkar` (`app/vilkar/page.tsx`) |
| Ansvarsfraskrivelse for kontrollen | Vises i kontrollen, i nedlastet prosjektbrief og i vilkårene (`DISCLAIMER` i `public/studio/tek17-check.js`) |
| Påstander i markedsføring | Forsiden `/` (`app/page.tsx`) |
| Lagringsinformasjon til bruker | Lagringsdialogen i studioet |

Selskapsopplysninger, driftsleverandør, lagringstid og verneting fylles inn i `lib/company.ts`. Når teksten er godkjent, settes `legalReviewed: true`, og utkastmerkingen forsvinner.

## Spørsmål

1. **Ansvar for veiledende regelverksinformasjon til forbrukere.** Er formuleringene i ansvarsfraskrivelsen og vilkårene dekkende og gyldige overfor forbrukere? Hvordan bør en ansvarsbegrensning formuleres for en gratis tjeneste? Bør noen formuleringer i kontrollen endres (vi bruker aldri «godkjent», og statusene er «Ser ut til å oppfylle preakseptert ytelse», «Bør avklares», «Oppfyller ikke preakseptert ytelse», «Mangler opplysninger» og «Krever trolig søknad»)?
2. **Markedsføring.** Er påstandene på forsiden i tråd med markedsføringsloven, særlig «se hva byggteknisk forskrift sier om endringene»?
3. **Personvern.** Behandler vi personopplysninger når prosjektdata bare ligger på brukerens enhet? Hvilket behandlingsgrunnlag gjelder for feilrapporter og driftslogger? Trengs databehandleravtale og grunnlag for overføring til USA med driftsleverandøren?
4. **Lokal lagring.** Krever bruk av IndexedDB/localStorage for å lagre brukerens egne prosjekter samtykke etter ekomloven, eller er det nødvendig for tjenesten brukeren ber om?
5. **Opplastede tegninger.** Plantegninger kan være laget av arkitekter. Bør vilkårene regulere brukerens rett til å laste opp og bearbeide dem, selv om filene bare lagres lokalt?
6. **Vilkår og endringer.** Hvordan varsles endringer i vilkårene uten konto eller e-post? Hvilket verneting bør vi bruke?
7. **Fremover.** Hva må være på plass før vi innfører (a) kontoer med lagring på server, (b) AI-tolkning av opplastede plantegninger hos en ekstern leverandør, og (c) betaling?
