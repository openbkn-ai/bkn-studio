import type { RuntimeInput } from "@/framework/runtime/types";

// Standalone dev/prod serves from `/` by default. Hosted/embedded deployments
// should pass `window.__BKN_STUDIO_RUNTIME__.router.basename` (e.g. `/studio`).
export const DEFAULT_APP_BASENAME = "/";

function normalizeBasename(value?: string) {
  const trimmed = value?.trim();
  if (!trimmed || trimmed === "/") {
    return "/";
  }

  const withLeadingSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return withLeadingSlash.replace(/\/+$/, "");
}

function readRuntimeBasename(runtimeInput?: RuntimeInput) {
  return runtimeInput?.router?.basename;
}

export function resolveAppBasename(runtimeInput?: RuntimeInput) {
  return normalizeBasename(readRuntimeBasename(runtimeInput) ?? DEFAULT_APP_BASENAME);
}

export function getAppBasename() {
  if (typeof window === "undefined") {
    return resolveAppBasename();
  }

  return resolveAppBasename(window.__BKN_STUDIO_RUNTIME__);
}

export function buildAppPath(pathname = "/") {
  const basename = getAppBasename();
  const normalizedPathname = pathname.startsWith("/") ? pathname : `/${pathname}`;

  if (basename === "/") {
    return normalizedPathname;
  }

  if (normalizedPathname === "/") {
    return basename;
  }

  return `${basename}${normalizedPathname}`;
}

export function getAppHomePath() {
  return buildAppPath("/");
}

export function getAppCallbackPath() {
  return buildAppPath("/callback");
}
