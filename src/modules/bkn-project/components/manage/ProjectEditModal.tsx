/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Form, Input, Modal } from "antd";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { MAX_PROJECT_NAME_LENGTH } from "@/modules/bkn-project/components/NewProjectModal";
import { manageFailureText } from "@/modules/bkn-project/components/manage/manageMessages";
import { namingLanguageLabelKey } from "@/modules/bkn-project/components/manage/projectLanguage";
import { renameProject } from "@/modules/bkn-project/services/project.service";
import type { Project } from "@/modules/bkn-project/types/project";

/** Renames a project. Its content language is fixed at creation, so it is only shown. */
export function ProjectEditModal({
  onCancel,
  onSaved,
  project,
}: {
  onCancel: () => void;
  onSaved: (project: Project) => void;
  /** The project being edited; the dialog is open while it is set. */
  project: Project | null;
}) {
  const { t } = useTranslation();
  const [form] = Form.useForm<{ name: string }>();
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const close = () => {
    setFailure(null);
    onCancel();
  };

  const save = async () => {
    const values = await form.validateFields().catch(() => null);
    if (!values || !project) {
      return;
    }
    setSaving(true);
    setFailure(null);
    try {
      onSaved(await renameProject(project.id, values.name));
    } catch (error) {
      setFailure(manageFailureText(t, error, "bknProject.manage.edit.failed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      cancelText={t("common.cancel")}
      confirmLoading={saving}
      destroyOnHidden
      okText={t("common.save")}
      onCancel={close}
      onOk={() => void save()}
      open={Boolean(project)}
      title={t("bknProject.manage.edit.title")}
    >
      <Form
        form={form}
        initialValues={{ name: project?.name ?? "" }}
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
        <Form.Item
          extra={t("bknProject.manage.edit.languageFixed")}
          label={t("bknProject.contentLanguage.label")}
        >
          <span>{project ? t(namingLanguageLabelKey(project.namingLanguage)) : null}</span>
        </Form.Item>
        {failure ? <Alert message={failure} showIcon type="error" /> : null}
      </Form>
    </Modal>
  );
}
