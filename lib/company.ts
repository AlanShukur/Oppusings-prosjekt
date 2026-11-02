/**
 * Company and hosting details shown on /personvern and /vilkar. Fill these in once and both
 * pages update. Empty fields show a visible [placeholder]. Set legalReviewed to true only after
 * a lawyer has approved both texts; that removes the draft banners. See docs/LEGAL-REVIEW.md.
 */
export const COMPANY = {
  name: "", // e.g. "Romly AS"
  orgNumber: "", // organisasjonsnummer
  address: "",
  email: "",
  hostingProvider: "", // e.g. "Cloudflare, Inc." (see docs/DEPLOY.md)
  logRetention: "", // how long the hosting provider keeps request and error logs
  venue: "", // verneting, e.g. "Oslo tingrett"
  legalReviewed: false,
};

/** The value, or a visible placeholder while it is missing. */
export const filled = (value: string, placeholder: string) => value.trim() || `[${placeholder}]`;

export const companyLine = () =>
  [filled(COMPANY.name, "Selskapsnavn"), `org.nr. ${filled(COMPANY.orgNumber, "organisasjonsnummer")}`, filled(COMPANY.address, "adresse"), filled(COMPANY.email, "e-post")].join(", ");
