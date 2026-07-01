/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Modal } from "antd";
import { useTranslation } from "react-i18next";

import { AppButton } from "@/framework/ui/common/AppButton";
import { CreateSkillForm } from "./CreateSkillForm";

type CreateSkillModalProps = {
  open: boolean;
  onClose: () => void;
  onImported: (skillId: string) => void;
};

export function CreateSkillModal({ open, onClose, onImported }: CreateSkillModalProps) {
  const { t } = useTranslation();

  return (
    <Modal
      destroyOnClose
      footer={
        <AppButton form="create-skill-modal-form" htmlType="submit" type="primary">
          {t("common.confirm")}
        </AppButton>
      }
      onCancel={onClose}
      open={open}
      title={t("executionFactory.importSkillTitle")}
      width={560}
    >
      <CreateSkillForm
        formId="create-skill-modal-form"
        onImported={(skillId) => {
          onClose();
          onImported(skillId);
        }}
      />
    </Modal>
  );
}
