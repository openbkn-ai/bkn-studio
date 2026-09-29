/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { useParams } from "react-router-dom";

import { ViewEditorScene } from "@/modules/data-catalog/scenes/ViewEditorScene";

export function ViewEditorPage() {
  const { catalogId, resourceId } = useParams<{ catalogId?: string; resourceId?: string }>();
  return <ViewEditorScene catalogId={catalogId} resourceId={resourceId} />;
}
