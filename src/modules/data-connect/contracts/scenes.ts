/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export type DataConnectListSceneProps = {
  defaultConnectorType?: string;
  defaultKeyword?: string;
  onCreate?: () => void;
  onEdit?: (recordId: string) => void;
  onOpenDetail?: (recordId: string) => void;
  onOpenScans?: (recordId?: string) => void;
};

export type DataConnectFormSceneProps = {
  mode: "create" | "edit";
  recordId?: string;
  onBack?: () => void;
  onSubmitSuccess?: () => void;
};

export type DataConnectScanSceneProps = {
  catalogId?: string;
  onBackToConnections?: () => void;
  onCatalogIdChange?: (catalogId?: string) => void;
};
