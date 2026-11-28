/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({
    message: { error: vi.fn() },
    runtimeConfig: {
      auth: { tokenManager: { getAccessToken: () => "t", refreshAccessToken: vi.fn() } },
    },
  }),
}));

vi.mock("@/modules/knowledge-network/components/cypher/CypherEditor", () => ({
  CypherEditor: ({ onChange, value }: { onChange: (value: string) => void; value: string }) => (
    <textarea
      aria-label="statement"
      onChange={(event) => onChange(event.target.value)}
      value={value}
    />
  ),
}));

const runCypherQuery = vi.fn();
vi.mock("@/modules/knowledge-network/cypher/cypher-query.service", () => ({
  runCypherQuery: (...args: unknown[]) => runCypherQuery(...args) as unknown,
}));

vi.mock("@/modules/knowledge-network/services/network.service", () => ({
  getKnowledgeNetwork: () => Promise.resolve({ id: "net-1", identifier: "kn-1" }),
}));

vi.mock("antd", async (importOriginal) => {
  const actual = await importOriginal<typeof import("antd")>();
  return {
    ...actual,
    Drawer: ({
      children,
      footer,
      open,
    }: {
      children?: ReactNode;
      footer?: ReactNode;
      open?: boolean;
    }) =>
      open ? (
        <div>
          {children}
          {footer}
        </div>
      ) : null,
  };
});

import type {
  ObjectTypeDataProperty,
  ObjectTypeLogicProperty,
} from "@/modules/knowledge-network/types/knowledge-network";

import { ObjectTypeLogicAttributeEditDrawer } from "./ObjectTypeLogicAttributeEditDrawer";

const originalMatchMedia = window.matchMedia;

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

afterAll(() => {
  window.matchMedia = originalMatchMedia;
});

afterEach(() => {
  cleanup();
  runCypherQuery.mockReset();
});

describe("ObjectTypeLogicAttributeEditDrawer", () => {
  it("rejects a logic-property display name over 128 Unicode code points", async () => {
    const onOk = vi.fn();

    render(
      <ObjectTypeLogicAttributeEditDrawer
        allData={[]}
        attrInfo={{} as ObjectTypeLogicProperty}
        logicFields={[]}
        onClose={vi.fn()}
        onOk={onOk}
        open
      />,
    );

    fireEvent.change(
      await screen.findByLabelText("knowledgeNetwork.objectTypePropertyDisplayName"),
      { target: { value: "😀".repeat(129) } },
    );
    fireEvent.click(screen.getByRole("button", { name: "common.ok" }));

    expect(
      await screen.findByText("knowledgeNetwork.objectTypePropertyDisplayNameMaxLength"),
    ).not.toBeNull();
    expect(onOk).not.toHaveBeenCalled();
  });

  const person: ObjectTypeDataProperty[] = [
    {
      displayKey: false,
      displayName: "Person ID",
      incrementalKey: false,
      name: "pid",
      primaryKey: true,
      type: "string",
    },
  ];

  it("starts a new logic property from the instance by primary key, bound to it", async () => {
    const onOk = vi.fn();
    render(
      <ObjectTypeLogicAttributeEditDrawer
        allData={person}
        attrInfo={{} as ObjectTypeLogicProperty}
        logicFields={[]}
        networkId="net-1"
        objectTypeId=""
        onClose={vi.fn()}
        onOk={onOk}
        open
      />,
    );

    const statement = await screen.findByLabelText<HTMLTextAreaElement>("statement");
    expect(statement.value).toContain("n.pid = $id");
    fireEvent.change(screen.getByLabelText("knowledgeNetwork.objectTypePropertyName"), {
      target: { value: "age" },
    });
    fireEvent.click(screen.getByRole("button", { name: "common.ok" }));

    await waitFor(() => expect(onOk).toHaveBeenCalled());
    expect(onOk.mock.calls[0][0]).toMatchObject({
      dataSource: { type: "cypher" },
      parameters: [{ name: "id", value: "pid", valueFrom: "property" }],
      type: "cypher",
    });
  });

  it("shows the explain error of a saved object type in place and does not save", async () => {
    const onOk = vi.fn();
    runCypherQuery.mockResolvedValue({
      error: { message: "line 1, column 3: bad statement" },
      exchange: {},
      ok: false,
    });
    render(
      <ObjectTypeLogicAttributeEditDrawer
        allData={person}
        attrInfo={{} as ObjectTypeLogicProperty}
        logicFields={[]}
        networkId="net-1"
        objectTypeId="person"
        onClose={vi.fn()}
        onOk={onOk}
        open
      />,
    );

    await screen.findByLabelText("statement");
    fireEvent.change(screen.getByLabelText("knowledgeNetwork.objectTypePropertyName"), {
      target: { value: "age" },
    });
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "knowledgeNetwork.objectTypeLogicTrialRun" }),
      ).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: "common.ok" }));

    expect(await screen.findByText("line 1, column 3: bad statement")).not.toBeNull();
    expect(runCypherQuery.mock.calls[0][0]).toMatchObject({ explain: true });
    expect(onOk).not.toHaveBeenCalled();
  });

  it("trial-runs the statement with the sample values and shows the scalar", async () => {
    runCypherQuery.mockResolvedValue({
      exchange: {},
      ok: true,
      result: { columns: [{ name: "value" }], entries: [{ value: 41 }] },
    });
    render(
      <ObjectTypeLogicAttributeEditDrawer
        allData={person}
        attrInfo={{} as ObjectTypeLogicProperty}
        logicFields={[]}
        networkId="net-1"
        objectTypeId="person"
        onClose={vi.fn()}
        onOk={vi.fn()}
        open
      />,
    );

    await screen.findByLabelText("statement");
    fireEvent.change(screen.getByLabelText("knowledgeNetwork.objectTypeLogicTrialSample"), {
      target: { value: "p-1" },
    });
    const run = screen.getByRole("button", { name: "knowledgeNetwork.objectTypeLogicTrialRun" });
    await waitFor(() => expect(run).toBeEnabled());
    fireEvent.click(run);

    expect((await screen.findByTestId("logic-trial-value")).textContent).toBe("41");
    expect(runCypherQuery.mock.calls.at(-1)?.[0]).toMatchObject({
      explain: false,
      parameters: { id: "p-1" },
    });
  });

  it("shows a tool-sourced property read-only with a notice and no way to save", async () => {
    render(
      <ObjectTypeLogicAttributeEditDrawer
        allData={person}
        attrInfo={{
          dataSource: { boxId: "b", name: "Weather", toolId: "t", type: "tool" },
          displayName: "Weather",
          name: "weather",
          type: "tool",
        }}
        logicFields={[]}
        onClose={vi.fn()}
        onOk={vi.fn()}
        open
      />,
    );

    expect(await screen.findByText("knowledgeNetwork.objectTypeLogicToolRetired")).not.toBeNull();
    expect(screen.queryByRole("button", { name: "common.ok" })).toBeNull();
    expect(screen.queryByLabelText("statement")).toBeNull();
  });
});
