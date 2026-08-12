// /today and /contest aren't ready for production yet — keep them visible in
// local dev so work can continue, hide them from the deployed site. NODE_ENV
// is statically inlined by Next.js at build time in both server and client
// bundles, so this is safe to import from either.
//
// NOTE: this used to also gate auth (login/profile). Auth is now live and has
// its own flag below — splitting them means shipping auth can't accidentally
// expose contests, which is still blocked on its own ingestion work.
export const SHOW_UNRELEASED_NAV = process.env.NODE_ENV !== "production";

// Accounts/login/profile are shipped. Named (not inlined) so it's easy to find
// and flip if ever needed. Profile visibility is additionally gated on the
// visitor actually being signed in (threaded from the server layout).
export const AUTH_ENABLED = true;
