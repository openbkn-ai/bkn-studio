/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { QuestionCircleOutlined } from "@ant-design/icons";
import { Form, InputNumber, Modal, Select, Switch, Tooltip } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { listObjectTypeSmallModels } from "@/modules/knowledge-network/services/knowledge-network.service";
import { logServiceFallback } from "@/modules/knowledge-network/services/shared/runtime";
import type {
  ObjectTypeIndexConfig,
  ObjectTypeSmallModel,
} from "@/modules/knowledge-network/types/knowledge-network";

import styles from "./ObjectTypeIndexSettingModal.module.css";

type ObjectTypeIndexSettingModalProps = {
  onCancel: () => void;
  onSubmit: (values: ObjectTypeIndexConfig) => Promise<void>;
  open: boolean;
  propertyName: string;
  values?: ObjectTypeIndexConfig;
};

const defaultIndexConfig = (): ObjectTypeIndexConfig => ({
  fulltextConfig: {
    analyzer: "",
    enabled: false,
  },
  keywordConfig: {
    enabled: false,
    ignoreAboveLen: 1024,
  },
  vectorConfig: {
    enabled: false,
    modelId: "",
  },
});

export function ObjectTypeIndexSettingModal({
  onCancel,
  onSubmit,
  open,
  propertyName,
  values,
}: ObjectTypeIndexSettingModalProps) {
  const { t } = useTranslation();
  const [submitting, setSubmitting] = useState(false);
  const [smallModels, setSmallModels] = useState<ObjectTypeSmallModel[]>([]);
  const [indexConfig, setIndexConfig] = useState<ObjectTypeIndexConfig>(
    defaultIndexConfig(),
  );

  useEffect(() => {
    if (!open) {
      setIndexConfig(defaultIndexConfig());
      return;
    }

    setIndexConfig(
      values
        ? {
            fulltextConfig: { ...values.fulltextConfig },
            keywordConfig: { ...values.keywordConfig },
            vectorConfig: { ...values.vectorConfig },
          }
        : defaultIndexConfig(),
    );
  }, [open, values]);

  useEffect(() => {
    if (!open) {
      setSmallModels([]);
      return;
    }

    const loadModels = async () => {
      try {
        const result = await listObjectTypeSmallModels();
        setSmallModels(result);
      } catch (error) {
        logServiceFallback("ObjectTypeIndexSettingModal.loadSmallModels", error);
        setSmallModels([]);
      }
    };

    void loadModels();
  }, [open]);

  const selectedModel = useMemo(
    () => smallModels.find((item) => item.value === indexConfig.vectorConfig.modelId),
    [indexConfig.vectorConfig.modelId, smallModels],
  );

  const tokenizerOptions = [
    { label: "standard", value: "standard" },
    { label: "english", value: "english" },
    { label: "ik_max_word", value: "ik_max_word" },
    { label: "hanlp_standard", value: "hanlp_standard" },
    { label: "hanlp_index", value: "hanlp_index" },
  ];

  const handleSubmit = async () => {
    if (
      indexConfig.keywordConfig.enabled &&
      !indexConfig.keywordConfig.ignoreAboveLen
    ) {
      return;
    }

    if (indexConfig.fulltextConfig.enabled && !indexConfig.fulltextConfig.analyzer) {
      return;
    }

    if (indexConfig.vectorConfig.enabled && !indexConfig.vectorConfig.modelId) {
      return;
    }

    setSubmitting(true);

    try {
      await onSubmit(indexConfig);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      confirmLoading={submitting}
      destroyOnClose
      okText={t("common.save")}
      onCancel={onCancel}
      onOk={() => {
        void handleSubmit();
      }}
      open={open}
      title={t("knowledgeNetwork.objectTypeIndexConfiguration")}
      width={480}
    >
      <div className={styles.selectedBox}>
        <span>{t("knowledgeNetwork.objectTypeIndexSelectedProperty")}</span>
        <span>{propertyName}</span>
      </div>

      <div className={styles.sectionHeader}>
        <div className={styles.sectionTitle}>
          {t("knowledgeNetwork.objectTypeIndexKeyword")}
        </div>
        <Switch
          checked={indexConfig.keywordConfig.enabled}
          onChange={(checked) => {
            setIndexConfig((current) => ({
              ...current,
              keywordConfig: {
                enabled: checked,
                ignoreAboveLen: current.keywordConfig.ignoreAboveLen || 1024,
              },
            }));
          }}
          size="small"
        />
      </div>
      {indexConfig.keywordConfig.enabled ? (
        <Form.Item
          className={styles.settingItem}
          label={
            <span className={styles.settingItemTitle}>
              <span className={styles.requiredMark}>*</span>
              {t("knowledgeNetwork.objectTypeIndexFieldLength")}
              <Tooltip title={t("knowledgeNetwork.objectTypeIndexFieldLengthTip")}>
                <QuestionCircleOutlined />
              </Tooltip>
            </span>
          }
          required
        >
          <InputNumber
            min={1}
            onChange={(value) => {
              setIndexConfig((current) => ({
                ...current,
                keywordConfig: {
                  ...current.keywordConfig,
                  ignoreAboveLen: Number(value ?? 1024),
                },
              }));
            }}
            style={{ width: "100%" }}
            value={indexConfig.keywordConfig.ignoreAboveLen}
          />
        </Form.Item>
      ) : null}

      <div className={styles.sectionHeader}>
        <div className={styles.sectionTitle}>
          {t("knowledgeNetwork.objectTypeIndexFulltext")}
        </div>
        <Switch
          checked={indexConfig.fulltextConfig.enabled}
          onChange={(checked) => {
            setIndexConfig((current) => ({
              ...current,
              fulltextConfig: {
                analyzer: checked ? "standard" : "",
                enabled: checked,
              },
            }));
          }}
          size="small"
        />
      </div>
      {indexConfig.fulltextConfig.enabled ? (
        <Form.Item
          className={styles.settingItem}
          label={
            <span className={styles.settingItemTitle}>
              <span className={styles.requiredMark}>*</span>
              {t("knowledgeNetwork.objectTypeIndexTokenizer")}
            </span>
          }
          required
        >
          <Select
            onChange={(value) => {
              setIndexConfig((current) => ({
                ...current,
                fulltextConfig: {
                  ...current.fulltextConfig,
                  analyzer: value,
                },
              }));
            }}
            options={tokenizerOptions}
            placeholder={t("knowledgeNetwork.pleaseSelect")}
            value={indexConfig.fulltextConfig.analyzer || undefined}
          />
        </Form.Item>
      ) : null}

      <div className={styles.sectionHeader}>
        <div className={styles.sectionTitle}>
          {t("knowledgeNetwork.objectTypeIndexVector")}
        </div>
        <Switch
          checked={indexConfig.vectorConfig.enabled}
          onChange={(checked) => {
            setIndexConfig((current) => ({
              ...current,
              vectorConfig: {
                enabled: checked,
                modelId: checked
                  ? current.vectorConfig.modelId || smallModels[0]?.value || ""
                  : "",
              },
            }));
          }}
          size="small"
        />
      </div>
      {indexConfig.vectorConfig.enabled ? (
        <Form.Item
          className={styles.settingItem}
          label={
            <span className={styles.settingItemTitle}>
              <span className={styles.requiredMark}>*</span>
              {t("knowledgeNetwork.objectTypeIndexSmallModel")}
            </span>
          }
          required
        >
          <Select
            onChange={(value) => {
              setIndexConfig((current) => ({
                ...current,
                vectorConfig: {
                  ...current.vectorConfig,
                  modelId: value,
                },
              }));
            }}
            options={smallModels.map((item) => ({
              label: item.label,
              value: item.value,
            }))}
            placeholder={t("knowledgeNetwork.pleaseSelect")}
            value={indexConfig.vectorConfig.modelId || undefined}
          />
          {selectedModel ? (
            <div className={styles.modelInfo}>
              <div className={styles.modelInfoRow}>
                <span>{t("knowledgeNetwork.objectTypeIndexVectorDimension")}</span>
                <span>{selectedModel.embeddingDim}</span>
              </div>
              <div className={styles.modelInfoRow}>
                <span>{t("knowledgeNetwork.objectTypeIndexBatchSize")}</span>
                <span>{selectedModel.batchSize}</span>
              </div>
              <div className={styles.modelInfoRow}>
                <span>{t("knowledgeNetwork.objectTypeIndexMaxTokens")}</span>
                <span>{selectedModel.maxTokens}</span>
              </div>
            </div>
          ) : null}
        </Form.Item>
      ) : null}
    </Modal>
  );
}
