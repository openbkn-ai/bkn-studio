/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Modal } from "antd";
import { useTranslation } from "react-i18next";

import type { ExecutionUnitTab } from "@/modules/execution-factory/components/execution-unit/types";

type PublishedPermModalProps = {
  activeTab: ExecutionUnitTab;
  open: boolean;
  resourceName: string;
  onClose: () => void;
  onConfigure: () => void;
};

export function PublishedPermModal({
  activeTab,
  open,
  resourceName,
  onClose,
  onConfigure,
}: PublishedPermModalProps) {
  const { t } = useTranslation();

  return (
    <Modal
      cancelText={t("executionFactory.publishedPermLater")}
      okText={t("executionFactory.publishedPermConfigure")}
      onCancel={onClose}
      onOk={onConfigure}
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
