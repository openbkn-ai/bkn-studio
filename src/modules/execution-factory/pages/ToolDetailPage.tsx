/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { useParams } from "react-router-dom";

import { ToolDetailScene } from "@/modules/execution-factory/scenes/ToolDetailScene";

export function ToolDetailPage() {
  const { boxId, toolId } = useParams<{ boxId: string; toolId: string }>();

  if (!boxId || !toolId) {
    return null;
  }

  return <ToolDetailScene boxId={boxId} toolId={toolId} />;
}
