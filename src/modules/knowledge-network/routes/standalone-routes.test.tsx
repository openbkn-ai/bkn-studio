/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { isValidElement, Suspense, type ReactElement } from "react";
import { describe, expect, it } from "vitest";

import { ObjectTypeAuthorizationPage } from "@/modules/knowledge-network/routes/lazy-pages";
import { KnowledgeNetworkChildModifyRouteGate } from "@/modules/knowledge-network/routes/KnowledgeNetworkChildModifyRouteGate";
import { KnowledgeNetworkModifyRouteGate } from "@/modules/knowledge-network/routes/KnowledgeNetworkModifyRouteGate";
import { knowledgeNetworkStandaloneRoutes } from "@/modules/knowledge-network/routes/standalone-routes";
import {
  getKnowledgeNetworkActionTypeDetail,
  getKnowledgeNetworkConceptGroup,
  getKnowledgeNetworkMetric,
  getKnowledgeNetworkObjectTypeDetail,
  getKnowledgeNetworkRelationTypeDetail,
} from "@/modules/knowledge-network/services/knowledge-network.service";

function routeChild(path: string): ReactElement {
  const route = knowledgeNetworkStandaloneRoutes.find((candidate) => candidate.path === path);

  expect(isValidElement(route?.element)).toBe(true);
  const suspense = route?.element as ReactElement<{ children: ReactElement }>;
  expect(suspense.type).toBe(Suspense);

  return suspense.props.children;
}

describe("knowledge network standalone routes", () => {
  it("keeps object-type base authorization available without the property capability", () => {
    expect(
      routeChild(
        "/knowledge-network/workspace/:networkId/object-types/:objectTypeId/authorization",
      ).type,
    ).toBe(ObjectTypeAuthorizationPage);
  });

  it.each([
    {
      loadResource: getKnowledgeNetworkConceptGroup,
      path: "/knowledge-network/workspace/:networkId/concept-groups/:conceptGroupId/edit",
      resourceIdParam: "conceptGroupId",
    },
    {
      loadResource: getKnowledgeNetworkMetric,
      path: "/knowledge-network/workspace/:networkId/metrics/:metricId/edit",
      resourceIdParam: "metricId",
    },
    {
      loadResource: getKnowledgeNetworkObjectTypeDetail,
      path: "/knowledge-network/workspace/:networkId/object-types/:objectTypeId/edit",
      resourceIdParam: "objectTypeId",
    },
    {
      loadResource: getKnowledgeNetworkRelationTypeDetail,
      path: "/knowledge-network/workspace/:networkId/relation-types/:relationTypeId/edit",
      resourceIdParam: "relationTypeId",
    },
    {
      loadResource: getKnowledgeNetworkRelationTypeDetail,
      path: "/knowledge-network/workspace/:networkId/relation-types/:relationTypeId/mapping",
      resourceIdParam: "relationTypeId",
    },
    {
      loadResource: getKnowledgeNetworkActionTypeDetail,
      path: "/knowledge-network/workspace/:networkId/action-types/:actionTypeId/edit",
      resourceIdParam: "actionTypeId",
    },
  ])("uses the child resource operation gate for $path", ({ loadResource, path, resourceIdParam }) => {
    const gate = routeChild(path) as ReactElement<{
      loadResource: unknown;
      resourceIdParam: string;
    }>;

    expect(gate.type).toBe(KnowledgeNetworkChildModifyRouteGate);
    expect(gate.props.loadResource).toBe(loadResource);
    expect(gate.props.resourceIdParam).toBe(resourceIdParam);
  });

  it.each([
    "/knowledge-network/workspace/:networkId/concept-groups/create",
    "/knowledge-network/workspace/:networkId/metrics/create",
    "/knowledge-network/workspace/:networkId/object-types/create",
    "/knowledge-network/workspace/:networkId/relation-types/create",
    "/knowledge-network/workspace/:networkId/action-types/create",
  ])("keeps the parent knowledge-network operation gate for %s", (path) => {
    expect(routeChild(path).type).toBe(KnowledgeNetworkModifyRouteGate);
  });
});
