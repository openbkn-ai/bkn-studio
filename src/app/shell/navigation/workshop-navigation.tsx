/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { BuildOutlined } from "@ant-design/icons";

import type { ConsoleNavContribution } from "@/app/shell/navigation/types";
import { CAPABILITIES } from "@/framework/entitlement/capabilities";

/**
 * Workshop builds business apps on knowledge networks. Its pages are in the enterprise image
 * (openbkn-ee studio/ registers /workshop), so extensionPage keeps the entry out of a community
 * build whatever the entitlement snapshot says. Its capability is the one the enterprise build
 * registers those pages under; a licence without it keeps the entry locked as professional.
 *
 * It sits right below project management, by its place in console-navigation's list.
 */
export const workshopNavigation: ConsoleNavContribution = {
  items: [
    {
      capability: CAPABILITIES.WORKSHOP,
      extensionPage: true,
      key: "workshop",
      labelKey: "shell.items.workshop",
      icon: <BuildOutlined />,
      path: "/workshop",
    },
  ],
};
