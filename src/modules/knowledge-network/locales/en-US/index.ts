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
import { capabilityPart } from "./capability";
import { packageImportPart } from "./package-import";
import { declarationsPart } from "./declarations";
import { propertyDeclarationsPart } from "./property-declarations";
import { relationDeclarationsPart } from "./relation-declarations";
import { valueTypesPart } from "./value-types";
import { knowledgeBasePart } from "./knowledge-base";
import { propertyAuthorizationPart } from "./property-authorization";
import { agentChatPart } from "./agent-chat";
import { contextLoaderPanelPart } from "./context-loader-panel";
import { cypherQueryPart } from "./cypher-query";
import { graphOverviewPart } from "./graph-overview";
import { sampleExperiencePart } from "./sample-experience";
import { appDevelopmentPart } from "./app-development";

export const knowledgeNetworkEnUS = {
  knowledgeNetwork: {
    ...networkPart,
    ...conceptgroupPart,
    ...objecttypePart,
    ...relationtypePart,
    ...actiontypePart,
    ...integrationPart,
    ...metricPart,
    ...capabilityPart,
    ...packageImportPart,
    ...declarationsPart,
    ...propertyDeclarationsPart,
    ...relationDeclarationsPart,
    ...valueTypesPart,
    ...knowledgeBasePart,
    ...propertyAuthorizationPart,
    ...agentChatPart,
    ...contextLoaderPanelPart,
    ...cypherQueryPart,
    ...graphOverviewPart,
    ...sampleExperiencePart,
    ...appDevelopmentPart,
  },
} as const;
