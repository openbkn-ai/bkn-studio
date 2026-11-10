/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { type PropsWithChildren, type ReactNode, useEffect } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

type StepAction = { onClick: () => void; text: string };

const mocks = vi.hoisted(() => {
  const locationState: { current: unknown } = { current: null };
  const locationSearch = { current: "" };
  const executionValue: { current: unknown } = { current: undefined };
  const routeParams: { current: Record<string, string> } = {
    current: { networkId: "network-1" },
  };
  return {
    confirm: vi.fn(),
    createActionType: vi.fn(),
    executionValue,
    getActionTypeDetail: vi.fn(),
    getObjectType: vi.fn(),
    getObjectTypeDetail: vi.fn(),
    listRelations: vi.fn(),
    getRelation: vi.fn(),
    listObjectTypePage: vi.fn(),
    locationState,
    locationSearch,
    navigate: vi.fn(),
    // Stable, as the real one is: the form reads again when it changes.
    translate: (key: string, options?: { objectTypeName?: string; role?: string }) => {
      if (key === "knowledgeNetwork.actionRelationObjectWithRole") {
        return `${options?.objectTypeName} (${options?.role})`;
      }
      if (
        (key === "knowledgeNetwork.actionRelationCurrentCondition" ||
          key === "knowledgeNetwork.actionRelationOtherCondition" ||
          key === "knowledgeNetwork.actionTypeApplicableConditionHint" ||
          key === "knowledgeNetwork.actionTypeExecutionCreateHint" ||
          key === "knowledgeNetwork.actionTypeExecutionUpdateHint" ||
          key === "knowledgeNetwork.actionTypeExecutionDeleteHint" ||
          key === "knowledgeNetwork.actionTypeImpactStaticHint") &&
        options?.objectTypeName
      ) {
        return `${key}:${options.objectTypeName}`;
      }
      return key;
    },
    routeParams,
    updateActionType: vi.fn(),
    validateExecution: vi.fn<(...args: unknown[]) => string | null>(() => null),
  };
});

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: mocks.translate }),
}));

vi.mock("react-router-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router-dom")>()),
  useLocation: () => ({
    state: mocks.locationState.current,
    search: mocks.locationSearch.current,
    pathname: "/knowledge-network/workspace/network-1/action-types/create",
  }),
  useNavigate: () => mocks.navigate,
  useParams: () => mocks.routeParams.current,
}));

vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({
    message: { error: vi.fn(), success: vi.fn() },
    modal: { confirm: mocks.confirm },
  }),
}));

vi.mock("@/modules/knowledge-network/services/knowledge-network.service", () => ({
  createKnowledgeNetworkActionType: mocks.createActionType,
  getKnowledgeNetworkActionTypeDetail: mocks.getActionTypeDetail,
  getKnowledgeNetworkObjectType: mocks.getObjectType,
  getKnowledgeNetworkObjectTypeDetail: mocks.getObjectTypeDetail,
  listKnowledgeNetworkObjectTypePage: mocks.listObjectTypePage,
  updateKnowledgeNetworkActionType: mocks.updateActionType,
}));

vi.mock("@/modules/knowledge-network/services/relation-type.service", () => ({
  listKnowledgeNetworkRelationTypePage: mocks.listRelations,
  getKnowledgeNetworkRelationTypeDetail: mocks.getRelation,
}));
vi.mock("@/modules/knowledge-network/services/action-type.service", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@/modules/knowledge-network/services/action-type.service")
  >()),
  canPersistActionTypeOperation: () => true,
  canPersistActionTypeCondition: () => true,
}));

// The execution and condition editors are tested on their own; here they accept anything.
vi.mock("@/modules/knowledge-network/components/action-type/ActionTypeExecutionEditor", () => ({
  ACTION_TYPE_EXECUTION_TOOL_REQUIRED_KEY: "tool-required",
  ActionTypeExecutionEditor: ({
    onParameterSchemaStateChange,
    value,
  }: {
    onParameterSchemaStateChange?: (state: { loaded: boolean; parameterCount: number }) => void;
    value: unknown;
  }) => {
    mocks.executionValue.current = value;
    // A tool without parameters, as the real editor reports once it has read the tool.
    useEffect(
      () => onParameterSchemaStateChange?.({ loaded: true, parameterCount: 0 }),
      [onParameterSchemaStateChange],
    );
    return <div data-testid="action-execution-editor" />;
  },
  createDefaultActionTypeExecutionConfig: () => ({}),
  normalizeActionTypeExecutionConfig: (value: unknown) => value,
  validateActionTypeExecutionConfig: (...args: unknown[]) => mocks.validateExecution(...args),
}));

vi.mock("@/modules/knowledge-network/components/action-type/ActionTypeConditionEditor", () => ({
  ActionTypeConditionEditor: () => null,
}));

vi.mock(
  "@/modules/knowledge-network/components/relation-type/RelationTypeObjectTypeSelect",
  () => ({
    RelationTypeObjectTypeSelect: ({
      objectTypes,
      onChange,
      value,
    }: {
      objectTypes: { id: string; name: string }[];
      onChange?: (value: string) => void;
      value?: string;
    }) => (
      <select
        aria-label="object type"
        onChange={(event) => onChange?.(event.target.value)}
        value={value ?? ""}
      >
        <option value="" />
        {objectTypes.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
      </select>
    ),
  }),
);

vi.mock("@/modules/knowledge-network/components/shared/ResourceFormStepsShell", () => ({
  ResourceFormStepsShell: ({
    actions,
    children,
    onBack,
    title,
  }: PropsWithChildren<{
    actions?: { cancel?: StepAction; save?: StepAction };
    onBack: () => void;
    title: ReactNode;
  }>) => (
    <div>
      <h1>{title}</h1>
      <button onClick={onBack} type="button">
        back
      </button>
      {actions?.save ? (
        <button onClick={actions.save.onClick} type="button">
          {actions.save.text}
        </button>
      ) : null}
      {children}
    </div>
  ),
}));

vi.mock("@/modules/knowledge-network/components/shared/ResourceColorSelect", () => ({
  DEFAULT_RESOURCE_COLOR: "#1677ff",
  ResourceColorSelect: () => <input aria-label="color" />,
}));

vi.mock("@/modules/knowledge-network/components/shared/ResourceTagsSelect", () => ({
  ResourceTagsSelect: () => <input aria-label="tags" />,
  validateKnowledgeNetworkTags: () => Promise.resolve(),
}));

import { renderWithoutAntdStyles } from "@/test/render-without-antd-styles";

import { ActionTypeFormScene } from "./ActionTypeFormScene";

const context = {
  title: "The project needs Reschedule order",
  description: "Moves the promised date",
  prefill: {
    description: "Moves the promised date",
    name: "Reschedule order",
    objectTypeId: "late",
  },
  returnTo: "/bkn-project/p1/kinetic",
  returnLabel: "Back to kinetic modeling",
  returnState: { needId: "n3" },
};

const firstPage = [{ id: "orders", name: "Orders" }];
const listPath = "/knowledge-network/workspace/network-1/action-types";

beforeAll(() => {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    addEventListener: vi.fn(),
    addListener: vi.fn(),
    dispatchEvent: vi.fn(),
    matches: false,
    media: query,
    onchange: null,
    removeEventListener: vi.fn(),
    removeListener: vi.fn(),
  }));
});

beforeEach(() => {
  mocks.locationState.current = null;
  mocks.locationSearch.current = "";
  mocks.routeParams.current = { networkId: "network-1" };
  mocks.listObjectTypePage.mockResolvedValue({ entries: firstPage, totalCount: 30 });
  mocks.getObjectType.mockResolvedValue({ id: "late", name: "Late orders" });
  mocks.getObjectTypeDetail.mockResolvedValue({ dataProperties: [] });
  mocks.listRelations.mockResolvedValue({ entries: [], totalCount: 0 });
  mocks.getRelation.mockResolvedValue({
    id: "order_supplier",
    name: "Supplied by",
    sourceObjectTypeId: "orders",
    sourceObjectTypeName: "Order",
    targetObjectTypeId: "suppliers",
    targetObjectTypeName: "Supplier",
  });
  mocks.confirm.mockImplementation(({ onOk }: { onOk: () => void }) => onOk());
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

/** The target object stays visible while the operation changes. */
async function getTargetObjectSelect() {
  return (await screen.findAllByLabelText("object type"))[0];
}

describe("ActionTypeFormScene navigation context", () => {
  it("keeps the chosen creation entry without offering an in-form type switch", async () => {
    mocks.locationState.current = { actionTypeContext: context };
    renderWithoutAntdStyles(<ActionTypeFormScene mode="create" />);
    expect(await screen.findByDisplayValue("Reschedule order")).toBeInTheDocument();
    await waitFor(async () => expect(await getTargetObjectSelect()).toHaveValue("late"));
    expect(
      screen.queryByRole("button", { name: "knowledgeNetwork.actionOperationChange" }),
    ).toBeNull();
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it("opens a legacy relationship route in the shared object form with five operations", async () => {
    mocks.locationSearch.current = "?operation=relation";
    renderWithoutAntdStyles(<ActionTypeFormScene mode="create" />);
    expect(await screen.findByLabelText("knowledgeNetwork.actionRelationType")).toBeInTheDocument();
    expect(screen.queryByLabelText("knowledgeNetwork.actionRelationSourceParameter")).toBeNull();
    expect(screen.queryByLabelText("knowledgeNetwork.actionRelationTargetParameter")).toBeNull();
    expect(
      screen
        .getByLabelText("knowledgeNetwork.actionRelationType")
        .compareDocumentPosition(screen.getByTestId("action-execution-editor")) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      screen.getByRole("radio", { name: "knowledgeNetwork.actionRelationCreate" }),
    ).toBeChecked();
    expect(screen.getByLabelText("object type")).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: "knowledgeNetwork.actionRelationType" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("radio", { name: /knowledgeNetwork.actionTypeInstanceOperationCreate/ }),
    ).toBeInTheDocument();
  });

  it("shows relationship selection after choosing a relationship operation and hides it for instance operations", async () => {
    mocks.locationState.current = { actionTypeInitialObjectTypeId: "orders" };
    renderWithoutAntdStyles(<ActionTypeFormScene mode="create" />);
    expect(await getTargetObjectSelect()).toHaveValue("orders");
    expect(screen.queryByLabelText("knowledgeNetwork.actionRelationType")).toBeNull();
    fireEvent.click(screen.getByRole("radio", { name: "knowledgeNetwork.actionRelationCreate" }));
    expect(
      screen.getByRole("combobox", { name: "knowledgeNetwork.actionRelationType" }),
    ).toBeEnabled();
    await waitFor(() =>
      expect(mocks.listRelations).toHaveBeenCalledWith(
        "network-1",
        expect.objectContaining({ boundObjectTypeId: "orders" }),
      ),
    );
    fireEvent.click(
      screen.getByRole("radio", { name: /knowledgeNetwork.actionTypeInstanceOperationUpdate/ }),
    );
    expect(screen.queryByLabelText("knowledgeNetwork.actionRelationType")).toBeNull();
    expect(await getTargetObjectSelect()).toHaveValue("orders");
  });

  it("keeps the chosen object, inferred endpoint role and both condition scopes when editing a relationship", async () => {
    mocks.routeParams.current = { actionTypeId: "a-rel", networkId: "network-1" };
    mocks.listObjectTypePage.mockResolvedValue({
      entries: [...firstPage, { id: "suppliers", name: "Supplier" }],
      totalCount: 2,
    });
    const condition = {
      objectTypeId: "suppliers",
      field: "status",
      operation: "==",
      value: "active",
    };
    const otherCondition = {
      objectTypeId: "orders",
      field: "status",
      operation: "==",
      value: "open",
    };
    mocks.getActionTypeDetail.mockResolvedValue({
      id: "a-rel",
      name: "Unlink supplier",
      actionKind: "create",
      objectTypeId: "suppliers",
      color: "#1677ff",
      description: "",
      tags: [],
      condition,
      operationConfig: {
        type: "relation",
        relationTypeId: "order_supplier",
        relationOperation: "delete",
        anchorRole: "target",
        otherObjectCondition: otherCondition,
      },
      executionConfig: {
        sourceType: "tool",
        sourceName: "Unlink",
        parameters: [
          { name: "order_id", valueFrom: "source_identity" },
          { name: "supplier_id", valueFrom: "target_identity" },
        ],
      },
    });
    mocks.updateActionType.mockResolvedValue(undefined);
    renderWithoutAntdStyles(<ActionTypeFormScene mode="edit" />);
    expect(await screen.findByDisplayValue("Unlink supplier")).toBeInTheDocument();
    expect(
      (await screen.findByText("Supplier", { selector: "strong" })).closest("label"),
    ).toHaveTextContent("knowledgeNetwork.actionRelationCurrentCondition:Supplier");
    expect(
      (await screen.findByText("Orders", { selector: "strong" })).closest("label"),
    ).toHaveTextContent("knowledgeNetwork.actionRelationOtherCondition:Orders");
    expect(
      screen.getByRole("radio", { name: "knowledgeNetwork.actionRelationDelete" }),
    ).toBeChecked();
    expect(screen.getByLabelText("object type")).toHaveValue("suppliers");
    fireEvent.click(screen.getByRole("button", { name: "knowledgeNetwork.actionTypeSaveAndExit" }));
    await waitFor(() =>
      expect(mocks.updateActionType).toHaveBeenCalledWith(
        "network-1",
        "a-rel",
        expect.objectContaining({
          objectTypeId: "suppliers",
          condition: expect.objectContaining({
            objectTypeId: "suppliers",
            value: "active",
          }) as unknown,
          operationConfig: expect.objectContaining({
            type: "relation",
            relationOperation: "delete",
            anchorRole: "target",
            otherObjectCondition: expect.objectContaining({
              objectTypeId: "orders",
              value: "open",
            }) as unknown,
          }) as unknown,
        }),
      ),
    );
    fireEvent.change(screen.getByLabelText("object type"), { target: { value: "orders" } });
    expect(screen.queryByText(/knowledgeNetwork.actionRelationOtherCondition:/)).toBeNull();
    fireEvent.click(
      screen.getByRole("radio", { name: /knowledgeNetwork.actionTypeInstanceOperationUpdate/ }),
    );
    expect(screen.queryByLabelText("knowledgeNetwork.actionRelationType")).toBeNull();
    expect(screen.queryByText(/knowledgeNetwork.actionRelationOtherCondition:/)).toBeNull();
    expect(mocks.executionValue.current).toMatchObject({
      parameters: [
        expect.objectContaining({ valueFrom: "input" }),
        expect.objectContaining({ valueFrom: "input" }),
      ],
    });
    mocks.updateActionType.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "knowledgeNetwork.actionTypeSaveAndExit" }));
    await waitFor(() =>
      expect(mocks.updateActionType).toHaveBeenCalledWith(
        "network-1",
        "a-rel",
        expect.objectContaining({
          objectTypeId: "orders",
          actionKind: "update",
          condition: undefined,
          operationConfig: { type: "object" },
        }),
      ),
    );
  });

  it("places the single aliases field below the action name and above tags", async () => {
    renderWithoutAntdStyles(<ActionTypeFormScene mode="create" />);

    const name = await screen.findByLabelText("knowledgeNetwork.actionTypeName");
    const aliases = screen.getByRole("combobox", {
      name: "knowledgeNetwork.definitionDeclarations.aliases",
    });
    const tags = screen.getByText("common.tag");

    expect(name.compareDocumentPosition(aliases) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(aliases.compareDocumentPosition(tags) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(
      screen.getAllByRole("combobox", { name: "knowledgeNetwork.definitionDeclarations.aliases" }),
    ).toHaveLength(1);
  });

  it("prefills the selected graph object when creating an object action", async () => {
    mocks.locationState.current = { actionTypeInitialObjectTypeId: "late" };

    renderWithoutAntdStyles(<ActionTypeFormScene mode="create" />);

    await waitFor(() => expect(mocks.getObjectType).toHaveBeenCalledWith("network-1", "late"));
    expect((await screen.findAllByLabelText("object type"))[0]).toHaveValue("late");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it.each([
    ["create", "knowledgeNetwork.actionTypeInstanceOperationCreate"],
    ["update", "knowledgeNetwork.actionTypeInstanceOperationUpdate"],
    ["delete", "knowledgeNetwork.actionTypeInstanceOperationDelete"],
  ])("creates a %s action for the selected object type", async (kind, label) => {
    mocks.locationState.current = { actionTypeInitialObjectTypeId: "orders" };
    mocks.createActionType.mockResolvedValue({ id: "action-new" });

    renderWithoutAntdStyles(<ActionTypeFormScene mode="create" />);

    fireEvent.click(await screen.findByRole("radio", { name: new RegExp(label) }));
    fireEvent.change(screen.getAllByPlaceholderText("knowledgeNetwork.pleaseInput")[0], {
      target: { value: "Manage order" },
    });
    fireEvent.click(screen.getByRole("button", { name: "knowledgeNetwork.actionTypeSaveAndExit" }));

    await waitFor(() =>
      expect(mocks.createActionType).toHaveBeenCalledWith(
        "network-1",
        expect.objectContaining({ actionKind: kind, objectTypeId: "orders" }),
      ),
    );
  });

  it("creates an independent action without object-only rules", async () => {
    mocks.locationState.current = {
      actionTypeCreateMode: "independent",
      actionTypeInitialObjectTypeId: "orders",
    };
    mocks.createActionType.mockResolvedValue({ id: "action-independent" });

    renderWithoutAntdStyles(<ActionTypeFormScene mode="create" />);

    expect(
      await screen.findByRole("heading", {
        name: "knowledgeNetwork.actionTypeCreateTitle · knowledgeNetwork.actionOperationTool",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("object type")).toBeNull();
    expect(
      screen.queryByRole("radio", {
        name: /knowledgeNetwork.actionTypeInstanceOperationCreate/,
      }),
    ).toBeNull();
    expect(screen.queryByText("knowledgeNetwork.actionTypeApplicableCondition")).toBeNull();
    expect(screen.queryByText("knowledgeNetwork.actionTypeAdditionalImpact")).toBeNull();
    expect(screen.queryByText("knowledgeNetwork.actionOperationToolExecutionHint")).toBeNull();

    fireEvent.change(screen.getAllByPlaceholderText("knowledgeNetwork.pleaseInput")[0], {
      target: { value: "Send notification" },
    });
    fireEvent.click(screen.getByRole("button", { name: "knowledgeNetwork.actionTypeSaveAndExit" }));

    await waitFor(() =>
      expect(mocks.createActionType).toHaveBeenCalledWith(
        "network-1",
        expect.objectContaining({
          actionKind: "create",
          affect: undefined,
          condition: undefined,
          name: "Send notification",
          objectTypeId: "",
        }),
      ),
    );
  });

  it("connects each instance operation to its applicable rules and tool guidance", async () => {
    mocks.locationState.current = { actionTypeInitialObjectTypeId: "orders" };

    renderWithoutAntdStyles(<ActionTypeFormScene mode="create" />);

    expect(await getTargetObjectSelect()).toHaveValue("orders");
    expect(screen.queryByText("knowledgeNetwork.actionTypeApplicableCondition")).toBeNull();
    expect(
      screen.getByText(/knowledgeNetwork.actionTypeExecutionCreateHint:/).querySelector("strong"),
    ).toHaveTextContent("Orders");
    expect(
      screen.getByText(/knowledgeNetwork.actionTypeImpactStaticHint:/).querySelector("strong"),
    ).toHaveTextContent("Orders");
    expect(screen.queryByText("knowledgeNetwork.actionTypeFlowExpectedCreate")).toBeNull();

    fireEvent.click(
      screen.getByRole("radio", {
        name: /knowledgeNetwork.actionTypeInstanceOperationUpdate/,
      }),
    );
    expect(
      await screen.findByText("knowledgeNetwork.actionTypeApplicableCondition"),
    ).toBeInTheDocument();
    expect(
      screen
        .getByText(/knowledgeNetwork.actionTypeApplicableConditionHint:/)
        .querySelector("strong"),
    ).toHaveTextContent("Orders");
    expect(
      screen.getByText(/knowledgeNetwork.actionTypeExecutionUpdateHint:/).querySelector("strong"),
    ).toHaveTextContent("Orders");

    fireEvent.click(
      screen.getByRole("radio", {
        name: /knowledgeNetwork.actionTypeInstanceOperationDelete/,
      }),
    );
    expect(
      screen.getByText(/knowledgeNetwork.actionTypeExecutionDeleteHint:/).querySelector("strong"),
    ).toHaveTextContent("Orders");
    expect(await getTargetObjectSelect()).toHaveValue("orders");
  });

  it("states the need and fills the form, fetching an object type past the first page", async () => {
    mocks.locationState.current = { actionTypeContext: context };

    renderWithoutAntdStyles(<ActionTypeFormScene mode="create" />);

    expect(await screen.findByText(context.title)).toBeInTheDocument();
    expect(
      screen.getByText(context.description, { selector: ".ant-alert-description" }),
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue("Reschedule order")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Moves the promised date")).toBeInTheDocument();
    await waitFor(() => expect(mocks.getObjectType).toHaveBeenCalledWith("network-1", "late"));
    expect(await getTargetObjectSelect()).toHaveValue("late");
    expect(screen.getByRole("option", { name: "Late orders" })).toBeInTheDocument();
  });

  it("starts the execution with what the caller says carries the action out, and says its notice", async () => {
    mocks.locationState.current = {
      actionTypeContext: {
        ...context,
        notice: "Implement Reschedule API first.",
        prefill: {
          ...context.prefill,
          execution: { mcpId: "mcp-1", toolId: "reschedule", toolName: "Reschedule", type: "mcp" },
        },
      },
    };

    renderWithoutAntdStyles(<ActionTypeFormScene mode="create" />);

    expect(await screen.findByText("Implement Reschedule API first.")).toBeInTheDocument();
    expect(
      screen.getByText(context.description, { selector: ".ant-alert-description div" }),
    ).toBeInTheDocument();
    fireEvent.click(await screen.findByText("knowledgeNetwork.actionTypeExecutionTool"));
    await waitFor(() =>
      expect(mocks.executionValue.current).toMatchObject({
        actionSource: { mcpId: "mcp-1", toolId: "reschedule", toolName: "Reschedule", type: "mcp" },
        sourceName: "Reschedule",
        sourceType: "mcp",
      }),
    );
  });

  it("leaves to the caller with its state, from the alert and from the unsaved-leave confirm", async () => {
    mocks.locationState.current = { actionTypeContext: context };

    renderWithoutAntdStyles(<ActionTypeFormScene mode="create" />);

    fireEvent.click(await screen.findByRole("button", { name: context.returnLabel }));
    expect(mocks.navigate).toHaveBeenLastCalledWith(context.returnTo, {
      state: context.returnState,
    });

    fireEvent.click(screen.getByRole("button", { name: "back" }));
    expect(mocks.confirm).toHaveBeenCalledTimes(1);
    expect(mocks.navigate).toHaveBeenCalledTimes(2);
    expect(mocks.navigate).toHaveBeenLastCalledWith(context.returnTo, {
      state: context.returnState,
    });
  });

  it("returns with the new action type once saved", async () => {
    mocks.locationState.current = { actionTypeContext: context };
    mocks.createActionType.mockResolvedValue({ id: "a-7" });

    renderWithoutAntdStyles(<ActionTypeFormScene mode="create" />);
    await getTargetObjectSelect();
    fireEvent.click(screen.getByRole("button", { name: "knowledgeNetwork.actionTypeSaveAndExit" }));

    await waitFor(() =>
      expect(mocks.createActionType).toHaveBeenCalledWith(
        "network-1",
        expect.objectContaining({
          description: "Moves the promised date",
          name: "Reschedule order",
          objectTypeId: "late",
        }),
      ),
    );
    await waitFor(() =>
      expect(mocks.navigate).toHaveBeenCalledWith(context.returnTo, {
        state: { needId: "n3", actionTypeCreated: { id: "a-7" } },
      }),
    );
  });

  it("creates without a context as before: no alert, empty form, back to the list", async () => {
    mocks.createActionType.mockResolvedValue({ id: "a-8" });

    renderWithoutAntdStyles(<ActionTypeFormScene mode="create" />);

    const select = await getTargetObjectSelect();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(select).toHaveValue("");
    expect(mocks.getObjectType).not.toHaveBeenCalled();
    // The name comes first of the inputs that ask to be filled in.
    fireEvent.change(screen.getAllByPlaceholderText("knowledgeNetwork.pleaseInput")[0], {
      target: { value: "Cancel order" },
    });
    fireEvent.change(select, { target: { value: "orders" } });
    fireEvent.click(screen.getByRole("button", { name: "knowledgeNetwork.actionTypeSaveAndExit" }));

    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith(listPath));
  });

  it("ignores a context in edit mode and returns to the list after saving", async () => {
    mocks.locationState.current = { actionTypeContext: context };
    mocks.routeParams.current = { actionTypeId: "a-1", networkId: "network-1" };
    mocks.getActionTypeDetail.mockResolvedValue({
      actionKind: "update",
      color: "#1677ff",
      condition: null,
      description: "Existing",
      executionConfig: {},
      id: "a-1",
      name: "Existing action",
      objectTypeId: "orders",
      tags: [],
    });
    mocks.updateActionType.mockResolvedValue(undefined);

    renderWithoutAntdStyles(<ActionTypeFormScene mode="edit" />);

    expect(await screen.findByDisplayValue("Existing action")).toBeInTheDocument();
    expect(screen.queryByText(context.title)).toBeNull();
    expect(screen.queryByRole("button", { name: context.returnLabel })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "knowledgeNetwork.actionTypeSaveAndExit" }));

    await waitFor(() =>
      expect(mocks.updateActionType).toHaveBeenCalledWith(
        "network-1",
        "a-1",
        expect.objectContaining({ name: "Existing action" }),
      ),
    );
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith(listPath));
  });

  it("recognizes an existing object-free action as independent when editing", async () => {
    mocks.routeParams.current = { actionTypeId: "independent-1", networkId: "network-1" };
    mocks.getActionTypeDetail.mockResolvedValue({
      actionKind: "create",
      color: "#1677ff",
      condition: null,
      description: "Runs nightly reconciliation",
      executionConfig: {},
      id: "independent-1",
      name: "Reconcile accounts",
      objectTypeId: "",
      tags: [],
    });

    renderWithoutAntdStyles(<ActionTypeFormScene mode="edit" />);

    expect(await screen.findByDisplayValue("Reconcile accounts")).toBeInTheDocument();
    expect(screen.queryByLabelText("object type")).toBeNull();
    expect(screen.getByText("knowledgeNetwork.actionOperationConfiguration")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "knowledgeNetwork.actionTypeSaveAndExit" }));

    await waitFor(() =>
      expect(mocks.updateActionType).toHaveBeenCalledWith(
        "network-1",
        "independent-1",
        expect.objectContaining({
          affect: undefined,
          condition: undefined,
          objectTypeId: "",
        }),
      ),
    );
  });
});

describe("ActionTypeFormScene rule panels", () => {
  it("retains an existing condition when editing a create action", async () => {
    mocks.routeParams.current = { actionTypeId: "a-1", networkId: "network-1" };
    const condition = { field: "status", objectTypeId: "orders", operation: "==", value: "open" };
    mocks.getActionTypeDetail.mockResolvedValue({
      actionKind: "create",
      color: "#1677ff",
      condition,
      description: "Existing",
      executionConfig: {},
      id: "a-1",
      name: "Existing create action",
      objectTypeId: "orders",
      tags: [],
    });
    mocks.updateActionType.mockResolvedValue(undefined);

    renderWithoutAntdStyles(<ActionTypeFormScene mode="edit" />);

    expect(
      await screen.findByText("knowledgeNetwork.actionTypeApplicableCondition"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "knowledgeNetwork.actionTypeSaveAndExit" }));

    await waitFor(() =>
      expect(mocks.updateActionType).toHaveBeenCalledWith(
        "network-1",
        "a-1",
        expect.objectContaining({
          condition: expect.objectContaining({ field: "status" }) as unknown,
        }),
      ),
    );
  });

  it("keeps what the collapsed rule panels hold when saving without opening them", async () => {
    mocks.routeParams.current = { actionTypeId: "a-1", networkId: "network-1" };
    const condition = { field: "status", objectTypeId: "orders", operation: "==", value: "open" };
    mocks.getActionTypeDetail.mockResolvedValue({
      actionKind: "update",
      affect: { comment: "Closes the order", objectTypeId: "orders" },
      color: "#1677ff",
      condition,
      description: "Existing",
      executionConfig: {},
      id: "a-1",
      name: "Existing action",
      objectTypeId: "orders",
      tags: [],
    });
    mocks.updateActionType.mockResolvedValue(undefined);

    renderWithoutAntdStyles(<ActionTypeFormScene mode="edit" />);

    expect(await screen.findByDisplayValue("Existing action")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "knowledgeNetwork.actionTypeSaveAndExit" }));

    await waitFor(() =>
      expect(mocks.updateActionType).toHaveBeenCalledWith(
        "network-1",
        "a-1",
        expect.objectContaining({
          actionKind: "update",
          affect: { comment: "Closes the order", objectTypeId: "orders" },
          condition: expect.objectContaining({ field: "status", value: "open" }) as unknown,
          objectTypeId: "orders",
        }),
      ),
    );
  });

  it("knows the tool takes no parameters when saving without opening the execution unit", async () => {
    mocks.routeParams.current = { actionTypeId: "a-1", networkId: "network-1" };
    mocks.getActionTypeDetail.mockResolvedValue({
      actionKind: "update",
      color: "#1677ff",
      condition: null,
      description: "Existing",
      executionConfig: {},
      id: "a-1",
      name: "Existing action",
      objectTypeId: "orders",
      tags: [],
    });
    mocks.updateActionType.mockResolvedValue(undefined);

    renderWithoutAntdStyles(<ActionTypeFormScene mode="edit" />);

    expect(await screen.findByDisplayValue("Existing action")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "knowledgeNetwork.actionTypeSaveAndExit" }));

    await waitFor(() => expect(mocks.updateActionType).toHaveBeenCalled());
    expect(mocks.validateExecution).toHaveBeenCalledWith(expect.anything(), {
      allowEmptyParameters: true,
    });
  });

  it("shows the visible target object error when none is selected", async () => {
    renderWithoutAntdStyles(<ActionTypeFormScene mode="create" />);

    fireEvent.change((await screen.findAllByPlaceholderText("knowledgeNetwork.pleaseInput"))[0], {
      target: { value: "Cancel order" },
    });
    fireEvent.click(screen.getByRole("button", { name: "knowledgeNetwork.actionTypeSaveAndExit" }));

    expect(await screen.findByText("knowledgeNetwork.actionTypeObjectRequired")).toBeVisible();
    expect(await getTargetObjectSelect()).toHaveValue("");
    expect(mocks.createActionType).not.toHaveBeenCalled();
  });
});
