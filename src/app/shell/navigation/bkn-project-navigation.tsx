/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { ProjectOutlined } from "@ant-design/icons";

import type { ConsoleNavContribution } from "@/app/shell/navigation/types";
import { CAPABILITIES } from "@/framework/entitlement/capabilities";

/**
 * Project management is a Professional capability whose pages ship in the enterprise image. The
 * community build keeps the entry with its edition label; the page behind it is masked with the
 * upgrade card (see bkn-project-license-routes).
 */
export const bknProjectNavigation: ConsoleNavContribution = {
  items: [
    {
      paidCapability: CAPABILITIES.BKN_PROJECT,
      paidEdition: "professional",
      key: "bkn-project",
      labelKey: "shell.items.bknProject",
      icon: <ProjectOutlined />,
      path: "/bkn-project",
    },
  ],
};
