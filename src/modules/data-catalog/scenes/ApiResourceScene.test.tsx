/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation, useNavigationType } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ApiResourceSceneProps } from "../contracts/api-resource";
import { createApiResourceInput } from "../lib/api-resource";
import { ApiResourcePage } from "../pages/ApiResourcePage";
import type { ApiResource } from "../types/api-resource";
import type { CatalogRecord } from "@/shared/catalog";

const { get, save, getCatalog, getConnector, toggle, remove, translate, confirm, messageError } =
  vi.hoisted(() => ({
    get: vi.fn(),
    save: vi.fn(),
    getCatalog: vi.fn(),
    getConnector: vi.fn(),
    toggle: vi.fn(),
    remove: vi.fn(),
    translate: (key: string) => key,
    confirm: vi.fn(),
    messageError: vi.fn(),
  }));
vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: translate }),
}));
vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({
    modal: { confirm },
    message: { success: vi.fn(), error: messageError },
  }),
}));
vi.mock("@/shared/catalog", () => ({
  getCatalog,
  hasCatalogOperation: (catalog: CatalogRecord | null, operation: string) =>
    catalog?.operations.includes(operation),
}));
vi.mock("../services/api-resource.service", () => ({
  getApiResource: get,
  saveApiResource: save,
  getApiResourceConnector: getConnector,
}));
vi.mock("../services/resource.service", () => ({
  setCatalogResourceEnabled: toggle,
  deleteCatalogResource: remove,
}));
vi.mock("../components/ApiResourceWorkspaceView", () => ({
  ApiResourceWorkspaceView: ({
    resource,
    onEdit,
    canEdit,
    actions,
    feedback,
    tab,
    onTabChange,
    onBack,
  }: {
    resource: ApiResource;
    onEdit: () => void;
    canEdit: boolean;
    actions: import("react").ReactNode;
    feedback: import("react").ReactNode;
    tab: ApiResourceSceneProps["tab"];
    onTabChange: ApiResourceSceneProps["onTabChange"];
    onBack?: () => void;
  }) => (
    <div>
      <h2>{resource.name}</h2>
      {tab ? <output aria-label="active tab">{tab}</output> : null}
      {onTabChange ? <button onClick={() => onTabChange("detail")}>show detail</button> : null}
      {onBack ? <button onClick={onBack}>back to catalog</button> : null}
      <button disabled={!canEdit} onClick={onEdit}>
        edit resource
      </button>
      {actions}
      {feedback}
    </div>
  ),
}));
vi.mock("../components/ApiResourceDefinitionEditor", () => ({
  ApiResourceDefinitionEditor: ({
    value,
    onChange,
    disabled,
  }: {
    value: ApiResource;
    onChange: (value: ApiResource) => void;
    disabled: boolean;
  }) => (
    <>
      <button
        disabled={disabled}
        onClick={() =>
          onChange({
            ...value,
            api_definition: {
              ...value.api_definition,
              request: { method: "POST", path: "orders" },
            },
            schema_definition: value.schema_definition.length
              ? value.schema_definition
              : [{ name: "id", original_name: "ID", display_name: "ID", type: "integer" }],
          })
        }
      >
        edit definition
      </button>
      <button
        disabled={disabled}
        onClick={() =>
          onChange({
            ...value,
            schema_definition: value.schema_definition.map((field) => ({
              ...field,
              display_name: "Label",
            })),
          })
        }
      >
        edit output labels
      </button>
    </>
  ),
}));
import { ApiResourceScene } from "./ApiResourceScene";

const resource: ApiResource = {
  ...createApiResourceInput("catalog"),
  name: "Orders",
  source_identifier: "orders",
  id: "resource",
  category: "api",
  api_effect_type: "read",
  update_time: 10,
  status: "active",
  operations: ["view_detail", "query_data", "modify", "delete"],
  schema_definition: [{ name: "id", original_name: "ID", type: "integer" }],
};
const catalog = {
  id: "catalog",
  category: "api",
  connectorType: "http",
  enabled: true,
  status: "enabled",
  operations: ["resource_manage"],
  builtin: false,
};
const key = (name: string) => `dataCatalog.apiResource.${name}`;

async function openEditor() {
  fireEvent.click(await screen.findByRole("button", { name: "edit resource" }));
  await screen.findByText("edit definition");
}

function SearchProbe() {
  return <output aria-label="search parameters">{useLocation().search}</output>;
}

function LocationProbe() {
  const { pathname } = useLocation();
  const navigationType = useNavigationType();
  return <output aria-label="location">{`${navigationType} ${pathname}`}</output>;
}

describe("API Resource management", () => {
  afterEach(() => vi.unstubAllEnvs());
  beforeEach(() => {
    vi.stubEnv("VITE_USE_MOCK", "false");
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    vi.clearAllMocks();
    get.mockResolvedValue(resource);
    getCatalog.mockResolvedValue(catalog);
    getConnector.mockResolvedValue({ category: "api", enabled: true, available: true });
    save.mockResolvedValue("resource");
    confirm.mockImplementation(({ onOk }: { onOk: () => void }) => onOk());
  });

  it("opens a preview deep link and keeps its tab in sync with the URL", async () => {
    render(
      <MemoryRouter
        initialEntries={["/data-catalog/api-resource/resource?tab=preview&context=demo"]}
      >
        <SearchProbe />
        <Routes>
          <Route path="/data-catalog/api-resource/:resourceId" element={<ApiResourcePage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByLabelText("active tab")).toHaveTextContent("preview");
    fireEvent.click(screen.getByRole("button", { name: "show detail" }));
    expect(screen.getByLabelText("active tab")).toHaveTextContent("detail");
    expect(screen.getByLabelText("search parameters")).toHaveTextContent("?context=demo");
    expect(get).toHaveBeenCalledOnce();
  });

  it.each([
    { catalogReadable: true, target: "/data-catalog/catalog/catalog" },
    { catalogReadable: false, target: "/data-catalog" },
  ])("returns from a resource deep link to $target", async ({ catalogReadable, target }) => {
    if (!catalogReadable) {
      getCatalog.mockRejectedValueOnce({
        isAxiosError: true,
        response: { status: 403, data: { error_code: "Forbidden" } },
      });
    }
    render(
      <MemoryRouter initialEntries={["/data-catalog/api-resource/resource"]}>
        <LocationProbe />
        <Routes>
          <Route path="/data-catalog/api-resource/:resourceId" element={<ApiResourcePage />} />
          <Route path="/data-catalog" element={null} />
          <Route path="/data-catalog/catalog/:catalogId" element={null} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole("button", { name: "back to catalog" }));
    expect(screen.getByLabelText("location").textContent).toBe(`PUSH ${target}`);
  });

  it("identifies mock saves without claiming upstream validation", async () => {
    vi.stubEnv("VITE_USE_MOCK", "true");
    render(<ApiResourceScene resourceId="resource" />);
    expect(await screen.findByText(key("mockHint"))).toBeVisible();
    await openEditor();
    fireEvent.change(screen.getByLabelText(key("name")), { target: { value: "Mock rename" } });
    fireEvent.click(screen.getByRole("button", { name: "common.save" }));
    expect(await screen.findByText(key("mockSaved"))).toBeVisible();
    expect(screen.queryByText(key("savedValidated"))).toBeNull();
  });

  it("hides the source identifier and saves editable metadata without implicit validation", async () => {
    render(<ApiResourceScene resourceId="resource" />);
    await screen.findByRole("heading", { name: "Orders" });
    expect(screen.queryByRole("button", { name: "common.refresh" })).not.toBeInTheDocument();
    await openEditor();
    const validation = screen.getByRole("article", { name: key("invocation.validation") });
    fireEvent.click(within(validation).getByRole("switch", { name: key("invocation.filter") }));
    expect(
      within(validation).getByRole("button", { name: "dataCatalog.filter.addRule" }),
    ).toBeVisible();
    expect(screen.queryByRole("button", { name: "common.refresh" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "common.disable" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "common.delete" })).not.toBeInTheDocument();
    expect(screen.queryByText(key("identifier"))).not.toBeInTheDocument();
    expect(
      within(screen.getByRole("contentinfo")).getByRole("button", { name: "common.save" }),
    ).toBeDisabled();
    expect(save).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText(key("name")), { target: { value: "Renamed" } });
    fireEvent.click(screen.getByRole("button", { name: "common.save" }));
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith(expect.objectContaining({ name: "Renamed" }), resource),
    );
    expect(await screen.findByText(key("savedMetadata"))).toBeVisible();
  });

  it("creates under the selected Catalog and waits for candidate validation before reporting success", async () => {
    const onSaved = vi.fn();
    render(<ApiResourceScene catalogId="catalog" onSaved={onSaved} />);
    await screen.findByText("edit definition");
    expect(get).not.toHaveBeenCalled();
    expect(screen.queryByLabelText(key("identifier"))).not.toBeInTheDocument();
    const status = screen.getByRole("switch", { name: "dataCatalog.resource.enabledStatus" });
    expect(status).toBeChecked();
    expect(status).toBeDisabled();
    fireEvent.change(screen.getByLabelText(key("name")), { target: { value: "New Resource" } });
    fireEvent.click(screen.getByRole("button", { name: "edit definition" }));
    fireEvent.click(screen.getByRole("button", { name: key("saveValidate") }));
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith(
        expect.objectContaining({
          catalog_id: "catalog",
          name: "New Resource",
        }),
        undefined,
      ),
    );
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith("resource"));
    expect(save.mock.calls[0]?.[0]).not.toHaveProperty("source_identifier");
    expect(screen.getByText(key("savedValidated"))).toBeVisible();
  });

  it.each(["create", "update"])(
    "replaces the %s page with the saved resource URL even if loading its details fails",
    async (action) => {
      const creating = action === "create";
      const latest = {
        ...resource,
        id: creating ? "created-resource" : resource.id,
        name: "Saved Resource",
      };
      const detailPath = "/data-catalog/api-resource";
      const createPath = "/data-catalog/catalog/catalog/api/new";
      render(
        <MemoryRouter initialEntries={[creating ? createPath : `${detailPath}/resource/edit`]}>
          <LocationProbe />
          <Routes>
            <Route path="/data-catalog/catalog/:catalogId/api/new" element={<ApiResourcePage />} />
            <Route path={`${detailPath}/:resourceId/edit`} element={<ApiResourcePage edit />} />
            <Route path={`${detailPath}/:resourceId`} element={<ApiResourcePage />} />
          </Routes>
        </MemoryRouter>,
      );
      fireEvent.change(await screen.findByLabelText(key("name")), {
        target: { value: latest.name },
      });
      if (creating) fireEvent.click(screen.getByRole("button", { name: "edit definition" }));
      save.mockResolvedValue(latest.id);
      get.mockRejectedValueOnce(new Error("Readback failed")).mockResolvedValue(latest);

      fireEvent.click(
        screen.getByRole("button", { name: creating ? key("saveValidate") : "common.save" }),
      );
      await waitFor(() =>
        expect(screen.getByLabelText("location")).toHaveTextContent(
          `REPLACE ${detailPath}/${latest.id}`,
        ),
      );
      fireEvent.click(await screen.findByRole("button", { name: "common.retry" }));

      expect(await screen.findByRole("heading", { name: latest.name })).toBeVisible();
      expect(save).toHaveBeenCalledOnce();
      expect(get).toHaveBeenCalledTimes(creating ? 2 : 3);
      expect(get).toHaveBeenLastCalledWith(latest.id);
    },
  );

  it.each(["create", "update"])(
    "only retries reading after a successful %s with a failed readback",
    async (action) => {
      const creating = action === "create";
      const latest = {
        ...resource,
        id: creating ? "created-resource" : resource.id,
        name: "Saved Resource",
        update_time: resource.update_time + 1,
      };
      const onSaved = vi.fn();
      save.mockResolvedValue(latest.id);
      render(
        <ApiResourceScene
          catalogId={creating ? "catalog" : undefined}
          resourceId={creating ? undefined : resource.id}
          startInEditMode
          onSaved={onSaved}
        />,
      );
      const name = await screen.findByLabelText(key("name"));
      fireEvent.change(name, { target: { value: latest.name } });
      if (creating) fireEvent.click(screen.getByRole("button", { name: "edit definition" }));

      const saveButton = creating ? key("saveValidate") : "common.save";
      get.mockRejectedValue(new Error("Readback failed"));
      fireEvent.click(screen.getByRole("button", { name: saveButton }));
      expect(await screen.findByRole("status")).toHaveTextContent(key("savedReadbackFailed"));
      expect(screen.queryByRole("button", { name: saveButton })).not.toBeInTheDocument();
      expect(save).toHaveBeenCalledOnce();
      expect(onSaved).not.toHaveBeenCalled();

      let rejectRetry!: (reason: Error) => void;
      const failedRetry = new Promise<ApiResource>((_, reject) => {
        rejectRetry = reject;
      });
      get.mockReturnValueOnce(failedRetry);
      const retry = screen.getByRole("button", { name: key("retryReadback") });
      fireEvent.click(retry);
      const reads = creating ? 2 : 3;
      expect(retry).toBeDisabled();
      expect(get).toHaveBeenCalledTimes(reads);
      expect(get).toHaveBeenLastCalledWith(latest.id);
      expect(save).toHaveBeenCalledOnce();
      expect(onSaved).not.toHaveBeenCalled();

      await act(async () => {
        rejectRetry(new Error("Readback failed again"));
        await failedRetry.catch(() => undefined);
      });
      get.mockResolvedValue(latest);
      const retryAgain = screen.getByRole("button", { name: key("retryReadback") });
      expect(retryAgain).toBeEnabled();
      fireEvent.click(retryAgain);
      expect(await screen.findByRole("heading", { name: latest.name })).toBeVisible();
      expect(save).toHaveBeenCalledOnce();
      expect(get).toHaveBeenCalledTimes(reads + 1);
      expect(get).toHaveBeenLastCalledWith(latest.id);
      expect(onSaved).toHaveBeenCalledExactlyOnceWith(latest.id);
    },
  );

  it("shows the saved disabled state and preserves it when editing metadata", async () => {
    const disabledResource = { ...resource, enabled: false };
    get.mockResolvedValue(disabledResource);
    render(<ApiResourceScene resourceId="resource" startInEditMode />);
    const status = await screen.findByRole("switch", {
      name: "dataCatalog.resource.enabledStatus",
    });
    expect(status).not.toBeChecked();
    expect(status).toBeDisabled();
    fireEvent.change(screen.getByLabelText(key("name")), { target: { value: "Renamed" } });
    fireEvent.click(screen.getByRole("button", { name: "common.save" }));
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith(
        expect.objectContaining({ enabled: false }),
        disabledResource,
      ),
    );
    expect(toggle).not.toHaveBeenCalled();
  });

  it("validates and saves a definition while the resource remains disabled", async () => {
    const disabledResource = { ...resource, enabled: false };
    get.mockResolvedValue(disabledResource);
    render(<ApiResourceScene resourceId="resource" startInEditMode />);
    fireEvent.click(await screen.findByRole("button", { name: "edit definition" }));
    fireEvent.click(screen.getByRole("button", { name: key("saveValidate") }));
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith(
        expect.objectContaining({ enabled: false }),
        disabledResource,
      ),
    );
    expect(toggle).not.toHaveBeenCalled();
  });

  it("saves output labels with modify permission even with incomplete validation inputs", async () => {
    const restricted = {
      ...resource,
      operations: ["view_detail", "modify"],
      schema_definition: resource.schema_definition.map((field) => ({
        ...field,
        filterable: true,
      })),
      api_definition: {
        ...resource.api_definition,
        variables: { credential: { sensitive: true } },
      },
    };
    get.mockResolvedValue(restricted);
    render(<ApiResourceScene resourceId="resource" startInEditMode />);
    fireEvent.click(await screen.findByRole("button", { name: "edit output labels" }));
    const validation = screen.getByRole("article", { name: key("invocation.validation") });
    fireEvent.click(within(validation).getByRole("switch", { name: key("invocation.filter") }));
    fireEvent.click(within(validation).getByRole("button", { name: "dataCatalog.filter.addRule" }));
    expect(screen.queryByText(key("saveHint"))).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "common.save" }));
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith(
        expect.objectContaining({
          schema_definition: [expect.objectContaining({ display_name: "Label" })],
        }),
        restricted,
      ),
    );
    expect(screen.queryByText(key("savedValidated"))).toBeNull();
  });

  it("submits a candidate definition to backend save validation and only then displays the saved result", async () => {
    render(<ApiResourceScene resourceId="resource" />);
    await openEditor();
    fireEvent.click(screen.getByRole("button", { name: "edit definition" }));
    expect(save).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: key("saveValidate") }));
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith(
        expect.objectContaining({
          api_definition: expect.objectContaining<Record<string, unknown>>({
            request: { method: "POST", path: "orders" },
          }) as unknown,
        }),
        resource,
      ),
    );
    expect(await screen.findByText(key("savedValidated"))).toBeVisible();
  });

  it("keeps the draft on a concurrency conflict and requires reload before another save", async () => {
    save.mockRejectedValueOnce({
      isAxiosError: true,
      response: {
        status: 409,
        data: { error_code: "VegaBackend.Resource.UpdateConflict", description: "Changed" },
      },
    });
    render(<ApiResourceScene resourceId="resource" />);
    await openEditor();
    fireEvent.change(screen.getByLabelText(key("name")), { target: { value: "Keep draft" } });
    fireEvent.click(screen.getByRole("button", { name: "common.save" }));
    await screen.findByText(key("conflict"));
    expect(screen.getByLabelText(key("name"))).toHaveValue("Keep draft");
    expect(screen.getByRole("button", { name: "common.save" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "common.reload" }));
    expect(await screen.findByRole("heading", { name: "Orders" })).toBeVisible();
    expect(screen.queryByText(key("conflict"))).not.toBeInTheDocument();
  });

  it.each([false, true])(
    "confirms discarding a changed draft from the shared editor (edit=%s)",
    async (edit) => {
      const onBack = vi.fn();
      confirm.mockImplementationOnce(() => Promise.resolve(false));
      render(
        <ApiResourceScene
          catalogId={edit ? undefined : "catalog"}
          resourceId={edit ? "resource" : undefined}
          startInEditMode={edit}
          onBack={onBack}
        />,
      );
      const name = await screen.findByLabelText(key("name"));
      fireEvent.change(name, { target: { value: "Unsaved draft" } });
      const cancel = within(screen.getByRole("contentinfo")).getByRole("button", {
        name: "common.cancel",
      });
      fireEvent.click(cancel);
      expect(confirm).toHaveBeenCalledWith(
        expect.objectContaining({ title: "dataCatalog.viewEditor.discardTitle" }),
      );
      expect(onBack).not.toHaveBeenCalled();
      expect(name).toHaveValue("Unsaved draft");
      fireEvent.click(cancel);
      expect(onBack).toHaveBeenCalledOnce();
    },
  );

  it("respects effective resource permissions and makes unavailable editions non-operational", async () => {
    get.mockResolvedValueOnce({ ...resource, operations: ["view_detail", "query_data"] });
    const view = render(<ApiResourceScene resourceId="resource" />);
    expect(await screen.findByText(key("readOnly"))).toBeVisible();
    expect(screen.getByRole("button", { name: "edit resource" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "common.disable" })).toBeNull();
    expect(screen.queryByRole("button", { name: "common.delete" })).toBeNull();
    expect(screen.queryByRole("button", { name: "common.save" })).toBeNull();
    view.unmount();
    getConnector.mockResolvedValueOnce({ category: "api", enabled: true, available: false });
    render(<ApiResourceScene resourceId="resource" />);
    expect(await screen.findByText(key("unavailable"))).toBeVisible();
    expect(screen.getByRole("button", { name: "edit resource" })).toBeDisabled();
  });

  it("allows metadata under a disabled Catalog but blocks definition changes", async () => {
    getCatalog.mockResolvedValueOnce({ ...catalog, enabled: false, status: "disabled" });
    render(<ApiResourceScene resourceId="resource" />);
    await openEditor();
    fireEvent.change(screen.getByLabelText(key("name")), { target: { value: "Changed metadata" } });
    expect(screen.getByRole("button", { name: "common.save" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "edit definition" }));
    expect(screen.getByRole("button", { name: key("saveValidate") })).toBeDisabled();
  });

  it("preserves Resource inspection when Catalog details are forbidden", async () => {
    get.mockResolvedValueOnce({ ...resource, operations: ["view_detail"] });
    getCatalog.mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 403, data: { error_code: "Forbidden" } },
    });
    render(<ApiResourceScene resourceId="resource" />);
    expect(await screen.findByRole("heading", { name: "Orders" })).toBeVisible();
    expect(screen.getByRole("button", { name: "edit resource" })).toBeDisabled();
    expect(getConnector).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "common.save" })).toBeNull();
  });

  it("updates metadata and toggles with a direct modify grant, without offering deletion", async () => {
    get.mockResolvedValue({ ...resource, operations: ["view_detail", "modify"] });
    getCatalog.mockResolvedValue({ ...catalog, operations: ["view_detail"] });
    render(<ApiResourceScene resourceId="resource" />);
    await screen.findByRole("button", { name: "edit resource" });
    expect(screen.queryByRole("button", { name: "common.delete" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "common.disable" }));
    await waitFor(() => expect(toggle).toHaveBeenCalledWith("resource", false));
    await openEditor();
    fireEvent.change(screen.getByLabelText(key("name")), { target: { value: "New name" } });
    fireEvent.click(screen.getByRole("button", { name: "common.save" }));
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith(
        expect.objectContaining({ name: "New name" }),
        expect.objectContaining({ id: "resource" }),
      ),
    );
  });

  it("allows a direct delete grant to delete even when Catalog details are forbidden", async () => {
    const deleted = vi.fn();
    get.mockResolvedValue({ ...resource, operations: ["view_detail", "delete"] });
    getCatalog.mockRejectedValue({
      isAxiosError: true,
      response: { status: 403, data: { error_code: "Forbidden" } },
    });
    render(<ApiResourceScene resourceId="resource" onDeleted={deleted} />);
    expect(await screen.findByRole("button", { name: "edit resource" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "common.disable" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "common.delete" }));
    await waitFor(() => expect(remove).toHaveBeenCalledWith("resource", { skipErrorToast: true }));
    expect(deleted).toHaveBeenCalledWith("catalog");
  });

  it.each([
    [403, "Permission denied"],
    [409, "The resource is still referenced"],
  ])(
    "shows delete failures and keeps the confirmation open on HTTP %s",
    async (status, description) => {
      const deleted = vi.fn();
      const failure = { isAxiosError: true, response: { status, data: { description } } };
      remove.mockRejectedValueOnce(failure);
      confirm.mockImplementationOnce(() => undefined);
      render(<ApiResourceScene resourceId="resource" onDeleted={deleted} />);
      fireEvent.click(await screen.findByRole("button", { name: "common.delete" }));

      const { onOk } = confirm.mock.lastCall?.[0] as { onOk: () => Promise<void> };
      await expect(onOk()).rejects.toBe(failure);
      expect(messageError).toHaveBeenCalledOnce();
      expect(messageError).toHaveBeenCalledWith(description);
      expect(deleted).not.toHaveBeenCalled();
    },
  );
});
