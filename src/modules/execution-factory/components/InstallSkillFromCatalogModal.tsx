/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Modal } from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import {
  installSkillFromMarket,
  syncSkillFromMarket,
} from "@/modules/execution-factory/services/skill.service";
import { resolveCatalogInstallErrorMessage } from "@/modules/execution-factory/utils/impex-error-message";

type InstallSkillFromCatalogModalProps = {
  alreadyInstalled?: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  open: boolean;
  skillId: string;
  skillName: string;
};

export function InstallSkillFromCatalogModal({
  alreadyInstalled = false,
  onClose,
  onSuccess,
  open,
  skillId,
  skillName,
}: InstallSkillFromCatalogModalProps) {
  const { t } = useTranslation();
  const { message } = useAppServices();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<{ title: string; hint?: string } | null>(null);

  useEffect(() => {
    if (!open) {
      setError(null);
    }
  }, [open]);

  const handleInstall = async () => {
    setSubmitting(true);
    setError(null);

    try {
      if (alreadyInstalled) {
        await syncSkillFromMarket(skillId);
      } else {
        await installSkillFromMarket(skillId);
      }

      void message.success(
        t(alreadyInstalled ? "executionFactory.syncSuccess" : "executionFactory.introduceSuccess"),
      );
      onSuccess?.();
      onClose();
    } catch (caughtError) {
      setError(
        resolveCatalogInstallErrorMessage(caughtError, {
          mode: alreadyInstalled ? "upsert" : "create",
          componentType: "toolbox",
          t,
        }),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      confirmLoading={submitting}
      destroyOnClose
      okText={t(
        alreadyInstalled ? "executionFactory.syncConfirm" : "executionFactory.introduceConfirm",
      )}
      onCancel={onClose}
      onOk={() => {
        void handleInstall();
      }}
      open={open}
      title={t(
        alreadyInstalled ? "executionFactory.syncTitle" : "executionFactory.introduceTitle",
      )}
    >
      <p>
        {t(
          alreadyInstalled
            ? "executionFactory.syncDescription"
            : "executionFactory.introduceDescription",
          { name: skillName },
        )}
      </p>
      {alreadyInstalled ? (
        <Alert
          message={t("executionFactory.syncModeHint")}
          showIcon
          style={{ marginBottom: 16 }}
          type="info"
        />
      ) : null}
      {error ? (
        <Alert
          description={error.hint}
          message={error.title}
          showIcon
          style={{ marginTop: 12 }}
          type="error"
        />
      ) : null}
    </Modal>
  );
}
