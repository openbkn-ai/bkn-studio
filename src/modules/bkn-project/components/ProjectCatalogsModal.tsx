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
import { draftErrorCode } from "@/modules/bkn-project/components/draft/edit";
import { addDraftCatalogs } from "@/modules/bkn-project/services/draft.service";
import { getProject, setProjectCatalogs } from "@/modules/bkn-project/services/project.service";
import type { Draft } from "@/modules/bkn-project/types/draft";
import type { Project } from "@/modules/bkn-project/types/project";

import styles from "./ProjectModel.module.css";

/**
 * Replaces the data catalogs a project drafts from, or adds some to them. Replacing starts from
 * the project's catalogs the caller can still see and names the ones that are gone, since saving
 * removes them; adding offers the catalogs the project does not have yet.
 */
export function ProjectCatalogsModal({
  catalogs,
  mode = "replace",
  onCancel,
  onSaved,
  project,
}: {
  /** Catalogs the caller can see, by id. */
  catalogs: Map<string, string>;
  mode?: "add" | "replace";
  onCancel: () => void;
  /** With the draft adding replied, when catalogs were added. */
  onSaved: (project: Project, draft?: Draft) => void;
  project: Project;
}) {
  const { t } = useTranslation();
  const adding = mode === "add";
  const [selected, setSelected] = useState(() =>
    adding ? [] : project.catalogIds.filter((id) => catalogs.has(id)),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const gone = adding ? [] : project.catalogIds.filter((id) => !catalogs.has(id));
  const unchanged = adding
    ? selected.length === 0
    : selected.length === project.catalogIds.length &&
      selected.every((id) => project.catalogIds.includes(id));
  const options = [...catalogs]
    .filter(([id]) => !adding || !project.catalogIds.includes(id))
    .map(([id, name]) => ({ label: name, value: id }));

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      if (adding) {
        const draft = await addDraftCatalogs(project.id, selected);
        onSaved(await getProject(project.id), draft);
      } else {
        onSaved(await setProjectCatalogs(project.id, selected));
      }
    } catch (cause) {
      // Adding is refused while catalogs are being added, or on a draft changed since it was read.
      const code = adding ? draftErrorCode(cause) : undefined;
      setError(
        code === "Drafting" || code === "Stale"
          ? t(`bknProject.model.catalogs.addRefused.${code}`)
          : extractRequestErrorMessage(cause),
      );
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
      title={t(adding ? "bknProject.model.catalogs.addTitle" : "bknProject.model.catalogs.title")}
    >
      <Form layout="vertical">
        <Form.Item
          extra={t(adding ? "bknProject.model.catalogs.addHint" : "bknProject.model.catalogs.hint")}
          htmlFor="project-catalogs"
          label={t("bknProject.model.catalogs.label")}
        >
          <Select
            id="project-catalogs"
            mode="multiple"
            onChange={setSelected}
            optionFilterProp="label"
            options={options}
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
