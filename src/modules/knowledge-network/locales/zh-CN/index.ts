/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { networkPart } from "./network";
import { conceptgroupPart } from "./concept-group";
import { objecttypePart } from "./object-type";
import { relationtypePart } from "./relation-type";
import { actiontypePart } from "./action-type";
import { integrationPart } from "./integration";
import { metricPart } from "./metric";
import { agentChatPart } from "./agent-chat";
import { contextLoaderPanelPart } from "./context-loader-panel";

export const knowledgeNetworkZhCN = {
  knowledgeNetwork: {
    ...networkPart,
    ...conceptgroupPart,
    ...objecttypePart,
    ...relationtypePart,
    ...actiontypePart,
    ...integrationPart,
    ...metricPart,
    ...agentChatPart,
    ...contextLoaderPanelPart,
  },
} as const;
