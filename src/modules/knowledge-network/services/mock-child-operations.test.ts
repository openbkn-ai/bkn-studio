/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/modules/knowledge-network/services/shared/runtime", async () => {
  const actual = await vi.importActual<
    typeof import("@/modules/knowledge-network/services/shared/runtime")
  >("@/modules/knowledge-network/services/shared/runtime");

  return {
    ...actual,
    useMock: true,
    wait: <T>(value: T) => Promise.resolve(value),
  };
});

import {
  getKnowledgeNetworkActionTypeDetail,
  listKnowledgeNetworkActionTypePage,
  listKnowledgeNetworkActionTypes,
} from "./action-type.service";
import {
  getKnowledgeNetworkConceptGroup,
  listKnowledgeNetworkConceptGroupPage,
  listKnowledgeNetworkConceptGroups,
} from "./concept-group.service";
import {
  getKnowledgeNetworkObjectTypeDetail,
  listKnowledgeNetworkObjectTypePage,
  listKnowledgeNetworkObjectTypes,
} from "./object-type.service";
import {
  getKnowledgeNetworkRelationTypeDetail,
  listKnowledgeNetworkRelationTypePage,
  listKnowledgeNetworkRelationTypes,
} from "./relation-type.service";
import { getKnowledgeNetwork, listKnowledgeNetworks } from "./network.service";
import { listQueryableKnowledgeBases } from "./knowledge-base.service";

describe("knowledge-network mock child operations", () => {
  beforeEach(() => {
    vi.stubEnv("DEV", true);
    vi.stubEnv("VITE_USE_MOCK", "true");
    vi.stubEnv("VITE_MOCK_USER", "admin");
  });

  afterEach(() => vi.unstubAllEnvs());
  it("projects operations on every list response used by operation-gated menus", async () => {
    const networkId = "kn-domain-risk";
    const [conceptGroups, objectTypes, actionTypes] = await Promise.all([
      listKnowledgeNetworkConceptGroups(networkId),
      listKnowledgeNetworkObjectTypes(networkId),
      listKnowledgeNetworkActionTypes(networkId),
    ]);

    for (const record of [conceptGroups[0], objectTypes[0], actionTypes[0]]) {
      expect(record?.operations).toEqual(["view_detail", "query_data", "modify", "delete"]);
    }
  });
});

describe("knowledge-network mock viewer", () => {
  beforeEach(() => {
    vi.stubEnv("DEV", true);
    vi.stubEnv("VITE_USE_MOCK", "true");
    vi.stubEnv("VITE_MOCK_USER", "viewer");
  });

  afterEach(() => vi.unstubAllEnvs());

  it("keeps network list and detail read-only without changing administrator fixtures", async () => {
    const page = await listKnowledgeNetworks({ keyword: "", page: 1, pageSize: 20 });
    expect(page.items.length).toBeGreaterThan(0);
    for (const record of page.items) {
      expect(record.operations).toEqual(["view_detail"]);
      expect((await getKnowledgeNetwork(record.id))?.operations).toEqual(["view_detail"]);
    }

    vi.stubEnv("VITE_MOCK_USER", "admin");
    expect((await getKnowledgeNetwork(page.items[0].id))?.operations).toEqual([
      "view_detail",
      "query_data",
      "modify",
      "delete",
      "authorize",
      "execute",
    ]);
  });

  it("projects every child list, paginated list and detail consistently", async () => {
    const networkId = "kn-domain-risk";
    const query = { limit: 100, offset: 0 };
    const cases = [
      {
        list: () => listKnowledgeNetworkObjectTypes(networkId),
        page: () => listKnowledgeNetworkObjectTypePage(networkId, query),
        detail: (id: string) => getKnowledgeNetworkObjectTypeDetail(networkId, id),
      },
      {
        list: () => listKnowledgeNetworkRelationTypes(networkId),
        page: () => listKnowledgeNetworkRelationTypePage(networkId, query),
        detail: (id: string) => getKnowledgeNetworkRelationTypeDetail(networkId, id),
      },
      {
        list: () => listKnowledgeNetworkActionTypes(networkId),
        page: () => listKnowledgeNetworkActionTypePage(networkId, query),
        detail: (id: string) => getKnowledgeNetworkActionTypeDetail(networkId, id),
      },
      {
        list: () => listKnowledgeNetworkConceptGroups(networkId),
        page: () => listKnowledgeNetworkConceptGroupPage(networkId, query),
        detail: (id: string) => getKnowledgeNetworkConceptGroup(networkId, id),
      },
    ];

    for (const entry of cases) {
      const records = await entry.list();
      const page = await entry.page();
      expect(records.length).toBeGreaterThan(0);
      expect(page.entries.length).toBeGreaterThan(0);
      for (const record of [...records, ...page.entries]) {
        expect(record.operations).toEqual(["view_detail"]);
      }
      expect((await entry.detail(records[0].id))?.operations).toEqual(["view_detail"]);
    }
  });

  it("does not offer queryable knowledge bases to a definition-only viewer", async () => {
    expect(await listQueryableKnowledgeBases()).toEqual([]);
    vi.stubEnv("VITE_MOCK_USER", "admin");
    expect((await listQueryableKnowledgeBases()).length).toBeGreaterThan(0);
  });
});
