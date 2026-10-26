/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Navigate, useParams } from "react-router-dom";

export function LegacyMcpExperienceRedirect() {
  const { networkId = "" } = useParams<{ networkId: string }>();
  const search = new URLSearchParams({
    tab: "mcp",
    mcpView: "debug",
    networkId,
  });

  return <Navigate replace to={`/knowledge-network/integration?${search.toString()}`} />;
}
