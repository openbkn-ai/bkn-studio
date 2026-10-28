/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  KnowledgeNetworkImportBindingError,
  KnowledgeNetworkImportConflictError,
} from "@/modules/knowledge-network/services/shared/runtime";

const mocks = vi.hoisted(() => ({
  form: {
    resetFields: vi.fn(),
    setFieldsValue: vi.fn(),
    validateFields: vi.fn(),
  },
  importKnowledgeNetwork: vi.fn(),
  importKnowledgeNetworkPackage: vi.fn(),
  messageError: vi.fn(),
  messageSuccess: vi.fn(),
  modalConfirm: vi.fn(),
  uploadFileName: "knowledge-network.json",
  uploadFileSize: 2,
}));

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({
    t: (key: string, vars?: Record<string, unknown>) =>
      vars ? `${key}:${JSON.stringify(vars)}` : key,
  }),
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

  const Switch = ({
    "aria-label": ariaLabel,
    checked,
    disabled,
    onChange,
  }: {
    "aria-label"?: string;
    checked?: boolean;
    disabled?: boolean;
    onChange?: (checked: boolean) => void;
  }) => (
    <input
      aria-label={ariaLabel}
      checked={checked}
      disabled={disabled}
      onChange={(event) => onChange?.(event.target.checked)}
      role="switch"
      type="checkbox"
    />
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
    Switch,
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
          onClick={() =>
            beforeUpload({
              name: mocks.uploadFileName,
              size: mocks.uploadFileSize,
            } as File)
          }
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
    modal: { confirm: mocks.modalConfirm },
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
    importKnowledgeNetworkPackage: mocks.importKnowledgeNetworkPackage,
  }),
);

import { KnowledgeNetworkImportButton } from "./KnowledgeNetworkImportButton";

describe("KnowledgeNetworkImportButton", () => {
  beforeEach(() => {
    mocks.form.resetFields.mockReset();
    mocks.form.setFieldsValue.mockReset();
    mocks.importKnowledgeNetwork.mockReset();
    mocks.importKnowledgeNetworkPackage.mockReset();
    mocks.messageError.mockReset();
    mocks.messageSuccess.mockReset();
    mocks.modalConfirm.mockReset();
    mocks.uploadFileName = "knowledge-network.json";
    mocks.uploadFileSize = 2;
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

  it("rejects files larger than the configured gateway limit before reading them", async () => {
    mocks.uploadFileSize = 500 * 1024 * 1024 + 1;
    const readAsText = vi.fn();
    vi.stubGlobal(
      "FileReader",
      class {
        onload: ((event: { target: { result: string } }) => void) | null = null;

        readAsText = readAsText;
      },
    );
    render(<KnowledgeNetworkImportButton onImported={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "upload-file" }));

    await waitFor(() => {
      expect(mocks.messageError).toHaveBeenCalledWith(
        'knowledgeNetwork.importFileTooLarge:{"maxSizeMB":500}',
      );
    });
    expect(readAsText).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
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
    expect(screen.getByText("knowledgeNetwork.importIgnore")).toBeInTheDocument();
    await waitFor(() => {
      expect(mocks.importKnowledgeNetwork).toHaveBeenCalledWith(
        { id: "orders", name: "Orders" },
        "normal",
        "detach",
        false,
      );
    });
  });

  it("passes ignore mode and strict validation independently", async () => {
    mocks.importKnowledgeNetwork.mockResolvedValueOnce(undefined);
    render(<KnowledgeNetworkImportButton onImported={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "upload-file" }));

    const dialog = await screen.findByRole("dialog");
    fireEvent.click(screen.getByDisplayValue("ignore"));
    fireEvent.click(
      within(dialog).getByRole("switch", { name: "knowledgeNetwork.importStrictModeTitle" }),
    );
    fireEvent.click(within(dialog).getByRole("button", { name: "knowledgeNetwork.importButton" }));

    await waitFor(() => {
      expect(mocks.importKnowledgeNetwork).toHaveBeenCalledWith(
        { id: "orders", name: "Orders" },
        "ignore",
        "preserve",
        true,
      );
    });
    expect(mocks.messageSuccess).toHaveBeenCalledWith("knowledgeNetwork.importSuccess");
  });

  it("requires confirmation before an overwrite import", async () => {
    mocks.importKnowledgeNetwork.mockResolvedValueOnce(undefined);
    render(<KnowledgeNetworkImportButton onImported={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "upload-file" }));

    const dialog = await screen.findByRole("dialog");
    fireEvent.click(screen.getByDisplayValue("overwrite"));
    fireEvent.click(within(dialog).getByRole("button", { name: "knowledgeNetwork.importButton" }));

    expect(mocks.importKnowledgeNetwork).not.toHaveBeenCalled();
    expect(mocks.modalConfirm).toHaveBeenCalledTimes(1);
    expect(mocks.modalConfirm).toHaveBeenCalledWith(
      expect.objectContaining({
        content: "knowledgeNetwork.importOverwriteConfirmDescription",
        okButtonProps: { danger: true },
        title: "knowledgeNetwork.importOverwriteConfirmTitle",
      }),
    );

    const confirmation = mocks.modalConfirm.mock.calls[0]?.[0] as { onOk?: () => Promise<void> };
    await confirmation.onOk?.();

    expect(mocks.importKnowledgeNetwork).toHaveBeenCalledWith(
      { id: "orders", name: "Orders" },
      "overwrite",
      "preserve",
      false,
    );
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
    const confirmation = mocks.modalConfirm.mock.calls[0]?.[0] as { onOk?: () => Promise<void> };
    void confirmation.onOk?.();

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

  it("keeps an incomplete binding error in the import dialog without a toast", async () => {
    mocks.importKnowledgeNetwork.mockRejectedValueOnce(
      new KnowledgeNetworkImportBindingError(
        "Import bindings are incomplete",
        "toolbox orders-api is missing bound tools: get-order",
      ),
    );
    render(<KnowledgeNetworkImportButton onImported={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "upload-file" }));

    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "knowledgeNetwork.importButton" }));

    await screen.findByText("Import bindings are incomplete");
    expect(
      screen.getByText("toolbox orders-api is missing bound tools: get-order"),
    ).toBeInTheDocument();
    expect(mocks.messageError).not.toHaveBeenCalled();
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
  });

  it("replaces a binding error with a later import conflict", async () => {
    mocks.importKnowledgeNetwork.mockRejectedValueOnce(
      new KnowledgeNetworkImportBindingError(
        "Import bindings are incomplete",
        "toolbox orders-api is missing bound tools: get-order",
      ),
    );
    render(<KnowledgeNetworkImportButton onImported={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "upload-file" }));

    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "knowledgeNetwork.importButton" }));
    await screen.findByText("Import bindings are incomplete");

    fireEvent.click(within(dialog).getByRole("button", { name: "knowledgeNetwork.importButton" }));
    await screen.findByText("Knowledge network ID already exists.");

    expect(screen.queryByText("Import bindings are incomplete")).not.toBeInTheDocument();
    expect(
      screen.queryByText("toolbox orders-api is missing bound tools: get-order"),
    ).not.toBeInTheDocument();
  });

  it("keeps a conflict form when a conflict action finds incomplete bindings", async () => {
    render(<KnowledgeNetworkImportButton onImported={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "upload-file" }));

    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "knowledgeNetwork.importButton" }));
    await screen.findByText("Knowledge network ID already exists.");
    mocks.importKnowledgeNetwork.mockRejectedValueOnce(
      new KnowledgeNetworkImportBindingError("Import bindings are incomplete"),
    );

    fireEvent.click(screen.getByRole("button", { name: "knowledgeNetwork.importOverwrite" }));
    const confirmation = mocks.modalConfirm.mock.calls[0]?.[0] as { onOk?: () => Promise<void> };
    void confirmation.onOk?.();
    await screen.findByText("Import bindings are incomplete");

    expect(screen.getByText("Knowledge network ID already exists.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "common.create" })).toBeInTheDocument();
  });

  describe("a BKN package", () => {
    beforeEach(() => {
      mocks.uploadFileName = "orders.tar.gz";
    });

    it("imports the package with the chosen options, without reading it as JSON", async () => {
      const readAsText = vi.fn();
      vi.stubGlobal(
        "FileReader",
        class {
          readAsText = readAsText;
        },
      );
      mocks.importKnowledgeNetworkPackage.mockResolvedValueOnce({ bound: 3, skipped: [] });
      const onImported = vi.fn();
      render(<KnowledgeNetworkImportButton onImported={onImported} />);

      fireEvent.click(screen.getByRole("button", { name: "upload-file" }));
      const dialog = await screen.findByRole("dialog");
      expect(
        within(dialog).getByText('knowledgeNetwork.packageImport.file:{"name":"orders.tar.gz"}'),
      ).toBeInTheDocument();
      fireEvent.click(screen.getByDisplayValue("ignore"));
      fireEvent.click(
        within(dialog).getByRole("button", { name: "knowledgeNetwork.importButton" }),
      );

      await waitFor(() =>
        expect(mocks.importKnowledgeNetworkPackage).toHaveBeenCalledWith(
          expect.objectContaining({ name: "orders.tar.gz" }),
          "ignore",
          "preserve",
          false,
        ),
      );
      expect(readAsText).not.toHaveBeenCalled();
      expect(mocks.messageSuccess).toHaveBeenCalledWith(
        'knowledgeNetwork.packageImport.successBound:{"count":3}',
      );
      expect(onImported).toHaveBeenCalled();
    });

    it("lists what it could not bind, each with its reason in words", async () => {
      mocks.importKnowledgeNetworkPackage.mockResolvedValueOnce({
        bound: 1,
        skipped: [
          {
            boxName: "",
            capabilityType: "knowledge_base",
            name: "Contracts",
            reason: "ambiguous_name",
          },
          {
            boxName: "orders-api",
            capabilityType: "function",
            name: "get-order",
            reason: "brand_new",
          },
        ],
      });
      render(<KnowledgeNetworkImportButton onImported={vi.fn()} />);

      fireEvent.click(screen.getByRole("button", { name: "upload-file" }));
      fireEvent.click(
        within(await screen.findByRole("dialog")).getByRole("button", {
          name: "knowledgeNetwork.importButton",
        }),
      );

      // The import dialog closes; the result opens in its place.
      const title = await screen.findByText(
        'knowledgeNetwork.packageImport.skippedTitle:{"count":2}',
      );
      expect(screen.getAllByRole("dialog")).toHaveLength(1);
      const result = title.closest('[role="dialog"]') as HTMLElement;
      expect(
        within(result).getByText(
          'knowledgeNetwork.packageImport.skipItem:{"box":"","name":"Contracts","type":"knowledgeNetwork.packageImport.type.knowledge_base"}',
        ),
      ).toBeInTheDocument();
      expect(
        within(result).getByText("knowledgeNetwork.packageImport.reason.ambiguous_name"),
      ).toBeInTheDocument();
      // A reason this release does not know reads as another reason, never as the raw value.
      expect(
        within(result).getByText("knowledgeNetwork.packageImport.reason.other"),
      ).toBeInTheDocument();
      expect(within(result).queryByText(/brand_new/)).toBeNull();
      expect(mocks.messageSuccess).not.toHaveBeenCalled();
    });

    it("offers no copy under a new name on a conflict, as a package cannot be renamed", async () => {
      mocks.importKnowledgeNetworkPackage.mockRejectedValueOnce(
        new KnowledgeNetworkImportConflictError("Knowledge network ID already exists."),
      );
      render(<KnowledgeNetworkImportButton onImported={vi.fn()} />);

      fireEvent.click(screen.getByRole("button", { name: "upload-file" }));
      fireEvent.click(
        within(await screen.findByRole("dialog")).getByRole("button", {
          name: "knowledgeNetwork.importButton",
        }),
      );

      expect(
        await screen.findByText("knowledgeNetwork.packageImport.conflictTip"),
      ).toBeInTheDocument();
      expect(screen.getByText("knowledgeNetwork.importOverwrite")).toBeInTheDocument();
      expect(screen.getByText("knowledgeNetwork.importIgnore")).toBeInTheDocument();
      expect(screen.queryByText("common.create")).toBeNull();
      expect(screen.queryByText("knowledgeNetwork.name")).toBeNull();
    });
  });
});
