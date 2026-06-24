// Standalone constant with NO DOM / no `@/*` imports so it can be pulled into
// the node-side tsconfig (via vite.config.ts) without dragging window-using
// app-paths.ts into a project that lacks the DOM lib. app-paths.ts re-exports it.
export const DEFAULT_APP_BASENAME = "/studio";
