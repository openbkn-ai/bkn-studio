/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { RouteObject } from "react-router-dom";

export type AppRouteContribution = {
  defaultEntryPath?: string;
  moduleId: string;
  routes: RouteObject[];
  standaloneRoutes?: RouteObject[];
};
