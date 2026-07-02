/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { RouteObject } from "react-router-dom";

import type { AppRouteContribution } from "@/app/router/types";
import { CatalogLabPage } from "@/modules/execution-factory-lab/pages/CatalogLabPage";
import { CapabilityLabPage } from "@/modules/execution-factory-lab/pages/CapabilityLabPage";
import { SandboxRuntimePage } from "@/modules/execution-factory-lab/pages/SandboxRuntimePage";

export const executionFactoryLabRoutes: RouteObject[] = [
  {
    path: "execution-factory-lab/capabilities",
    handle: {
      console: {
        descriptionKey: "executionFactoryLab.capabilitiesDescription",
        menuKey: "execution-factory-lab-capabilities",
        titleKey: "executionFactoryLab.capabilitiesTitle",
      },
    },
    element: <CapabilityLabPage />,
  },
  {
    path: "execution-factory-lab/catalog",
    handle: {
      console: {
        descriptionKey: "executionFactoryLab.catalogDescription",
        menuKey: "execution-factory-lab-catalog",
        titleKey: "executionFactoryLab.catalogTitle",
      },
    },
    element: <CatalogLabPage />,
  },
  {
    path: "execution-factory-lab/sandbox-runtime",
    handle: {
      console: {
        descriptionKey: "executionFactoryLab.sandboxRuntimeDescription",
        menuKey: "execution-factory-lab-sandbox-runtime",
        titleKey: "executionFactoryLab.sandboxRuntimeTitle",
      },
    },
    element: <SandboxRuntimePage />,
  },
];

export const executionFactoryLabRouteContribution: AppRouteContribution = {
  moduleId: "execution-factory-lab",
  routes: executionFactoryLabRoutes,
};
