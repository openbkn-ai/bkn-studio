/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FunctionWorkbenchScene } from "@/modules/execution-factory/scenes/FunctionWorkbenchScene";

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));

const router = vi.hoisted(() => {
  const value: { navigate: ReturnType<typeof vi.fn>; state: unknown } = {
    navigate: vi.fn(),
    state: null,
  };
  return value;
});

vi.mock("react-router-dom", () => ({
  useLocation: () => ({
    pathname: "/execution-factory/toolboxes/box-1/tools",
    search: "",
    state: router.state,
  }),
  useNavigate: () => router.navigate,
}));

const EDITOR = [
  "execution-factory:tool:create",
  "execution-factory:tool:debug",
  "execution-factory:tool:delete",
  "execution-factory:tool:edit",
  "execution-factory:toolbox:edit",
  "execution-factory:function:edit",
  "execution-factory:function:debug",
];
const grants = vi.hoisted(() => ({ current: [] as string[] }));

vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({
    message: {
      destroy: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      success: vi.fn(),
      warning: vi.fn(),
    },
    modal: { confirm: vi.fn() },
    runtimeConfig: {
      currentUser: { permissions: grants.current },
    },
  }),
}));

// Monaco does not run in jsdom: a textarea stands in for the Cypher editor.
vi.mock("@/modules/knowledge-network/components/cypher/CypherEditor", () => ({
  CypherEditor: ({
    ariaLabel,
    onChange,
    value,
  }: {
    ariaLabel: string;
    onChange: (value: string) => void;
    value: string;
  }) => (
    <textarea
      aria-label={ariaLabel}
      onChange={(event) => onChange(event.target.value)}
      value={value}
    />
  ),
}));

vi.mock("@/modules/knowledge-network/scenes/NetworkSelect", () => ({
  NetworkSelect: () => null,
}));

const cypher = vi.hoisted(() => ({
  runCypherQuery: vi.fn(),
}));

vi.mock("@/modules/knowledge-network/cypher/cypher-query.service", () => ({
  runCypherQuery: cypher.runCypherQuery,
}));

const agent = vi.hoisted(() => ({ generateCypher: vi.fn() }));

vi.mock("@/modules/knowledge-network/cypher/cypher-ai", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/knowledge-network/cypher/cypher-ai")>()),
  generateCypher: agent.generateCypher,
}));

vi.mock("@/modules/execution-factory/scenes/function-workbench/use-cypher-network", () => ({
  useCypherNetwork: (knId: string | undefined) => ({
    network: knId ? { id: knId, identifier: "supply", name: "供应链" } : null,
    setNetwork: vi.fn(),
    base: "",
    env: knId ? { base: "", token: "t", knId: "supply" } : null,
    tokenProvider: { getToken: () => "t", refresh: () => Promise.resolve("t") },
    schema: { objectTypes: [], relationTypes: [], properties: {} },
  }),
}));

vi.mock("@/modules/execution-factory/components/CodeEditor", () => ({
  CodeEditor: ({ value }: { value?: string }) => <textarea readOnly value={value ?? ""} />,
}));

vi.mock("@/modules/execution-factory/components/FunctionAiGenerateModal", () => ({
  FunctionAiGenerateModal: () => null,
}));

vi.mock("@/modules/execution-factory/scenes/function-workbench/FunctionDependencyPanel", () => ({
  FunctionDependencyPanel: () => null,
}));

vi.mock("@/modules/model-resources/services/llm.service", () => ({
  listLlmModels: vi.fn().mockResolvedValue({ items: [] }),
}));

const { getResourceOperations } = vi.hoisted(() => ({
  getResourceOperations: vi.fn(),
}));

vi.mock("@/modules/model-resources/services/authorization.service", () => ({
  getResourceOperations,
}));

vi.mock("@/modules/execution-factory/services/category.service", () => ({
  listCategories: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/modules/execution-factory/services/function.service", () => ({
  executeFunction: vi.fn(),
  inferFunctionSchema: vi.fn(),
}));

const { getToolbox, updateToolbox, updateToolboxStatus } = vi.hoisted(() => ({
  getToolbox: vi.fn(),
  updateToolbox: vi.fn(),
  updateToolboxStatus: vi.fn(),
}));

vi.mock("@/modules/execution-factory/services/toolbox.service", () => ({
  getToolbox,
  updateToolbox,
  updateToolboxStatus,
}));

const { createTool, deleteTools, getToolDetail, listTools, updateTool, updateToolStatus } =
  vi.hoisted(() => ({
    createTool: vi.fn(),
    deleteTools: vi.fn(),
    getToolDetail: vi.fn(),
    listTools: vi.fn(),
    updateTool: vi.fn(),
    updateToolStatus: vi.fn(),
  }));

vi.mock("@/modules/execution-factory/services/tool.service", () => ({
  createTool,
  deleteTools,
  getToolDetail,
  listTools,
  updateTool,
  updateToolStatus,
}));

const STATEMENT = "MATCH (o:po) WHERE o.supplier_code = $code RETURN count(o) AS n";

function statementEditor(): HTMLTextAreaElement {
  return screen.getByLabelText<HTMLTextAreaElement>("executionFactory.cypherFunction.logic");
}

function runButton(): HTMLElement {
  const button = screen.getByText("executionFactory.workbenchRun").closest("button");
  if (!button) throw new Error("run button not rendered");
  return button;
}

describe("FunctionWorkbenchScene Cypher functions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    grants.current = EDITOR;
    router.state = null;
    getToolbox.mockResolvedValue({
      boxId: "box-1",
      name: "供应链函数",
      metadataType: "function",
      status: "unpublish",
    });
    listTools.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 50, boxId: "box-1" });
    createTool.mockResolvedValue({ successIds: ["tool-new"], failures: [] });
    updateTool.mockResolvedValue(undefined);
    updateToolStatus.mockResolvedValue(undefined);
    getResourceOperations.mockResolvedValue([{ id: "adhoc", operation: ["execute"] }]);
  });

  it("opens a statement from the data query page as a new Cypher function and saves it as one", async () => {
    router.state = {
      returnTo: "/knowledge-network/kn-1",
      cypherDraft: {
        query: STATEMENT,
        knId: "kn-1",
        inputs: [
          { name: "code", type: "string", required: true, description: "", example: "76904023" },
        ],
      },
    };
    render(<FunctionWorkbenchScene boxId="box-1" />);

    await waitFor(() => expect(statementEditor().value).toBe(STATEMENT));
    // The draft leaves the history entry so a reload does not add it again; returnTo stays.
    expect(router.navigate).toHaveBeenCalledWith("/execution-factory/toolboxes/box-1/tools", {
      replace: true,
      state: { returnTo: "/knowledge-network/kn-1" },
    });

    // A parameter typed into the statement becomes a required string input.
    fireEvent.change(statementEditor(), {
      target: { value: STATEMENT.replace("RETURN", "AND o.qty > $min RETURN") },
    });
    // The execution factory refuses inputs without a description; the save names them first.
    fireEvent.click(screen.getByText("common.save"));
    const descriptions = await screen.findAllByPlaceholderText(
      "executionFactory.parameterDescriptionPlaceholder",
    );
    expect(createTool).not.toHaveBeenCalled();
    fireEvent.change(descriptions[0], { target: { value: "供应商编码" } });
    fireEvent.change(descriptions[1], { target: { value: "最小数量" } });
    fireEvent.click(screen.getByText("common.save"));

    await waitFor(() => expect(createTool).toHaveBeenCalledTimes(1));
    const [, created] = createTool.mock.calls[0] as [string, { functionInput?: unknown }];
    expect(created.functionInput).toMatchObject({
      script_type: "cypher",
      kn_id: "kn-1",
      result_shape: "value",
      outputs: [],
      dependencies: [],
      inputs: [
        {
          name: "code",
          type: "string",
          required: true,
          description: "供应商编码",
          example: "76904023",
        },
        { name: "min", type: "string", required: true, description: "最小数量" },
      ],
    });
  });

  it("runs the statement with the test input converted and the result shaped as the function would", async () => {
    router.state = {
      cypherDraft: {
        query: STATEMENT,
        knId: "kn-1",
        inputs: [{ name: "code", type: "string", required: true, description: "" }],
      },
    };
    cypher.runCypherQuery.mockResolvedValue({
      ok: true,
      result: { columns: [{ name: "n" }], entries: [{ n: 16 }] },
      exchange: { url: "", request: {}, status: 200, latencyMs: 8, response: {} },
    });
    render(<FunctionWorkbenchScene boxId="box-1" />);
    await waitFor(() => expect(statementEditor().value).toBe(STATEMENT));

    fireEvent.click(runButton());

    await waitFor(() => expect(cypher.runCypherQuery).toHaveBeenCalledTimes(1));
    expect(cypher.runCypherQuery.mock.calls[0][0]).toMatchObject({
      query: STATEMENT,
      env: { knId: "supply" },
      parameters: { code: "" },
    });
    await waitFor(() => expect(screen.getByText(/"value": 16/)).toBeTruthy());
  });

  it("refuses a value result with more than one row, as the saved function would", async () => {
    router.state = { cypherDraft: { query: "MATCH (o:po) RETURN o.code", knId: "kn-1" } };
    cypher.runCypherQuery.mockResolvedValue({
      ok: true,
      result: { columns: [{ name: "o.code" }], entries: [{ "o.code": "a" }, { "o.code": "b" }] },
      exchange: { url: "", request: {}, status: 200, latencyMs: 8, response: {} },
    });
    render(<FunctionWorkbenchScene boxId="box-1" />);
    await waitFor(() => expect(statementEditor().value).toBe("MATCH (o:po) RETURN o.code"));

    fireEvent.click(runButton());

    expect(await screen.findByText("executionFactory.cypherFunction.problems.rows")).toBeTruthy();
  });

  it("tells the author what the statement's LIMIT means for the shape it returns", async () => {
    const statement = "MATCH (o:po) RETURN o.code LIMIT 1";
    router.state = { cypherDraft: { query: statement, knId: "kn-1" } };
    render(<FunctionWorkbenchScene boxId="box-1" />);
    await waitFor(() => expect(statementEditor().value).toBe(statement));
    const notice = "executionFactory.cypherFunction.notices.";

    // A value from LIMIT 1 with no order is whichever row came first.
    expect(screen.getByText(`${notice}value-unordered-limit`)).toBeTruthy();

    fireEvent.click(screen.getByText("executionFactory.cypherFunction.shapeTable"));
    await waitFor(() => expect(screen.queryByText(`${notice}value-unordered-limit`)).toBeNull());
    expect(screen.queryByText(`${notice}table-default-limit`)).toBeNull();

    // Without LIMIT a table is cut at bkn-backend's default.
    fireEvent.change(statementEditor(), { target: { value: "MATCH (o:po) RETURN o.code" } });
    expect(await screen.findByText(`${notice}table-default-limit`)).toBeTruthy();
  });

  it("writes the statement with the Cypher Agent and fills the parameters it describes", async () => {
    router.state = {
      cypherDraft: {
        query: STATEMENT,
        knId: "kn-1",
        inputs: [{ name: "code", type: "string", required: true, description: "供应商编码" }],
      },
    };
    const generated =
      "MATCH (o:po) WHERE o.supplier_code = $code AND o.qty > $min RETURN count(o) AS n";
    agent.generateCypher.mockResolvedValue({
      query: "",
      threadId: "th-1",
      answer: `\`\`\`cypher\n${generated}\n\`\`\`\n\`\`\`json\n${JSON.stringify([
        { name: "code", type: "string", description: "Agent 的说明", example: "S1" },
        { name: "min", type: "number", description: "最小数量", example: 5 },
      ])}\n\`\`\``,
    });
    render(<FunctionWorkbenchScene boxId="box-1" />);
    await waitFor(() => expect(statementEditor().value).toBe(STATEMENT));

    fireEvent.click(screen.getByText("executionFactory.cypherFunction.ai.open"));
    fireEvent.change(
      await screen.findByLabelText("executionFactory.cypherFunction.ai.description"),
      {
        target: { value: "按供应商统计数量超过下限的采购单" },
      },
    );
    fireEvent.click(screen.getByText("executionFactory.cypherFunction.ai.generate"));

    await waitFor(() => expect(agent.generateCypher).toHaveBeenCalledTimes(1));
    const [request] = agent.generateCypher.mock.calls[0] as [{ knId: string; message: string }];
    // The network as Context Loader names it, and the function's contract in the request.
    expect(request.knId).toBe("supply");
    expect(request.message).toContain("executionFactory.cypherFunction.ai.message.shapeValue");
    expect(request.message).toContain("$code (string): 供应商编码");

    fireEvent.click(await screen.findByText("executionFactory.cypherFunction.ai.apply"));
    await waitFor(() => expect(statementEditor().value).toBe(generated));

    fireEvent.click(screen.getByText("common.save"));
    await waitFor(() => expect(createTool).toHaveBeenCalledTimes(1));
    const [, created] = createTool.mock.calls[0] as [string, { functionInput?: unknown }];
    // The author's description stays; the new parameter takes the Agent's type and words.
    expect(created.functionInput).toMatchObject({
      code: generated,
      inputs: [
        { name: "code", type: "string", description: "供应商编码", example: "S1" },
        { name: "min", type: "number", description: "最小数量", example: 5 },
      ],
    });
  });

  it("keeps a saved Cypher function a Cypher function when it is edited", async () => {
    listTools.mockResolvedValue({
      items: [{ toolId: "tool-1", name: "po_count", status: "enabled" }],
      total: 1,
      page: 1,
      pageSize: 50,
      boxId: "box-1",
    });
    getToolDetail.mockResolvedValue({
      toolId: "tool-1",
      name: "po_count",
      description: "采购单数",
      status: "enabled",
      functionInput: {
        code: STATEMENT,
        script_type: "cypher",
        kn_id: "kn-1",
        result_shape: "table",
        inputs: [{ name: "code", type: "string", required: true, description: "供应商编码" }],
        outputs: [],
        dependencies: [],
      },
    });
    render(<FunctionWorkbenchScene boxId="box-1" />);
    await waitFor(() => expect(statementEditor().value).toBe(STATEMENT));
    // Python's templates have no place in a Cypher function.
    expect(screen.queryByText("executionFactory.functionInsertTemplate")).toBeNull();

    // A saved function says how to call it, here where a function toolbox opens.
    fireEvent.click(screen.getByText("executionFactory.callGuide.open"));
    expect(await screen.findByText("executionFactory.callGuide.responseCypherTable")).toBeTruthy();
    expect(screen.getAllByText(/\/tool-box\/box-1\/proxy\/tool-1/).length).toBeGreaterThan(0);

    fireEvent.change(statementEditor(), { target: { value: `${STATEMENT} LIMIT 1` } });
    fireEvent.click(screen.getByText("common.save"));

    await waitFor(() => expect(updateTool).toHaveBeenCalledTimes(1));
    const [, , updated] = updateTool.mock.calls[0] as [string, string, { functionInput?: unknown }];
    expect(updated.functionInput).toMatchObject({
      code: `${STATEMENT} LIMIT 1`,
      script_type: "cypher",
      kn_id: "kn-1",
      result_shape: "table",
      inputs: [{ name: "code", type: "string", required: true, description: "供应商编码" }],
    });
  });

  it("lets an API-only editor read a Cypher function and how to call it, but not change it", async () => {
    grants.current = ["execution-factory:toolbox:edit", "execution-factory:function:view"];
    listTools.mockResolvedValue({
      items: [{ toolId: "tool-1", name: "po_count", status: "enabled" }],
      total: 1,
      page: 1,
      pageSize: 50,
      boxId: "box-1",
    });
    getToolDetail.mockResolvedValue({
      toolId: "tool-1",
      name: "po_count",
      description: "采购单数",
      status: "enabled",
      functionInput: {
        code: STATEMENT,
        script_type: "cypher",
        kn_id: "kn-1",
        result_shape: "value",
        inputs: [{ name: "code", type: "string", required: true, description: "供应商编码" }],
        outputs: [],
        dependencies: [],
      },
    });
    render(<FunctionWorkbenchScene boxId="box-1" />);
    await waitFor(() => expect(statementEditor().value).toBe(STATEMENT));

    expect(screen.queryByText("common.save")).toBeNull();
    expect(screen.queryByText("executionFactory.cypherFunction.ai.open")).toBeNull();
    fireEvent.click(screen.getByText("executionFactory.callGuide.open"));
    expect(await screen.findByText("executionFactory.callGuide.responseCypherValue")).toBeTruthy();
  });
});
