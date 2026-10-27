/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Form, Modal, Select } from "antd";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { setProjectCatalogs } from "@/modules/bkn-project/services/project.service";
import type { Project } from "@/modules/bkn-project/types/project";

import styles from "./ProjectModel.module.css";

/**
 * Replaces the data catalogs a project drafts from. It starts from the project's catalogs the
 * caller can still see; the ones that are gone are named, since saving removes them.
 */
export function ProjectCatalogsModal({
  catalogs,
  onCancel,
  onSaved,
  project,
}: {
  /** Catalogs the caller can see, by id. */
  catalogs: Map<string, string>;
  onCancel: () => void;
  onSaved: (project: Project) => void;
  project: Project;
}) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState(() =>
    project.catalogIds.filter((id) => catalogs.has(id)),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const gone = project.catalogIds.filter((id) => !catalogs.has(id));
  const unchanged =
    selected.length === project.catalogIds.length &&
    selected.every((id) => project.catalogIds.includes(id));

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      onSaved(await setProjectCatalogs(project.id, selected));
    } catch (cause) {
      setError(extractRequestErrorMessage(cause));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      cancelText={t("common.cancel")}
      confirmLoading={saving}
      destroyOnHidden
      okButtonProps={{ disabled: unchanged }}
      okText={t("common.save")}
      onCancel={onCancel}
      onOk={() => void save()}
      open
      title={t("bknProject.model.catalogs.title")}
    >
      <Form layout="vertical">
        <Form.Item
          extra={t("bknProject.model.catalogs.hint")}
          htmlFor="project-catalogs"
          label={t("bknProject.model.catalogs.label")}
        >
          <Select
            id="project-catalogs"
            mode="multiple"
            onChange={setSelected}
            optionFilterProp="label"
            options={[...catalogs].map(([id, name]) => ({ label: name, value: id }))}
            placeholder={t("bknProject.create.catalogsPlaceholder")}
            value={selected}
          />
        </Form.Item>
      </Form>
      {gone.length ? (
        <p className={styles.muted}>
          {t("bknProject.model.catalogs.removed", { names: gone.join(", ") })}
        </p>
      ) : null}
      {error ? <Alert description={error} showIcon type="error" /> : null}
    </Modal>
  );
}
