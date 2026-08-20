/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import {
  EditOutlined,
  PlayCircleOutlined,
  SettingOutlined,
  UnorderedListOutlined,
} from "@ant-design/icons";
import { Alert, Card, Descriptions, Spin } from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

import { useAppServices } from "@/framework/context/use-app-services";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { ActionTypeExecuteModal } from "@/modules/knowledge-network/components/action-type/ActionTypeExecuteModal";
import {
  ACTION_TYPE_EXECUTION_TOOL_REQUIRED_KEY,
  ActionTypeExecutionEditor,
  createDefaultActionTypeExecutionConfig,
  normalizeActionTypeExecutionConfig,
  validateActionTypeExecutionConfig,
} from "@/modules/knowledge-network/components/action-type/ActionTypeExecutionEditor";
import type { ActionTypeExecutionParameterSchemaState } from "@/modules/knowledge-network/components/action-type/ActionTypeExecutionEditor";
import { ActionTypeTaskManagementPanel } from "@/modules/knowledge-network/components/action-type/ActionTypeTaskManagementPanel";
import { KnowledgeNetworkResourceConfigShell } from "@/modules/knowledge-network/components/shared/KnowledgeNetworkResourceConfigShell";
import { useKnowledgeNetworkOperationAccessState } from "@/modules/knowledge-network/hooks/useKnowledgeNetworkCanModify";
import {
  executeKnowledgeNetworkActionTypeNow,
  getKnowledgeNetworkActionTypeDetail,
  updateKnowledgeNetworkActionType,
} from "@/modules/knowledge-network/services/knowledge-network.service";
import type {
  ActionTypeDetail,
  ActionTypeExecutionConfig,
} from "@/modules/knowledge-network/types/knowledge-network";
import { getActionTypeDynamicParameters } from "@/modules/knowledge-network/utils/action-type-dynamic-params";
import { getActionSourceDisplayName } from "@/modules/knowledge-network/utils/action-type-execution";

import detailStyles from "./ActionTypeDetailScene.module.css";
import styles from "./KnowledgeNetworkResourceConfigScene.module.css";

type ExecutionTab = "run" | "config" | "tasks";

const ACTION_TYPE_EXECUTION_OPERATIONS = ["modify", "task_manage"] as const;

export function ActionTypeExecutionScene() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { message } = useAppServices();
  const [searchParams, setSearchParams] = useSearchParams();
  const { actionTypeId = "", networkId = "" } = useParams<{
    actionTypeId: string;
    networkId: string;
  }>();
  const [detail, setDetail] = useState<ActionTypeDetail | null>(null);
  const [executionValue, setExecutionValue] = useState<ActionTypeExecutionConfig>(
    createDefaultActionTypeExecutionConfig(),
  );
  const [executionSchemaState, setExecutionSchemaState] =
    useState<ActionTypeExecutionParameterSchemaState>({
      loaded: false,
      parameterCount: 0,
    });
  const [executionSourceError, setExecutionSourceError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [executeModalOpen, setExecuteModalOpen] = useState(false);
  const [taskRefreshToken, setTaskRefreshToken] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const { access: operationAccess, isLoading: isPermissionLoading } =
    useKnowledgeNetworkOperationAccessState(
      networkId,
      ACTION_TYPE_EXECUTION_OPERATIONS,
    );
  const canModify = operationAccess.modify;
  const canTaskManage = operationAccess.task_manage;

  const listPath = `/knowledge-network/workspace/${networkId}/action-types`;
  const detailPath = `/knowledge-network/workspace/${networkId}/action-types/${actionTypeId}/detail`;
  const activeTab: ExecutionTab =
    searchParams.get("tab") === "config"
      ? "config"
      : searchParams.get("tab") === "tasks"
        ? "tasks"
        : "run";

  useEffect(() => {
    if (!networkId || !actionTypeId) {
      return;
    }

    const loadData = async () => {
      setLoading(true);
      setError(null);

      try {
        const actionTypeDetail = await getKnowledgeNetworkActionTypeDetail(
          networkId,
          actionTypeId,
        );

        if (!actionTypeDetail) {
          throw new Error(t("common.notFound"));
        }

        setDetail(actionTypeDetail);
        setExecutionValue(actionTypeDetail.executionConfig);
      } catch (nextError) {
        setError(extractRequestErrorMessage(nextError));
      } finally {
        setLoading(false);
      }
    };

    void loadData();
  }, [actionTypeId, networkId, t]);

  const setActiveTab = (tab: ExecutionTab) => {
    if (tab === "run") {
      setSearchParams({});
      return;
    }

    setSearchParams({ tab });
  };

  const handleSave = async () => {
    if (!detail || !canModify) {
      return;
    }

    const validationErrorKey = validateActionTypeExecutionConfig(executionValue, {
      allowEmptyParameters:
        executionSchemaState.loaded && executionSchemaState.parameterCount === 0,
    });
    if (validationErrorKey) {
      const validationError = t(validationErrorKey);
      setExecutionSourceError(
        validationErrorKey === ACTION_TYPE_EXECUTION_TOOL_REQUIRED_KEY
          ? validationError
          : null,
      );
      void message.error(validationError);
      return;
    }
    setExecutionSourceError(null);

    const normalizedExecution = normalizeActionTypeExecutionConfig(executionValue);

    setSubmitting(true);
    try {
      await updateKnowledgeNetworkActionType(networkId, actionTypeId, {
        actionKind: detail.actionKind,
        affect: detail.affect,
        color: detail.color,
        condition: detail.condition,
        description: detail.description,
        executionConfig: normalizedExecution,
        name: detail.name,
        objectTypeId: detail.objectTypeId,
        tags: detail.tags,
      });
      void message.success(t("common.success"));
      void navigate(detailPath);
    } catch (nextError) {
      void message.error(extractRequestErrorMessage(nextError));
    } finally {
      setSubmitting(false);
    }
  };

  const executeNow = async (dynamicParams?: Record<string, unknown>) => {
    if (!detail || !canTaskManage) {
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

  const renderRunPanel = () => {
    if (!detail) {
      return null;
    }

    const dynamicParameters = getActionTypeDynamicParameters(detail.executionConfig.parameters);
    const sourceName =
      getActionSourceDisplayName(detail.executionConfig.actionSource) ||
      detail.executionConfig.sourceName ||
      t("knowledgeNetwork.actionTypeEmptyValue");

    return (
      <Card className={styles.executionCard} title={t("knowledgeNetwork.actionTypeExecutionRunTitle")}>
        <Descriptions column={2} size="middle">
          <Descriptions.Item label={t("knowledgeNetwork.actionTypeObject")}>
            {detail.objectTypeName || detail.objectTypeId}
          </Descriptions.Item>
          <Descriptions.Item label={t("knowledgeNetwork.actionTypeOperatorLabel")}>
            {sourceName}
          </Descriptions.Item>
          <Descriptions.Item label={t("knowledgeNetwork.actionTypeExecutionParameters")}>
            {t("knowledgeNetwork.actionTypeExecutionParameterCount", {
              count: detail.executionConfig.parameters.length,
            })}
          </Descriptions.Item>
          <Descriptions.Item label={t("knowledgeNetwork.actionTypeExecuteParamsTitle")}>
            {dynamicParameters.length > 0
              ? t("knowledgeNetwork.actionTypeExecutionDynamicParamCount", {
                  count: dynamicParameters.length,
                })
              : t("knowledgeNetwork.actionTypeExecutionNoDynamicParams")}
          </Descriptions.Item>
        </Descriptions>
        <div className={styles.executionActionBar}>
          <AppButton
            disabled={isPermissionLoading || !canTaskManage}
            icon={<PlayCircleOutlined />}
            loading={executing}
            onClick={handleExecuteNow}
            type="primary"
          >
            {t("knowledgeNetwork.actionTypeExecuteImmediately")}
          </AppButton>
          <AppButton onClick={() => setActiveTab("tasks")}>
            {t("knowledgeNetwork.actionTypeDetailTaskManagement")}
          </AppButton>
        </div>
      </Card>
    );
  };

  const renderConfigPanel = () => {
    if (!canModify) {
      return (
        <Alert
          message={t("knowledgeNetwork.actionTypeExecutionConfigReadonly")}
          showIcon
          type="info"
        />
      );
    }

    return (
      <div className={styles.mappingFormPanel}>
        <ActionTypeExecutionEditor
          networkId={networkId}
          objectTypeId={detail?.objectTypeId ?? ""}
          onParameterSchemaStateChange={setExecutionSchemaState}
          onChange={(nextValue) => {
            setExecutionValue(nextValue);
            if (
              getActionSourceDisplayName(nextValue.actionSource) ||
              nextValue.sourceName.trim()
            ) {
              setExecutionSourceError(null);
            }
          }}
          sourceError={executionSourceError}
          value={executionValue}
        />
      </div>
    );
  };

  return (
    <KnowledgeNetworkResourceConfigShell
      actions={
        activeTab === "config" && canModify ? (
          <AppButton
            disabled={isPermissionLoading}
            loading={submitting}
            onClick={() => void handleSave()}
            type="primary"
          >
            {t("common.save")}
          </AppButton>
        ) : (
          <AppButton
            icon={<EditOutlined />}
            onClick={() => {
              void navigate(detailPath);
            }}
          >
            {t("knowledgeNetwork.actionTypeDetailOverview")}
          </AppButton>
        )
      }
      onBack={() => {
        void navigate(actionTypeId ? detailPath : listPath);
      }}
      subtitle={t("knowledgeNetwork.actionTypeExecutionDescription")}
      title={detail?.name ?? t("knowledgeNetwork.actionTypeExecutionTitle")}
    >
      {loading ? (
        <div className={styles.loadingState}>
          <Spin />
        </div>
      ) : error ? (
        <Alert message={error} showIcon type="error" />
      ) : (
        <div className={detailStyles.detailLayout}>
          <aside className={detailStyles.sideNav}>
            <button
              className={
                activeTab === "run" ? detailStyles.sideNavItemActive : detailStyles.sideNavItem
              }
              onClick={() => setActiveTab("run")}
              type="button"
            >
              <PlayCircleOutlined />
              <span>{t("knowledgeNetwork.actionTypeExecutionRun")}</span>
            </button>
            <button
              className={
                activeTab === "config" ? detailStyles.sideNavItemActive : detailStyles.sideNavItem
              }
              onClick={() => setActiveTab("config")}
              type="button"
            >
              <SettingOutlined />
              <span>{t("knowledgeNetwork.actionTypeExecutionConfig")}</span>
            </button>
            <button
              className={
                activeTab === "tasks" ? detailStyles.sideNavItemActive : detailStyles.sideNavItem
              }
              onClick={() => setActiveTab("tasks")}
              type="button"
            >
              <UnorderedListOutlined />
              <span>{t("knowledgeNetwork.actionTypeDetailTaskManagement")}</span>
            </button>
          </aside>

          <div className={detailStyles.contentPanel}>
            {activeTab === "run" ? renderRunPanel() : null}
            {activeTab === "config" ? renderConfigPanel() : null}
            {activeTab === "tasks" && detail ? (
              <ActionTypeTaskManagementPanel
                actionTypeId={actionTypeId}
                canManage={canTaskManage}
                networkId={networkId}
                refreshToken={taskRefreshToken}
              />
            ) : null}
          </div>
        </div>
      )}
      {detail ? (
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
      ) : null}
    </KnowledgeNetworkResourceConfigShell>
  );
}
