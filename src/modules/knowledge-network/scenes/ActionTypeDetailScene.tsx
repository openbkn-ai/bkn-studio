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
import modalStyles from "@/modules/knowledge-network/components/network/KnowledgeNetworkFormModal.module.css";
import { KnowledgeNetworkObjectAuthorizeDrawer } from "@/modules/knowledge-network/components/shared/KnowledgeNetworkObjectAuthorizeDrawer";
import { KnowledgeNetworkResourceConfigShell } from "@/modules/knowledge-network/components/shared/KnowledgeNetworkResourceConfigShell";
import { KnowledgeNetworkResourceDetailActions } from "@/modules/knowledge-network/components/shared/KnowledgeNetworkResourceDetailActions";
import {
  deleteKnowledgeNetworkActionType,
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
  const { message, modal, runtimeConfig } = useAppServices();
  const { actionTypeId = "", networkId = "" } = useParams<{
    actionTypeId: string;
    networkId: string;
  }>();
  const [detail, setDetail] = useState<ActionTypeDetail | null>(null);
  const [objectTypes, setObjectTypes] = useState<KnowledgeNetworkObjectTypeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authorizeOpen, setAuthorizeOpen] = useState(false);
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

  const confirmDelete = () => {
    if (!detail) {
      return;
    }

    void modal.confirm({
      cancelText: t("common.cancel"),
      centered: true,
      className: `${modalStyles.businessModal} ${modalStyles.resourceDeleteConfirmModal}`,
      content: t("knowledgeNetwork.actionTypeDeleteDescription", { name: detail.name }),
      okButtonProps: { danger: true, type: "primary" },
      okText: t("common.delete"),
      onOk: async () => {
        await deleteKnowledgeNetworkActionType(networkId, actionTypeId);
        void message.success(t("common.success"));
        void navigate(listPath);
      },
      title: t("knowledgeNetwork.actionTypeDeleteTitle"),
      width: 520,
    });
  };

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
    <>
      <KnowledgeNetworkResourceConfigShell
        actions={
          <KnowledgeNetworkResourceDetailActions
            actions={[
              {
                key: "edit",
                label: t("common.edit"),
                onClick: () => {
                  void navigate(
                    `/knowledge-network/workspace/${networkId}/action-types/${actionTypeId}/edit`,
                  );
                },
                operation: "modify",
                type: "primary",
              },
              {
                key: "execution",
                label: t("knowledgeNetwork.actionTypeExecutionEntry"),
                onClick: () => {
                  void navigate(
                    `/knowledge-network/workspace/${networkId}/action-types/${actionTypeId}/execution`,
                  );
                },
                operation: "task_manage",
              },
              {
                key: "authorize",
                label: t("knowledgeNetwork.authorizeAction"),
                onClick: () => setAuthorizeOpen(true),
                operation: "authorize",
              },
              {
                danger: true,
                key: "delete",
                label: t("common.delete"),
                onClick: confirmDelete,
                operation: "delete",
              },
            ]}
            record={detail}
          />
        }
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
      <KnowledgeNetworkObjectAuthorizeDrawer
        networkId={networkId}
        objectType="action_type"
        onClose={() => setAuthorizeOpen(false)}
        open={authorizeOpen}
        record={detail}
      />
    </>
  );
}
