/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Form, Input, Modal, Radio, Select } from "antd";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { createProject } from "@/modules/bkn-project/services/project.service";
import type { Project, ProjectCatalog, ProjectNetwork } from "@/modules/bkn-project/types/project";

import styles from "./NewProjectModal.module.css";

/** bkn-project refuses longer project names. */
export const MAX_PROJECT_NAME_LENGTH = 128;

type TargetMode = "existing" | "new";

type FormValues = {
  catalogIds: string[];
  knId?: string;
  mode: TargetMode;
  name: string;
  newKnName?: string;
};

export function NewProjectModal({
  catalogs,
  catalogsError,
  networks,
  networksError,
  onCancel,
  onCreated,
  open,
}: {
  catalogs: ProjectCatalog[];
  catalogsError: string | null;
  networks: ProjectNetwork[];
  networksError: string | null;
  onCancel: () => void;
  onCreated: (project: Project) => void;
  open: boolean;
}) {
  const { t } = useTranslation();
  const [form] = Form.useForm<FormValues>();
  const [submitting, setSubmitting] = useState(false);
  const mode = Form.useWatch("mode", form) ?? "existing";

  const handleClose = () => {
    form.resetFields();
    onCancel();
  };

  const handleSubmit = async () => {
    // Fields that fail validation show their own messages.
    const values = await form.validateFields().catch(() => null);
    if (!values) {
      return;
    }
    setSubmitting(true);
    try {
      const project = await createProject({
        catalogIds: values.catalogIds ?? [],
        name: values.name,
        ...(values.mode === "new" ? { newKnName: values.newKnName } : { knId: values.knId }),
      });
      form.resetFields();
      onCreated(project);
    } catch {
      // The request layer shows bkn-project's localized message; the dialog stays open to retry.
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      confirmLoading={submitting}
      destroyOnHidden
      okText={t("bknProject.create.submit")}
      onCancel={handleClose}
      onOk={() => void handleSubmit()}
      open={open}
      title={t("bknProject.create.title")}
    >
      <Form<FormValues>
        form={form}
        initialValues={{ catalogIds: [], mode: "existing" }}
        layout="vertical"
        preserve={false}
      >
        <Form.Item
          label={t("bknProject.create.name")}
          name="name"
          rules={[
            { required: true, whitespace: true, message: t("bknProject.create.nameRequired") },
            {
              max: MAX_PROJECT_NAME_LENGTH,
              message: t("bknProject.create.nameTooLong", { max: MAX_PROJECT_NAME_LENGTH }),
            },
          ]}
        >
          <Input placeholder={t("bknProject.create.namePlaceholder")} />
        </Form.Item>

        <Form.Item label={t("bknProject.create.target")} name="mode">
          <Radio.Group className={styles.modes}>
            <Radio value="existing">
              <span className={styles.modeTitle}>{t("bknProject.create.existing")}</span>
              <span className={styles.modeDescription}>
                {t("bknProject.create.existingDescription")}
              </span>
            </Radio>
            <Radio value="new">
              <span className={styles.modeTitle}>{t("bknProject.create.newNetwork")}</span>
              <span className={styles.modeDescription}>
                {t("bknProject.create.newNetworkDescription")}
              </span>
            </Radio>
          </Radio.Group>
        </Form.Item>

        {mode === "existing" ? (
          <>
            {networksError ? (
              <Alert
                className={styles.alert}
                description={networksError}
                message={t("bknProject.create.networksLoadFailed")}
                showIcon
                type="error"
              />
            ) : null}
            <Form.Item
              name="knId"
              rules={[{ required: true, message: t("bknProject.create.networkRequired") }]}
            >
              <Select
                optionFilterProp="label"
                options={networks.map((network) => ({ label: network.name, value: network.id }))}
                placeholder={t("bknProject.create.networkPlaceholder")}
                showSearch
              />
            </Form.Item>
          </>
        ) : (
          <Form.Item
            label={t("bknProject.create.newNetworkName")}
            name="newKnName"
            rules={[
              {
                required: true,
                whitespace: true,
                message: t("bknProject.create.newNetworkNameRequired"),
              },
            ]}
          >
            <Input placeholder={t("bknProject.create.newNetworkNamePlaceholder")} />
          </Form.Item>
        )}

        <Form.Item
          extra={t("bknProject.create.catalogsHint")}
          label={t("bknProject.create.catalogs")}
          name="catalogIds"
        >
          <Select
            mode="multiple"
            optionFilterProp="label"
            options={catalogs.map((catalog) => ({ label: catalog.name, value: catalog.id }))}
            placeholder={t("bknProject.create.catalogsPlaceholder")}
          />
        </Form.Item>
        {catalogsError ? (
          <Alert
            className={styles.alert}
            description={catalogsError}
            message={t("bknProject.create.catalogsLoadFailed")}
            showIcon
            type="error"
          />
        ) : null}
      </Form>
    </Modal>
  );
}
