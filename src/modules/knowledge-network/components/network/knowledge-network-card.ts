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

export function getKnowledgeNetworkCardMenuKeys(
  record: KnowledgeNetworkRecord,
  canRequestPermission = true,
) {
  return [
    "view",
    ...(hasKnowledgeNetworkRecordOperation(record, "modify") ? ["edit"] : []),
    "export",
    ...(canRequestPermission && getMissingKnowledgeNetworkBusinessOperations(record).length > 0
      ? ["request-permission"]
      : []),
    ...(hasKnowledgeNetworkRecordOperation(record, "authorize") ? ["authorize"] : []),
    ...(hasKnowledgeNetworkRecordOperation(record, "delete") ? ["delete"] : []),
  ];
}

// Authorization management is intentionally absent: ordinary users may ask
// for business access, but must not self-request authority to grant others.
export const KNOWLEDGE_NETWORK_BUSINESS_OPERATIONS = [
  "view_detail",
  "modify",
  "delete",
  "execute",
  "query_data",
] as const;

export function getMissingKnowledgeNetworkBusinessOperations(record: KnowledgeNetworkRecord) {
  const granted = record.operations;
  // A list response that does not carry effective operations cannot safely
  // decide whether an application is needed, so do not expose the entry.
  if (!granted || granted.includes("*") || granted.includes("full_business_access")) {
    return [];
  }
  return KNOWLEDGE_NETWORK_BUSINESS_OPERATIONS.filter((operation) => !granted.includes(operation));
}

/** Offered in menu order: JSON first, since it is the format the import dialog reads back. */
export const KNOWLEDGE_NETWORK_EXPORT_FORMATS: KnowledgeNetworkExportFormat[] = ["json", "bkn"];

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
