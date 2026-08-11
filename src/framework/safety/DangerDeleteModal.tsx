/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/* eslint-disable react-refresh/only-export-components */

import { Alert, Input, Modal, Typography } from "antd";
import { type ReactNode, useCallback, useState } from "react";
import { useTranslation } from "react-i18next";

type DangerDeleteConfig = {
  /** Risk-confirmation body describing impact, assembled by the caller for the resource or connection. */
  impact?: ReactNode;
  /** Keep the modal open when onOk throws; the caller is responsible for showing an error toast. */
  onOk: () => Promise<void>;
  /** Require a second confirmation by object name for high-risk deletions with indexes. */
  requireTypeName?: boolean;
  targetName: string;
  title: string;
};

/**
 * Informed high-risk deletion modal. Returns { open, node }; callers render node, calculate the
 * impact before opening it, and require an object name before enabling OK for high-risk cases.
 */
export function useDangerDelete() {
  const { t } = useTranslation();
  const [config, setConfig] = useState<DangerDeleteConfig | null>(null);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);

  const open = useCallback((next: DangerDeleteConfig) => {
    setTyped("");
    setBusy(false);
    setConfig(next);
  }, []);

  const close = useCallback(() => {
    setConfig(null);
    setBusy(false);
    setTyped("");
  }, []);

  const canConfirm =
    !config?.requireTypeName || typed.trim() === config.targetName.trim();

  const handleOk = useCallback(async () => {
    if (!config || !canConfirm) {
      return;
    }
    setBusy(true);
    try {
      await config.onOk();
      close();
    } catch {
      // The caller has shown an error toast; keep the modal open so the user can retry or cancel.
      setBusy(false);
    }
  }, [canConfirm, close, config]);

  const node = (
    <Modal
      cancelButtonProps={{ disabled: busy }}
      cancelText={t("common.cancel")}
      destroyOnClose
      maskClosable={!busy}
      okButtonProps={{ danger: true, disabled: !canConfirm, loading: busy }}
      okText={t("common.delete")}
      onCancel={busy ? undefined : close}
      onOk={() => void handleOk()}
      open={Boolean(config)}
      title={config?.title}
      width={520}
    >
      {config?.impact}
      {config?.requireTypeName ? (
        <div style={{ marginTop: 12 }}>
          <Typography.Paragraph style={{ marginBottom: 8 }}>
            {t("common.dangerDelete.typeNameToConfirm", {
              name: config.targetName,
            })}
          </Typography.Paragraph>
          <Input
            autoFocus
            onChange={(event) => setTyped(event.target.value)}
            onPressEnter={() => {
              if (canConfirm) {
                void handleOk();
              }
            }}
            placeholder={config.targetName}
            value={typed}
          />
        </div>
      ) : null}
    </Modal>
  );

  return { node, open };
}

/** Impact notice: an orange irreversible warning for indexed high-risk cases, otherwise a standard empty-object message. */
export function DeleteImpactAlert({
  detail,
  warning,
}: {
  detail: ReactNode;
  warning?: ReactNode;
}) {
  return (
    <Alert
      description={warning}
      message={detail}
      showIcon
      style={{ marginBottom: 4 }}
      type={warning ? "warning" : "info"}
    />
  );
}
