/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { AppButton } from "@/framework/ui/common/AppButton";

/** How many items a notice lists before it folds the rest away. */
export const COLLAPSED_ITEMS = 3;

/**
 * A notice that lists items one per line shows the first few, then offers all of them, and folds
 * them back once open. The list keeps its own markup; this gives what to show and the toggle.
 */
export function useCollapsedList<T>(
  items: readonly T[],
  limit = COLLAPSED_ITEMS,
  /** Opens the list, as when a link leads to an item past the first few. */
  openForced = false,
) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(openForced);
  useEffect(() => {
    if (openForced) {
      setOpen(true);
    }
  }, [openForced]);
  const folds = items.length > limit;
  return {
    toggle: folds ? (
      <AppButton onClick={() => setOpen((current) => !current)} size="small" type="link">
        {open
          ? t("bknProject.collapsedList.collapse")
          : t("bknProject.collapsedList.showAll", { count: items.length })}
      </AppButton>
    ) : null,
    visible: folds && !open ? items.slice(0, limit) : items,
  };
}
