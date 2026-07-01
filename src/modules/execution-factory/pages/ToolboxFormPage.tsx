/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { useParams } from "react-router-dom";

import { ToolboxFormScene } from "@/modules/execution-factory/scenes/ToolboxFormScene";

type ToolboxFormPageProps = {
  mode: "create" | "edit";
};

export function ToolboxFormPage({ mode }: ToolboxFormPageProps) {
  const { boxId } = useParams<{ boxId: string }>();

  return <ToolboxFormScene boxId={boxId} mode={mode} />;
}
