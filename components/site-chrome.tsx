/** Header and footer shared by the public pages (landing, personvern, vilkår). */

export const STUDIO_URL = "/studio/index.html";

export function Logo() {
  return (
    <a href="/" className="flex items-center gap-2.5 text-[26px] font-extrabold tracking-[-1.4px] text-[#22202a]" aria-label="Romly forside">
      <svg viewBox="0 0 64 64" className="h-8 w-8 -rotate-3" aria-hidden="true">
        <rect width="64" height="64" rx="18" fill="#7961cf" />
        <path d="M15 31 32 16l17 15v17H36V35h-9v13H15Z" fill="none" stroke="white" strokeWidth="4" strokeLinejoin="round" />
      </svg>
      <span>
        romly<span className="text-[#7961cf]">.</span>
      </span>
    </a>
  );
}

export function SiteHeader() {
  return (
    <header className="border-b border-[#ece7f3] bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
        <Logo />
        <a href={STUDIO_URL} className="rounded-lg bg-[#7961cf] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#6a52bf] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7961cf]">
          Åpne designstudioet
        </a>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-[#ece7f3] bg-[#fbf9fd]">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-8 text-sm text-[#6f6a7a] sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <p>Romly er under utvikling. Kontrollen er veiledende og erstatter ikke fagfolk eller kommunen.</p>
        <nav className="flex gap-5" aria-label="Juridisk">
          <a className="underline underline-offset-4 hover:text-[#22202a]" href="/personvern">Personvern</a>
          <a className="underline underline-offset-4 hover:text-[#22202a]" href="/vilkar">Vilkår</a>
          <a className="underline underline-offset-4 hover:text-[#22202a]" href={STUDIO_URL}>Designstudio</a>
        </nav>
      </div>
    </footer>
  );
}

/** Page frame for personvern and vilkår. */
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white text-[#22202a]" style={{ fontFamily: "Manrope, ui-sans-serif, system-ui, sans-serif" }}>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-5 py-12 sm:px-8">
        <h1 className="text-3xl font-extrabold tracking-[-1px] sm:text-4xl">{title}</h1>
        <p className="mt-2 mb-8 text-sm text-[#6f6a7a]">Sist oppdatert {updated}</p>
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}

export function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8 space-y-3 leading-relaxed text-[#46424f] [&_a]:text-[#6a52bf] [&_a]:underline [&_a]:underline-offset-4 [&_li]:ml-5 [&_li]:list-disc [&_li]:pl-1">
      <h2 className="text-xl font-bold tracking-[-0.3px] text-[#22202a]">{title}</h2>
      {children}
    </section>
  );
}

/** Banner for texts that still need company details and legal review before launch. */
export function DraftNotice({ children }: { children: React.ReactNode }) {
  return (
    <div role="note" className="mb-8 rounded-xl border border-[#f0e2b0] bg-[#fdf8e6] px-4 py-3 text-sm leading-relaxed text-[#6d5410]">
      {children}
    </div>
  );
}
