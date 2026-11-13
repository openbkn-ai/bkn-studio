/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Input, Modal } from "antd";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { manageFailureText } from "@/modules/bkn-project/components/manage/manageMessages";
import { deleteProject } from "@/modules/bkn-project/services/project.service";
import type { Project } from "@/modules/bkn-project/types/project";

import styles from "./ProjectManage.module.css";

/**
 * Deletes a project once its name is typed. It says what goes and what stays: the project's own
 * material goes, its unpublished prepared release is withdrawn, and the knowledge network and its
 * published versions stay.
 */
export function ProjectDeleteModal({
  onCancel,
  onDeleted,
  project,
}: {
  onCancel: () => void;
  onDeleted: (project: Project) => void;
  /** The project to delete; the dialog is open while it is set. */
  project: Project | null;
}) {
  const { t } = useTranslation();
  const [typed, setTyped] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const matches = Boolean(project) && typed.trim() === project?.name.trim();

  const close = () => {
    if (deleting) {
      return;
    }
    setTyped("");
    setFailure(null);
    onCancel();
  };

  const confirm = async () => {
    // Enter in the name field must not send a second request while one is under way.
    if (!project || !matches || deleting) {
      return;
    }
    setDeleting(true);
    setFailure(null);
    try {
      await deleteProject(project.id);
      setTyped("");
      onDeleted(project);
    } catch (error) {
      setFailure(manageFailureText(t, error, "bknProject.manage.delete.failed"));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Modal
      cancelButtonProps={{ disabled: deleting }}
      cancelText={t("common.cancel")}
      closable={!deleting}
      confirmLoading={deleting}
      destroyOnHidden
      maskClosable={!deleting}
      okButtonProps={{ danger: true, disabled: !matches }}
      okText={t("common.delete")}
      onCancel={close}
      onOk={() => void confirm()}
      open={Boolean(project)}
      title={t("bknProject.manage.delete.title", { name: project?.name ?? "" })}
    >
      <div className={styles.stack}>
        <Alert
          description={
            <ul className={styles.list}>
              <li>{t("bknProject.manage.delete.removes")}</li>
              <li>{t("bknProject.manage.delete.withdraws")}</li>
              <li>{t("bknProject.manage.delete.keeps")}</li>
            </ul>
          }
          message={t("bknProject.manage.delete.warning")}
          showIcon
          type="warning"
        />
        <label className={styles.field}>
          <span>{t("bknProject.manage.delete.typeName", { name: project?.name ?? "" })}</span>
          <Input
            aria-label={t("bknProject.manage.delete.typeNameLabel")}
            onChange={(event) => setTyped(event.target.value)}
            onPressEnter={() => void confirm()}
            placeholder={project?.name}
            value={typed}
          />
        </label>
        {failure ? <Alert message={failure} showIcon type="error" /> : null}
      </div>
    </Modal>
  );
}
