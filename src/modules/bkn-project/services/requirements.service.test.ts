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
async function importService(useMock = "false") {
  vi.stubEnv("VITE_USE_MOCK", useMock);
  vi.resetModules();
  return import("@/modules/bkn-project/services/requirements.service");
}

const prefix = "/bkn-project/v1/projects/p%2F1/requirements";
const citation = { block_id: "b2", document_id: "d1", end: 20, quote: "late orders", start: 9 };

describe("requirements.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("reads the specification, null lists as empty, and none before the first drafting", async () => {
    const { getRequirements } = await importService();
    mockGet.mockResolvedValueOnce({
      data: {
        project_id: "p/1",
        spec: {
          choices: [
            {
              citations: null,
              decision: {
                basis: "Simpler",
                by: { id: "u1", type: "user" },
                option_id: "o1",
                time: 5,
              },
              id: "f1",
              options: [{ consequence: "One type", id: "o1", label: "One" }],
              question: "Split customers?",
              reason: "Same in the documents",
              recommended_option_id: "o1",
            },
          ],
          concepts: [
            {
              category: "object",
              citations: [citation],
              definition: "An order",
              edited: true,
              id: "c1",
              maps_to: { id: "orders", kind: "object_type" },
              term: "Order",
            },
          ],
          conflicts: [
            {
              deferred: true,
              id: "k1",
              kind: "rule",
              resolution: null,
              sides: [{ ...citation, position: "By customer" }],
              topic: "Late",
            },
          ],
          questions: [
            {
              answer_shape: "A list",
              citations: [],
              id: "q1",
              layer: "knowledge",
              needs: [{ id: "orders", kind: "object_type" }],
              needs_source: "concepts",
              scenario_ids: null,
              supplement_reason: "Asked by sales",
              template: "Which {x}?",
              text: "Which orders?",
              type: "filter",
            },
          ],
          rejected: null,
          rules: [
            { citations: null, compiles_to: "constraint", id: "r1", statement: "Late is late" },
          ],
          scenarios: [
            {
              actor: "Sales",
              capabilities: [{ kind: "metric", name: "Late rate" }],
              citations: [citation],
              decision: "Call",
              id: "s1",
              knowledge: null,
              name: "Delay warning",
              trigger: "Daily",
            },
          ],
          tables_omitted: 3,
        },
        stale: true,
        status: "ready",
        undecided_choices: 0,
        unresolved_conflicts: 1,
        update_time: 7,
        version: 2,
      },
    });

    const requirements = await getRequirements("p/1");

    expect(mockGet).toHaveBeenCalledWith(prefix, { skipErrorToast: true });
    expect(requirements).toMatchObject({
      error: "",
      stale: true,
      status: "ready",
      undecidedChoices: 0,
      unresolvedConflicts: 1,
      updateTime: 7,
      version: 2,
    });
    const spec = requirements!.spec;
    expect(spec.catalogsUnlisted).toEqual([]);
    expect(spec.rejected).toEqual([]);
    expect(spec.tablesOmitted).toBe(3);
    expect(spec.choices[0]).toEqual({
      citations: [],
      decision: { basis: "Simpler", byId: "u1", optionId: "o1", time: 5 },
      id: "f1",
      options: [{ consequence: "One type", id: "o1", label: "One" }],
      question: "Split customers?",
      reason: "Same in the documents",
      recommendedOptionId: "o1",
    });
    expect(spec.concepts[0]).toMatchObject({
      citations: [{ blockId: "b2", documentId: "d1", end: 20, quote: "late orders", start: 9 }],
      edited: true,
      mapsTo: { id: "orders", kind: "object_type" },
      notOntologyReason: "",
    });
    expect(spec.conflicts[0]).toMatchObject({
      deferred: true,
      resolution: null,
      sides: [{ documentId: "d1", position: "By customer" }],
      suggestedDocumentId: "",
    });
    expect(spec.questions[0]).toMatchObject({
      answerShape: "A list",
      edited: false,
      needsSource: "concepts",
      scenarioIds: [],
      supplementReason: "Asked by sales",
    });
    expect(spec.rules[0]).toEqual({
      citations: [],
      compilesTo: "constraint",
      edited: false,
      id: "r1",
      statement: "Late is late",
    });
    expect(spec.scenarios[0]).toMatchObject({
      capabilities: [{ definition: "", kind: "metric", name: "Late rate" }],
      knowledge: [],
    });

    mockGet.mockRejectedValueOnce(
      new AxiosError("x", "ERR_BAD_REQUEST", undefined, undefined, {
        data: { error_code: "BknProject.Requirement.NotFound" },
        status: 404,
      } as AxiosResponse),
    );
    expect(await getRequirements("p/1")).toBeNull();
  });

  it("uploads files as a form and says how each went", async () => {
    const { uploadDocuments } = await importService();
    mockPost.mockResolvedValue({
      data: {
        results: [
          { document_id: "d3", name: "a.md", outcome: "created" },
          { code: "Requirement.NotText", name: "b.txt", outcome: "rejected" },
        ],
      },
    });
    const files = [new File(["# A"], "a.md"), new File(["\u0000"], "b.txt")];

    expect(await uploadDocuments("p/1", files)).toEqual([
      { code: "", documentId: "d3", name: "a.md", outcome: "created" },
      { code: "Requirement.NotText", documentId: "", name: "b.txt", outcome: "rejected" },
    ]);
    const [path, form] = mockPost.mock.calls[0] as [string, FormData];
    expect(path).toBe(`${prefix}/documents`);
    expect((form.getAll("files") as File[]).map((file) => file.name)).toEqual(["a.md", "b.txt"]);
  });

  it("lists, reads, types and removes documents", async () => {
    const { deleteDocument, getDocument, listDocuments, setDocumentType } = await importService();
    const backendDocument = {
      create_time: 1,
      doc_type: "prd",
      format: "markdown",
      id: "d1",
      name: "prd.md",
      size: 30,
      uploader: { id: "u1", type: "user" },
    };
    mockGet.mockResolvedValueOnce({ data: { entries: [backendDocument] } }).mockResolvedValueOnce({
      data: { ...backendDocument, blocks: [{ end: 5, id: "b1", start: 0 }], content: "Hello" },
    });

    expect(await listDocuments("p/1")).toEqual([
      {
        createTime: 1,
        docType: "prd",
        format: "markdown",
        id: "d1",
        name: "prd.md",
        size: 30,
        uploaderId: "u1",
      },
    ]);
    expect(await getDocument("p/1", "d1")).toMatchObject({
      blocks: [{ end: 5, heading: "", id: "b1", start: 0 }],
      content: "Hello",
    });
    await setDocumentType("p/1", "d1", "policy");
    expect(mockPatch).toHaveBeenCalledWith(
      `${prefix}/documents/d1`,
      { doc_type: "policy" },
      { skipErrorToast: true },
    );
    await deleteDocument("p/1", "d1");
    expect(mockDelete).toHaveBeenCalledWith(`${prefix}/documents/d1`, { skipErrorToast: true });
  });

  it("drafts, agreeing to discard decisions only when asked", async () => {
    const { draftRequirements } = await importService();
    mockPost.mockResolvedValue({
      data: { spec: {}, status: "drafting", update_time: 1, version: 3 },
    });

    expect((await draftRequirements("p/1")).status).toBe("drafting");
    expect(mockPost).toHaveBeenLastCalledWith(`${prefix}:draft`, undefined, {
      skipErrorToast: true,
    });
    await draftRequirements("p/1", true);
    expect(mockPost).toHaveBeenLastCalledWith(
      `${prefix}:draft`,
      { discard_decisions: true },
      { skipErrorToast: true },
    );
  });

  it("sends each edit with the update time read, and only the fields set", async () => {
    const { addItem, decideChoice, editItem, removeItem, resolveConflict, setConceptMapping } =
      await importService();
    const reply = { data: { spec: {}, status: "ready", update_time: 9, version: 2 } };
    mockPost.mockResolvedValue(reply);
    mockPatch.mockResolvedValue(reply);
    mockPut.mockResolvedValue(reply);
    mockDelete.mockResolvedValue(reply);

    expect((await addItem("p/1", "rules", { statement: "Late is late" }, 7)).updateTime).toBe(9);
    expect(mockPost).toHaveBeenCalledWith(
      `${prefix}/items/rules`,
      { statement: "Late is late", update_time: 7 },
      { skipErrorToast: true },
    );

    await editItem(
      "p/1",
      "questions",
      "q1",
      { needs: [{ id: "orders", kind: "object_type" }], scenarioIds: ["s1"], text: "Q" },
      7,
    );
    expect(mockPatch).toHaveBeenCalledWith(
      `${prefix}/items/questions/q1`,
      {
        needs: [{ id: "orders", kind: "object_type" }],
        scenario_ids: ["s1"],
        text: "Q",
        update_time: 7,
      },
      { skipErrorToast: true },
    );
    await editItem("p/1", "questions", "q1", { followConcepts: true }, 7);
    expect(mockPatch).toHaveBeenLastCalledWith(
      `${prefix}/items/questions/q1`,
      { follow_concepts: true, update_time: 7 },
      { skipErrorToast: true },
    );

    await removeItem("p/1", "scenarios", "s1", 7);
    expect(mockDelete).toHaveBeenCalledWith(`${prefix}/items/scenarios/s1`, {
      params: { update_time: 7 },
      skipErrorToast: true,
    });

    await setConceptMapping("p/1", "c1", null, 7);
    expect(mockPut).toHaveBeenCalledWith(
      `${prefix}/concepts/c1/maps-to`,
      { maps_to: null, update_time: 7 },
      { skipErrorToast: true },
    );
    await resolveConflict(
      "p/1",
      "k1",
      { deferred: false, documentId: "", reason: "Both", text: "Late by date" },
      7,
    );
    expect(mockPut).toHaveBeenCalledWith(
      `${prefix}/conflicts/k1`,
      { deferred: false, document_id: "", reason: "Both", text: "Late by date", update_time: 7 },
      { skipErrorToast: true },
    );
    await decideChoice("p/1", "f1", { basis: "", optionId: "o2" }, 7);
    expect(mockPut).toHaveBeenLastCalledWith(
      `${prefix}/choices/f1`,
      { basis: "", option_id: "o2", update_time: 7 },
      { skipErrorToast: true },
    );
  });

  it("reads a question's tests and guidance, none before the first generation, and edits them", async () => {
    const { deleteTest, editTest, generateQuestionDev, getQuestionDev } = await importService();
    const reply = {
      current: false,
      deleted_tests: 1,
      guidance: "Find the customer first.",
      left_out_tests: 2,
      no_tests_reason: "",
      ontology_changed: null,
      out_of_scope: null,
      question_id: "q1",
      status: "ready",
      tests: [
        {
          check: { outcome: "passed" },
          edited: false,
          expect: "exists",
          id: "t1",
          kind: "paraphrase",
          text: "A?",
        },
        { check: null, expect: "same_record", id: "t2", text: "B?" },
      ],
      update_time: 5,
    };
    mockGet.mockResolvedValueOnce({ data: reply });

    expect(await getQuestionDev("p/1", "q1")).toEqual({
      current: false,
      deletedTests: 1,
      error: "",
      guidance: "Find the customer first.",
      leftOutTests: 2,
      noTestsReason: "",
      ontologyChanged: null,
      outOfScope: [],
      status: "ready",
      tests: [
        {
          byServer: false,
          check: { outcome: "passed", reason: "" },
          edited: false,
          expect: "exists",
          id: "t1",
          kind: "paraphrase",
          text: "A?",
        },
        {
          byServer: false,
          check: { outcome: "not_checked", reason: "" },
          edited: false,
          expect: "same_record",
          id: "t2",
          kind: "",
          text: "B?",
        },
      ],
      testsNote: "",
      updateTime: 5,
    });
    expect(mockGet).toHaveBeenCalledWith(`${prefix}/questions/q1/dev`, { skipErrorToast: true });

    mockGet.mockRejectedValueOnce(
      new AxiosError("x", "ERR_BAD_REQUEST", undefined, undefined, {
        data: { error_code: "BknProject.Requirement.TestNotFound" },
        status: 404,
      } as AxiosResponse),
    );
    expect(await getQuestionDev("p/1", "q6")).toBeNull();

    mockPost.mockResolvedValue({ data: { ...reply, status: "generating", tests: [] } });
    expect((await generateQuestionDev("p/1", "q1")).status).toBe("generating");
    expect(mockPost).toHaveBeenCalledWith(`${prefix}/questions/q1/dev:generate`, undefined, {
      skipErrorToast: true,
    });

    mockPut.mockResolvedValue({ data: reply });
    await editTest("p/1", "q1", "t1", { expect: "not_exists" }, 5);
    expect(mockPut).toHaveBeenCalledWith(
      `${prefix}/questions/q1/tests/t1`,
      { expect: "not_exists", update_time: 5 },
      { skipErrorToast: true },
    );
    mockDelete.mockResolvedValue({ data: reply });
    await deleteTest("p/1", "q1", "t2", 5);
    expect(mockDelete).toHaveBeenCalledWith(`${prefix}/questions/q1/tests/t2`, {
      params: { update_time: 5 },
      skipErrorToast: true,
    });
  });

  it("reads what a question is asked about, telling unknown from none", async () => {
    const { getRequirements } = await importService();
    const question = (extra: Record<string, unknown>) => ({
      answer_shape: "",
      id: "q",
      layer: "knowledge",
      needs_source: "concepts",
      template: "",
      text: "",
      type: "",
      ...extra,
    });
    mockGet.mockResolvedValueOnce({
      data: {
        spec: {
          questions: [
            question({
              id: "q1",
              inputs: [
                {
                  concept_id: "c1",
                  name: "customer",
                  property: "code",
                  property_from_key: true,
                  role: "record",
                },
              ],
              notes: ["capability_without_basis"],
              relative_window: true,
            }),
            question({ id: "q2", inputs: [] }),
            question({ id: "q3" }),
          ],
        },
        status: "ready",
        update_time: 1,
        version: 1,
      },
    });

    const [withInputs, none, unknown] = (await getRequirements("p/1"))!.spec.questions;
    expect(withInputs).toMatchObject({
      inputs: [
        {
          conceptId: "c1",
          name: "customer",
          property: "code",
          propertyFromKey: true,
          role: "record",
        },
      ],
      notes: ["capability_without_basis"],
      relativeWindow: true,
    });
    expect(none.inputs).toEqual([]);
    expect(withInputs.inputs?.[0]).not.toHaveProperty("property_from_key");
    // Drafted before inputs: nothing is said, not "none".
    expect(unknown).toMatchObject({ inputs: null, notes: [], relativeWindow: false });
  });

  it("sends a question's inputs and window, and reads who wrote each test", async () => {
    const { editItem, getQuestionDev } = await importService();
    mockPatch.mockResolvedValue({
      data: { spec: {}, status: "ready", update_time: 2, version: 1 },
    });
    await editItem(
      "p/1",
      "questions",
      "q1",
      {
        inputs: [{ conceptId: "c1", name: "as_of", property: "signed_at", role: "reference_time" }],
        relativeWindow: true,
      },
      1,
    );
    expect(mockPatch).toHaveBeenCalledWith(
      `${prefix}/items/questions/q1`,
      {
        inputs: [
          { concept_id: "c1", name: "as_of", property: "signed_at", role: "reference_time" },
        ],
        relative_window: true,
        update_time: 1,
      },
      { skipErrorToast: true },
    );

    mockGet.mockResolvedValueOnce({
      data: {
        status: "ready",
        tests: [
          { by_server: true, expect: "exists", id: "t1", kind: "template", text: "A?" },
          { expect: "exists", id: "t3", kind: "paraphrase", text: "B?" },
        ],
        tests_note: "inputs_untested",
        update_time: 3,
      },
    });
    const dev = (await getQuestionDev("p/1", "q1"))!;
    expect(dev.tests.map((test) => test.byServer)).toEqual([true, false]);
    expect(dev.testsNote).toBe("inputs_untested");
  });
});
