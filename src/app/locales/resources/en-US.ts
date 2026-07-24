/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { appEnUS } from "@/app/locales/resources/app/en-US";
import { authEnUS } from "@/app/locales/resources/auth/en-US";
import { commonEnUS } from "@/app/locales/resources/common/en-US";
import { shellEnUS } from "@/app/locales/resources/shell/en-US";
import { accountEnUS } from "@/modules/account/locales/en-US";
import { apiKeysEnUS } from "@/modules/api-keys/locales/en-US";
import { bknTraceEnUS } from "@/modules/bkn-trace/locales/en-US";
import { dataCatalogEnUS } from "@/modules/data-catalog/locales/en-US";
import { dataConnectEnUS } from "@/modules/data-connect/locales/en-US";
import { executionFactoryLabEnUS } from "@/modules/execution-factory-lab/locales/en-US";
import { executionFactoryEnUS } from "@/modules/execution-factory/locales/en-US";
import { knowledgeNetworkEnUS } from "@/modules/knowledge-network/locales/en-US";
import { modelResourcesEnUS } from "@/modules/model-resources/locales/en-US";
import { systemAdminEnUS } from "@/modules/system-admin/locales/en-US";

export const enUS = {
  ...commonEnUS,
  ...appEnUS,
  ...authEnUS,
  ...shellEnUS,
  ...dataConnectEnUS,
  ...dataCatalogEnUS,
  ...knowledgeNetworkEnUS,
  ...executionFactoryEnUS,
  ...modelResourcesEnUS,
  ...executionFactoryLabEnUS,
  ...systemAdminEnUS,
  ...apiKeysEnUS,
  ...bknTraceEnUS,
  ...accountEnUS,
} as const;
