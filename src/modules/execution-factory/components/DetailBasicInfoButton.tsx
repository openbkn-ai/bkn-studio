/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { ProfileOutlined } from "@ant-design/icons";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { AppButton } from "@/framework/ui/common/AppButton";
import { DetailBasicInfoDrawer } from "@/modules/execution-factory/components/DetailBasicInfoDrawer";
import type { DetailMetaItem } from "@/modules/execution-factory/components/DetailMetaPanel";

type DetailBasicInfoButtonProps = {
  items: DetailMetaItem[];
  title?: string;
};

/**
 * Header entry for a detail page's basic info: an icon button that owns its own
 * open state and the shared drawer. Detail scenes render one of these instead of
 * repeating the button + state + drawer trio.
 */
export function DetailBasicInfoButton({ items, title }: DetailBasicInfoButtonProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <>
      <AppButton
        icon={<ProfileOutlined />}
        onClick={() => setOpen(true)}
        title={t("common.basicInfo")}
      />
      <DetailBasicInfoDrawer
        items={items}
        onClose={() => setOpen(false)}
        open={open}
        title={title}
      />
    </>
  );
}
