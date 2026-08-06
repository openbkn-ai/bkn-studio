/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { useEffect, useState } from "react";

import { getKnowledgeNetwork } from "@/modules/knowledge-network/services/knowledge-network.service";
import { hasKnowledgeNetworkRecordOperation } from "@/modules/knowledge-network/utils/record-operations";

export function useKnowledgeNetworkCanModify(networkId: string) {
  const [canModify, setCanModify] = useState(false);

  useEffect(() => {
    let cancelled = false;

    setCanModify(false);

    if (!networkId) {
      return () => {
        cancelled = true;
      };
    }

    void getKnowledgeNetwork(networkId)
      .then((record) => {
        if (!cancelled) {
          setCanModify(hasKnowledgeNetworkRecordOperation(record, "modify"));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCanModify(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [networkId]);

  return canModify;
}
