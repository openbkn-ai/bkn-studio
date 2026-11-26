/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { getActionTypeDynamicParameters } from "../utils/action-type-dynamic-params";
import type { ActionExecutionInput } from "../utils/action-execution-input";

import { EditOutlined, PlayCircleOutlined, UnorderedListOutlined } from "@ant-design/icons";
import { Alert, Card, Descriptions, Spin } from "antd";
import { Suspense, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";

import { useAppServices } from "@/framework/context/use-app-services";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { hasPermissions } from "@/framework/permission/has-permissions";
import {
  extensionActionExecutionGate,
  type ActionExecutionGateProps,
} from "@/framework/extension/registry";
import { AppButton } from "@/framework/ui/common/AppButton";
import { ActionTypeExecuteModal } from "@/modules/knowledge-network/components/action-type/ActionTypeExecuteModal";
import { ActionTypeTaskManagementPanel } from "@/modules/knowledge-network/components/action-type/ActionTypeTaskManagementPanel";
import { KnowledgeNetworkResourceConfigShell } from "@/modules/knowledge-network/components/shared/KnowledgeNetworkResourceConfigShell";
import {
  knowledgeNetworkReturnPath,
  knowledgeNetworkReturnState,
} from "@/modules/knowledge-network/lib/knowledge-network-navigation";
import {
  needsActionTypeActionSourceDisplayResolution,
  resolveActionTypeActionSourceDisplayWithTimeout,
} from "@/modules/knowledge-network/services/action-type-tool.service";
import {
  executeKnowledgeNetworkActionTypeNow,
  getKnowledgeNetworkActionTypeDetail,
  isActionGovernanceRequiredError,
} from "@/modules/knowledge-network/services/knowledge-network.service";
import type {
  ActionTypeDetail,
  ActionTypeActionSource,
} from "@/modules/knowledge-network/types/knowledge-network";
import { hasKnowledgeNetworkRecordOperation } from "@/modules/knowledge-network/utils/record-operations";
import { getReadableActionSourceDisplayName } from "@/modules/knowledge-network/utils/action-type-execution";

import detailStyles from "./ActionTypeDetailScene.module.css";
import styles from "./KnowledgeNetworkResourceConfigScene.module.css";

type ExecutionTab = "run" | "tasks";

export function ActionTypeExecutionScene() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { message, runtimeConfig } = useAppServices();
  const [searchParams, setSearchParams] = useSearchParams();
  const { actionTypeId = "", networkId = "" } = useParams<{
    actionTypeId: string;
    networkId: string;
  }>();
  const [detail, setDetail] = useState<ActionTypeDetail | null>(null);
  const [resolvedRunActionSource, setResolvedRunActionSource] = useState<
    ActionTypeActionSource | undefined
  >();
  const [runSourceResolutionFailed, setRunSourceResolutionFailed] = useState(false);
  const [runSourceResolving, setRunSourceResolving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [executeModalOpen, setExecuteModalOpen] = useState(false);
  const [governanceGate, setGovernanceGate] = useState<{
    input: ActionExecutionInput;
  } | null>(null);
  const ExecutionGate = extensionActionExecutionGate();
  const [taskRefreshToken, setTaskRefreshToken] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const canExecute = detail ? hasKnowledgeNetworkRecordOperation(detail, "execute") : false;
  const actionSource = detail?.executionConfig.actionSource;
  const canViewToolbox = hasPermissions({
    currentPermissions: runtimeConfig.currentUser.permissions,
    mode: "any",
    requiredPermissions: ["execution-factory:toolbox:view", "execution-factory:function:view"],
  });
  const canViewMcp = hasPermissions({
    currentPermissions: runtimeConfig.currentUser.permissions,
    requiredPermissions: "execution-factory:mcp:view",
  });
  const canResolveActionSource =
    !actionSource ||
    actionSource.type === "manual" ||
    (actionSource.type === "tool" ? canViewToolbox : canViewMcp);

  const listPath = `/knowledge-network/workspace/${networkId}/action-types`;
  const detailPath = `/knowledge-network/workspace/${networkId}/action-types/${actionTypeId}/detail`;
  const returnPath = knowledgeNetworkReturnPath(
    networkId,
    location.state,
    actionTypeId ? detailPath : listPath,
  );
  const activeTab: ExecutionTab = searchParams.get("tab") === "tasks" ? "tasks" : "run";

  useEffect(() => {
    if (!networkId || !actionTypeId) {
      return;
    }

    const loadData = async () => {
      setLoading(true);
      setError(null);

      try {
        const actionTypeDetail = await getKnowledgeNetworkActionTypeDetail(networkId, actionTypeId);

        if (!actionTypeDetail) {
          throw new Error(t("common.notFound"));
        }

        setDetail(actionTypeDetail);
      } catch (nextError) {
        setError(extractRequestErrorMessage(nextError));
      } finally {
        setLoading(false);
      }
    };

    void loadData();
  }, [actionTypeId, networkId, t]);

  useEffect(() => {
    setResolvedRunActionSource(actionSource);

    if (!actionSource || !needsActionTypeActionSourceDisplayResolution(actionSource)) {
      setRunSourceResolutionFailed(false);
      setRunSourceResolving(false);
      return;
    }

    if (!canResolveActionSource) {
      setRunSourceResolutionFailed(true);
      setRunSourceResolving(false);
      return;
    }

    let cancelled = false;
    setRunSourceResolutionFailed(false);
    setRunSourceResolving(true);

    void resolveActionTypeActionSourceDisplayWithTimeout(actionSource)
      .then((resolved) => {
        if (!cancelled) {
          setResolvedRunActionSource(resolved);
          setRunSourceResolutionFailed(needsActionTypeActionSourceDisplayResolution(resolved));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRunSourceResolutionFailed(true);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setRunSourceResolving(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [actionSource, canResolveActionSource]);

  // A tab is a search parameter; keep the navigation state so the back button still leads
  // where the user came from.
  const setActiveTab = (tab: ExecutionTab) => {
    setSearchParams(tab === "run" ? {} : { tab }, { state: location.state as unknown });
  };

  const executeNow = async (
    input?: ActionExecutionInput,
    governance?: { requestId: string; planDigest: string },
  ) => {
    if (!detail || !canExecute) {
      return false;
    }

    setExecuting(true);
    try {
      await executeKnowledgeNetworkActionTypeNow(networkId, detail.id, input, governance, {
        skipErrorToast: true,
      });
      void message.success(t("knowledgeNetwork.actionTypeExecuteSuccess"));
      setTaskRefreshToken((value) => value + 1);
      setActiveTab("tasks");
      return true;
    } catch (nextError) {
      if (!governance && isActionGovernanceRequiredError(nextError) && ExecutionGate) {
        // The executor owns the governance verdict. Keep the assembled input and let
        // the extension negotiate the decision before exactly one authorized retry.
        setGovernanceGate({ input: input ?? {} });
        setExecuteModalOpen(false);
        return false;
      }
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

    setExecuteModalOpen(true);
  };

  const handleGovernanceAuthorized: ActionExecutionGateProps["onAuthorized"] = (credentials) => {
    const input = governanceGate?.input;
    if (!input) {
      return;
    }
    void executeNow(input, credentials).finally(() => setGovernanceGate(null));
  };

  const renderRunPanel = () => {
    if (!detail) {
      return null;
    }

    const dynamicParameters = getActionTypeDynamicParameters(detail.executionConfig.parameters);
    const sourceUnavailable =
      runSourceResolutionFailed &&
      needsActionTypeActionSourceDisplayResolution(resolvedRunActionSource);
    const sourceName =
      runSourceResolving || sourceUnavailable
        ? ""
        : getReadableActionSourceDisplayName(resolvedRunActionSource) ||
          (!detail.executionConfig.actionSource ? detail.executionConfig.sourceName.trim() : "");

    return (
      <Card
        className={styles.executionCard}
        title={t("knowledgeNetwork.actionTypeExecutionRunTitle")}
      >
        <Descriptions column={2} size="middle">
          <Descriptions.Item label={t("knowledgeNetwork.actionTypeObject")}>
            {detail.objectTypeName || detail.objectTypeId}
          </Descriptions.Item>
          <Descriptions.Item label={t("knowledgeNetwork.actionTypeOperatorLabel")}>
            {runSourceResolving ? (
              <span>
                <Spin size="small" /> {t("knowledgeNetwork.actionTypeExecutionSourceResolving")}
              </span>
            ) : (
              sourceName || t("knowledgeNetwork.actionTypeEmptyValue")
            )}
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
            disabled={!canExecute}
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

  return (
    <KnowledgeNetworkResourceConfigShell
      actions={
        <AppButton
          icon={<EditOutlined />}
          onClick={() => {
            void navigate(detailPath, { state: knowledgeNetworkReturnState(returnPath) });
          }}
        >
          {t("knowledgeNetwork.actionTypeDetailOverview")}
        </AppButton>
      }
      onBack={() => {
        void navigate(returnPath);
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
        <>
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
              {activeTab === "tasks" && detail ? (
                <ActionTypeTaskManagementPanel
                  actionTypeId={actionTypeId}
                  canManage={canExecute}
                  networkId={networkId}
                  refreshToken={taskRefreshToken}
                  initialExecutionId={searchParams.get("execution_id") ?? undefined}
                />
              ) : null}
            </div>
          </div>
        </>
      )}
      {detail ? (
        <ActionTypeExecuteModal
          networkId={networkId}
          actionTypeId={detail.id}
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
          submitting={executing}
        />
      ) : null}
      {detail && ExecutionGate && governanceGate ? (
        <Suspense fallback={<Spin />}>
          <ExecutionGate
            networkId={networkId}
            actionTypeId={detail.id}
            actionTypeName={detail.name}
            input={governanceGate.input}
            onClose={() => setGovernanceGate(null)}
            onAuthorized={handleGovernanceAuthorized}
          />
        </Suspense>
      ) : null}
    </KnowledgeNetworkResourceConfigShell>
  );
}
