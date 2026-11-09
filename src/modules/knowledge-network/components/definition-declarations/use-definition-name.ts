/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { useEffect, useState } from "react";

import {
  getKnowledgeNetworkActionType,
  getKnowledgeNetworkObjectType,
  getKnowledgeNetworkRelationType,
} from "@/modules/knowledge-network/services/knowledge-network.service";
import type { DeclarationDefinitionKind } from "@/modules/knowledge-network/types/knowledge-network";

// A definition that is gone or hidden from the user reads as unnamed; no error toast.
const SILENT = { skipErrorToast: true };

/** Reads one definition of the kind given; looked up when called, so tests can mock the service. */
function readDefinition(networkId: string, kind: DeclarationDefinitionKind, id: string) {
  switch (kind) {
    case "action_type":
      return getKnowledgeNetworkActionType(networkId, id, SILENT);
    case "object_type":
      return getKnowledgeNetworkObjectType(networkId, id, SILENT);
    case "relation_type":
      return getKnowledgeNetworkRelationType(networkId, id, SILENT);
  }
}

/** The name of a definition; undefined while it loads, or when it cannot be read. */
export function useDefinitionName(
  networkId: string,
  definition: { id: string; kind: DeclarationDefinitionKind } | undefined,
) {
  const [named, setNamed] = useState<{ key: string; name?: string }>();
  const key = definition ? `${networkId}/${definition.kind}/${definition.id}` : "";

  useEffect(() => {
    if (!definition) {
      return;
    }
    let cancelled = false;
    readDefinition(networkId, definition.kind, definition.id)
      .then((item) => {
        if (!cancelled) {
          setNamed({ key, name: item?.name });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setNamed({ key });
        }
      });
    return () => {
      cancelled = true;
    };
    // The key stands for the definition.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return named?.key === key ? named.name : undefined;
}
