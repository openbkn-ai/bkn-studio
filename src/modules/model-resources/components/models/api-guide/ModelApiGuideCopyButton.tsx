/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { CopyOutlined } from "@ant-design/icons";
import { useTranslation } from "react-i18next";

import { writeTextToClipboard } from "@/framework/compat/clipboard";
import { useAppServices } from "@/framework/context/use-app-services";
import { AppButton } from "@/framework/ui/common/AppButton";

type ModelApiGuideCopyButtonProps = {
  className?: string;
  text: string;
};

export function ModelApiGuideCopyButton({ className, text }: ModelApiGuideCopyButtonProps) {
  const { t } = useTranslation();
  const { message } = useAppServices();

  const handleCopy = async () => {
    try {
      await writeTextToClipboard(text);
      message.success(t("modelResources.models.apiGuide.copySuccess"));
    } catch {
      message.error(t("modelResources.models.apiGuide.copyFailed"));
    }
  };

  return (
    <AppButton
      aria-label={t("modelResources.models.apiGuide.copy")}
      className={className}
      icon={<CopyOutlined />}
      onClick={() => void handleCopy()}
      size="small"
      type="text"
    />
  );
}
