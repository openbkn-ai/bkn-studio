/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { useParams } from "react-router-dom";

import { UnitFormScene } from "@/modules/execution-factory/scenes/UnitFormScene";

type UnitFormPageProps = {
  mode: "create" | "edit";
};

export function UnitFormPage({ mode }: UnitFormPageProps) {
  const { operatorId } = useParams<{ operatorId: string }>();

  return <UnitFormScene mode={mode} operatorId={operatorId} />;
}
