/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { CloseCircleFilled, DownOutlined } from "@ant-design/icons";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import type { ActionTypeCatalogSelection } from "@/modules/knowledge-network/services/action-type-tool.service";
import type { ActionTypeActionSource } from "@/modules/knowledge-network/types/knowledge-network";

import { ActionTypeToolSelectModal } from "./ActionTypeToolSelectModal";
import { getActionSourceDisplayName } from "@/modules/knowledge-network/utils/action-type-execution";

import styles from "./ActionTypeSourcePicker.module.css";

type ActionTypeSourcePickerProps = {
  onSourceSelected?: (source: ActionTypeActionSource) => void;
  value?: ActionTypeActionSource;
  onChange?: (value?: ActionTypeActionSource) => void;
};

export function ActionTypeSourcePicker({
  onSourceSelected,
  value,
  onChange,
}: ActionTypeSourcePickerProps) {
  const { t } = useTranslation();
  const [modalOpen, setModalOpen] = useState(false);

  const displayName = useMemo(() => getActionSourceDisplayName(value), [value]);

  const handleConfirm = (source: ActionTypeActionSource, _selection: ActionTypeCatalogSelection) => {
    onChange?.(source);
    onSourceSelected?.(source);
    setModalOpen(false);
  };

  return (
    <>
      <div
        className={styles.selectTrigger}
        onClick={() => setModalOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setModalOpen(true);
          }
        }}
        role="button"
        tabIndex={0}
      >
        {displayName ? (
          <>
            <span className={styles.value} title={displayName}>
              {displayName}
            </span>
            <CloseCircleFilled
              className={styles.closeIcon}
              onClick={(event) => {
                event.stopPropagation();
                onChange?.(undefined);
              }}
            />
          </>
        ) : (
          <>
            <span className={styles.placeholder}>
              {t("knowledgeNetwork.actionTypeOperatorSelectPlaceholder")}
            </span>
            <DownOutlined className={styles.suffixIcon} />
          </>
        )}
      </div>

      <ActionTypeToolSelectModal
        onCancel={() => setModalOpen(false)}
        onConfirm={handleConfirm}
        open={modalOpen}
        value={value}
      />
    </>
  );
}
