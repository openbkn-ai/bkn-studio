/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { EditOutlined, FileTextOutlined, PlayCircleOutlined, ThunderboltOutlined, UnorderedListOutlined } from "@ant-design/icons";
import { Alert, Spin } from "antd";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

import { useAppServices } from "@/framework/context/use-app-services";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { ActionTypeOverviewPanel } from "@/modules/knowledge-network/components/action-type/ActionTypeOverviewPanel";
import { ActionTypeExecuteModal } from "@/modules/knowledge-network/components/action-type/ActionTypeExecuteModal";
import { ActionTypeTaskManagementPanel } from "@/modules/knowledge-network/components/action-type/ActionTypeTaskManagementPanel";
import modalStyles from "@/modules/knowledge-network/components/network/KnowledgeNetworkFormModal.module.css";
import { KnowledgeNetworkResourceConfigShell } from "@/modules/knowledge-network/components/shared/KnowledgeNetworkResourceConfigShell";
import {
  deleteKnowledgeNetworkActionType,
  executeKnowledgeNetworkActionTypeNow,
  getKnowledgeNetworkActionTypeDetail,
  listKnowledgeNetworkObjectTypes,
} from "@/modules/knowledge-network/services/knowledge-network.service";
import { useKnowledgeNetworkOperationAccess } from "@/modules/knowledge-network/hooks/useKnowledgeNetworkCanModify";
import type {
  ActionTypeDetail,
  KnowledgeNetworkObjectTypeRecord,
} from "@/modules/knowledge-network/types/knowledge-network";
import { getActionTypeDynamicParameters } from "@/modules/knowledge-network/utils/action-type-dynamic-params";

import styles from "./ActionTypeDetailScene.module.css";

type DetailTab = "overview" | "tasks";

const ACTION_TYPE_DETAIL_OPERATIONS = ["modify", "task_manage"] as const;

export function ActionTypeDetailScene() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { message, modal } = useAppServices();
  const [searchParams, setSearchParams] = useSearchParams();
  const { actionTypeId = "", networkId = "" } = useParams<{
    actionTypeId: string;
    networkId: string;
  }>();
  const [detail, setDetail] = useState<ActionTypeDetail | null>(null);
  const [objectTypes, setObjectTypes] = useState<KnowledgeNetworkObjectTypeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [executeModalOpen, setExecuteModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [taskRefreshToken, setTaskRefreshToken] = useState(0);
  const operationAccess = useKnowledgeNetworkOperationAccess(
    networkId,
    ACTION_TYPE_DETAIL_OPERATIONS,
  );
  const canModify = operationAccess.modify;
  const canTaskManage = operationAccess.task_manage;

  const activeTab: DetailTab = searchParams.get("tab") === "tasks" ? "tasks" : "overview";
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

  const setActiveTab = (tab: DetailTab) => {
    if (tab === "overview") {
      setSearchParams({});
      return;
    }

    setSearchParams({ tab: "tasks" });
  };

  const confirmDelete = () => {
    if (!detail) {
      return;
    }

    void modal.confirm({
      title: t("knowledgeNetwork.actionTypeDeleteTitle"),
      content: t("knowledgeNetwork.actionTypeDeleteDescription", { name: detail.name }),
      cancelText: t("common.cancel"),
      centered: true,
      className: `${modalStyles.businessModal} ${modalStyles.resourceDeleteConfirmModal}`,
      okButtonProps: { danger: true, type: "primary" },
      okText: t("common.delete"),
      onOk: async () => {
        await deleteKnowledgeNetworkActionType(networkId, detail.id);
        void message.success(t("common.success"));
        void navigate(listPath);
      },
      width: 520,
    });
  };

  const executeNow = async (dynamicParams?: Record<string, unknown>) => {
    if (!detail) {
      return false;
    }

    setExecuting(true);
    try {
      await executeKnowledgeNetworkActionTypeNow(networkId, detail.id, dynamicParams);
      void message.success(t("knowledgeNetwork.actionTypeExecuteSuccess"));
      setTaskRefreshToken((value) => value + 1);
      setActiveTab("tasks");
      return true;
    } catch (nextError) {
      void message.error(extractRequestErrorMessage(nextError));
      return false;
    } finally {
      setExecuting(false);
    }
  };

  const handleExecuteNow = () => {
    if (!detail) {
      return;
    }

    const dynamicParameters = getActionTypeDynamicParameters(
      detail.executionConfig.parameters,
    );
    if (dynamicParameters.length > 0) {
      setExecuteModalOpen(true);
      return;
    }

    void executeNow();
  };

  if (loading) {
    return (
      <div className={styles.loadingState}>
        <Spin />
      </div>
    );
  }

  if (error || !detail) {
    return <Alert message={error ?? t("common.notFound")} showIcon type="error" />;
  }

  return (
    <KnowledgeNetworkResourceConfigShell
      actions={
        canModify || canTaskManage ? (
          <>
            {canTaskManage ? (
              <AppButton
                icon={<PlayCircleOutlined />}
                loading={executing}
                onClick={handleExecuteNow}
                type="primary"
              >
                {t("knowledgeNetwork.actionTypeExecuteImmediately")}
              </AppButton>
            ) : null}
            {canModify ? (
              <>
                <AppButton
                  icon={<EditOutlined />}
                  onClick={() => {
                    void navigate(
                      `/knowledge-network/workspace/${networkId}/action-types/${actionTypeId}/edit`,
                    );
                  }}
                >
                  {t("common.edit")}
                </AppButton>
                <AppButton
                  icon={<ThunderboltOutlined />}
                  onClick={() => {
                    void navigate(
                      `/knowledge-network/workspace/${networkId}/action-types/${actionTypeId}/execution`,
                    );
                  }}
                >
                  {t("knowledgeNetwork.actionTypeExecutionEntry")}
                </AppButton>
                <AppButton danger onClick={confirmDelete}>
                  {t("common.delete")}
                </AppButton>
              </>
            ) : null}
          </>
        ) : null
      }
      onBack={() => {
        void navigate(listPath);
      }}
      subtitle={t("knowledgeNetwork.actionTypeDetailDescription")}
      title={detail.name}
    >
      <div className={styles.detailLayout}>
        <aside className={styles.sideNav}>
          <button
            className={activeTab === "overview" ? styles.sideNavItemActive : styles.sideNavItem}
            onClick={() => setActiveTab("overview")}
            type="button"
          >
            <FileTextOutlined />
            <span>{t("knowledgeNetwork.actionTypeDetailOverview")}</span>
          </button>
          <button
            className={activeTab === "tasks" ? styles.sideNavItemActive : styles.sideNavItem}
            onClick={() => setActiveTab("tasks")}
            type="button"
          >
            <UnorderedListOutlined />
            <span>{t("knowledgeNetwork.actionTypeDetailTaskManagement")}</span>
          </button>
        </aside>

        <div className={styles.contentPanel}>
          {activeTab === "overview" ? (
            <ActionTypeOverviewPanel
              detail={detail}
              networkId={networkId}
              objectTypes={objectTypes}
            />
          ) : (
            <ActionTypeTaskManagementPanel
              actionTypeId={actionTypeId}
              networkId={networkId}
              refreshToken={taskRefreshToken}
            />
          )}
        </div>
      </div>
      <ActionTypeExecuteModal
        actionSource={detail.executionConfig.actionSource}
        actionTypeName={detail.name}
        onCancel={() => setExecuteModalOpen(false)}
        onSubmit={async (dynamicParams) => {
          const succeeded = await executeNow(dynamicParams);
          if (succeeded) {
            setExecuteModalOpen(false);
          }
          return succeeded;
        }}
        open={executeModalOpen}
        parameters={getActionTypeDynamicParameters(detail.executionConfig.parameters)}
        submitting={executing}
      />
    </KnowledgeNetworkResourceConfigShell>
  );
}
