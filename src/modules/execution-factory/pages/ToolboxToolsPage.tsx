/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Spin } from "antd";
import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";

import { FunctionWorkbenchScene } from "@/modules/execution-factory/scenes/FunctionWorkbenchScene";
import { ToolboxToolsScene } from "@/modules/execution-factory/scenes/ToolboxToolsScene";
import { getToolbox } from "@/modules/execution-factory/services/toolbox.service";

export function ToolboxToolsPage() {
  const { boxId } = useParams<{ boxId: string }>();
  const [searchParams] = useSearchParams();
  const catalogContext = searchParams.get("from") === "catalog";
  const [isFunctionToolbox, setIsFunctionToolbox] = useState<boolean | null>(null);

  useEffect(() => {
    if (!boxId || catalogContext) {
      setIsFunctionToolbox(false);
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const record = await getToolbox(boxId);
        if (!cancelled) {
          setIsFunctionToolbox(record.metadataType === "function");
        }
      } catch {
        // Fall back to the generic tool-list page when classification is unavailable instead of leaving users stuck loading.
        if (!cancelled) {
          setIsFunctionToolbox(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [boxId, catalogContext]);

  if (!boxId) {
    return null;
  }

  if (isFunctionToolbox === null) {
    return (
      <div style={{ display: "grid", placeItems: "center", padding: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  // Code functions use the workbench with code, parameters, and debugging together; OpenAPI and others remain on the tool-list page.
  return isFunctionToolbox ? (
    <FunctionWorkbenchScene boxId={boxId} />
  ) : (
    <ToolboxToolsScene boxId={boxId} />
  );
}
