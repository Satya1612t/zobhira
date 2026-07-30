// Auth (login/signup/profile) and /today aren't ready for production yet —
// keep them visible in local dev so work can continue, hide them from the
// deployed site. NODE_ENV is statically inlined by Next.js at build time in
// both server and client bundles, so this is safe to import from either.
// Flip this back once those features are ready to ship.
export const SHOW_UNRELEASED_NAV = process.env.NODE_ENV !== "production";
