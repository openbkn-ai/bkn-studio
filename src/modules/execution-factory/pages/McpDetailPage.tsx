/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { useParams } from "react-router-dom";

import { McpDetailScene } from "@/modules/execution-factory/scenes/McpDetailScene";

export function McpDetailPage() {
  const { mcpId } = useParams<{ mcpId: string }>();

  if (!mcpId) {
    return null;
  }

  return <McpDetailScene mcpId={mcpId} />;
}
