/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { ConceptGroupDetail } from "@/modules/knowledge-network/types/knowledge-network";

export function downloadConceptGroupExport(detail: ConceptGroupDetail) {
  const blob = new Blob([JSON.stringify(detail, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${detail.name}.json`;
  link.click();
  URL.revokeObjectURL(url);
}
