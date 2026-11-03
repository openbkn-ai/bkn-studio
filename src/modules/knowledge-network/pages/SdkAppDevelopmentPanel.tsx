/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { NetworkPickerGuide } from "@/modules/knowledge-network/scenes/NetworkPickerGuide";

/**
 * The SDK tab. SDK examples are generated from a network's own structure on its App development
 * page, so this tab only picks a network and opens that page.
 */
export function SdkAppDevelopmentPanel() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <NetworkPickerGuide
      guideTitle={t("knowledgeNetwork.integration.sdk.guideTitle")}
      guideDescription={t("knowledgeNetwork.integration.sdk.guideDescription")}
      steps={[
        t("knowledgeNetwork.integration.sdk.steps.pick"),
        t("knowledgeNetwork.integration.sdk.steps.start"),
        t("knowledgeNetwork.integration.sdk.steps.examples"),
      ]}
      eyebrow={t("knowledgeNetwork.integration.sdk.eyebrow")}
      title={t("knowledgeNetwork.integration.sdk.title")}
      actionLabel={t("knowledgeNetwork.integration.sdk.open")}
      onOpen={(network) => void navigate(`/knowledge-network/workspace/${network.id}/develop`)}
    />
  );
}
