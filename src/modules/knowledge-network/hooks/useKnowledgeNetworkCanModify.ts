/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { useEffect, useState } from "react";

import { getKnowledgeNetwork } from "@/modules/knowledge-network/services/knowledge-network.service";
import { hasKnowledgeNetworkRecordOperation } from "@/modules/knowledge-network/utils/record-operations";

type OperationAccess = Record<string, boolean>;

function createOperationAccess(operations: readonly string[], value: boolean) {
  return Object.fromEntries(operations.map((operation) => [operation, value]));
}

export function useKnowledgeNetworkOperationAccess(
  networkId: string,
  operations: readonly string[],
) {
  const [access, setAccess] = useState<OperationAccess>(() =>
    createOperationAccess(operations, false),
  );
  const operationsKey = operations.join("\u0000");

  useEffect(() => {
    let cancelled = false;
    const requestedOperations =
      operationsKey.length > 0 ? operationsKey.split("\u0000") : [];

    setAccess(createOperationAccess(requestedOperations, false));

    if (!networkId) {
      return () => {
        cancelled = true;
      };
    }

    void getKnowledgeNetwork(networkId)
      .then((record) => {
        if (!cancelled) {
          setAccess(
            Object.fromEntries(
              requestedOperations.map((operation) => [
                operation,
                hasKnowledgeNetworkRecordOperation(record, operation),
              ]),
            ),
          );
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAccess(createOperationAccess(requestedOperations, false));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [networkId, operationsKey]);

  return access;
}

export function useKnowledgeNetworkCanOperate(networkId: string, operation: string) {
  return useKnowledgeNetworkOperationAccess(networkId, [operation])[operation] ?? false;
}

export function useKnowledgeNetworkCanModify(networkId: string) {
  return useKnowledgeNetworkCanOperate(networkId, "modify");
}
