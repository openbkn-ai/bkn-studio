/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Checkbox, Input, Modal } from "antd";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import { publishErrorText } from "@/modules/bkn-project/components/release/releaseMessages";
import { projectErrorCode } from "@/modules/bkn-project/services/publish.service";
import { publishRelease } from "@/modules/bkn-project/services/release.service";

import styles from "./Release.module.css";

const PREFIX = "bknProject.release.publishDialog";

/**
 * Publishes the prepared release as the network's running version. The owner confirms bringing
 * back what a rollback took out, and publishing though scenario questions were not answered.
 */
export function ReleasePublishDialog({
  baseName,
  failedQuestions,
  onCancel,
  onNothingToPublish,
  onPublished,
  outdated,
  outdatedName,
  projectId,
  purgedName,
  regressionText,
  runningName,
  version,
}: {
  /** The version the release builds on; empty before the first. */
  baseName: string;
  /** How many scenario questions the regression did not answer right; 0 for none. */
  failedQuestions: number;
  onCancel: () => void;
  /** The network is the same as its running version: nothing is published. */
  onNothingToPublish: () => void;
  onPublished: () => void;
  /** The running version was switched back past what the release builds on. */
  outdated: boolean;
  /** The version a rollback switched away from, which publishing brings back. */
  outdatedName: string;
  projectId: string;
  /** The version the community edition keeps only the record of once this is published. */
  purgedName: string;
  regressionText: string;
  runningName: string;
  version: string;
}) {
  const { t } = useTranslation();
  const { message } = useAppServices();
  // The network may say it was rolled back after the page read it.
  const [askOutdated, setAskOutdated] = useState(outdated);
  const [bringBack, setBringBack] = useState(false);
  const [acceptFailed, setAcceptFailed] = useState(false);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = (!askOutdated || bringBack) && (!failedQuestions || acceptFailed);

  const publish = async () => {
    setBusy(true);
    setError(null);
    try {
      await publishRelease(projectId, {
        allowOutdatedBase: askOutdated && bringBack,
        notes: notes.trim(),
        version,
      });
      message.success(t(`${PREFIX}.done`, { version }));
      onPublished();
    } catch (failure) {
      const code = projectErrorCode(failure);
      if (code === "Release.DraftOutdated") {
        setAskOutdated(true);
        setError(t(`${PREFIX}.outdatedNow`));
      } else if (code === "Release.NothingToPublish") {
        onNothingToPublish();
      } else {
        setError(publishErrorText(t, code));
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
      okButtonProps={{ disabled: !ready }}
      okText={t(`${PREFIX}.confirm`)}
      onCancel={onCancel}
      onOk={() => void publish()}
      open
      title={t(`${PREFIX}.title`, { version })}
      width={560}
    >
      <div className={styles.stack}>
        <dl className={styles.keyValues}>
          {baseName ? (
            <>
              <dt>{t(`${PREFIX}.base`)}</dt>
              <dd>{baseName}</dd>
            </>
          ) : null}
          <dt>{t(`${PREFIX}.regression`)}</dt>
          <dd>{regressionText}</dd>
        </dl>
        {askOutdated ? (
          <>
            <Alert
              message={t(`${PREFIX}.outdated`, { running: runningName, version: outdatedName })}
              showIcon
              type="warning"
            />
            <Checkbox checked={bringBack} onChange={(event) => setBringBack(event.target.checked)}>
              {t(`${PREFIX}.bringBack`)}
            </Checkbox>
          </>
        ) : null}
        {failedQuestions ? (
          <Checkbox
            checked={acceptFailed}
            onChange={(event) => setAcceptFailed(event.target.checked)}
          >
            {t(`${PREFIX}.acceptFailed`, { count: failedQuestions })}
          </Checkbox>
        ) : null}
        {purgedName ? (
          <Alert message={t(`${PREFIX}.community`, { version: purgedName })} showIcon type="info" />
        ) : null}
        <div className={styles.stack}>
          <label className={styles.label} htmlFor="release-notes">
            {t(`${PREFIX}.notes`)}
          </label>
          <Input.TextArea
            autoSize={{ maxRows: 6, minRows: 3 }}
            id="release-notes"
            maxLength={2000}
            onChange={(event) => setNotes(event.target.value)}
            placeholder={t(`${PREFIX}.notesPlaceholder`)}
            value={notes}
          />
        </div>
        {error ? (
          <Alert closable message={error} onClose={() => setError(null)} showIcon type="error" />
        ) : null}
      </div>
    </Modal>
  );
}
