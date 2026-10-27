/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AxiosError, type AxiosResponse } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Project } from "@/modules/bkn-project/types/project";

const getDraftMock = vi.hoisted(() => vi.fn());
const generateDraftMock = vi.hoisted(() => vi.fn());
const listCatalogsMock = vi.hoisted(() => vi.fn());
const editDraftItemMock = vi.hoisted(() => vi.fn());
const messageMock = vi.hoisted(() => ({ error: vi.fn(), info: vi.fn(), warning: vi.fn() }));
const confirmMock = vi.hoisted(() => vi.fn());
const translate = vi.hoisted(
  () => (key: string, options?: Record<string, unknown>) =>
    options ? `${key}:${JSON.stringify(options)}` : key,
);

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: translate }),
}));

vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({ message: messageMock, modal: { confirm: confirmMock } }),
}));

vi.mock("@/modules/bkn-project/services/draft.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/bkn-project/services/draft.service")>()),
  editDraftItem: editDraftItemMock,
  generateDraft: generateDraftMock,
  getDraft: getDraftMock,
}));

vi.mock("@/shared/catalog", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/shared/catalog")>()),
  listCatalogs: listCatalogsMock,
}));

import { mapDraft, mockDraft } from "@/modules/bkn-project/services/draft.service";

import { DRAFT_POLL_MS, ProjectModel } from "./ProjectModel";

const project: Project = {
  archived: false,
  baselineNetworkId: "orders",
  branch: "project/p1",
  catalogIds: ["cat-001"],
  createTime: 1,
  id: "p1",
  knId: "orders",
  name: "Delivery warning",
  otherProjects: 0,
  owner: { id: "me", type: "user" },
  updateTime: 1,
};

const ready = () => mapDraft(mockDraft("p1"));

function conflict(code: string) {
  return new AxiosError("409", "ERR_BAD_REQUEST", undefined, undefined, {
    data: { description: `${code} described`, error_code: `BknProject.Draft.${code}` },
    status: 409,
  } as AxiosResponse);
}

/** The draft after an edit: bkn-project replies it with a new update time. */
function edited(change: (draft: ReturnType<typeof ready>) => void) {
  const draft = ready();
  change(draft);
  draft.updateTime += 1;
  return draft;
}

function renderModel(override: Partial<Project> = {}) {
  return render(<ProjectModel project={{ ...project, ...override }} />);
}

describe("ProjectModel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Ant Design's table reads breakpoints, which jsdom lacks.
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
    listCatalogsMock.mockResolvedValue({ items: [{ id: "cat-001", name: "ERP" }], total: 1 });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("offers to draft before the first draft, unless the project has no catalogs", async () => {
    getDraftMock.mockResolvedValue(null);
    const view = renderModel();

    expect(await screen.findByText("bknProject.model.empty.title")).toBeInTheDocument();
    expect(screen.getByText("bknProject.model.empty.description")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "bknProject.model.generate" })).toBeEnabled();
    view.unmount();

    renderModel({ catalogIds: [] });
    expect(await screen.findByText("bknProject.model.empty.noCatalogs")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "bknProject.model.generate" })).toBeDisabled();
  });

  it("drafts and shows bkn-project's localized refusal when drafting cannot start", async () => {
    getDraftMock.mockResolvedValue(null);
    generateDraftMock.mockRejectedValue(
      new AxiosError("409", "ERR_BAD_REQUEST", undefined, undefined, {
        data: {
          description: "Data Catalog Not Found.",
          error_code: "BknProject.Draft.CatalogMissing",
        },
        status: 409,
      } as AxiosResponse),
    );
    renderModel();

    fireEvent.click(await screen.findByRole("button", { name: "bknProject.model.generate" }));

    expect(await screen.findByText("bknProject.model.generateFailed")).toBeInTheDocument();
    expect(screen.getByText(/Data Catalog Not Found/)).toBeInTheDocument();
    expect(generateDraftMock).toHaveBeenCalledWith("p1");
  });

  it("reads a drafting draft again until it is done, and stops when the page goes", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    getDraftMock
      .mockResolvedValueOnce({ ...ready(), status: "drafting" })
      .mockResolvedValueOnce(ready());
    const view = renderModel();

    expect(await screen.findByText("bknProject.model.drafting.title")).toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(DRAFT_POLL_MS);
    });
    await waitFor(() => expect(getDraftMock).toHaveBeenCalledTimes(2));
    expect(await screen.findByText(/bknProject.model.summary/)).toBeInTheDocument();

    view.unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(DRAFT_POLL_MS * 3);
    });
    expect(getDraftMock).toHaveBeenCalledTimes(2);
  });

  it("keeps reading a drafting draft after a failed read, and says the read failed", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    getDraftMock
      .mockResolvedValueOnce({ ...ready(), status: "drafting" })
      .mockRejectedValueOnce(new Error("gateway timeout"))
      .mockResolvedValueOnce(ready());
    renderModel();

    expect(await screen.findByText("bknProject.model.drafting.title")).toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(DRAFT_POLL_MS);
    });
    expect(await screen.findByText("bknProject.model.loadFailed")).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(DRAFT_POLL_MS);
    });
    expect(await screen.findByText(/bknProject.model.summary/)).toBeInTheDocument();
    expect(getDraftMock).toHaveBeenCalledTimes(3);
    expect(screen.queryByText("bknProject.model.loadFailed")).not.toBeInTheDocument();
  });

  it("explains a failed draft; only a data source's reply goes to the details", async () => {
    getDraftMock.mockResolvedValue({ ...ready(), error: "timeout", status: "failed" });
    const view = renderModel();
    expect(await screen.findByText("bknProject.model.failed.timeout")).toBeInTheDocument();
    expect(screen.queryByText("bknProject.model.failed.details")).not.toBeInTheDocument();
    view.unmount();

    getDraftMock.mockResolvedValue({
      ...ready(),
      error: "vega-backend returned HTTP 500",
      status: "failed",
    });
    renderModel();
    expect(await screen.findByText("bknProject.model.failed.source")).toBeInTheDocument();
    expect(screen.getByText("bknProject.model.failed.details")).toBeInTheDocument();
  });

  it("marks a key that is not unique, translates a failed count, and counts what waits", async () => {
    getDraftMock.mockResolvedValue(ready());
    renderModel();

    expect(
      await screen.findByText(/bknProject.model.evidence.warning.notUnique/),
    ).toHaveTextContent('{"distinct":911,"rows":1972}');
    expect(
      screen.getByText(/bknProject.model.evidence.countReason.query_failed/),
    ).toBeInTheDocument();
    // A data source's raw reply means nothing to people here; the page only says counting did not finish.
    expect(screen.queryByText(/Public.Forbidden/)).not.toBeInTheDocument();
    // material_bom waits for its identity, and its adopted relation waits to be unadopted.
    expect(screen.getByText(/bknProject.model.pending/)).toHaveTextContent('{"count":2}');
    expect(screen.getByText(/bknProject.model.notice.unadoptedEnds/)).toBeInTheDocument();
  });

  it("marks relations adopted while an end is not, with their evidence", async () => {
    getDraftMock.mockResolvedValue(ready());
    renderModel();

    fireEvent.click(await screen.findByText(/bknProject.model.tabs.relations/));

    expect(await screen.findByText("bknProject.model.state.unadoptedEnd")).toBeInTheDocument();
    expect(screen.getAllByText(/bknProject.model.evidence.joinCount/)[0]).toHaveTextContent(
      '"rate":"99.5%"',
    );
    expect(screen.getByText(/bknProject.model.evidence.origin.name_match/)).toBeInTheDocument();
  });

  it("reports catalogs that are gone, and nothing when the catalogs cannot be listed", async () => {
    getDraftMock.mockResolvedValue(mapDraft(mockDraft("p1", "old-catalog")));
    const view = renderModel();
    expect(await screen.findByText(/bknProject.model.notice.missingCatalogs/)).toHaveTextContent(
      "old-catalog",
    );
    view.unmount();

    listCatalogsMock.mockRejectedValue(new Error("down"));
    renderModel();
    await screen.findByText(/bknProject.model.summary/);
    expect(screen.queryByText(/bknProject.model.notice.missingCatalogs/)).not.toBeInTheDocument();
  });

  it("opens an object type with its identity, properties and the fields left out", async () => {
    getDraftMock.mockResolvedValue(ready());
    renderModel();

    fireEvent.click(await screen.findByRole("button", { name: /^customers/ }));

    expect(await screen.findByText("bknProject.model.detail.propertiesTitle")).toBeInTheDocument();
    expect(screen.getByText("contact_phone")).toBeInTheDocument();
    expect(screen.getAllByText(/bknProject.model.excluded.reason.privacy/)[0]).toHaveTextContent(
      '"keyword":"phone"',
    );
  });

  it("unadopts with the draft's update time and says which relations went with it", async () => {
    const current = ready();
    getDraftMock.mockResolvedValue(current);
    editDraftItemMock.mockResolvedValue(
      edited((draft) => {
        draft.items.objectTypes[0].adopted = false;
        draft.items.relationTypes[0].adopted = false;
      }),
    );
    renderModel();

    fireEvent.click(await screen.findByRole("switch", { name: /"name":"customers"/ }));

    await waitFor(() =>
      expect(editDraftItemMock).toHaveBeenCalledWith(
        "p1",
        "object_types",
        "customers",
        current.updateTime,
        { adopted: false },
      ),
    );
    expect(messageMock.info).toHaveBeenCalledWith(
      expect.stringContaining('bknProject.model.edit.cascade:{"count":1'),
    );
    expect(await screen.findByRole("switch", { name: /"name":"customers"/ })).not.toBeChecked();
  });

  it("does not offer adopting an object type that waits for its identity", async () => {
    getDraftMock.mockResolvedValue(ready());
    renderModel();

    expect(await screen.findByRole("switch", { name: /"name":"material_bom"/ })).toBeDisabled();
    expect(screen.getByRole("switch", { name: /"name":"sales_orders"/ })).toBeEnabled();
  });

  it("reloads a draft someone else changed and does not replay the edit", async () => {
    getDraftMock.mockResolvedValue(ready());
    editDraftItemMock.mockRejectedValue(conflict("Stale"));
    renderModel();

    fireEvent.click(await screen.findByRole("switch", { name: /"name":"customers"/ }));

    await waitFor(() => expect(getDraftMock).toHaveBeenCalledTimes(2));
    expect(messageMock.warning).toHaveBeenCalledWith("bknProject.model.edit.stale");
    expect(editDraftItemMock).toHaveBeenCalledTimes(1);
  });

  it("shows bkn-project's localized refusal of an edit", async () => {
    getDraftMock.mockResolvedValue(ready());
    editDraftItemMock.mockRejectedValue(conflict("ProjectArchived"));
    renderModel();

    fireEvent.click(await screen.findByRole("switch", { name: /"name":"customers"/ }));

    await waitFor(() =>
      expect(messageMock.error).toHaveBeenCalledWith("ProjectArchived described"),
    );
    expect(getDraftMock).toHaveBeenCalledTimes(1);
  });

  it("renames an item with only what changed, and offers nothing for an empty edit", async () => {
    getDraftMock.mockResolvedValue(ready());
    editDraftItemMock.mockResolvedValue(
      edited((draft) => {
        draft.items.objectTypes[0].name = "Client";
      }),
    );
    renderModel();

    fireEvent.click(await screen.findByRole("button", { name: /edit:.*"name":"customers"/ }));
    const save = await screen.findByRole("button", { name: "common.save" });
    expect(save).toBeDisabled();

    fireEvent.change(screen.getByLabelText("bknProject.model.edit.name"), {
      target: { value: " Client " },
    });
    fireEvent.click(save);

    await waitFor(() =>
      expect(editDraftItemMock).toHaveBeenCalledWith(
        "p1",
        "object_types",
        "customers",
        expect.any(Number),
        { name: "Client" },
      ),
    );
  });

  it("asks before drafting again over decisions, and agrees to discard them", async () => {
    const current = ready();
    current.items.decisions = [
      {
        action: "unadopt",
        after: false,
        before: true,
        by: { id: "me", type: "user" },
        itemId: "customers",
        kind: "object_types",
        time: 1,
      },
    ];
    getDraftMock.mockResolvedValue(current);
    generateDraftMock.mockResolvedValue({ ...ready(), status: "drafting" });
    renderModel();

    fireEvent.click(await screen.findByRole("button", { name: "bknProject.model.regenerate" }));

    expect(generateDraftMock).not.toHaveBeenCalled();
    expect(confirmMock).toHaveBeenCalledWith(
      expect.objectContaining({
        content: 'bknProject.model.regenerateConfirm.content:{"count":1}',
      }),
    );
    await act(async () => {
      await confirmMock.mock.calls[0][0].onOk();
    });
    expect(generateDraftMock).toHaveBeenCalledWith("p1", { discardDecisions: true });
  });

  it("drafts again without asking when nobody decided anything", async () => {
    getDraftMock.mockResolvedValue(ready());
    generateDraftMock.mockResolvedValue({ ...ready(), status: "drafting" });
    renderModel();

    fireEvent.click(await screen.findByRole("button", { name: "bknProject.model.regenerate" }));

    await waitFor(() => expect(generateDraftMock).toHaveBeenCalledWith("p1"));
    expect(confirmMock).not.toHaveBeenCalled();
  });

  it("asks again when someone decided something since the draft was read", async () => {
    const decided = ready();
    decided.items.decisions = [
      {
        action: "rename",
        after: "Client",
        before: "customers",
        by: { id: "other", type: "user" },
        itemId: "customers",
        kind: "object_types",
        time: 2,
      },
    ];
    getDraftMock.mockResolvedValueOnce(ready()).mockResolvedValue(decided);
    generateDraftMock.mockRejectedValueOnce(conflict("HasDecisions"));
    renderModel();

    fireEvent.click(await screen.findByRole("button", { name: "bknProject.model.regenerate" }));

    await waitFor(() => expect(confirmMock).toHaveBeenCalledTimes(1));
    expect(getDraftMock).toHaveBeenCalledTimes(2);
    expect(screen.queryByText("bknProject.model.generateFailed")).not.toBeInTheDocument();
  });

  it("offers no edits on an archived project", async () => {
    getDraftMock.mockResolvedValue(ready());
    renderModel({ archived: true });

    expect(await screen.findByRole("switch", { name: /"name":"customers"/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /edit:.*"name":"customers"/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: "bknProject.model.regenerate" })).toBeDisabled();
  });
});
