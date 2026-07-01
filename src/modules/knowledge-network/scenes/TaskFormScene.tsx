/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Form, Input } from "antd";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";

import { useAppServices } from "@/framework/context/use-app-services";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { AppButton } from "@/framework/ui/common/AppButton";
import { KnowledgeNetworkResourceConfigShell } from "@/modules/knowledge-network/components/shared/KnowledgeNetworkResourceConfigShell";
import { createKnowledgeNetworkTask } from "@/modules/knowledge-network/services/knowledge-network.service";
import type { KnowledgeNetworkTaskJobType } from "@/modules/knowledge-network/types/knowledge-network";

import styles from "./TaskFormScene.module.css";

type TaskFormValues = {
  jobType: KnowledgeNetworkTaskJobType;
  name: string;
};

const JOB_TYPE_OPTIONS: KnowledgeNetworkTaskJobType[] = ["full", "incremental"];

export function TaskFormScene() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { message } = useAppServices();
  const { networkId = "" } = useParams<{ networkId: string }>();
  const [form] = Form.useForm<TaskFormValues>();
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const jobType = Form.useWatch("jobType", form) ?? "full";

  const listPath = `/knowledge-network/workspace/${networkId}/tasks`;

  const handleSubmit = async () => {
    if (!networkId) {
      return;
    }

    try {
      const values = await form.validateFields();
      setSubmitting(true);
      await createKnowledgeNetworkTask(networkId, values);
      void message.success(t("common.success"));
      void navigate(listPath);
    } catch (error) {
      if (error instanceof Error && error.message) {
        setLoadError(extractRequestErrorMessage(error));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KnowledgeNetworkResourceConfigShell
      actions={
        <AppButton loading={submitting} onClick={() => void handleSubmit()} type="primary">
          {t("common.create")}
        </AppButton>
      }
      onBack={() => {
        void navigate(listPath);
      }}
      subtitle={t("knowledgeNetwork.taskCreateDescription")}
      title={t("knowledgeNetwork.taskCreateTitle")}
    >
      {loadError ? <Alert message={loadError} showIcon type="error" /> : null}
      <div className={styles.formPanel}>
        <Form
          colon={false}
          form={form}
          initialValues={{ jobType: "full", name: "" }}
          labelAlign="left"
          labelCol={{ span: 4 }}
          wrapperCol={{ span: 20 }}
        >
          <Form.Item
            label={t("knowledgeNetwork.taskName")}
            name="name"
            rules={[{ message: t("knowledgeNetwork.taskNameRequired"), required: true }]}
          >
            <Input maxLength={40} placeholder={t("knowledgeNetwork.taskNamePlaceholder")} />
          </Form.Item>

          <Form.Item
            label={t("knowledgeNetwork.taskBuildMethod")}
            name="jobType"
            rules={[{ message: t("knowledgeNetwork.taskJobTypeRequired"), required: true }]}
          >
            <div className={styles.jobTypeGroup}>
              {JOB_TYPE_OPTIONS.map((value) => {
                const selected = jobType === value;
                const title =
                  value === "full"
                    ? t("knowledgeNetwork.taskJobTypeFull")
                    : t("knowledgeNetwork.taskJobTypeIncremental");
                const description =
                  value === "full"
                    ? t("knowledgeNetwork.taskJobTypeFullDescription")
                    : t("knowledgeNetwork.taskJobTypeIncrementalDescription");

                return (
                  <button
                    className={`${styles.jobTypeOption} ${selected ? styles.jobTypeOptionSelected : ""}`}
                    key={value}
                    onClick={() => form.setFieldValue("jobType", value)}
                    type="button"
                  >
                    <div>
                      <div className={styles.jobTypeTitle}>{title}</div>
                      <p className={styles.jobTypeDescription}>{description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </Form.Item>
        </Form>
      </div>
    </KnowledgeNetworkResourceConfigShell>
  );
}
