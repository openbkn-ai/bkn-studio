/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { HttpToolLifecyclePanel } from "@/modules/execution-factory/components/HttpToolLifecyclePanel";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe("HttpToolLifecyclePanel", () => {
  it("keeps business fields before advanced config, with IO/debug in the side column", () => {
    const { container } = render(
      <HttpToolLifecyclePanel
        advancedConfig={<div>raw openapi spec</div>}
        businessFields={<div>business summary fields</div>}
        debugWorkbench={<div>debug workbench</div>}
        ioPreview={<div>request and response preview</div>}
        metadataTypeLabel="OpenAPI"
      />,
    );

    const business = screen.getByText("business summary fields");
    const ioPreview = screen.getByText("request and response preview");
    const advanced = screen.getByText("raw openapi spec");
    const debug = screen.getByText("debug workbench");

    expect(screen.getByText("executionFactory.httpToolLifecycleSummaryTitle")).toBeTruthy();
    expect(screen.getByText("executionFactory.httpToolLifecyclePreviewTitle")).toBeTruthy();
    expect(screen.getByText("executionFactory.httpToolLifecycleAdvancedTitle")).toBeTruthy();
    expect(screen.getByText("OpenAPI")).toBeTruthy();

    // Primary column: business then advanced
    expect(business.compareDocumentPosition(advanced) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // Side column: IO then debug; both after business in document order
    expect(business.compareDocumentPosition(ioPreview) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(ioPreview.compareDocumentPosition(debug) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    const panel = container.firstElementChild;
    expect(panel?.children).toHaveLength(2);
  });

  it("renders without advanced or debug sections when omitted", () => {
    render(
      <HttpToolLifecyclePanel
        businessFields={<div>business summary fields</div>}
        ioPreview={<div>request and response preview</div>}
        metadataTypeLabel="Function"
      />,
    );

    expect(screen.getByText("business summary fields")).toBeTruthy();
    expect(screen.getByText("request and response preview")).toBeTruthy();
    expect(screen.queryByText("executionFactory.httpToolLifecycleAdvancedTitle")).toBeNull();
  });
});
