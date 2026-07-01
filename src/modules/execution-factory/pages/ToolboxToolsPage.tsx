/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { useParams } from "react-router-dom";

import { ToolboxToolsScene } from "@/modules/execution-factory/scenes/ToolboxToolsScene";

export function ToolboxToolsPage() {
  const { boxId } = useParams<{ boxId: string }>();

  if (!boxId) {
    return null;
  }

  return <ToolboxToolsScene boxId={boxId} />;
}
