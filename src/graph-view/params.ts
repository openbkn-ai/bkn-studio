/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { parseDeepLink } from "@/modules/knowledge-network/scenes/graph-explorer/deep-link";
import type { ExpandDirection } from "@/modules/knowledge-network/services/graph-explorer.service";
import { layoutFromConfig, type ExplorerLayout } from "@/modules/knowledge-network/utils/graph-explorer-cache";

declare global {
  interface Window {
    __BKN_GRAPH_VIEW__?: { token?: string; layout?: string };
  }
}

export type ViewParams = {
  kn: string;
  ids: string[];
  expand: ExpandDirection | null;
  layout: ExplorerLayout;
  token: string;
};

/**
 * `graph-view.html?kn=<network id>&ids=<instance id,…>[&expand=out|in|both][&layout=…][&token=…]`.
 * `search` is the query string and the fragment together (see `combineLinkSource`), so a long id
 * list can ride in the fragment and never reach the server's request line. Ids may also arrive
 * grouped as `g=<object type>:<key,…>;…`. The token comes from the query first, then the
 * deploy-time config, then whatever the caller offers as a fallback (the Studio session cookie).
 */
export function parseViewParams(
  search: string,
  configToken?: string,
  fallbackToken = "",
  configLayout?: unknown,
): ViewParams {
  const params = new URLSearchParams(search);
  const link = parseDeepLink(search);
  return {
    kn: (params.get("kn") ?? "").trim(),
    ids: link?.ids ?? [],
    expand: link?.expand ?? null,
    // The link wins, then the deploy-time default, then force.
    layout: link?.layout ?? layoutFromConfig(configLayout) ?? "force",
    token: (params.get("token") ?? "").trim() || (configToken ?? "").trim() || fallbackToken,
  };
}
