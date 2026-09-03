/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Button, Spin } from "antd";
import { type ReactNode, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useParams } from "react-router-dom";

import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { getKnowledgeNetwork } from "@/modules/knowledge-network/services/knowledge-network.service";
import { getRequestErrorStatus } from "@/modules/knowledge-network/services/shared/runtime";
import { hasKnowledgeNetworkRecordOperation } from "@/modules/knowledge-network/utils/record-operations";

type KnowledgeNetworkModifyRouteGateProps = {
  children: ReactNode;
};

export function KnowledgeNetworkModifyRouteGate({
  children,
}: KnowledgeNetworkModifyRouteGateProps) {
  const { t } = useTranslation();
  const { networkId = "" } = useParams<{ networkId: string }>();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    setAllowed(null);
    setError(null);
    void getKnowledgeNetwork(networkId)
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
  }, [networkId, reloadToken]);

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
    return (
      <Navigate
        replace
        to={`/knowledge-network/workspace/${networkId}/overview`}
      />
    );
  }

  return children;
}
