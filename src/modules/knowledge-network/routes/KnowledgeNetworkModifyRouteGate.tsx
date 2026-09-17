/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Button, Spin } from "antd";
import { type ReactNode, useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useParams } from "react-router-dom";

import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { getKnowledgeNetwork } from "@/modules/knowledge-network/services/knowledge-network.service";
import { getRequestErrorStatus } from "@/modules/knowledge-network/services/shared/runtime";
import { hasKnowledgeNetworkRecordOperation } from "@/modules/knowledge-network/utils/record-operations";

type KnowledgeNetworkModifyRouteGateProps = {
  children: ReactNode;
};

type OperationRecord = {
  operations?: string[];
};

type KnowledgeNetworkOperationRouteGateProps = {
  children: ReactNode;
  loadRecord: () => Promise<OperationRecord | null>;
  redirectTo: string;
};

export function KnowledgeNetworkOperationRouteGate({
  children,
  loadRecord,
  redirectTo,
}: KnowledgeNetworkOperationRouteGateProps) {
  const { t } = useTranslation();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    setAllowed(null);
    setError(null);
    void loadRecord()
      .then((record) => {
        if (!cancelled) {
          setAllowed(hasKnowledgeNetworkRecordOperation(record, "modify"));
        }
      })
      .catch((nextError: unknown) => {
        if (!cancelled) {
          if (getRequestErrorStatus(nextError) === 403) {
            setAllowed(false);
            return;
          }

          setError(extractRequestErrorMessage(nextError));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [loadRecord, reloadToken]);

  if (error) {
    return (
      <Alert
        action={
          <Button onClick={() => setReloadToken((value) => value + 1)} size="small">
            {t("common.retry")}
          </Button>
        }
        message={error}
        showIcon
        type="error"
      />
    );
  }

  if (allowed === null) {
    return <Spin fullscreen />;
  }

  if (!allowed) {
    return <Navigate replace to={redirectTo} />;
  }

  return children;
}

export function KnowledgeNetworkModifyRouteGate({
  children,
}: KnowledgeNetworkModifyRouteGateProps) {
  const { networkId = "" } = useParams<{ networkId: string }>();
  const loadRecord = useCallback(() => getKnowledgeNetwork(networkId), [networkId]);

  return (
    <KnowledgeNetworkOperationRouteGate
      loadRecord={loadRecord}
      redirectTo={`/knowledge-network/workspace/${networkId}/overview`}
    >
      {children}
    </KnowledgeNetworkOperationRouteGate>
  );
}
