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
        // 判定不出来就退回通用工具列表页，别把用户堵在加载态。
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

  // 代码函数走工作台（代码 / 参数 / 调试同屏）；OpenAPI 等仍走工具列表页。
  return isFunctionToolbox ? (
    <FunctionWorkbenchScene boxId={boxId} />
  ) : (
    <ToolboxToolsScene boxId={boxId} />
  );
}
