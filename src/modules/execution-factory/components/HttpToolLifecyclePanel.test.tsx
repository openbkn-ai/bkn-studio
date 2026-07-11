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
  it("keeps business fields and IO preview before advanced raw configuration", () => {
    render(
      <HttpToolLifecyclePanel
        advancedConfig={<div>raw openapi spec</div>}
        businessFields={<div>business summary fields</div>}
        ioPreview={<div>request and response preview</div>}
        metadataTypeLabel="OpenAPI"
      />,
    );

    const business = screen.getByText("business summary fields");
    const ioPreview = screen.getByText("request and response preview");
    const advanced = screen.getByText("raw openapi spec");

    expect(screen.getByText("executionFactory.httpToolLifecycleSummaryTitle")).toBeTruthy();
    expect(screen.getByText("executionFactory.httpToolLifecyclePreviewTitle")).toBeTruthy();
    expect(screen.getByText("executionFactory.httpToolLifecycleAdvancedTitle")).toBeTruthy();
    expect(screen.getByText("OpenAPI")).toBeTruthy();
    expect(business.compareDocumentPosition(ioPreview) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(ioPreview.compareDocumentPosition(advanced) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
