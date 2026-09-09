/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { KnowledgeNetworkCard } from "./KnowledgeNetworkCard";

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));

import type { KnowledgeNetworkRecord } from "@/modules/knowledge-network/types/knowledge-network";
import { hasKnowledgeNetworkRecordOperation } from "@/modules/knowledge-network/utils/record-operations";
import {
  formatKnowledgeNetworkUpdateTime,
  getKnowledgeNetworkCardMenuKeys,
  getKnowledgeNetworkExportMenuKey,
  KNOWLEDGE_NETWORK_EXPORT_FORMATS,
  parseKnowledgeNetworkExportMenuKey,
} from "./knowledge-network-card";

function createRecord(operations?: string[]): KnowledgeNetworkRecord {
  return {
    id: "network-1",
    identifier: "network_1",
    name: "Network 1",
    description: "",
    color: "#1677ff",
    ...(operations === undefined ? {} : { operations }),
    tags: [],
    createTime: "",
    updateTime: "",
    creatorName: "",
    updaterName: "",
    statistics: {
      objectTypesTotal: 0,
      relationTypesTotal: 0,
      actionTypesTotal: 0,
      conceptGroupsTotal: 0,
      metricsTotal: 0,
      skillsTotal: 0,
      mcpToolsTotal: 0,
      apisTotal: 0,
      functionsTotal: 0,
    },
  };
}

describe("formatKnowledgeNetworkUpdateTime", () => {
  it("removes seconds only from a complete time value", () => {
    expect(formatKnowledgeNetworkUpdateTime("2026-08-06 14:30:45")).toBe("2026-08-06 14:30");
    expect(formatKnowledgeNetworkUpdateTime("2026-08-06 14:30")).toBe("2026-08-06 14:30");
  });

  it("preserves existing empty-state values", () => {
    expect(formatKnowledgeNetworkUpdateTime("-")).toBe("-");
    expect(formatKnowledgeNetworkUpdateTime("")).toBe("--");
    expect(formatKnowledgeNetworkUpdateTime()).toBe("--");
  });
});

describe("getKnowledgeNetworkCardMenuKeys", () => {
  it("hides edit and delete when record operations do not allow them", () => {
    expect(getKnowledgeNetworkCardMenuKeys(createRecord(["view_detail"]))).toEqual([
      "view",
      "export",
    ]);
  });

  it("shows edit and delete only when record operations allow them", () => {
    expect(
      getKnowledgeNetworkCardMenuKeys(createRecord(["view_detail", "modify", "delete"])),
    ).toEqual(["view", "edit", "export", "delete"]);
  });

  it("denies actions when operation data is missing", () => {
    expect(hasKnowledgeNetworkRecordOperation(null, "modify")).toBe(false);
    expect(hasKnowledgeNetworkRecordOperation(createRecord(), "modify")).toBe(false);
    expect(hasKnowledgeNetworkRecordOperation(createRecord(["view_detail"]), "modify")).toBe(false);
  });
});

describe("knowledge network export menu keys", () => {
  it("offers both export formats", () => {
    expect(KNOWLEDGE_NETWORK_EXPORT_FORMATS).toEqual(["json", "bkn"]);
  });

  it("routes a submenu key back to the format it stands for", () => {
    KNOWLEDGE_NETWORK_EXPORT_FORMATS.forEach((format) => {
      expect(parseKnowledgeNetworkExportMenuKey(getKnowledgeNetworkExportMenuKey(format))).toBe(
        format,
      );
    });
  });

  it("does not read the other card actions as an export", () => {
    expect(parseKnowledgeNetworkExportMenuKey("export")).toBeUndefined();
    expect(parseKnowledgeNetworkExportMenuKey("delete")).toBeUndefined();
  });
});

describe("KnowledgeNetworkCard export menu interaction", () => {
  afterEach(() => {
    cleanup();
  });

  function renderCard() {
    const handlers = {
      onAuthorize: vi.fn(),
      onDelete: vi.fn(),
      onEdit: vi.fn(),
      onExport: vi.fn(),
      onOpen: vi.fn(),
    };
    const view = render(
      <KnowledgeNetworkCard {...handlers} record={createRecord(["view_detail"])} />,
    );

    return { ...handlers, view };
  }

  it("expands the export formats without opening the workspace", async () => {
    const { onExport, onOpen, view } = renderCard();

    fireEvent.click(view.container.querySelector("button") as HTMLButtonElement);

    const exportItem = await screen.findByText("knowledgeNetwork.export");
    fireEvent.click(exportItem);

    expect(onOpen).not.toHaveBeenCalled();
    expect(onExport).not.toHaveBeenCalled();
  });

  it("exports in the format picked from the submenu", async () => {
    const { onExport, onOpen, view } = renderCard();

    fireEvent.click(view.container.querySelector("button") as HTMLButtonElement);
    fireEvent.mouseEnter(await screen.findByText("knowledgeNetwork.export"));
    fireEvent.click(await screen.findByText("knowledgeNetwork.exportBkn"));

    expect(onExport).toHaveBeenCalledWith(expect.objectContaining({ id: "network-1" }), "bkn");
    expect(onOpen).not.toHaveBeenCalled();
  });
});
