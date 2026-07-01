/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Alert, Input, Modal, Typography } from "antd";
import { type ReactNode, useCallback, useState } from "react";
import { useTranslation } from "react-i18next";

type DangerDeleteConfig = {
  /** 危险确认正文(影响面),由调用方按资源/连接组装。 */
  impact?: ReactNode;
  /** onOk 抛错时弹窗保持打开(调用方负责弹错误 toast)。 */
  onOk: () => Promise<void>;
  /** 高危(有索引)时要求输入对象名二次确认。 */
  requireTypeName?: boolean;
  targetName: string;
  title: string;
};

/**
 * 知情危险删除弹窗。返回 { open, node }:调用方渲染 node,
 * 在删除前先算影响面再 open。高危时 OK 按钮须输入对象名才解锁。
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
      // 调用方已弹错误 toast;弹窗保持打开,允许重试或取消。
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
            {t("dataCatalog.dangerDelete.typeNameToConfirm", {
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

/** 影响面提示:高危(有索引)橙色警告 + 不可恢复;空对象给普通说明。 */
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
