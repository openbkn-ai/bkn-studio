/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { useParams } from "react-router-dom";

import { DataConnectFormScene } from "@/modules/data-connect/scenes/DataConnectFormScene";

type DataConnectFormPageProps = {
  mode: "create" | "edit";
};

export function DataConnectFormPage({ mode }: DataConnectFormPageProps) {
  const { recordId } = useParams<{ recordId: string }>();

  return <DataConnectFormScene mode={mode} recordId={recordId} />;
}
