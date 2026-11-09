/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import type { PropsWithChildren, ReactNode } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

type StepAction = { onClick: () => void; text: string };

const mocks = vi.hoisted(() => {
  const locationState: { current: unknown } = { current: null };
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
    listObjectTypePage: vi.fn(),
    locationState,
    navigate: vi.fn(),
    // Stable, as the real one is: the form reads again when it changes.
    translate: (key: string) => key,
    routeParams,
    updateActionType: vi.fn(),
  };
});

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: mocks.translate }),
}));

vi.mock("react-router-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router-dom")>()),
  useLocation: () => ({ state: mocks.locationState.current }),
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
  getKnowledgeNetworkObjectTypeDetail: vi.fn().mockResolvedValue({ dataProperties: [] }),
  listKnowledgeNetworkObjectTypePage: mocks.listObjectTypePage,
  updateKnowledgeNetworkActionType: mocks.updateActionType,
}));

// The execution and condition editors are tested on their own; here they accept anything.
vi.mock("@/modules/knowledge-network/components/action-type/ActionTypeExecutionEditor", () => ({
  ACTION_TYPE_EXECUTION_TOOL_REQUIRED_KEY: "tool-required",
  ActionTypeExecutionEditor: ({ value }: { value: unknown }) => {
    mocks.executionValue.current = value;
    return null;
  },
  createDefaultActionTypeExecutionConfig: () => ({}),
  normalizeActionTypeExecutionConfig: (value: unknown) => value,
  validateActionTypeExecutionConfig: () => null,
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
  mocks.routeParams.current = { networkId: "network-1" };
  mocks.listObjectTypePage.mockResolvedValue({ entries: firstPage, totalCount: 30 });
  mocks.getObjectType.mockResolvedValue({ id: "late", name: "Late orders" });
  mocks.confirm.mockImplementation(({ onOk }: { onOk: () => void }) => onOk());
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

/** Opens the trigger rule, where the object type is chosen. */
async function openTrigger() {
  fireEvent.click(await screen.findByText("knowledgeNetwork.actionTypeTriggerRule"));
  // The impact declaration has an object type select of its own, after this one.
  return (await screen.findAllByLabelText("object type"))[0];
}

describe("ActionTypeFormScene navigation context", () => {
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
    expect(await openTrigger()).toHaveValue("late");
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
    await openTrigger();
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

    const select = await openTrigger();
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
      actionKind: "modify",
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
});

describe("ActionTypeFormScene rule panels", () => {
  it("keeps what the collapsed rule panels hold when saving without opening them", async () => {
    mocks.routeParams.current = { actionTypeId: "a-1", networkId: "network-1" };
    const condition = { field: "status", objectTypeId: "orders", operation: "==", value: "open" };
    mocks.getActionTypeDetail.mockResolvedValue({
      actionKind: "modify",
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
          actionKind: "modify",
          affect: { comment: "Closes the order", objectTypeId: "orders" },
          condition: expect.objectContaining({ field: "status", value: "open" }) as unknown,
          objectTypeId: "orders",
        }),
      ),
    );
  });

  it("opens the trigger rule when its object type is missing on save", async () => {
    renderWithoutAntdStyles(<ActionTypeFormScene mode="create" />);

    fireEvent.change((await screen.findAllByPlaceholderText("knowledgeNetwork.pleaseInput"))[0], {
      target: { value: "Cancel order" },
    });
    fireEvent.click(screen.getByRole("button", { name: "knowledgeNetwork.actionTypeSaveAndExit" }));

    expect(await screen.findByText("knowledgeNetwork.actionTypeObjectRequired")).toBeVisible();
    expect(
      screen.getByRole("button", {
        expanded: true,
        name: /knowledgeNetwork.actionTypeTriggerRule/,
      }),
    ).toBeInTheDocument();
    expect(mocks.createActionType).not.toHaveBeenCalled();
  });
});
