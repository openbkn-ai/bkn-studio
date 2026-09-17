/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const listTopLevelAuthzObjectsMock = vi.hoisted(() => vi.fn());
const paginationPropsMock = vi.hoisted(() => vi.fn());

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/framework/ui/common/TablePaginationBar", () => ({
  TablePaginationBar: (props: unknown) => {
    paginationPropsMock(props);
    return null;
  },
}));
vi.mock("@/modules/system-admin/services/authz-objects.service", () => ({
  listTopLevelAuthzObjects: listTopLevelAuthzObjectsMock,
  TOP_LEVEL_AUTHZ_RESOURCE_TYPES: [
    "catalog",
    "knowledge_network",
    "function",
    "tool_box",
    "mcp",
    "skill",
  ],
}));

import { TopResourceAuthorizationPanel } from "./TopResourceAuthorizationPanel";

describe("TopResourceAuthorizationPanel", () => {
  beforeEach(() => vi.clearAllMocks());

  it("keeps loading visual-only instead of rendering a missing translation key", () => {
    listTopLevelAuthzObjectsMock.mockImplementation(() => new Promise(() => undefined));

    render(<TopResourceAuthorizationPanel fineGrained onManage={vi.fn()} />);

    expect(screen.queryByText("common.loading")).toBeNull();
  });

  it("renders only flat catalog resources while parent-child authorization is unavailable", async () => {
    listTopLevelAuthzObjectsMock.mockResolvedValue({
      objects: [{
        id: "kn-ecommerce",
        name: "电商经营决策知识网络",
        type: "knowledge_network",
      }],
      total: 1,
    });
    render(<TopResourceAuthorizationPanel fineGrained onManage={vi.fn()} />);
    expect(await screen.findByText("电商经营决策知识网络")).not.toBeNull();
    expect(listTopLevelAuthzObjectsMock).toHaveBeenCalledWith(undefined, "", {
      limit: 10,
      offset: 0,
    });
    expect(paginationPropsMock).toHaveBeenCalledWith(expect.objectContaining({
      pageSize: 10,
      showSizeChanger: true,
      total: 1,
    }));

    expect(screen.queryByRole("button", {
      name: "systemAdmin.objectGrants.topResourceToggle",
    })).toBeNull();
  });
});
