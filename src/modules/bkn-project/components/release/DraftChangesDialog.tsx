/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Modal } from "antd";
import { useTranslation } from "react-i18next";

import styles from "./Release.module.css";

const PREFIX = "bknProject.release.draftChanges";

/**
 * Someone edited the network in the workspace and did not publish: writing the project's content
 * replaces those edits. The owner brings them into the project first, or overwrites them.
 */
export function DraftChangesDialog({
  busy,
  onCancel,
  onCommit,
  onOverwrite,
}: {
  busy: boolean;
  onCancel: () => void;
  /** Brings the edits into the project; absent where only overwriting makes sense. */
  onCommit?: () => void;
  onOverwrite: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Modal
      cancelText={t("common.cancel")}
      destroyOnHidden
      footer={(_, { CancelBtn }) => <CancelBtn />}
      onCancel={onCancel}
      open
      title={t(`${PREFIX}.title`)}
      width={560}
    >
      <div className={styles.stack}>
        <p className={styles.muted}>{t(`${PREFIX}.description`)}</p>
        {onCommit ? (
          <button className={styles.choice} disabled={busy} onClick={onCommit} type="button">
            <span className={styles.choiceTitle}>{t(`${PREFIX}.commit`)}</span>
            <span className={styles.questionMeta}>{t(`${PREFIX}.commitHint`)}</span>
          </button>
        ) : null}
        <button className={styles.choice} disabled={busy} onClick={onOverwrite} type="button">
          <span className={styles.choiceTitle}>{t(`${PREFIX}.overwrite`)}</span>
          <span className={styles.questionMeta}>{t(`${PREFIX}.overwriteHint`)}</span>
        </button>
      </div>
    </Modal>
  );
}
