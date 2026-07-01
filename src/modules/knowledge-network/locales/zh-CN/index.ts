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
import { metricPart } from "./metric";
import { taskPart } from "./task";

export const knowledgeNetworkZhCN = {
  knowledgeNetwork: {
    ...networkPart,
    ...conceptgroupPart,
    ...objecttypePart,
    ...relationtypePart,
    ...actiontypePart,
    ...metricPart,
    ...taskPart,
  },
} as const;
