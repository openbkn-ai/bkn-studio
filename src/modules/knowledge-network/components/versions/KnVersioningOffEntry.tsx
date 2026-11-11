/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Button } from "antd";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { ShellTrailPortal } from "@/app/shell/workspace-slots";
import { useAppServices } from "@/framework/context/use-app-services";
import { EnableVersioningModal } from "@/modules/knowledge-network/components/versions/EnableVersioningModal";

type KnVersioningOffEntryProps = {
  networkId: string;
  onEnabled: () => void;
};

/**
 * Where the version picker would be on a network without versioning: a quiet way to turn it on.
 * Edits to such a network take effect at once, as they always did.
 */
export function KnVersioningOffEntry({ networkId, onEnabled }: KnVersioningOffEntryProps) {
  const { t } = useTranslation();
  const { message } = useAppServices();
  const [open, setOpen] = useState(false);

  return (
    <>
      <ShellTrailPortal>
        <Button onClick={() => setOpen(true)} size="small" type="link">
          {t("knowledgeNetwork.versions.enable.action")}
        </Button>
      </ShellTrailPortal>
      <EnableVersioningModal
        networkId={networkId}
        onClose={() => setOpen(false)}
        onEnabled={() => {
          setOpen(false);
          message.success(t("common.success"));
          onEnabled();
        }}
        open={open}
      />
    </>
  );
}
