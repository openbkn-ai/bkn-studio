/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Modal } from "antd";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { DraftChangesDialog } from "@/modules/bkn-project/components/release/DraftChangesDialog";
import { projectErrorCode } from "@/modules/bkn-project/services/publish.service";
import { copyVersion } from "@/modules/bkn-project/services/release.service";

import styles from "./Release.module.css";

const PREFIX = "bknProject.release.copy";

/**
 * Puts a version's content back into the project, to change and publish as a new version. The
 * running version stays.
 */
export function CopyVersionDialog({
  knVersion,
  name,
  onCancel,
  onCopied,
  projectId,
  recordOnly,
}: {
  knVersion: number;
  /** The version as people know it. */
  name: string;
  onCancel: () => void;
  onCopied: () => void;
  projectId: string;
  /** The community edition keeps only the record of it: its content comes from the project. */
  recordOnly: boolean;
}) {
  const { t } = useTranslation();
  const { message } = useAppServices();
  const [busy, setBusy] = useState(false);
  const [draftChanged, setDraftChanged] = useState(false);

  const copy = async (overwrite: boolean) => {
    setBusy(true);
    try {
      await copyVersion(projectId, knVersion, overwrite);
      message.success(t(`${PREFIX}.done`, { version: name }));
      onCopied();
    } catch (error) {
      const code = projectErrorCode(error);
      if (code === "Release.DraftHasChanges") {
        setDraftChanged(true);
      } else {
        setDraftChanged(false);
        message.error(
          t(
            `${PREFIX}.error.${
              code === "Release.VersionPurged"
                ? "VersionPurged"
                : code === "Release.NotOwner"
                  ? "NotOwner"
                  : "other"
            }`,
          ),
        );
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      cancelText={t("common.cancel")}
      confirmLoading={busy}
      destroyOnHidden
      okText={t(`${PREFIX}.confirm`)}
      onCancel={onCancel}
      onOk={() => void copy(false)}
      open
      title={t(`${PREFIX}.title`, { version: name })}
      width={560}
    >
      <div className={styles.stack}>
        <p className={styles.muted}>
          {t(`${PREFIX}.${recordOnly ? "recordOnly" : "kept"}`, { version: name })}
        </p>
        <Alert message={t(`${PREFIX}.replaces`)} showIcon type="warning" />
      </div>
      {draftChanged ? (
        <DraftChangesDialog
          busy={busy}
          onCancel={() => setDraftChanged(false)}
          onOverwrite={() => void copy(true)}
        />
      ) : null}
    </Modal>
  );
}
