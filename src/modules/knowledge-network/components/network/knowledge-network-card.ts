/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type {
  KnowledgeNetworkExportFormat,
  KnowledgeNetworkRecord,
} from "@/modules/knowledge-network/types/knowledge-network";
import { hasKnowledgeNetworkRecordOperation } from "@/modules/knowledge-network/utils/record-operations";

export function formatKnowledgeNetworkUpdateTime(value?: string): string {
  return value?.replace(/(\d{2}:\d{2}):\d{2}$/, "$1") || "--";
}

export function getKnowledgeNetworkCardMenuKeys(record: KnowledgeNetworkRecord) {
  return [
    "view",
    ...(hasKnowledgeNetworkRecordOperation(record, "modify") ? ["edit"] : []),
    "export",
    ...(hasKnowledgeNetworkRecordOperation(record, "authorize") ? ["authorize"] : []),
    ...(hasKnowledgeNetworkRecordOperation(record, "delete") ? ["delete"] : []),
  ];
}

/** Offered in menu order: JSON first, since it is the format the import dialog reads back. */
export const KNOWLEDGE_NETWORK_EXPORT_FORMATS: KnowledgeNetworkExportFormat[] = [
  "json",
  "bkn",
];

export function getKnowledgeNetworkExportMenuKey(format: KnowledgeNetworkExportFormat) {
  return `export-${format}`;
}

export function parseKnowledgeNetworkExportMenuKey(
  key: string,
): KnowledgeNetworkExportFormat | undefined {
  return KNOWLEDGE_NETWORK_EXPORT_FORMATS.find(
    (format) => getKnowledgeNetworkExportMenuKey(format) === key,
  );
}
