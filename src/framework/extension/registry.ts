/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import i18n from "i18next";
import { createElement } from "react";
import type { RouteObject } from "react-router-dom";

import { RequireCapability } from "@/framework/entitlement/RequireCapability";
import { RequireEdition } from "@/framework/entitlement/RequireEdition";
import type { SupportedLocale } from "@/framework/runtime/types";
import { capabilityMinEdition } from "@/modules/subscription/capability-catalog";

/**
 * What another build adds to Studio without this repository knowing about it: routes, and
 * the copy they render. The community build installs none.
 *
 * Registration happens in exactly one module, `@/app/extensions/installed`, which the entry
 * imports before the app mounts. A build that ships extensions (the enterprise image) swaps
 * that module out through a bundler alias instead of editing it, so the dependency runs one
 * way: the extending build imports Studio, Studio never imports it.
 */
export type StudioExtension = {
  /** Unique within a build. */
  id: string;
  /**
   * Capability key that switches the routes on. The shell reads it from the server's
   * capability list and does not judge it: every route is wrapped in a capability guard, so
   * a build that carries the code still renders nothing the licence does not cover, and a
   * licence that falls short gets the upgrade page instead.
   */
  capability: string;
  /** Routes inside the app shell, beside the module routes. */
  routes?: RouteObject[];
  /** Routes without the shell, like the knowledge-network workspace pages. */
  standaloneRoutes?: RouteObject[];
  /** Copy merged into the translation resources, by locale. */
  locales?: Partial<Record<SupportedLocale, Record<string, unknown>>>;
};

const installed: StudioExtension[] = [];
let frozen = false;

export function registerExtension(extension: StudioExtension) {
  if (frozen) {
    throw new Error(
      `Extension "${extension.id}" was registered after the app mounted; register it from @/app/extensions/installed.`,
    );
  }
  if (installed.some((item) => item.id === extension.id)) {
    throw new Error(`Extension "${extension.id}" is registered twice.`);
  }
  for (const route of [...(extension.routes ?? []), ...(extension.standaloneRoutes ?? [])]) {
    // The gate wraps route.element; a route rendered through lazy or Component would slip past it.
    if (route.element === undefined) {
      throw new Error(
        `Extension "${extension.id}" has a route without an element (${route.path ?? "index"}).`,
      );
    }
  }
  installed.push(extension);
  addExtensionLocales(extension.locales);
}

/**
 * Called by the bootstrap as the app mounts. The router is built once from what is installed
 * by then, so a later registration throws instead of leaving a route silently missing.
 */
export function freezeExtensions() {
  frozen = true;
}

export function extensionRoutes(): RouteObject[] {
  return installed.flatMap((extension) => gated(extension, extension.routes));
}

export function extensionStandaloneRoutes(): RouteObject[] {
  return installed.flatMap((extension) => gated(extension, extension.standaloneRoutes));
}

/**
 * A capability the edition catalog knows gets the full upgrade page when the licence does not
 * cover it: what the capability is, the edition it needs, and the way to the licence portal and
 * the edition comparison. The page itself stays unmounted, so it sends nothing while locked. A
 * capability the catalog does not know has no copy for that page and falls back to the plain
 * guard.
 */
function gated(extension: StudioExtension, routes: RouteObject[] = []): RouteObject[] {
  const { capability } = extension;
  const minEdition = capabilityMinEdition(capability);

  return routes.map((route) => ({
    ...route,
    element: minEdition
      ? createElement(RequireEdition, {
          capability,
          children: route.element,
          minEdition,
          mountLockedContent: false,
        })
      : createElement(RequireCapability, { capability, children: route.element }),
  }));
}

/**
 * Merges copy into the running translation resources without overriding existing keys. Also
 * used by pages an extending build serves outside this shell, which share the resources.
 */
export function addExtensionLocales(locales: StudioExtension["locales"]) {
  for (const [locale, resources] of Object.entries(locales ?? {})) {
    i18n.addResourceBundle(locale, "translation", resources, true, false);
  }
}

/** Tests only: forget every registration and reopen the registry. */
export function resetExtensionsForTesting() {
  installed.length = 0;
  frozen = false;
}
