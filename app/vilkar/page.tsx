import type { Metadata } from "next";
import { DraftNotice, LegalPage, LegalSection } from "@/components/site-chrome";
import { COMPANY, companyLine, filled } from "@/lib/company";

export const metadata: Metadata = {
  title: "Vilkår – Romly",
  description: "Vilkår for bruk av Romly, og hva den veiledende prosjektkontrollen betyr.",
};

export default function Vilkar() {
  return (
    <LegalPage title="Vilkår for bruk" updated="2. november 2026">
      {!COMPANY.legalReviewed && (
        <DraftNotice>
          <strong>Utkast som skal gjennomgås av advokat før lansering.</strong> Selskapsopplysninger, ansvarsbegrensning og verneting er ikke ferdig formulert.
        </DraftNotice>
      )}

      <LegalSection title="Om tjenesten">
        <p>
          Romly er et verktøy for å skissere planløsninger for boligen din og få en veiledende vurdering mot byggteknisk forskrift (TEK17). Tjenesten er en tidlig versjon. Funksjoner kan endres eller fjernes.
        </p>
      </LegalSection>

      <LegalSection title="Prosjektkontrollen er veiledende">
        <ul className="space-y-2">
          <li>Kontrollen sammenligner tegningen og opplysningene du gir med preaksepterte ytelser i DiBKs veiledning til TEK17. Preaksepterte ytelser er én måte å oppfylle kravene på. Andre løsninger kan dokumenteres.</li>
          <li>Kontrollen er ikke en godkjenning, en teknisk kontroll eller en bindende vurdering av om tiltaket er søknadspliktig.</li>
          <li>Du som tiltakshaver er ansvarlig for å vurdere om tiltaket er søknadspliktig. Er du i tvil, kontakt kommunen.</li>
          <li>Mål i tegningen er skisseverdier og må kontrolleres mot oppmåling.</li>
          <li>Bæring, brannsikkerhet, våtrom og ventilasjon må prosjekteres og utføres av kvalifiserte fagfolk.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Ditt ansvar">
        <p>
          Du er ansvarlig for at opplysningene du legger inn er riktige, og for avgjørelsene du tar på grunnlag av dem. Last bare opp filer du har rett til å bruke.
        </p>
      </LegalSection>

      <LegalSection title="Lagring og sikkerhetskopi">
        <p>
          Prosjektene lagres bare i nettleseren på enheten din. Vi kan ikke hente tilbake data som er slettet eller tapt, for eksempel når nettleserdata slettes. Last ned sikkerhetskopier av arbeid du vil ta vare på.
        </p>
      </LegalSection>

      <LegalSection title="Ingen garanti">
        <p>
          Tjenesten leveres som den er. Vi arbeider for at regelverket som brukes er oppdatert, men kan ikke garantere at tjenesten er feilfri eller passer for ditt konkrete prosjekt. [Ansvarsbegrensning formuleres etter juridisk gjennomgang.]
        </p>
      </LegalSection>

      <LegalSection title="Endringer i vilkårene">
        <p>Vi kan endre vilkårene. Vesentlige endringer varsles på nettstedet før de gjelder.</p>
      </LegalSection>

      <LegalSection title="Lovvalg og kontakt">
        <p>Vilkårene reguleres av norsk rett. Verneting: {filled(COMPANY.venue, "verneting")}.</p>
        <p>Tjenesten leveres av {companyLine()}.</p>
      </LegalSection>
    </LegalPage>
  );
}
