/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { KnowledgeNetworkImportConflictError } from "@/modules/knowledge-network/services/shared/runtime";

const mocks = vi.hoisted(() => ({
  form: {
    resetFields: vi.fn(),
    setFieldsValue: vi.fn(),
    validateFields: vi.fn(),
  },
  importKnowledgeNetwork: vi.fn(),
  messageError: vi.fn(),
  messageSuccess: vi.fn(),
}));

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("antd", () => {
  const Form = ({ children }: { children?: ReactNode }) => <form>{children}</form>;
  Form.Item = ({ children, label }: { children?: ReactNode; label?: ReactNode }) => (
    <label>
      {label}
      {children}
    </label>
  );
  Form.useForm = () => [mocks.form];

  const Radio = ({ children, value }: { children?: ReactNode; value?: string }) => (
    <label>
      <input type="radio" value={value} />
      {children}
    </label>
  );
  Radio.Group = ({
    children,
    onChange,
    value,
  }: {
    children?: ReactNode;
    onChange?: (event: { target: { value: string } }) => void;
    value?: string;
  }) => (
    <div
      data-value={value}
      onChange={(event) =>
        onChange?.({ target: { value: (event.target as HTMLInputElement).value } })
      }
    >
      {children}
    </div>
  );

  return {
    Alert: ({ description }: { description?: ReactNode }) => <div>{description}</div>,
    Form,
    Input: () => <input />,
    Modal: ({
      children,
      footer,
      okText,
      onOk,
      open,
      title,
    }: {
      children?: ReactNode;
      footer?: ReactNode;
      okText?: ReactNode;
      onOk?: () => void;
      open?: boolean;
      title?: ReactNode;
    }) =>
      open ? (
        <div role="dialog">
          <h1>{title}</h1>
          {children}
          {footer ?? (
            <button onClick={onOk} type="button">
              {okText}
            </button>
          )}
        </div>
      ) : null,
    Radio,
    Space: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    Typography: {
      Paragraph: ({ children }: { children?: ReactNode }) => <p>{children}</p>,
      Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
    },
    Upload: ({
      beforeUpload,
      children,
    }: {
      beforeUpload: (file: File) => boolean;
      children?: ReactNode;
    }) => (
      <div>
        <button
          onClick={() => beforeUpload(new File(["{}"], "knowledge-network.json"))}
          type="button"
        >
          upload-file
        </button>
        {children}
      </div>
    ),
  };
});

vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({
    message: {
      error: mocks.messageError,
      success: mocks.messageSuccess,
    },
  }),
}));

vi.mock("@/framework/ui/common/AppButton", () => ({
  AppButton: ({
    children,
    disabled,
    loading,
    onClick,
  }: {
    children?: ReactNode;
    disabled?: boolean;
    loading?: boolean;
    onClick?: () => void;
  }) => (
    <button
      data-loading={loading ? "true" : "false"}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  ),
}));

vi.mock(
  "@/modules/knowledge-network/services/knowledge-network.service",
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import("@/modules/knowledge-network/services/knowledge-network.service")
    >()),
    importKnowledgeNetwork: mocks.importKnowledgeNetwork,
  }),
);

import { KnowledgeNetworkImportButton } from "./KnowledgeNetworkImportButton";

describe("KnowledgeNetworkImportButton", () => {
  beforeEach(() => {
    mocks.form.resetFields.mockReset();
    mocks.form.setFieldsValue.mockReset();
    mocks.importKnowledgeNetwork.mockReset();
    mocks.messageError.mockReset();
    mocks.messageSuccess.mockReset();
    mocks.importKnowledgeNetwork.mockRejectedValue(
      new KnowledgeNetworkImportConflictError("Knowledge network ID already exists."),
    );
    vi.stubGlobal(
      "FileReader",
      class {
        onload: ((event: { target: { result: string } }) => void) | null = null;

        readAsText() {
          this.onload?.({ target: { result: '{"id":"orders","name":"Orders"}' } });
        }
      },
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps the binding selection and ID/name conflict resolution in one dialog", async () => {
    render(<KnowledgeNetworkImportButton onImported={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "upload-file" }));

    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByText("knowledgeNetwork.importBindingPolicyDescription"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByDisplayValue("detach"));
    fireEvent.click(within(dialog).getByRole("button", { name: "knowledgeNetwork.importButton" }));

    await screen.findByText("Knowledge network ID already exists.");

    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(screen.getByText("knowledgeNetwork.name")).toBeInTheDocument();
    expect(screen.getByText("knowledgeNetwork.identifier")).toBeInTheDocument();
    expect(screen.queryByText("knowledgeNetwork.importIgnore")).not.toBeInTheDocument();
    await waitFor(() => {
      expect(mocks.importKnowledgeNetwork).toHaveBeenCalledWith(
        { id: "orders", name: "Orders" },
        undefined,
        "detach",
      );
    });
  });

  it("shows loading only on the conflict action being submitted", async () => {
    render(<KnowledgeNetworkImportButton onImported={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "upload-file" }));

    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "knowledgeNetwork.importButton" }));
    await screen.findByText("Knowledge network ID already exists.");

    let resolveRequest: (() => void) | undefined;
    mocks.importKnowledgeNetwork.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveRequest = resolve;
        }),
    );

    fireEvent.click(screen.getByRole("button", { name: "knowledgeNetwork.importOverwrite" }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "knowledgeNetwork.importOverwrite" }),
      ).toHaveAttribute("data-loading", "true");
    });
    expect(screen.getByRole("button", { name: "common.create" })).toHaveAttribute(
      "data-loading",
      "false",
    );
    expect(screen.getByRole("button", { name: "common.create" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "common.cancel" })).toBeDisabled();

    resolveRequest?.();
  });
});
