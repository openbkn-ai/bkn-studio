/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export type ApiResourceTab = "detail" | "preview";

export type ApiResourceSceneProps = {
  catalogId?: string;
  resourceId?: string;
  startInEditMode?: boolean;
  tab?: ApiResourceTab;
  onTabChange?: (tab: ApiResourceTab) => void;
  onEdit?: () => void;
  /** The host takes over loading the saved resource after a successful write. */
  onSaveCommitted?: (resourceId: string) => void;
  onSaved?: (resourceId: string) => void;
  onDeleted?: (catalogId: string) => void;
  /** Resource details provide the parent catalog ID when the catalog is accessible. */
  onBack?: (catalogId?: string) => void;
};
