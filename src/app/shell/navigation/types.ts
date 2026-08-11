/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { ReactNode } from "react";

import type { PermissionCheckMode } from "@/framework/permission/has-permissions";

export type ConsoleNavItem = {
  children?: ConsoleNavItem[];
  disabled?: boolean;
  icon?: ReactNode;
  key: string;
  labelKey: string;
  path?: string;
  /** Permissions required to render this item (any/all is determined by permissionMode). Omit for universal visibility. */
  permission?: string | string[];
  permissionMode?: PermissionCheckMode;
};

export type ConsoleNavContribution = {
  items: ConsoleNavItem[];
  parentKey?: string;
};
