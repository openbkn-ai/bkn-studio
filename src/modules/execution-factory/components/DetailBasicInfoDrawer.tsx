/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Drawer } from "antd";
import { useTranslation } from "react-i18next";

import type { DetailMetaItem } from "@/modules/execution-factory/components/DetailMetaPanel";
import { DetailMetaPanel } from "@/modules/execution-factory/components/DetailMetaPanel";

type DetailBasicInfoDrawerProps = {
  items: DetailMetaItem[];
  onClose: () => void;
  open: boolean;
  title?: string;
};

/**
 * Unified "basic info" surface for execution-unit detail pages. Renders the
 * shared stacked label/value list (not a bordered table) so long ids/urls stay
 * readable inside the narrow drawer. Opened by a header button on every page.
 */
export function DetailBasicInfoDrawer({
  items,
  onClose,
  open,
  title,
}: DetailBasicInfoDrawerProps) {
  const { t } = useTranslation();

  return (
    <Drawer
      onClose={onClose}
      open={open}
      title={title ?? t("common.basicInfo")}
      width={480}
    >
      <DetailMetaPanel columns={1} dividers items={items} variant="plain" />
    </Drawer>
  );
}
