/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { RouteObject } from "react-router-dom";

import { ProjectListPreview } from "@/app/router/ProjectListPreview";
import { CAPABILITIES } from "@/framework/entitlement/capabilities";
import { RequireEdition } from "@/framework/entitlement/RequireEdition";
import { isExtensionInstalled } from "@/framework/extension/registry";

/**
 * Project management ships in the enterprise image. Without it every project path, the list and
 * a project's own pages alike, shows the preview under the upgrade card: the edition it needs and
 * the way to the licence, or that the licence is there and the enterprise images are not. Resolve
 * after extension registration so the real pages are never shadowed.
 */
export function bknProjectLicenseRoutes(): RouteObject[] {
  return isExtensionInstalled(CAPABILITIES.BKN_PROJECT)
    ? []
    : [
        {
          path: "bkn-project/*",
          handle: { console: { menuKey: "bkn-project", titleKey: "shell.items.bknProject" } },
          element: (
            <RequireEdition capability={CAPABILITIES.BKN_PROJECT} minEdition="professional">
              <ProjectListPreview />
            </RequireEdition>
          ),
        },
      ];
}
