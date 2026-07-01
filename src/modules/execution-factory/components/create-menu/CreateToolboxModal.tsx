/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Modal } from "antd";
import { useTranslation } from "react-i18next";

import { AppButton } from "@/framework/ui/common/AppButton";
import { CreateToolboxForm } from "./CreateToolboxForm";

type CreateToolboxModalProps = {
  open: boolean;
  onClose: () => void;
  onCreated: (boxId: string) => void;
};

export function CreateToolboxModal({ open, onClose, onCreated }: CreateToolboxModalProps) {
  const { t } = useTranslation();

  return (
    <Modal
      destroyOnClose
      footer={
        <AppButton form="create-toolbox-modal-form" htmlType="submit" type="primary">
          {t("common.confirm")}
        </AppButton>
      }
      onCancel={onClose}
      open={open}
      title={t("executionFactory.createToolboxModalTitle")}
      width={640}
    >
      <CreateToolboxForm
        formId="create-toolbox-modal-form"
        onCreated={(boxId) => {
          onClose();
          onCreated(boxId);
        }}
      />
    </Modal>
  );
}
