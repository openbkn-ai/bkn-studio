/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, screen, waitFor } from "@testing-library/react";
import { AxiosError, type AxiosResponse } from "axios";
import type { TFunction } from "i18next";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ProjectPackagePreview } from "@/modules/bkn-project/types/project";

const previewMock = vi.hoisted(() => vi.fn());
const importMock = vi.hoisted(() => vi.fn());
const messageMock = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
const translate = vi.hoisted(
  () => (key: string, options?: Record<string, unknown>) =>
    options ? `${key}:${JSON.stringify(options)}` : key,
);

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: translate }),
}));

vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({ message: messageMock }),
}));

vi.mock("@/modules/bkn-project/services/project.service", () => ({
  importProjectPackage: importMock,
  previewProjectPackage: previewMock,
  renameProject: vi.fn(),
}));

import { renderWithoutAntdStyles } from "@/test/render-without-antd-styles";

import { importFailureText, prefillCatalogMapping } from "./manageMessages";
import { ProjectImport } from "./ProjectImport";

const refusal = (status: number, code: string) =>
  new AxiosError(code, "ERR_BAD_REQUEST", undefined, undefined, {
    data: { description: code, error_code: `BknProject.${code}` },
    status,
  } as AxiosResponse);

const preview: ProjectPackagePreview = {
  catalogs: [
    { id: "c1", name: "ERP" },
    { id: "c-old", name: "CRM" },
    { id: "c-gone", name: "Legacy" },
  ],
  contents: { confirmedFiles: 0, documents: 2, draft: true, editions: [], requirement: true },
  formatVersion: 1,
  kn: { id: "orders", name: "Orders network" },
  name: "Orders",
  namingLanguage: "en-US",
};

const catalogs = [
  { id: "c1", name: "ERP here" },
  { id: "c2", name: "CRM" },
  { id: "c3", name: "Warehouse" },
];

function renderImport(onImported = vi.fn()) {
  const view = renderWithoutAntdStyles(
    <ProjectImport
      catalogs={catalogs}
      catalogsError={null}
      networks={[{ id: "orders", name: "Orders network" }]}
      networksError={null}
      onImported={onImported}
    />,
  );
  return { onImported, view };
}

function pickFile(container: HTMLElement, file: File) {
  const input = container.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [file] } });
}

describe("prefillCatalogMapping", () => {
  it("pairs by the same id, then the same name, and leaves the rest to choose", () => {
    expect(prefillCatalogMapping(preview.catalogs, catalogs)).toEqual({
      c1: "c1",
      "c-gone": undefined,
      "c-old": "c2",
    });
  });

  it("keeps a pairing already chosen", () => {
    expect(prefillCatalogMapping(preview.catalogs, catalogs, { c1: "c3" })).toMatchObject({
      c1: "c3",
    });
  });
});

describe("importFailureText", () => {
  const t = translate as unknown as TFunction;

  it.each([
    [400, "Project.InvalidPackage", "bknProject.import.errors.invalidPackage"],
    [400, "Project.UnsupportedPackageVersion", "bknProject.import.errors.unsupportedVersion"],
    [413, "Project.PackageTooLarge", 'bknProject.import.errors.tooLarge:{"max":50}'],
    [400, "Project.InvalidCatalogMapping", "bknProject.import.errors.catalogMapping"],
    [409, "Project.CatalogMissing", "bknProject.import.errors.catalogMissing"],
  ])("words %s %s for the person", (status, code, text) => {
    expect(importFailureText(t, refusal(status, code))).toBe(text);
  });
});

describe("ProjectImport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        addEventListener: vi.fn(),
        addListener: vi.fn(),
        dispatchEvent: vi.fn(),
        matches: false,
        media: query,
        onchange: null,
        removeEventListener: vi.fn(),
        removeListener: vi.fn(),
      })),
    );
  });

  it("refuses a file over 50 MB before sending it", () => {
    const { view } = renderImport();
    const file = new File(["x"], "big.bknproj");
    Object.defineProperty(file, "size", { value: 51 * 1024 * 1024 });

    pickFile(view.container, file);

    expect(messageMock.error).toHaveBeenCalledWith('bknProject.import.errors.tooLarge:{"max":50}');
    expect(previewMock).not.toHaveBeenCalled();
  });

  it("says why a package cannot be read", async () => {
    previewMock.mockRejectedValue(refusal(400, "Project.InvalidPackage"));
    const { view } = renderImport();

    pickFile(view.container, new File(["x"], "bad.bknproj"));

    await waitFor(() =>
      expect(messageMock.error).toHaveBeenCalledWith("bknProject.import.errors.invalidPackage"),
    );
  });

  it("shows the package, requires every catalog mapped, then imports it", async () => {
    previewMock.mockResolvedValue(preview);
    importMock.mockResolvedValue({ id: "p9" });
    const { onImported, view } = renderImport();
    const file = new File(["zip"], "orders.bknproj");

    pickFile(view.container, file);

    expect(await screen.findByText("bknProject.import.title")).toBeInTheDocument();
    expect(screen.getByText("bknProject.contentLanguage.options.en")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Orders")).toBeInTheDocument();
    // Pre-selected: the same id, then the same name.
    expect(screen.getByTitle("ERP here")).toBeInTheDocument();
    expect(screen.getByTitle("CRM")).toBeInTheDocument();

    const networkSelect = screen
      .getByText("bknProject.create.networkPlaceholder")
      .closest(".ant-select") as HTMLElement;
    fireEvent.mouseDown(networkSelect.querySelector(".ant-select-selector") as HTMLElement);
    fireEvent.click(screen.getByTitle("Orders network"));

    fireEvent.click(screen.getByText("bknProject.import.submit"));
    expect(await screen.findByText("bknProject.import.errors.catalogMapping")).toBeInTheDocument();
    expect(importMock).not.toHaveBeenCalled();

    const legacy = screen
      .getAllByLabelText('bknProject.import.catalogs.toLabel:{"name":"Legacy"}')[0]
      .closest(".ant-select") as HTMLElement;
    fireEvent.mouseDown(legacy.querySelector(".ant-select-selector") as HTMLElement);
    fireEvent.click(screen.getByTitle("Warehouse"));
    fireEvent.click(screen.getByText("bknProject.import.submit"));

    await waitFor(() =>
      expect(importMock).toHaveBeenCalledWith(file, {
        catalogMapping: { c1: "c1", "c-gone": "c3", "c-old": "c2" },
        knId: "orders",
        name: "Orders",
      }),
    );
    expect(onImported).toHaveBeenCalledWith({ id: "p9" });
  });
});
