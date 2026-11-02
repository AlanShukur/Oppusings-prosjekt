import Link from "next/link";
import { SiteFooter, SiteHeader, STUDIO_URL } from "@/components/site-chrome";

const FONT = { fontFamily: "Manrope, ui-sans-serif, system-ui, sans-serif" };

const STEPS = [
  {
    title: "Grunnlag",
    text: "Last opp plantegningen som bilde eller PDF, sett målestokk med to punkter og tegn rommene oppå.",
  },
  {
    title: "Planforslag",
    text: "Skriv hva du ønsker deg, for eksempel et ekstra soverom, og utforsk ulike planløsninger. I dag med eksempelforslag – forslag for din egen bolig kommer.",
  },
  {
    title: "Designstudio",
    text: "Juster rom, flytt vegger, plasser dører, vinduer og møbler, og se resultatet i 3D.",
  },
  {
    title: "Prosjektkontroll",
    text: "Få en veiledende sjekk mot byggteknisk forskrift (TEK17): utsyn, dagslys, romhøyde, dørbredder, rømning og om tiltaket kan kreve søknad. Med kilder til DiBK.",
  },
];

function PlanIllustration() {
  return (
    <svg viewBox="0 0 420 300" className="h-auto w-full" role="img" aria-label="Skisse av en plantegning med stue, to soverom, bad og entré">
      <rect x="20" y="20" width="380" height="260" rx="6" fill="#f6f3ec" />
      <rect x="40" y="40" width="200" height="220" fill="#f0e9dc" />
      <rect x="240" y="40" width="140" height="95" fill="#e4e9df" />
      <rect x="240" y="135" width="140" height="70" fill="#e9ebdf" />
      <rect x="295" y="205" width="85" height="55" fill="#e2eaf0" />
      <rect x="240" y="205" width="55" height="55" fill="#efe9df" />
      <g fill="none" stroke="#4e584e" strokeWidth="6" strokeLinecap="square">
        <rect x="40" y="40" width="340" height="220" />
      </g>
      <g fill="none" stroke="#626a60" strokeWidth="4">
        <path d="M240 40v220M240 135h140M240 205h140M295 205v55" />
      </g>
      <g stroke="#fbfdfd" strokeWidth="8">
        <path d="M90 40h90M290 40h60M380 70v40M40 120v60" />
      </g>
      <g stroke="#9bb8bd" strokeWidth="1.6">
        <path d="M90 37h90M90 43h90M290 37h60M290 43h60M377 70v40M383 70v40M37 120v60M43 120v60" />
      </g>
      <g fill="none" stroke="#8f948e" strokeWidth="1.4">
        <path d="M240 90a24 24 0 0 0-24 24M240 165a22 22 0 0 0-22 22" />
      </g>
      <rect x="70" y="170" width="48" height="70" rx="6" fill="#c9cfc2" />
      <rect x="140" y="190" width="60" height="45" rx="14" fill="#e6d8bf" />
      <rect x="300" y="55" width="55" height="65" rx="3" fill="#f9f8f1" stroke="#9ea494" />
      <rect x="305" y="148" width="50" height="45" rx="3" fill="#f9f8f1" stroke="#9ea494" />
      <g fontFamily="Manrope, system-ui, sans-serif" fontSize="11" fontWeight="600" fill="#515a50" textAnchor="middle">
        <text x="140" y="110">Stue / kjøkken</text>
        <text x="310" y="128">Soverom 1</text>
        <text x="310" y="200">Soverom 2</text>
        <text x="337" y="250">Bad</text>
        <text x="267" y="250">Entré</text>
      </g>
      <g transform="translate(56 54)">
        <rect width="132" height="26" rx="13" fill="#ffffff" stroke="#c9e6d3" />
        <text x="66" y="17" textAnchor="middle" fontFamily="Manrope, system-ui, sans-serif" fontSize="10.5" fontWeight="600" fill="#2f6b45">Utsyn og dagslys ✓</text>
      </g>
    </svg>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen bg-white text-[#22202a]" style={FONT}>
      <SiteHeader />
      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-14 sm:px-8 md:grid-cols-[1.05fr_1fr] md:py-20">
          <div>
            <p className="mb-4 inline-flex rounded-full bg-[#f2ecfa] px-3 py-1 text-xs font-semibold tracking-wide text-[#6a52bf]">
              TIDLIG VERSJON · GRATIS · INGEN KONTO
            </p>
            <h1 className="text-4xl leading-[1.08] font-extrabold tracking-[-1.5px] sm:text-5xl">
              Gi hjemmet ditt nye muligheter.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-[#5f5a6b]">
              Tegn boligen din, prøv en ny planløsning i 2D og 3D, og se hva byggteknisk forskrift sier om endringene – før du snakker med håndverkere eller kommunen.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href={STUDIO_URL} className="rounded-lg bg-[#7961cf] px-5 py-3 font-semibold text-white transition hover:bg-[#6a52bf] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7961cf]">
                Start i designstudioet
              </a>
              <a href="#slik-fungerer-det" className="rounded-lg border border-[#e3dcee] px-5 py-3 font-semibold text-[#3d3947] transition hover:border-[#cbbfe0]">
                Slik fungerer det
              </a>
            </div>
          </div>
          <div className="rounded-2xl border border-[#ece7f3] bg-[#fbf9fd] p-4 shadow-sm">
            <PlanIllustration />
          </div>
        </section>

        <section id="slik-fungerer-det" className="border-y border-[#ece7f3] bg-[#fbf9fd]">
          <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8">
            <h2 className="text-2xl font-extrabold tracking-[-0.6px] sm:text-3xl">Fra plantegning til en plan du kan ta videre</h2>
            <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((step, index) => (
                <li key={step.title} className="rounded-xl border border-[#ece7f3] bg-white p-5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#7961cf] text-sm font-bold text-white">{index + 1}</span>
                  <h3 className="mt-4 font-bold">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#5f5a6b]">{step.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-6 px-5 py-14 sm:px-8 md:grid-cols-2">
          <div className="rounded-xl border border-[#ece7f3] p-6">
            <h2 className="text-xl font-extrabold tracking-[-0.4px]">Dataene dine blir hos deg</h2>
            <p className="mt-3 leading-relaxed text-[#5f5a6b]">
              Du trenger ingen konto. Tegninger, ønsker og filer du laster opp lagres bare i nettleseren på enheten din, og sendes ikke til noen server. Last ned en sikkerhetskopi når du vil ta vare på arbeidet.
            </p>
            <Link href="/personvern" className="mt-4 inline-block text-sm font-semibold text-[#6a52bf] underline underline-offset-4">Les om personvern</Link>
          </div>
          <div className="rounded-xl border border-[#ece7f3] p-6">
            <h2 className="text-xl font-extrabold tracking-[-0.4px]">Veiledende, ikke godkjenning</h2>
            <p className="mt-3 leading-relaxed text-[#5f5a6b]">
              Romly sammenligner tegningen med DiBKs preaksepterte ytelser og viser kilden for hvert punkt. Det er et godt utgangspunkt for samtalen med fagfolk, men ingen teknisk kontroll. Bæring, brann og søknadsplikt må alltid avklares for ditt konkrete tiltak.
            </p>
            <Link href="/vilkar" className="mt-4 inline-block text-sm font-semibold text-[#6a52bf] underline underline-offset-4">Les vilkårene</Link>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 pb-16 sm:px-8">
          <div className="flex flex-col items-start justify-between gap-5 rounded-2xl bg-[#7961cf] px-6 py-8 text-white sm:flex-row sm:items-center sm:px-10">
            <div>
              <h2 className="text-2xl font-extrabold tracking-[-0.6px]">Prøv med eksempelboligen</h2>
              <p className="mt-1 text-white/85">Du kan utforske alt uten å laste opp noe.</p>
            </div>
            <a href={STUDIO_URL} className="rounded-lg bg-white px-5 py-3 font-semibold text-[#5b43b0] transition hover:bg-[#f2ecfa]">
              Åpne designstudioet
            </a>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
