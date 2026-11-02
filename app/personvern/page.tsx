import type { Metadata } from "next";
import { DraftNotice, LegalPage, LegalSection, STUDIO_URL } from "@/components/site-chrome";

export const metadata: Metadata = {
  title: "Personvern – Romly",
  description: "Hvordan Romly behandler dataene dine: ingen konto, og prosjektene lagres bare i nettleseren din.",
};

export default function Personvern() {
  return (
    <LegalPage title="Personvern" updated="2. november 2026">
      <DraftNotice>
        <strong>Utkast.</strong> Teksten beskriver hvordan Romly fungerer i dag. Opplysninger om hvem som er ansvarlig, og navnet på driftsleverandøren, mangler fortsatt, og teksten skal gjennomgås juridisk før lansering.
      </DraftNotice>

      <LegalSection title="Kort fortalt">
        <p>
          Romly krever ingen konto og samler ikke inn opplysninger om deg. Prosjektene dine, og filene du laster opp, lagres bare i nettleseren på enheten din. De sendes ikke til oss, og vi har ikke tilgang til dem.
        </p>
      </LegalSection>

      <LegalSection title="Hva som lagres, og hvor">
        <ul className="space-y-2">
          <li>Prosjekter: tegningen, romnavn og mål, dine ønsker, kommune og svarene du gir i prosjektkontrollen.</li>
          <li>Filer du laster opp: bilder og PDF-er av plantegninger.</li>
          <li>En midlertidig gjenopprettingskopi hvis en lagring blir avbrutt, og hvilket prosjekt du sist hadde åpent.</li>
        </ul>
        <p>
          Alt dette ligger i nettleserens lokale lagring (IndexedDB og localStorage) på enheten. Bilder kan inneholde metadata, for eksempel hvor bildet ble tatt. Den blir også værende på enheten.
        </p>
      </LegalSection>

      <LegalSection title="Hva vi ikke gjør">
        <p>Romly har ikke kontoer, bruker ikke sporingskapsler eller analyseverktøy, og viser ikke annonser.</p>
      </LegalSection>

      <LegalSection title="Drift og tekniske logger">
        <p>
          Nettstedet leveres av en driftsleverandør. Som for andre nettsteder kan leverandøren registrere tekniske opplysninger, som IP-adresse og tidspunkt, når sidene lastes. Det brukes til drift og sikkerhet. [Navn på driftsleverandør og lagringstid fylles inn.]
        </p>
      </LegalSection>

      <LegalSection title="Lenker til andre nettsteder">
        <p>Prosjektkontrollen lenker til kilder hos Direktoratet for byggkvalitet (dibk.no) og Lovdata. Når du åpner dem, gjelder deres personvernerklæringer.</p>
      </LegalSection>

      <LegalSection title="Slik sletter du dataene">
        <p>
          I <a href={STUDIO_URL}>designstudioet</a> velger du lagringsknappen øverst til høyre og deretter «Slett alle data». Du kan også slette nettstedsdata for Romly i innstillingene i nettleseren. Sikkerhetskopier du har lastet ned, er dine egne filer og slettes ikke automatisk.
        </p>
      </LegalSection>

      <LegalSection title="Endringer">
        <p>Hvis Romly senere får kontoer, lagring på server eller AI-funksjoner, oppdaterer vi denne erklæringen før endringen tas i bruk.</p>
      </LegalSection>

      <LegalSection title="Kontakt">
        <p>[Selskapsnavn, organisasjonsnummer, adresse og e-post fylles inn.]</p>
        <p>
          Du kan også klage til <a href="https://www.datatilsynet.no" target="_blank" rel="noopener noreferrer">Datatilsynet</a>.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
