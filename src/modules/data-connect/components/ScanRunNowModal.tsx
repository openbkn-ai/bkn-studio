/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Modal, Radio, Space } from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import type { DataConnectScanStrategy } from "@/modules/data-connect/types/scan";

import styles from "./ScanRunNowModal.module.css";

type ScanRunNowModalProps = {
  connectionName: string;
  onCancel: () => void;
  onSubmit: (strategy: DataConnectScanStrategy) => Promise<void>;
  open: boolean;
  submitting?: boolean;
};

const STRATEGY_OPTIONS: DataConnectScanStrategy[] = [
  "full_sync",
  "create_only",
  "cleanup_only",
];

export function ScanRunNowModal({
  connectionName,
  onCancel,
  onSubmit,
  open,
  submitting = false,
}: ScanRunNowModalProps) {
  const { t } = useTranslation();
  const [strategy, setStrategy] = useState<DataConnectScanStrategy>("create_only");

  useEffect(() => {
    if (open) {
      setStrategy("create_only");
    }
  }, [open]);

  return (
    <Modal
      cancelText={t("common.cancel")}
      className={styles.modal}
      confirmLoading={submitting}
      destroyOnHidden
      maskClosable={!submitting}
      okText={t("dataConnect.scanRunNow")}
      onCancel={submitting ? undefined : onCancel}
      onOk={() => {
        void onSubmit(strategy);
      }}
      open={open}
      rootClassName={styles.modalRoot}
      title={t("dataConnect.scanRunNowConfirmTitle")}
      width={520}
    >
      <p className={styles.summary}>
        {t("dataConnect.scanRunNowConfirmDescription", { name: connectionName })}
      </p>
      <div className={styles.fieldLabel}>{t("dataConnect.scanStrategy")}</div>
      <Radio.Group
        className={styles.strategyGroup}
        onChange={(event) => {
          setStrategy(event.target.value as DataConnectScanStrategy);
        }}
        value={strategy}
      >
        <Space direction="vertical" size={10}>
          {STRATEGY_OPTIONS.map((option) => (
            <Radio className={styles.strategyOption} key={option} value={option}>
              <span className={styles.strategyTitle}>
                {t(`dataConnect.scanStrategies.${option}`)}
              </span>
              <span className={styles.strategyHint}>
                {t(`dataConnect.scanStrategyHints.${option}`)}
              </span>
            </Radio>
          ))}
        </Space>
      </Radio.Group>
    </Modal>
  );
}
