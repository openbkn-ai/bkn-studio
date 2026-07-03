/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Form, Input, Modal, Select, Typography } from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import type {
  KnowledgeNetworkMutationPayload,
  KnowledgeNetworkRecord,
} from "@/modules/knowledge-network/types/knowledge-network";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import {
  getDefaultSmallModel,
  listSmallModels,
} from "@/modules/model-resources";

import styles from "./KnowledgeNetworkFormModal.module.css";
import {
  DEFAULT_RESOURCE_COLOR,
  ResourceColorSelect,
} from "@/modules/knowledge-network/components/shared/ResourceColorSelect";
import {
  ResourceTagsSelect,
  validateKnowledgeNetworkTags,
} from "@/modules/knowledge-network/components/shared/ResourceTagsSelect";

type KnowledgeNetworkFormModalProps = {
  mode: "create" | "edit";
  onCancel: () => void;
  onSubmit: (values: KnowledgeNetworkMutationPayload) => Promise<void>;
  open: boolean;
  record?: KnowledgeNetworkRecord | null;
};

type FormValues = KnowledgeNetworkMutationPayload;

type EmbeddingModelOption = {
  label: string;
  value: string;
};

const IDENTIFIER_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;

export function KnowledgeNetworkFormModal({
  mode,
  onCancel,
  onSubmit,
  open,
  record,
}: KnowledgeNetworkFormModalProps) {
  const { t } = useTranslation();
  const [form] = Form.useForm<FormValues>();
  const [embeddingOptions, setEmbeddingOptions] = useState<EmbeddingModelOption[]>([]);
  const [globalDim, setGlobalDim] = useState<number | null>(null);
  const [embeddingLoading, setEmbeddingLoading] = useState(false);
  const [embeddingError, setEmbeddingError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    form.setFieldsValue({
      color: record?.color ?? DEFAULT_RESOURCE_COLOR,
      description: record?.description ?? "",
      identifier: record?.identifier ?? "",
      name: record?.name ?? "",
      tags: record?.tags ?? [],
      embeddingModel: undefined,
    });
  }, [form, mode, open, record]);

  // Embedding model is locked at creation: only load the picker in create mode.
  useEffect(() => {
    if (!open || mode !== "create") {
      return;
    }

    let cancelled = false;
    setEmbeddingLoading(true);
    setEmbeddingError(null);

    void (async () => {
      try {
        const [defaultModel, list] = await Promise.all([
          getDefaultSmallModel("embedding"),
          listSmallModels({ page: 1, size: 100, modelType: "embedding" }),
        ]);

        if (cancelled) {
          return;
        }

        const dim = defaultModel?.embeddingDim ?? null;
        setGlobalDim(dim);

        // Backend rejects models whose dimension differs from the global concept
        // store, so only offer dimension-matching models when the global dim is known.
        const options = list.items
          .filter((item) => dim == null || item.embeddingDim === dim)
          .map<EmbeddingModelOption>((item) => {
            const dimLabel =
              item.embeddingDim != null
                ? t("knowledgeNetwork.embeddingModelDimSuffix", { dim: item.embeddingDim })
                : t("knowledgeNetwork.embeddingDimUnknown");
            const suffix = item.default
              ? `（${t("modelResources.models.defaultTag")} · ${dimLabel}）`
              : `（${dimLabel}）`;
            return { label: `${item.modelName}${suffix}`, value: item.modelName };
          });

        setEmbeddingOptions(options);
      } catch (error) {
        if (!cancelled) {
          setEmbeddingError(extractRequestErrorMessage(error));
          setEmbeddingOptions([]);
        }
      } finally {
        if (!cancelled) {
          setEmbeddingLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [mode, open, t]);

  const handleCancel = () => {
    form.resetFields();
    onCancel();
  };

  const lockedEmbeddingText = (() => {
    if (!record?.embeddingModelId) {
      return t("knowledgeNetwork.embeddingModelSystemDefault");
    }
    const dimLabel =
      record.embeddingDim != null
        ? t("knowledgeNetwork.embeddingModelDimSuffix", { dim: record.embeddingDim })
        : t("knowledgeNetwork.embeddingDimUnknown");
    return `${record.embeddingModelId} · ${dimLabel}`;
  })();

  return (
    <Modal
      cancelText={t("common.cancel")}
      destroyOnClose
      okText={mode === "create" ? t("common.create") : t("common.save")}
      onCancel={handleCancel}
      onOk={() => {
        void form.validateFields().then(async (values) => {
          await onSubmit(values);
          form.resetFields();
        });
      }}
      open={open}
      rootClassName={styles.businessModal}
      title={
        mode === "create"
          ? t("knowledgeNetwork.createTitle")
          : t("knowledgeNetwork.editTitle")
      }
      width={640}
    >
      <Form<FormValues>
        className={styles.form}
        form={form}
        layout="vertical"
        onFinish={(values) => {
          void onSubmit(values);
        }}
      >
        <Form.Item
          label={t("knowledgeNetwork.name")}
          name="name"
          rules={[
            { required: true, message: t("knowledgeNetwork.nameRequired") },
            { max: 40, message: t("knowledgeNetwork.nameMaxLength", { len: 40 }) },
          ]}
        >
          <Input placeholder={t("knowledgeNetwork.pleaseInput")} />
        </Form.Item>
        <Form.Item
          label={t("knowledgeNetwork.identifier")}
          name="identifier"
          rules={[
            { max: 40, message: t("knowledgeNetwork.identifierMaxLength", { len: 40 }) },
            {
              pattern: IDENTIFIER_PATTERN,
              message: t("knowledgeNetwork.identifierPattern"),
            },
          ]}
        >
          <Input
            disabled={mode === "edit"}
            placeholder={t("knowledgeNetwork.pleaseInput")}
          />
        </Form.Item>
        <Form.Item label={t("knowledgeNetwork.color")} name="color">
          <ResourceColorSelect inModal />
        </Form.Item>
        <Form.Item
          label={t("knowledgeNetwork.tags")}
          name="tags"
          rules={[
            {
              validator: (_rule, value) =>
                validateKnowledgeNetworkTags(t, _rule, value),
            },
          ]}
        >
          <ResourceTagsSelect />
        </Form.Item>
        <Form.Item label={t("knowledgeNetwork.descriptionField")} name="description">
          <Input.TextArea
            maxLength={1000}
            placeholder={t("knowledgeNetwork.pleaseInput")}
            rows={3}
            showCount
          />
        </Form.Item>
        {mode === "create" ? (
          <Form.Item
            extra={
              <Typography.Text type="secondary">
                {globalDim != null
                  ? t("knowledgeNetwork.embeddingModelOnlySameDimHint", { dim: globalDim })
                  : t("knowledgeNetwork.embeddingModelHint")}
              </Typography.Text>
            }
            help={embeddingError ?? undefined}
            label={t("knowledgeNetwork.embeddingModel")}
            name="embeddingModel"
            validateStatus={embeddingError ? "error" : undefined}
          >
            <Select
              allowClear
              loading={embeddingLoading}
              options={embeddingOptions}
              placeholder={t("knowledgeNetwork.embeddingModelPlaceholder")}
              showSearch
            />
          </Form.Item>
        ) : (
          <Form.Item label={t("knowledgeNetwork.embeddingModelLockedLabel")}>
            <Input disabled value={lockedEmbeddingText} />
          </Form.Item>
        )}
      </Form>
    </Modal>
  );
}
