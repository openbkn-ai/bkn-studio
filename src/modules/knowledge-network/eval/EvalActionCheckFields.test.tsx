/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License. See LICENSE for the full text.
 */
import { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { EvalActionCheckFields } from "./EvalActionCheckFields";
import type { CaseTargetSchema } from "./case-form.service";
vi.mock("./useEvalTranslation", () => ({
  useEvalTranslation: () => ({ t: (key: string) => key.split(".").at(-1) }),
}));
vi.mock("./EvalResourceArguments", () => ({
  EvalResourceArguments: ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (s: string) => void;
  }) => (
    <textarea aria-label="runtime-input" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));
vi.mock("./EvalCaseArguments", () => ({
  EvalCaseArguments: ({ value, onChange }: { value: string; onChange: (s: string) => void }) => (
    <textarea aria-label="raw-input" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));
const bindings = [
  "parameters",
  "precondition",
  "authorization",
  "invocation_mode",
  "outcome_scope",
  "failure",
  "target",
  "duplicate",
];
const contract: CaseTargetSchema = {
  available: true,
  input: { type: "object", properties: { dynamic_params: { type: "object" } } },
  action_checks: Object.fromEntries(bindings.map((x) => [x, { type: "object" }])),
};
function Editor({
  binding,
  initial = "{}",
  form = contract,
}: {
  binding: string;
  initial?: string;
  form?: CaseTargetSchema;
}) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <EvalActionCheckFields
        networkId="kn"
        binding={binding}
        contract={form}
        value={value}
        onChange={setValue}
      />
      <output data-testid="arguments">{value}</output>
    </>
  );
}
it.each(bindings)(
  "creates a complete %s wrapper and distinguishes inspection from execution",
  async (binding) => {
    render(<Editor binding={binding} />);
    await waitFor(() =>
      expect(screen.getByTestId("arguments").textContent).toContain('"action_input":{}'),
    );
    const value = JSON.parse(screen.getByTestId("arguments").textContent ?? "{}") as Record<
      string,
      unknown
    >;
    expect(value).toHaveProperty("check");
    if (["precondition", "authorization", "target"].includes(binding)) {
      expect(screen.queryByText("inspectionHelp")).toBeNull();
      fireEvent.mouseEnter(screen.getByRole("button", { name: "actionInput ?" }));
      expect(await screen.findByRole("tooltip")).toHaveTextContent("inspectionHelp");
    } else {
      expect(screen.getByRole("alert")).toHaveTextContent(
        binding === "duplicate" ? "duplicateHelp" : "executionHelp",
      );
    }
    fireEvent.change(screen.getByRole("textbox", { name: "runtime-input" }), {
      target: { value: '{"dynamic_params":{"id":9007199254740993,"enabled":false}}' },
    });
    expect(screen.getByTestId("arguments").textContent).toContain("9007199254740993");
    expect(screen.getByTestId("arguments").textContent).toContain('"enabled":false');
    fireEvent.change(screen.getByRole("textbox", { name: "runtime-input" }), {
      target: { value: '{"dynamic_params":' },
    });
    expect(screen.getByTestId("arguments").textContent).toContain(
      '"action_input":{"dynamic_params":,',
    );
  },
);
it("allows intentionally invalid target input only in the rejection scenario", async () => {
  render(<Editor binding="target" />);
  fireEvent.mouseDown(screen.getByRole("combobox", { name: "decision" }));
  fireEvent.click((await screen.findAllByText("rejected")).at(-1)!);
  expect(screen.queryByRole("textbox", { name: "runtime-input" })).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole("textbox", { name: "raw-input" }), {
    target: { value: '{"_instance_identities":[]}' },
  });
  const value = JSON.parse(screen.getByTestId("arguments").textContent ?? "{}") as {
    check: { expected_decision: string };
  };
  expect(value.check.expected_decision).toBe("rejected");
});
it("blocks the editor when the runtime has no observation contract", () => {
  render(<Editor binding="parameters" form={{ available: true, input: { type: "object" } }} />);
  expect(screen.getByText("unavailable")).toBeInTheDocument();
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
});
it("resets cancellation settings when switching to admission checks", async () => {
  render(
    <Editor
      binding="failure"
      initial='{"action_input":{},"check":{"phase":"source","scenario":"cancellation","cancel_after_ms":100}}'
    />,
  );
  expect(screen.getByRole("spinbutton", { name: "cancelAfter" })).toBeInTheDocument();
  fireEvent.mouseDown(screen.getByRole("combobox", { name: "failurePhase" }));
  fireEvent.click((await screen.findAllByText("admission")).at(-1)!);
  const value = JSON.parse(screen.getByTestId("arguments").textContent ?? "{}") as {
    check: Record<string, unknown>;
  };
  expect(value.check).toEqual({ phase: "admission", scenario: "failure" });
  expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
});

it("removes hidden cancellation delay when switching to a failure scenario", async () => {
  render(
    <Editor
      binding="failure"
      initial='{"action_input":{},"check":{"phase":"source","scenario":"cancellation","cancel_after_ms":100}}'
    />,
  );
  fireEvent.mouseDown(screen.getByRole("combobox", { name: "scenario" }));
  fireEvent.click((await screen.findAllByText("failure")).at(-1)!);
  const value = JSON.parse(screen.getByTestId("arguments").textContent ?? "{}") as {
    check: Record<string, unknown>;
  };
  expect(value.check).toEqual({
    phase: "source",
    scenario: "failure",
  });
  expect(screen.queryByRole("spinbutton", { name: "cancelAfter" })).not.toBeInTheDocument();
});
