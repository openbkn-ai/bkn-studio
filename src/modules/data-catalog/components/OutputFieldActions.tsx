/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { ArrowDownOutlined, ArrowUpOutlined } from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import { AppButton } from "@/framework/ui/common/AppButton";

type OutputFieldActionsProps = {
  canMoveUp: boolean;
  canMoveDown: boolean;
  disabled?: boolean;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
};

export function OutputFieldActions({
  canMoveUp,
  canMoveDown,
  disabled,
  onMove,
  onRemove,
}: OutputFieldActionsProps) {
  const { t } = useTranslation();

  return (
    <>
      <AppButton
        aria-label={t("dataCatalog.viewEditor.moveUp")}
        disabled={disabled || !canMoveUp}
        icon={<ArrowUpOutlined aria-hidden="true" />}
        onClick={() => onMove(-1)}
      />
      <AppButton
        aria-label={t("dataCatalog.viewEditor.moveDown")}
        disabled={disabled || !canMoveDown}
        icon={<ArrowDownOutlined aria-hidden="true" />}
        onClick={() => onMove(1)}
      />
      <AppButton danger disabled={disabled} onClick={onRemove} type="link">
        {t("dataCatalog.viewEditor.removeField")}
      </AppButton>
    </>
  );
}
