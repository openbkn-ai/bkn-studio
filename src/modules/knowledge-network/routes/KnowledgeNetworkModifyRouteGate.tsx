/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Spin } from "antd";
import { type ReactNode, useEffect, useState } from "react";
import { Navigate, useParams } from "react-router-dom";

import { getKnowledgeNetwork } from "@/modules/knowledge-network/services/knowledge-network.service";
import { hasKnowledgeNetworkRecordOperation } from "@/modules/knowledge-network/utils/record-operations";

type KnowledgeNetworkModifyRouteGateProps = {
  children: ReactNode;
};

export function KnowledgeNetworkModifyRouteGate({
  children,
}: KnowledgeNetworkModifyRouteGateProps) {
  const { networkId = "" } = useParams<{ networkId: string }>();
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;

    setAllowed(null);
    void getKnowledgeNetwork(networkId)
      .then((record) => {
        if (!cancelled) {
          setAllowed(hasKnowledgeNetworkRecordOperation(record, "modify"));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAllowed(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [networkId]);

  if (allowed === null) {
    return <Spin fullscreen />;
  }

  if (!allowed) {
    return (
      <Navigate
        replace
        to={`/knowledge-network/workspace/${networkId}/overview`}
      />
    );
  }

  return children;
}
