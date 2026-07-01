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
  buildRelationTypeMappingRulesFromDetail,
  createDefaultRelationTypeMappingValues,
  normalizeRelationTypeMappingValues,
  RelationTypeMappingEditor,
  validateRelationTypeMappingValues,
  type RelationTypeMappingFormValues,
} from "@/modules/knowledge-network/components/relation-type/RelationTypeMappingEditor";
import { KnowledgeNetworkResourceConfigShell } from "@/modules/knowledge-network/components/shared/KnowledgeNetworkResourceConfigShell";
import {
  getKnowledgeNetworkRelationTypeDetail,
  listKnowledgeNetworkObjectTypes,
  updateKnowledgeNetworkRelationType,
} from "@/modules/knowledge-network/services/knowledge-network.service";
import type {
  KnowledgeNetworkObjectTypeRecord,
  RelationTypeDetail,
} from "@/modules/knowledge-network/types/knowledge-network";

import styles from "./KnowledgeNetworkResourceConfigScene.module.css";

export function RelationTypeMappingScene() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { message } = useAppServices();
  const { networkId = "", relationTypeId = "" } = useParams<{
    networkId: string;
    relationTypeId: string;
  }>();
  const [detail, setDetail] = useState<RelationTypeDetail | null>(null);
  const [objectTypes, setObjectTypes] = useState<KnowledgeNetworkObjectTypeRecord[]>([]);
  const [mappingValue, setMappingValue] = useState<RelationTypeMappingFormValues>(
    createDefaultRelationTypeMappingValues(),
  );
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const listPath = `/knowledge-network/workspace/${networkId}/relation-types`;
  const detailPath = `/knowledge-network/workspace/${networkId}/relation-types/${relationTypeId}/detail`;

  useEffect(() => {
    if (!networkId || !relationTypeId) {
      return;
    }

    const loadData = async () => {
      setLoading(true);
      setError(null);

      try {
        const [relationTypeDetail, nextObjectTypes] = await Promise.all([
          getKnowledgeNetworkRelationTypeDetail(networkId, relationTypeId),
          listKnowledgeNetworkObjectTypes(networkId),
        ]);

        if (!relationTypeDetail) {
          throw new Error(t("common.notFound"));
        }

        setDetail(relationTypeDetail);
        setObjectTypes(nextObjectTypes);
        setMappingValue({
          mappingMode: relationTypeDetail.mappingMode,
          mappingRules: buildRelationTypeMappingRulesFromDetail(relationTypeDetail),
        });
      } catch (nextError) {
        setError(extractRequestErrorMessage(nextError));
      } finally {
        setLoading(false);
      }
    };

    void loadData();
  }, [networkId, relationTypeId, t]);

  const handleSave = async () => {
    if (!detail) {
      return;
    }

    const validationError = validateRelationTypeMappingValues(t, mappingValue);
    if (validationError) {
      void message.error(validationError);
      return;
    }

    const normalizedMapping = normalizeRelationTypeMappingValues(mappingValue);

    setSubmitting(true);
    try {
      await updateKnowledgeNetworkRelationType(networkId, relationTypeId, {
        color: detail.color,
        description: detail.description,
        mappingMode: normalizedMapping.mappingMode,
        mappingRules: normalizedMapping.mappingRules,
        name: detail.name,
        sourceObjectTypeId: normalizedMapping.mappingRules.sourceObjectTypeId,
        tags: detail.tags,
        targetObjectTypeId: normalizedMapping.mappingRules.targetObjectTypeId,
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
        void navigate(relationTypeId ? detailPath : listPath);
      }}
      subtitle={t("knowledgeNetwork.relationTypeMappingSubtitle")}
      title={detail?.name ?? t("knowledgeNetwork.relationTypeMappingTitle")}
    >
      {loading ? (
        <div className={styles.loadingState}>
          <Spin />
        </div>
      ) : error ? (
        <Alert message={error} showIcon type="error" />
      ) : (
        <div className={styles.mappingFormPanel}>
          <RelationTypeMappingEditor
            networkId={networkId}
            objectTypes={objectTypes}
            onChange={setMappingValue}
            value={mappingValue}
          />
        </div>
      )}
    </KnowledgeNetworkResourceConfigShell>
  );
}
