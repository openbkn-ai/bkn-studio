/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert } from "antd";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";

import { useAppServices } from "@/framework/context/use-app-services";
import { hasPermissions } from "@/framework/permission/has-permissions";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { ActionTypeOverviewPanel } from "@/modules/knowledge-network/components/action-type/ActionTypeOverviewPanel";
import { KnowledgeNetworkResourceConfigShell } from "@/modules/knowledge-network/components/shared/KnowledgeNetworkResourceConfigShell";
import {
  getKnowledgeNetworkActionTypeDetail,
  listKnowledgeNetworkObjectTypes,
} from "@/modules/knowledge-network/services/knowledge-network.service";
import type {
  ActionTypeDetail,
  KnowledgeNetworkObjectTypeRecord,
} from "@/modules/knowledge-network/types/knowledge-network";

import styles from "./ActionTypeDetailScene.module.css";

export function ActionTypeDetailScene() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { runtimeConfig } = useAppServices();
  const { actionTypeId = "", networkId = "" } = useParams<{
    actionTypeId: string;
    networkId: string;
  }>();
  const [detail, setDetail] = useState<ActionTypeDetail | null>(null);
  const [objectTypes, setObjectTypes] = useState<KnowledgeNetworkObjectTypeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const canViewToolbox = hasPermissions({
    currentPermissions: runtimeConfig.currentUser.permissions,
    requiredPermissions: "execution-factory:toolbox:view",
  });
  const canViewMcp = hasPermissions({
    currentPermissions: runtimeConfig.currentUser.permissions,
    requiredPermissions: "execution-factory:mcp:view",
  });
  const actionSource = detail?.executionConfig.actionSource;
  const canResolveActionSource =
    !actionSource ||
    actionSource.type === "manual" ||
    (actionSource.type === "tool" ? canViewToolbox : canViewMcp);
  const listPath = `/knowledge-network/workspace/${networkId}/action-types`;

  const loadData = useCallback(async () => {
    if (!networkId || !actionTypeId) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [result, nextObjectTypes] = await Promise.all([
        getKnowledgeNetworkActionTypeDetail(networkId, actionTypeId),
        listKnowledgeNetworkObjectTypes(networkId),
      ]);
      setDetail(result);
      setObjectTypes(nextObjectTypes);
    } catch (nextError) {
      setError(extractRequestErrorMessage(nextError));
    } finally {
      setLoading(false);
    }
  }, [actionTypeId, networkId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  if (loading) {
    return (
      <KnowledgeNetworkResourceConfigShell
        loading
        onBack={() => {
          void navigate(listPath);
        }}
        subtitle={t("knowledgeNetwork.actionTypeDetailDescription")}
        title={t("knowledgeNetwork.actionTypeDetailTitle")}
      />
    );
  }

  if (error || !detail) {
    return <Alert message={error ?? t("common.notFound")} showIcon type="error" />;
  }

  return (
    <KnowledgeNetworkResourceConfigShell
      onBack={() => {
        void navigate(listPath);
      }}
      subtitle={t("knowledgeNetwork.actionTypeDetailDescription")}
      title={detail.name}
    >
      <div className={styles.contentPanel}>
        <ActionTypeOverviewPanel
          canResolveActionSource={canResolveActionSource}
          detail={detail}
          networkId={networkId}
          objectTypes={objectTypes}
        />
      </div>
    </KnowledgeNetworkResourceConfigShell>
  );
}
