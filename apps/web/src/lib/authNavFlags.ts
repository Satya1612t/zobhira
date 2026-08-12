// /today and /contest aren't ready for production yet — keep them visible in
// local dev so work can continue, hide them from the deployed site. NODE_ENV
// is statically inlined by Next.js at build time in both server and client
// bundles, so this is safe to import from either.
//
// NOTE: this used to also gate auth (login/profile). Auth is now live and has
// its own flag below — splitting them means shipping auth can't accidentally
// expose contests, which is still blocked on its own ingestion work.
export const SHOW_UNRELEASED_NAV = process.env.NODE_ENV !== "production";

// Certifications aren't ready for production yet either — keep them visible in
// local dev (nav + pages + sitemap) but hidden from the deployed site. Its own
// flag (not folded into SHOW_UNRELEASED_NAV) so certs can be shipped
// independently of contests when their content is ready, without one exposing
// the other. Same NODE_ENV-inlined-at-build-time mechanism.
export const SHOW_CERTIFICATIONS = process.env.NODE_ENV !== "production";

// Accounts/login/profile are shipped. Named (not inlined) so it's easy to find
// and flip if ever needed. Profile visibility is additionally gated on the
// visitor actually being signed in (threaded from the server layout).
export const AUTH_ENABLED = true;
