/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { Location } from "react-router-dom";

/**
 * Where a detail scene's back button should go when the visitor came from another module.
 *
 * Detail scenes must not answer their back button with `navigate(-1)`: the history stack cannot
 * tell an in-app entry apart from a direct hit, and a list page that also relied on `navigate(-1)`
 * bounced the visitor between itself and the config page it had just been sent from (#386). The
 * origin that needs a destination other than the scene's fixed parent (a knowledge network's
 * capability list) declares it in location state instead; a scene without it uses its parent page.
 */
export type ReturnToState = {
  returnTo?: string;
};

export function buildReturnToState(
  location: Pick<Location, "pathname" | "search">,
): ReturnToState {
  return { returnTo: `${location.pathname}${location.search}` };
}

/** Only an in-app path is honoured; anything else falls through to the scene's own fallback. */
export function readReturnTo(state: unknown): string | undefined {
  if (!state || typeof state !== "object") {
    return undefined;
  }

  const { returnTo } = state as ReturnToState;
  return typeof returnTo === "string" && returnTo.startsWith("/") ? returnTo : undefined;
}
