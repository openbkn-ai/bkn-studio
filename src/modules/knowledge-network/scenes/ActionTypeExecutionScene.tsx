/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Spin } from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";

import { useAppServices } from "@/framework/context/use-app-services";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import {
  ActionTypeExecutionEditor,
  createDefaultActionTypeExecutionConfig,
  normalizeActionTypeExecutionConfig,
  validateActionTypeExecutionConfig,
} from "@/modules/knowledge-network/components/action-type/ActionTypeExecutionEditor";
import { KnowledgeNetworkResourceConfigShell } from "@/modules/knowledge-network/components/shared/KnowledgeNetworkResourceConfigShell";
import {
  getKnowledgeNetworkActionTypeDetail,
  updateKnowledgeNetworkActionType,
} from "@/modules/knowledge-network/services/knowledge-network.service";
import type {
  ActionTypeDetail,
  ActionTypeExecutionConfig,
} from "@/modules/knowledge-network/types/knowledge-network";

import styles from "./KnowledgeNetworkResourceConfigScene.module.css";

export function ActionTypeExecutionScene() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { message } = useAppServices();
  const { actionTypeId = "", networkId = "" } = useParams<{
    actionTypeId: string;
    networkId: string;
  }>();
  const [detail, setDetail] = useState<ActionTypeDetail | null>(null);
  const [executionValue, setExecutionValue] = useState<ActionTypeExecutionConfig>(
    createDefaultActionTypeExecutionConfig(),
  );
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const listPath = `/knowledge-network/workspace/${networkId}/action-types`;
  const detailPath = `/knowledge-network/workspace/${networkId}/action-types/${actionTypeId}/detail`;

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

  const handleSave = async () => {
    if (!detail) {
      return;
    }

    const validationError = validateActionTypeExecutionConfig(t, executionValue);
    if (validationError) {
      void message.error(validationError);
      return;
    }

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

  return (
    <KnowledgeNetworkResourceConfigShell
      actions={
        <AppButton loading={submitting} onClick={() => void handleSave()} type="primary">
          {t("common.save")}
        </AppButton>
      }
      onBack={() => {
        void navigate(actionTypeId ? detailPath : listPath);
      }}
      subtitle={t("knowledgeNetwork.actionTypeExecutionConfigSubtitle")}
      title={detail?.name ?? t("knowledgeNetwork.actionTypeExecutionTitle")}
    >
      {loading ? (
        <div className={styles.loadingState}>
          <Spin />
        </div>
      ) : error ? (
        <Alert message={error} showIcon type="error" />
      ) : (
        <div className={styles.mappingFormPanel}>
          <ActionTypeExecutionEditor
            networkId={networkId}
            objectTypeId={detail?.objectTypeId ?? ""}
            onChange={setExecutionValue}
            value={executionValue}
          />
        </div>
      )}
    </KnowledgeNetworkResourceConfigShell>
  );
}
