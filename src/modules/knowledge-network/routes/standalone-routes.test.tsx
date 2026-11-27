/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { isValidElement, Suspense, type ReactElement } from "react";
import { describe, expect, it } from "vitest";

import { WORKSPACE_MOUNT_SECTIONS } from "@/modules/knowledge-network/constants/workspace-mount-sections";
import { ObjectTypeAuthorizationPage } from "@/modules/knowledge-network/routes/lazy-pages";
import { CAPABILITIES } from "@/framework/entitlement/capabilities";
import { RequireEdition } from "@/framework/entitlement/RequireEdition";
import { KnowledgeNetworkChildModifyRouteGate } from "@/modules/knowledge-network/routes/KnowledgeNetworkChildModifyRouteGate";
import { KnowledgeNetworkModifyRouteGate } from "@/modules/knowledge-network/routes/KnowledgeNetworkModifyRouteGate";
import { knowledgeNetworkStandaloneRoutes } from "@/modules/knowledge-network/routes/standalone-routes";
import {
  getKnowledgeNetworkActionTypeDetail,
  getKnowledgeNetworkConceptGroup,
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

function objectMetricsRouteChild(path: string): ReactElement {
  const gate = routeChild(path) as ReactElement<{ capability: string; children: ReactElement }>;

  expect(gate.type).toBe(RequireEdition);
  expect(gate.props).toMatchObject({
    capability: CAPABILITIES.OBJECT_METRICS,
    minEdition: "professional",
    mountLockedContent: false,
  });
  return gate.props.children;
}

function actionModelingRouteChild(path: string): ReactElement {
  const gate = routeChild(path) as ReactElement<{ children: ReactElement }>;

  expect(gate.type).toBe(RequireEdition);
  expect(gate.props).toMatchObject({
    capability: CAPABILITIES.KN_ACTION_MODELING,
    minEdition: "professional",
    mountLockedContent: false,
  });
  return gate.props.children;
}

describe("knowledge network standalone routes", () => {
  it.each(["", "/:actionTypeId/detail", "/:actionTypeId/execution"])(
    "requires Professional for the action type read or execution route %s",
    (suffix) => {
      expect(
        isValidElement(
          actionModelingRouteChild(`/knowledge-network/workspace/:networkId/action-types${suffix}`),
        ),
      ).toBe(true);
    },
  );

  it.each([
    ["event-classes", CAPABILITIES.KN_EVENTS, undefined],
    ["versions", CAPABILITIES.KN_DRAFT_VERSIONS, undefined],
    ["functions", CAPABILITIES.KN_TOOL_MOUNTS, WORKSPACE_MOUNT_SECTIONS.functions],
    ["apis", CAPABILITIES.KN_TOOL_MOUNTS, WORKSPACE_MOUNT_SECTIONS.apis],
    ["mcp", CAPABILITIES.KN_TOOL_MOUNTS, WORKSPACE_MOUNT_SECTIONS.mcp],
    ["skills", CAPABILITIES.KN_TOOL_MOUNTS, WORKSPACE_MOUNT_SECTIONS.skills],
  ])("requires Professional for the %s page", (section, capability, upgradeCopy) => {
    const gate = routeChild(`/knowledge-network/workspace/:networkId/${section}`);
    expect(gate.type).toBe(RequireEdition);
    expect(gate.props).toMatchObject({
      capability,
      minEdition: "professional",
      mountLockedContent: false,
      upgradeCopy,
    });
  });

  it("protects the permission matrix workspace route with the Enterprise gate", () => {
    const gate = routeChild("/knowledge-network/workspace/:networkId/permissions");
    expect(gate.type).toBe(RequireEdition);
    expect(gate.props).toMatchObject({
      capability: CAPABILITIES.PERMISSION_MATRIX,
      minEdition: "enterprise",
      mountLockedContent: false,
    });
  });
  it("keeps unlicensed Eval behind the Professional gate without mounting its API consumers", () => {
    const gate = routeChild("/knowledge-network/workspace/:networkId/evals") as ReactElement<{
      capability: string;
      minEdition: string;
      mountLockedContent: boolean;
    }>;

    expect(gate.type).toBe(RequireEdition);
    expect(gate.props.capability).toBe(CAPABILITIES.EVAL);
    expect(gate.props.minEdition).toBe("professional");
    expect(gate.props.mountLockedContent).toBe(false);
  });

  it("keeps object-type base authorization available without the property capability", () => {
    expect(
      routeChild("/knowledge-network/workspace/:networkId/object-types/:objectTypeId/authorization")
        .type,
    ).toBe(ObjectTypeAuthorizationPage);
  });

  it.each([
    {
      loadResource: getKnowledgeNetworkConceptGroup,
      path: "/knowledge-network/workspace/:networkId/concept-groups/:conceptGroupId/edit",
      resourceIdParam: "conceptGroupId",
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
  ])(
    "uses the child resource operation gate for $path",
    ({ loadResource, path, resourceIdParam }) => {
      const element = path.includes("/action-types/")
        ? actionModelingRouteChild(path)
        : routeChild(path);
      const gate = element as ReactElement<{
        loadResource: unknown;
        resourceIdParam: string;
      }>;

      expect(gate.type).toBe(KnowledgeNetworkChildModifyRouteGate);
      expect(gate.props.loadResource).toBe(loadResource);
      expect(gate.props.resourceIdParam).toBe(resourceIdParam);
    },
  );

  it.each([
    "/knowledge-network/workspace/:networkId/concept-groups/create",
    "/knowledge-network/workspace/:networkId/object-types/create",
    "/knowledge-network/workspace/:networkId/relation-types/create",
    "/knowledge-network/workspace/:networkId/action-types/create",
  ])("keeps the parent knowledge-network operation gate for %s", (path) => {
    const element = path.includes("/action-types/")
      ? actionModelingRouteChild(path)
      : routeChild(path);
    expect(element.type).toBe(KnowledgeNetworkModifyRouteGate);
  });

  it.each([
    "/knowledge-network/workspace/:networkId/metrics",
    "/knowledge-network/workspace/:networkId/metrics/:metricId/detail",
  ])("guards the Object Metrics read route for %s", (path) => {
    expect(isValidElement(objectMetricsRouteChild(path))).toBe(true);
  });

  it.each([
    "/knowledge-network/workspace/:networkId/metrics/create",
    "/knowledge-network/workspace/:networkId/metrics/:metricId/edit",
  ])("guards Object Metrics before the parent modify gate for %s", (path) => {
    expect(objectMetricsRouteChild(path).type).toBe(KnowledgeNetworkModifyRouteGate);
  });
});
