# Romly

Norsk, interaktiv prototype for et oppussingsstudio. Bygget i HTML, CSS og JavaScript med en SVG-basert skisseeditor.

Kjør `npm.cmd run dev` på Windows (eller `npm run dev`) og åpne http://127.0.0.1:5173. Ingen avhengigheter må installeres.

Arbeidsflaten følger nettleservinduets bredde og høyde uten siderulling. Sidepaneler og dialoginnhold ruller ved behov. På skjermer opptil 900 piksler veksler du mellom Tegning, Verktøy og Egenskaper; selve plantegningen tilpasses automatisk tilgjengelig plass. Oppsettet ligger i `dist/layout.css`.

Prototypen inneholder lokal forhåndsvisning av bilder/PDF-filer, behovsbeskrivelse, tre eksempelplaner, romredigering, materialvalg, møbler, vinduer, dører, skillevegger, romlig visning, angre/gjør om, lokal lagring og eksport/import av prosjektfiler. SVG og prosjektbrief kan lastes ned. TEK17-sjekklisten lenker til DiBK.

AI-bildetolkning, generering fra egen plantegning, en teknisk bygningsmodell, automatisert regelkontroll og kommunale oppslag er ikke tilkoblet. Opplastede filer beholdes bare i minnet mens siden er åpen. Prosjektdata lagres i nettleserens localStorage. Et eksportert prosjekt inneholder rom og ønsker, men ikke opplastede bilder.

Mål er skisseverdier. Den romlige visningen er en visualisering. Bæring, brann, dagslys, våtrom og søknadsplikt må dokumenteres og vurderes for det konkrete tiltaket. Appen sender ingen søknad og gir ingen teknisk eller kommunal godkjenning.
