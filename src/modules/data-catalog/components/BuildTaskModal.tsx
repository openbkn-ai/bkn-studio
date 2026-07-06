/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Modal } from "antd";
import { useTranslation } from "react-i18next";

import { BuildTaskFormPanel } from "@/modules/data-catalog/components/BuildTaskFormPanel";
import type { BuildTask, CatalogResource } from "@/modules/data-catalog/types/data-catalog";

type BuildTaskModalProps = {
  onClose: () => void;
  onCreated: (task: BuildTask) => void;
  open: boolean;
  resource: CatalogResource;
};

export function BuildTaskModal({ onClose, onCreated, open, resource }: BuildTaskModalProps) {
  const { t } = useTranslation();

  return (
    <Modal
      footer={null}
      onCancel={onClose}
      open={open}
      title={t("dataCatalog.build.title")}
      width={880}
    >
      <BuildTaskFormPanel
        active={open}
        onCancel={onClose}
        onSubmitted={(task) => {
          onCreated(task);
          onClose();
        }}
        resource={resource}
      />
    </Modal>
  );
}
