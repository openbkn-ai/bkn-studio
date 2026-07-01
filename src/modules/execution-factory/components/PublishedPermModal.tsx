/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Modal } from "antd";
import { useTranslation } from "react-i18next";

import { useAppServices } from "@/framework/context/use-app-services";
import type { ExecutionUnitTab } from "@/modules/execution-factory/components/execution-unit/types";

type PublishedPermModalProps = {
  activeTab: ExecutionUnitTab;
  open: boolean;
  resourceName: string;
  onClose: () => void;
};

export function PublishedPermModal({
  activeTab,
  open,
  resourceName,
  onClose,
}: PublishedPermModalProps) {
  const { t } = useTranslation();
  const { message } = useAppServices();

  return (
    <Modal
      cancelText={t("executionFactory.publishedPermLater")}
      okText={t("executionFactory.publishedPermConfigure")}
      onCancel={onClose}
      onOk={() => {
        void message.info(t("executionFactory.publishedPermConfigureHint"));
        onClose();
      }}
      open={open}
      title={t("executionFactory.publishedPermTitle")}
    >
      <p>
        {t("executionFactory.publishedPermDescription", {
          name: resourceName,
          type: t(`executionFactory.executionUnitTabs.${activeTab}`),
        })}
      </p>
    </Modal>
  );
}
