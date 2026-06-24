import type { RuntimeInput } from "@/framework/runtime/types";

export { DEFAULT_APP_BASENAME } from "./app-basename";
import { DEFAULT_APP_BASENAME } from "./app-basename";

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
