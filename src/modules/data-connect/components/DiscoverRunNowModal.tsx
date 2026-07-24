/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Modal, Radio, Space } from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import type { DataConnectDiscoverStrategy } from "@/modules/data-connect/types/discover";

import styles from "./DiscoverRunNowModal.module.css";

type DiscoverRunNowModalProps = {
  connectionName: string;
  onCancel: () => void;
  onSubmit: (strategy: DataConnectDiscoverStrategy) => Promise<void>;
  open: boolean;
  submitting?: boolean;
};

const STRATEGY_OPTIONS: DataConnectDiscoverStrategy[] = [
  "full_sync",
  "create_only",
  "cleanup_only",
];

export function DiscoverRunNowModal({
  connectionName,
  onCancel,
  onSubmit,
  open,
  submitting = false,
}: DiscoverRunNowModalProps) {
  const { t } = useTranslation();
  const [strategy, setStrategy] = useState<DataConnectDiscoverStrategy>("create_only");

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
      okText={t("dataConnect.discoverRunNow")}
      onCancel={submitting ? undefined : onCancel}
      onOk={() => {
        void onSubmit(strategy);
      }}
      open={open}
      rootClassName={styles.modalRoot}
      title={t("dataConnect.discoverRunNowConfirmTitle")}
      width={520}
    >
      <p className={styles.summary}>
        {t("dataConnect.discoverRunNowConfirmDescription", { name: connectionName })}
      </p>
      <div className={styles.fieldLabel}>{t("dataConnect.discoverStrategy")}</div>
      <Radio.Group
        className={styles.strategyGroup}
        onChange={(event) => {
          setStrategy(event.target.value as DataConnectDiscoverStrategy);
        }}
        value={strategy}
      >
        <Space direction="vertical" size={10}>
          {STRATEGY_OPTIONS.map((option) => (
            <Radio className={styles.strategyOption} key={option} value={option}>
              <span className={styles.strategyTitle}>
                {t(`dataConnect.discoverStrategies.${option}`)}
              </span>
              <span className={styles.strategyHint}>
                {t(`dataConnect.discoverStrategyHints.${option}`)}
              </span>
            </Radio>
          ))}
        </Space>
      </Radio.Group>
    </Modal>
  );
}
