/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export type ImpexComponentType = "operator" | "toolbox" | "mcp";

export type ImpexImportMode = "create" | "upsert";

export type ImpexExportResult = Record<string, unknown>;

export type ImpexImportResult = {
  type: ImpexComponentType;
  id?: string;
};
