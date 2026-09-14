/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { isValidElement, Suspense, type ReactElement } from "react";
import { describe, expect, it } from "vitest";

import { ObjectTypeAuthorizationPage } from "@/modules/knowledge-network/routes/lazy-pages";
import { knowledgeNetworkStandaloneRoutes } from "@/modules/knowledge-network/routes/standalone-routes";

describe("knowledge network standalone routes", () => {
  it("keeps object-type base authorization available without the property capability", () => {
    const route = knowledgeNetworkStandaloneRoutes.find(
      (candidate) => candidate.path === "/knowledge-network/workspace/:networkId/object-types/:objectTypeId/authorization",
    );

    expect(isValidElement(route?.element)).toBe(true);
    const suspense = route?.element as ReactElement<{ children: ReactElement }>;
    expect(suspense.type).toBe(Suspense);
    expect(suspense.props.children.type).toBe(ObjectTypeAuthorizationPage);
  });
});
