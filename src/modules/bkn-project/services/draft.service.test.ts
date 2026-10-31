/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { AxiosError, type AxiosResponse } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockDelete, mockGet, mockPatch, mockPost, mockPut } = vi.hoisted(() => ({
  mockDelete: vi.fn(),
  mockGet: vi.fn(),
  mockPatch: vi.fn(),
  mockPost: vi.fn(),
  mockPut: vi.fn(),
}));

vi.mock("@/framework/request/http", () => ({
  http: { delete: mockDelete, get: mockGet, patch: mockPatch, post: mockPost, put: mockPut },
}));

// useMock is read when the module loads, so each case stubs the env and imports afresh.
async function importService() {
  vi.stubEnv("VITE_USE_MOCK", "false");
  vi.resetModules();
  return import("@/modules/bkn-project/services/draft.service");
}

function httpError(status: number, code: string) {
  return new AxiosError(code, "ERR_BAD_REQUEST", undefined, undefined, {
    data: { description: code, error_code: code },
    status,
  } as AxiosResponse);
}

describe("draft.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("reads the draft and maps every item, null lists as empty", async () => {
    const { getDraft, mockDraft } = await importService();
    const backend = mockDraft("p1");
    backend.items.decisions = undefined;
    backend.items.object_types![2].primary_keys = null;
    mockGet.mockResolvedValue({ data: backend });

    const draft = await getDraft("p/1");

    expect(mockGet).toHaveBeenCalledWith("/bkn-project/v1/projects/p%2F1/ontology/draft", {
      skipErrorToast: true,
    });
    expect(draft?.status).toBe("ready");
    expect(draft?.items.decisions).toEqual([]);
    expect(draft?.items.objectTypes[1]).toMatchObject({
      id: "sales_orders",
      key: { computed: true, distinct: 911, rows: 1972, source: "chosen" },
      needsIdentity: false,
      primaryKeys: ["id"],
      table: { catalogId: "cat-001", name: "sales_orders", resourceId: "res-sales_orders" },
    });
    expect(draft?.items.objectTypes[2].primaryKeys).toEqual([]);
    expect(draft?.items.relationTypes[0]).toMatchObject({
      evidence: { hitRate: 0.995, hits: 796, orphans: 4, rows: 800, sourceDistinct: 60 },
      mapping: [{ sourceProperty: "customer_id", targetProperty: "customer_id" }],
      origin: "name_match",
    });
    expect(draft?.items.valueTypes[0]).toMatchObject({
      baseType: "string",
      usedBy: [{ objectType: "customers", property: "level" }],
    });
    expect(draft?.items.excluded[0]).toEqual({
      field: "contact_phone",
      keyword: "phone",
      objectType: "customers",
      reason: "privacy",
    });
    expect(draft?.items.unreadable[0].reason).toBe("not_visible");
  });

  it("answers null before the first draft and rethrows any other error", async () => {
    const { getDraft } = await importService();
    mockGet.mockRejectedValueOnce(httpError(404, "BknProject.Draft.NotFound"));
    await expect(getDraft("p1")).resolves.toBeNull();

    mockGet.mockRejectedValueOnce(httpError(500, "BknProject.Draft.InternalError"));
    await expect(getDraft("p1")).rejects.toBeInstanceOf(AxiosError);
  });

  it("starts drafting with the generate method and returns the drafting draft", async () => {
    const { generateDraft, mockDraft } = await importService();
    mockPost.mockResolvedValue({ data: { ...mockDraft("p1"), status: "drafting" } });

    const draft = await generateDraft("p1");

    expect(mockPost).toHaveBeenCalledWith(
      "/bkn-project/v1/projects/p1/ontology/draft:generate",
      {},
      { skipErrorToast: true },
    );
    expect(draft.status).toBe("drafting");
  });

  it("agrees to discard the decisions only when asked", async () => {
    const { generateDraft, mockDraft } = await importService();
    mockPost.mockResolvedValue({ data: { ...mockDraft("p1"), status: "drafting" } });

    await generateDraft("p1", { discardDecisions: true });

    expect(mockPost).toHaveBeenCalledWith(
      "/bkn-project/v1/projects/p1/ontology/draft:generate",
      { discard_decisions: true },
      { skipErrorToast: true },
    );
  });

  it("edits one item with the draft's update time and only the fields given", async () => {
    const { editDraftItem, mockDraft } = await importService();
    mockPatch.mockResolvedValue({ data: { ...mockDraft("p1"), update_time: 42 } });

    const draft = await editDraftItem("p 1", "object_types", "sales orders", 7, {
      adopted: false,
    });

    expect(mockPatch).toHaveBeenCalledWith(
      "/bkn-project/v1/projects/p%201/ontology/draft/items/object_types/sales%20orders",
      { adopted: false, update_time: 7 },
      { skipErrorToast: true },
    );
    expect(draft.updateTime).toBe(42);
  });

  it("sends an update field as bkn-project names it, and reads it back", async () => {
    const { editDraftItem, mockDraft } = await importService();
    const backend = mockDraft("p1");
    backend.items.object_types![1].incremental_key = "updated_at";
    mockPatch.mockResolvedValue({ data: backend });

    const draft = await editDraftItem("p1", "object_types", "sales_orders", 7, {
      incrementalKey: "updated_at",
    });

    expect(mockPatch).toHaveBeenCalledWith(
      "/bkn-project/v1/projects/p1/ontology/draft/items/object_types/sales_orders",
      { incremental_key: "updated_at", update_time: 7 },
      { skipErrorToast: true },
    );
    expect(draft.items.objectTypes[1].incrementalKey).toBe("updated_at");
    // An object type without one reads as empty.
    expect(draft.items.objectTypes[0].incrementalKey).toBe("");
  });

  it("records an update field in the mock only when it changes", async () => {
    vi.stubEnv("VITE_USE_MOCK", "true");
    vi.resetModules();
    const { editDraftItem, getDraft } =
      await import("@/modules/bkn-project/services/draft.service");
    vi.useFakeTimers();
    try {
      const settle = async <T>(promise: Promise<T>) => {
        await vi.runAllTimersAsync();
        return promise;
      };
      const before = (await settle(getDraft("p-001")))!;
      const set = await settle(
        editDraftItem("p-001", "object_types", "sales_orders", before.updateTime, {
          incrementalKey: "order_date",
        }),
      );
      const again = await settle(
        editDraftItem("p-001", "object_types", "sales_orders", set.updateTime, {
          incrementalKey: "order_date",
        }),
      );

      const recorded = again.items.decisions.filter((item) => item.action === "incremental");
      expect(recorded).toHaveLength(1);
      expect(
        again.items.objectTypes.find((item) => item.id === "sales_orders")?.incrementalKey,
      ).toBe("order_date");
    } finally {
      vi.useRealTimers();
    }
  });

  it("saves an object type whole as bkn-project names it", async () => {
    const { mockDraft, saveDraftObjectType } = await importService();
    const backend = mockDraft("p1");
    mockPut.mockResolvedValue({ data: backend });

    const draft = await saveDraftObjectType("p/1", "customers", 7, {
      description: "Who buys",
      displayKey: "name",
      incrementalKey: "",
      name: "Customer",
      primaryKeys: ["customer_id"],
      properties: [
        {
          description: "",
          displayName: "Customer",
          mappedField: "customer_id",
          name: "customer_id",
          type: "string",
        },
        {
          description: "Shown",
          displayName: "Name",
          mappedField: "name",
          name: "name",
          type: "string",
        },
      ],
    });

    expect(mockPut).toHaveBeenCalledWith(
      "/bkn-project/v1/projects/p%2F1/ontology/draft/object_types/customers",
      {
        comment: "Who buys",
        data_properties: [
          {
            comment: "",
            display_name: "Customer",
            mapped_field: { name: "customer_id" },
            name: "customer_id",
            type: "string",
          },
          {
            comment: "Shown",
            display_name: "Name",
            mapped_field: { name: "name" },
            name: "name",
            type: "string",
          },
        ],
        display_key: "name",
        incremental_key: "",
        name: "Customer",
        primary_keys: ["customer_id"],
        update_time: 7,
      },
      { skipErrorToast: true },
    );
    expect(draft.items.objectTypes[0].name).toBe("customers");
  });

  it("refuses in the mock as bkn-project does: a joined property, a column mapped twice", async () => {
    vi.stubEnv("VITE_USE_MOCK", "true");
    vi.resetModules();
    const { getDraft, listDraftTableFields, saveDraftObjectType } =
      await import("@/modules/bkn-project/services/draft.service");
    vi.useFakeTimers();
    try {
      const settle = async <T>(promise: Promise<T>) => {
        await vi.runAllTimersAsync();
        return promise;
      };
      // Caught before the timers run, as the mock refuses at once.
      const refusal = async (promise: Promise<unknown>) => {
        const caught = promise.catch((error: AxiosError) => error);
        await vi.runAllTimersAsync();
        return (await caught) as AxiosError<{ error_code: string; error_details?: unknown }>;
      };
      const before = (await settle(getDraft("p-001")))!;
      const customers = before.items.objectTypes.find((item) => item.id === "customers")!;
      const save = (properties: { mappedField?: string; name: string }[], updateTime: number) =>
        saveDraftObjectType("p-001", "customers", updateTime, {
          description: "",
          displayKey: "name",
          incrementalKey: "",
          name: "customers",
          primaryKeys: ["customer_id"],
          properties: properties.map((property) => ({
            description: "",
            displayName: property.name,
            type: "string",
            ...property,
          })),
        });

      // The columns read off the draft: the mapped ones and those left out.
      const fields = await settle(
        listDraftTableFields({ id: "p-001", knId: "n" }, "customers", "res-customers"),
      );
      expect(fields.map((field) => field.name)).toEqual([
        "customer_id",
        "name",
        "contact_phone",
        "contact_email",
      ]);

      // A relation joins by customer_id.
      const inUse = await refusal(save([{ mappedField: "name", name: "name" }], before.updateTime));
      expect(inUse.response?.data).toMatchObject({
        error_code: "BknProject.Draft.PropertyInUse",
        error_details: [
          {
            property: "customer_id",
            relation: { id: "sales_orders_to_customers", name: "sales_orders_to_customers" },
            source: { id: "sales_orders", name: "sales_orders" },
            target: { id: "customers", name: "customers" },
          },
        ],
      });
      const twice = await refusal(
        save(
          [
            { mappedField: "customer_id", name: "customer_id" },
            { mappedField: "customer_id", name: "name" },
          ],
          before.updateTime,
        ),
      );
      expect(twice.response?.data).toMatchObject({
        error_code: "BknProject.Draft.InvalidProperty",
        error_details: { field: "customer_id", reason: "field_mapped_twice" },
      });
      const stale = await refusal(save([], before.updateTime - 1));
      expect(stale.response?.data.error_code).toBe("BknProject.Draft.Stale");

      // Mapping a column left out restores it.
      const saved = await settle(
        save(
          [
            { mappedField: "customer_id", name: "customer_id" },
            { mappedField: "name", name: "name" },
            { mappedField: "contact_phone", name: "phone" },
          ],
          before.updateTime,
        ),
      );
      expect(
        saved.items.objectTypes.find((item) => item.id === "customers")?.properties,
      ).toHaveLength(customers.properties.length + 1);
      expect(saved.items.excluded.map((field) => field.field)).not.toContain("contact_phone");
      expect(saved.items.decisions.at(-1)).toMatchObject({ action: "save", itemId: "customers" });
    } finally {
      vi.useRealTimers();
    }
  });

  it("adds catalogs with the custom method and reads which are being added", async () => {
    const { addDraftCatalogs, mockDraft } = await importService();
    const backend = mockDraft("p1");
    backend.items.adding = { by: { id: "u1", type: "user" }, catalog_ids: ["c2"], since: 5 };
    mockPost.mockResolvedValue({ data: backend, status: 202 });

    const draft = await addDraftCatalogs("p 1", ["c2"]);

    expect(mockPost).toHaveBeenCalledWith(
      "/bkn-project/v1/projects/p%201/catalogs:add",
      { catalog_ids: ["c2"] },
      { skipErrorToast: true },
    );
    expect(draft.status).toBe("ready");
    expect(draft.items.adding).toEqual({
      by: { id: "u1", type: "user" },
      catalogIds: ["c2"],
      since: 5,
    });
  });

  it("adds catalogs in the mock in the background, refusing another adding meanwhile", async () => {
    vi.stubEnv("VITE_USE_MOCK", "true");
    vi.resetModules();
    const { addDraftCatalogs, getDraft } =
      await import("@/modules/bkn-project/services/draft.service");
    vi.useFakeTimers();
    try {
      const settle = async <T>(promise: Promise<T>) => {
        await vi.runAllTimersAsync();
        return promise;
      };
      const adding = await settle(addDraftCatalogs("p-001", ["cat-002"]));
      expect(adding.items.adding?.catalogIds).toEqual(["cat-002"]);
      const again = addDraftCatalogs("p-001", ["cat-003"]).catch((error: AxiosError) => error);
      await vi.runAllTimersAsync();
      expect(((await again) as AxiosError<{ error_code: string }>).response?.data.error_code).toBe(
        "BknProject.Draft.Drafting",
      );

      vi.advanceTimersByTime(10_000);
      const done = (await settle(getDraft("p-001")))!;
      expect(done.items.adding).toBeNull();
      expect(done.items.decisions.at(-1)).toMatchObject({ action: "add_catalogs", kind: "draft" });
    } finally {
      vi.useRealTimers();
    }
  });

  it("makes, saves and deletes relation types as bkn-backend's", async () => {
    const { createDraftRelationType, deleteDraftRelationType, mockDraft, saveDraftRelationType } =
      await importService();
    mockPost.mockResolvedValue({ data: mockDraft("p1"), status: 201 });
    mockPut.mockResolvedValue({ data: mockDraft("p1") });
    mockDelete.mockResolvedValue({ data: mockDraft("p1") });
    const direct = {
      description: "",
      mapping: [{ sourceProperty: "customer_id", targetProperty: "id" }],
      name: "Orders of customer",
      source: "orders",
      target: "customers",
    };

    await createDraftRelationType("p 1", 7, direct);
    expect(mockPost).toHaveBeenCalledWith(
      "/bkn-project/v1/projects/p%201/ontology/draft/relation_types",
      {
        comment: "",
        mapping_rules: [
          { source_property: { name: "customer_id" }, target_property: { name: "id" } },
        ],
        name: "Orders of customer",
        source_object_type_id: "orders",
        target_object_type_id: "customers",
        type: "direct",
        update_time: 7,
      },
      { skipErrorToast: true },
    );

    await saveDraftRelationType("p 1", "r 1", 8, {
      ...direct,
      link: {
        resourceId: "res-items",
        sourceMapping: [{ sourceProperty: "id", targetProperty: "order_id" }],
        targetMapping: [{ sourceProperty: "customer_id", targetProperty: "id" }],
      },
      mapping: [],
    });
    expect(mockPut).toHaveBeenCalledWith(
      "/bkn-project/v1/projects/p%201/ontology/draft/relation_types/r%201",
      expect.objectContaining({
        mapping_rules: {
          backing_data_source: { id: "res-items", type: "resource" },
          source_mapping_rules: [
            { source_property: { name: "id" }, target_property: { name: "order_id" } },
          ],
          target_mapping_rules: [
            { source_property: { name: "customer_id" }, target_property: { name: "id" } },
          ],
        },
        type: "indirect",
        update_time: 8,
      }),
      { skipErrorToast: true },
    );

    await deleteDraftRelationType("p 1", "r 1", 9);
    expect(mockDelete).toHaveBeenCalledWith(
      "/bkn-project/v1/projects/p%201/ontology/draft/relation_types/r%201",
      { params: { update_time: 9 }, skipErrorToast: true },
    );
  });

  it("makes relations in the mock as bkn-project does, deleting only those people made", async () => {
    vi.stubEnv("VITE_USE_MOCK", "true");
    vi.resetModules();
    const { createDraftRelationType, deleteDraftRelationType, getDraft } =
      await import("@/modules/bkn-project/services/draft.service");
    vi.useFakeTimers();
    try {
      const settle = async <T>(promise: Promise<T>) => {
        await vi.runAllTimersAsync();
        return promise;
      };
      // Caught before the timers run, as the mock refuses at once.
      const refusal = async (promise: Promise<unknown>) => {
        const caught = promise.catch((error: AxiosError) => error);
        await vi.runAllTimersAsync();
        return ((await caught) as AxiosError<{ error_details?: { reason?: string } }>).response
          ?.data.error_details?.reason;
      };
      const before = (await settle(getDraft("p-001")))!;
      const drafted = before.items.relationTypes[0];
      const join = {
        description: "",
        mapping: drafted.mapping,
        name: "Again",
        source: drafted.source,
        target: drafted.target,
      };

      expect(await refusal(createDraftRelationType("p-001", before.updateTime, join))).toBe(
        "duplicate",
      );
      expect(
        await refusal(
          createDraftRelationType("p-001", before.updateTime, {
            ...join,
            mapping: [{ sourceProperty: "nothing", targetProperty: "customer_id" }],
          }),
        ),
      ).toBe("unknown_property");
      expect(await refusal(deleteDraftRelationType("p-001", drafted.id, before.updateTime))).toBe(
        "not_manual",
      );

      const made = await settle(
        createDraftRelationType("p-001", before.updateTime, {
          ...join,
          mapping: [{ sourceProperty: "customer_id", targetProperty: "name" }],
        }),
      );
      const added = made.items.relationTypes.at(-1)!;
      expect(added).toMatchObject({ name: "Again", origin: "manual" });
      // Made after it, deleting the first and making a third leaves every id its own.
      const second = await settle(
        createDraftRelationType("p-001", made.updateTime, {
          ...join,
          mapping: [{ sourceProperty: "order_no", targetProperty: "name" }],
          name: "Second",
        }),
      );
      const kept = second.items.relationTypes.at(-1)!;
      const left = await settle(deleteDraftRelationType("p-001", added.id, second.updateTime));
      expect(left.items.relationTypes.map((item) => item.id)).not.toContain(added.id);
      const third = await settle(
        createDraftRelationType("p-001", left.updateTime, {
          ...join,
          mapping: [{ sourceProperty: "order_no", targetProperty: "customer_id" }],
          name: "Third",
        }),
      );
      const ids = third.items.relationTypes.map((item) => item.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(ids).toContain(kept.id);
    } finally {
      vi.useRealTimers();
    }
  });

  it("reads the candidates in bkn-project's order, kept to an added catalog on request", async () => {
    const { getCandidates } = await importService();
    mockGet.mockResolvedValue({
      data: {
        counts: { adopted: 1, pending: 1 },
        items: [
          {
            added_by_catalog: "c2",
            adopted: false,
            id: "leads",
            kind: "object_types",
            name: "Leads",
            needed_by_requirements: { questions: [{ id: "q1", text: "Who calls?" }] },
            state: "pending",
            table: { name: "crm_leads", rows: 40 },
          },
          { adopted: true, id: "orders", kind: "object_types", name: "Orders", state: "adopted" },
        ],
      },
    });

    const read = await getCandidates("p 1", "c2");

    expect(mockGet).toHaveBeenCalledWith("/bkn-project/v1/projects/p%201/ontology/candidates", {
      params: { catalog_id: "c2" },
      skipErrorToast: true,
    });
    expect(read.counts).toEqual({ adopted: 1, excluded: 0, pending: 1 });
    expect(read.items[0]).toMatchObject({
      addedByCatalog: "c2",
      neededBy: { concepts: [], questions: [{ id: "q1", text: "Who calls?" }] },
      table: { name: "crm_leads", rows: 40 },
    });
    expect(read.items[1]).toMatchObject({ addedByCatalog: "", neededBy: null, table: null });
  });

  it("accepts the suggestions with the draft's time, and sends why an item is left out", async () => {
    const { acceptDraftSuggestions, editDraftItem, mockDraft } = await importService();
    mockPost.mockResolvedValue({ data: { draft: mockDraft("p1"), skipped: 2 } });
    mockPatch.mockResolvedValue({ data: mockDraft("p1") });

    expect((await acceptDraftSuggestions("p 1", 7)).skipped).toBe(2);
    expect(mockPost).toHaveBeenCalledWith(
      "/bkn-project/v1/projects/p%201/ontology/draft:accept_suggestions",
      { update_time: 7 },
      { skipErrorToast: true },
    );

    await editDraftItem("p1", "object_types", "customers", 8, {
      adopted: false,
      reason: "A log",
    });
    expect(mockPatch).toHaveBeenCalledWith(
      "/bkn-project/v1/projects/p1/ontology/draft/items/object_types/customers",
      expect.objectContaining({ adopted: false, reason: "A log", update_time: 8 }),
      { skipErrorToast: true },
    );
  });

  it("confirms candidates in the mock as people decide, and as suggested where it can", async () => {
    vi.stubEnv("VITE_USE_MOCK", "true");
    vi.resetModules();
    const { acceptDraftSuggestions, editDraftItem, getCandidates, getDraft } =
      await import("@/modules/bkn-project/services/draft.service");
    vi.useFakeTimers();
    try {
      const settle = async <T>(promise: Promise<T>) => {
        await vi.runAllTimersAsync();
        return promise;
      };
      const before = (await settle(getDraft("p-001")))!;
      const first = await settle(getCandidates("p-001"));
      expect(first.counts.pending).toBe(first.items.length);
      // What the requirements need comes first.
      expect(first.items[0].neededBy).not.toBeNull();

      const left = await settle(
        editDraftItem("p-001", "object_types", "customers", before.updateTime, {
          adopted: false,
          reason: "Not now",
        }),
      );
      const customers = (await settle(getCandidates("p-001"))).items.find(
        (item) => item.id === "customers",
      );
      expect(customers).toMatchObject({ excludeReason: "Not now", state: "excluded" });

      // An object type waiting for its identity, and relations with an end left out, are skipped.
      const { skipped } = await settle(acceptDraftSuggestions("p-001", left.updateTime));
      const after = await settle(getCandidates("p-001"));
      expect(skipped).toBe(after.counts.pending);
      expect(after.items.find((item) => item.id === "sales_orders")?.state).toBe("adopted");
    } finally {
      vi.useRealTimers();
    }
  });

  it("chooses an identity and waits longer than bkn-project counts", async () => {
    const { chooseIdentity, IDENTITY_TIMEOUT_MS, mockDraft } = await importService();
    mockPut.mockResolvedValue({ data: mockDraft("p1") });

    await chooseIdentity("p1", "material bom", 7, ["material_code"]);

    expect(mockPut).toHaveBeenCalledWith(
      "/bkn-project/v1/projects/p1/ontology/draft/object_types/material%20bom/identity",
      { properties: ["material_code"], update_time: 7 },
      { skipErrorToast: true, timeout: IDENTITY_TIMEOUT_MS },
    );
    // bkn-project counts for up to 30 seconds and keeps the identity either way; the page must
    // not give up first and report a choice that was saved as failed.
    expect(IDENTITY_TIMEOUT_MS).toBeGreaterThan(30_000);
  });

  it("restores an excluded field with the draft's update time", async () => {
    const { mockDraft, restoreField } = await importService();
    mockPost.mockResolvedValue({ data: mockDraft("p1") });

    await restoreField("p1", 7, "customers", "contact_phone");

    expect(mockPost).toHaveBeenCalledWith(
      "/bkn-project/v1/projects/p1/ontology/draft:restore",
      { field: "contact_phone", object_type: "customers", update_time: 7 },
      { skipErrorToast: true },
    );
  });

  it("reads the source changes, null lists as empty, and drafts them with the signature", async () => {
    const { draftSourceChanges, getSourceChanges } = await importService();
    mockGet.mockResolvedValueOnce({
      data: {
        missing_tables: null,
        object_types: [
          {
            changes: [{ change: "added", excluded: "privacy", field: "phone" }],
            id: "customer",
            in_draft: true,
            name: "Customer",
            published: false,
            table: "customer_entity",
          },
        ],
        relation_types: [{ id: "r1", name: "Places", removed: null, table: "links" }],
        signature: "sig",
        state: "changed",
      },
    });
    expect(await getSourceChanges("p/1")).toEqual({
      missingTables: [],
      objectTypes: [
        {
          changes: [
            {
              change: "added",
              excluded: "privacy",
              field: "phone",
              fieldName: "",
              fromType: "",
              key: false,
              property: "",
              propertyName: "",
              relations: [],
              toType: "",
              unsupported: false,
            },
          ],
          id: "customer",
          inDraft: true,
          name: "Customer",
          published: false,
          table: "customer_entity",
        },
      ],
      relationTypes: [{ id: "r1", name: "Places", removed: [], table: "links" }],
      signature: "sig",
      state: "changed",
    });
    expect(mockGet).toHaveBeenCalledWith("/bkn-project/v1/projects/p%2F1/source-changes", {
      skipErrorToast: true,
    });

    const { mockDraft } = await import("@/modules/bkn-project/services/draft.service");
    mockPost.mockResolvedValueOnce({ data: mockDraft("p/1") });
    await draftSourceChanges("p/1", "sig");
    expect(mockPost).toHaveBeenCalledWith(
      "/bkn-project/v1/projects/p%2F1/source-changes:draft",
      { signature: "sig" },
      { skipErrorToast: true },
    );
  });

  it("asks AI about an object type, and reads a missing suggestion as none", async () => {
    const { askAboutObjectType, ASK_TIMEOUT_MS } = await importService();
    mockPost.mockResolvedValueOnce({
      data: {
        answer: "A",
        suggestion: { field: "identity", properties: ["id", "entry_id"], reason: "R" },
      },
    });
    expect(await askAboutObjectType("p/1", "po 1", "Q?")).toEqual({
      answer: "A",
      suggestion: { field: "identity", properties: ["id", "entry_id"], reason: "R", value: "" },
    });
    expect(mockPost).toHaveBeenCalledWith(
      "/bkn-project/v1/projects/p%2F1/ontology/draft/object_types/po%201/ask",
      { question: "Q?" },
      { skipErrorToast: true, timeout: ASK_TIMEOUT_MS },
    );

    mockPost.mockResolvedValueOnce({ data: { answer: "B", suggestion: null } });
    expect(await askAboutObjectType("p/1", "po", "Q?")).toEqual({ answer: "B", suggestion: null });
  });
});
