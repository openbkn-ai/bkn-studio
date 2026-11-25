/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Navigate, useLocation, useParams } from "react-router-dom";

/** Keep existing bookmarks on their network, including the selected version. */
export function LegacyKnowledgeBasesRedirect() {
  const { networkId = "" } = useParams<{ networkId: string }>();
  const { search, hash } = useLocation();
  return (
    <Navigate
      replace
      to={`/knowledge-network/workspace/${encodeURIComponent(networkId)}/overview${search}${hash}`}
    />
  );
}
