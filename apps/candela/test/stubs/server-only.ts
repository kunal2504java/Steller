// Stub for the `server-only` package used only by Vitest's module resolver.
//
// The real `server-only` npm package is never installed in this repo (it's
// not a dependency anywhere — Next.js resolves the bare `"server-only"`
// specifier internally, via its own bundled copy, only inside its
// webpack/turbopack build for React Server Components). Vitest runs on
// plain Vite, which has no such alias, so `import "server-only"` fails to
// *resolve* at all (not just "throws" — see vitest.config.ts comment).
//
// This empty module is aliased in vitest.config.ts so the bare specifier
// resolves to something real; `server-only`'s actual behavior (throwing
// outside the `react-server` condition) is intentionally never exercised
// in unit tests.
export {};
