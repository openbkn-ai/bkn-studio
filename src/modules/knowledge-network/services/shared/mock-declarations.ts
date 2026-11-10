/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type {
  DefinitionDeclarationEdit,
  DefinitionDeclarations,
} from "@/modules/knowledge-network/types/knowledge-network";
import { normalizeDefinitionDeclarations } from "@/modules/knowledge-network/utils/definition-declarations";

/**
 * The aliases and lifecycle a mock save stores: what the form sent, or what was stored when the
 * save does not edit them, as the backend keeps fields a request leaves out.
 */
export function withMockDefinitionDeclarations(
  stored: DefinitionDeclarations | undefined,
  edit: DefinitionDeclarationEdit | undefined,
): { declarations?: DefinitionDeclarations } {
  const declarations = edit ? normalizeDefinitionDeclarations(edit.current) : stored;
  return { declarations };
}
