/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Modal } from "antd";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { CreateOperatorTypeStep, type CreateOperatorMode } from "./CreateOperatorTypeStep";

type CreateOperatorModalProps = {
  open: boolean;
  onClose: () => void;
};

export function CreateOperatorModal({ open, onClose }: CreateOperatorModalProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [mode, setMode] = useState<CreateOperatorMode | undefined>();

  const handleConfirm = () => {
    if (!mode) {
      return;
    }

    void navigate(`/execution-factory/units/new?metadataType=${mode}`);
    onClose();
  };

  return (
    <Modal
      destroyOnClose
      okButtonProps={{ disabled: !mode }}
      okText={t("common.save")}
      onCancel={onClose}
      onOk={handleConfirm}
      open={open}
      title={t("executionFactory.createOperatorModalTitle")}
      width={720}
    >
      <CreateOperatorTypeStep mode={mode} onModeChange={setMode} />
    </Modal>
  );
}
