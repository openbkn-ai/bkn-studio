/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/** @deprecated Prefer registerOpenApiBundle when operatorSync is enabled. */
import { registerOperator } from "@/modules/execution-factory/services/operator.service";
import type { OperatorRecord } from "@/modules/execution-factory/types/operator";
import type { OperatorSyncPublishInput } from "@/modules/execution-factory/types/operator-sync";
import { validateOpenApiDocumentText } from "@/modules/execution-factory/utils/metadata-content";

export async function publishOperatorFromOpenApiSync(
  openapiSpec: string,
  options: {
    defaultName: string;
    sync?: OperatorSyncPublishInput;
  },
): Promise<OperatorRecord | null> {
  if (!options.sync?.enabled) {
    return null;
  }

  const validation = validateOpenApiDocumentText(openapiSpec);
  if (!validation.ok) {
    throw new Error(validation.reason);
  }

  const operatorName = options.sync.name?.trim() || options.defaultName.trim();
  if (!operatorName) {
    throw new Error("同步发布算子时请填写算子名称。");
  }

  return registerOperator({
    metadataType: "openapi",
    name: operatorName,
    openapiSpec,
    category: options.sync.category ?? "other_category",
    executeControl: options.sync.executeControl,
    directPublish: options.sync.directPublish ?? false,
  });
}
