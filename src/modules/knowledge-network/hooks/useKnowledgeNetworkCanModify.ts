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

type OperationAccessState = {
  access: OperationAccess;
  isLoading: boolean;
};

function createOperationAccess(operations: readonly string[], value: boolean) {
  return Object.fromEntries(operations.map((operation) => [operation, value]));
}

export function useKnowledgeNetworkOperationAccessState(
  networkId: string,
  operations: readonly string[],
): OperationAccessState {
  const [access, setAccess] = useState<OperationAccess>(() =>
    createOperationAccess(operations, false),
  );
  const operationsKey = operations.join("\u0000");
  const requestKey = `${networkId}\u0000${operationsKey}`;
  const [resolvedRequestKey, setResolvedRequestKey] = useState("");
  const isLoading = Boolean(networkId) && resolvedRequestKey !== requestKey;

  useEffect(() => {
    let cancelled = false;
    const requestedOperations =
      operationsKey.length > 0 ? operationsKey.split("\u0000") : [];

    setAccess(createOperationAccess(requestedOperations, false));

    if (!networkId) {
      setResolvedRequestKey(requestKey);
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
          setResolvedRequestKey(requestKey);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAccess(createOperationAccess(requestedOperations, false));
          setResolvedRequestKey(requestKey);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [networkId, operationsKey, requestKey]);

  return { access, isLoading };
}

export function useKnowledgeNetworkOperationAccess(
  networkId: string,
  operations: readonly string[],
) {
  return useKnowledgeNetworkOperationAccessState(networkId, operations).access;
}

export function useKnowledgeNetworkCanOperate(networkId: string, operation: string) {
  return useKnowledgeNetworkOperationAccess(networkId, [operation])[operation] ?? false;
}

export function useKnowledgeNetworkCanModify(networkId: string) {
  return useKnowledgeNetworkCanOperate(networkId, "modify");
}

export function useKnowledgeNetworkModifyAccess(networkId: string) {
  const { access, isLoading } = useKnowledgeNetworkOperationAccessState(networkId, ["modify"]);
  return { canModify: access.modify ?? false, isLoading };
}
