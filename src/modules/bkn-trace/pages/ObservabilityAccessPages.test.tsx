/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BusinessProvenancePage } from "@/modules/bkn-trace/pages/BusinessProvenancePage";
import { TraceAnalysisPage } from "@/modules/bkn-trace/pages/TraceAnalysisPage";
import { getAccessProfile } from "@/modules/bkn-trace/services/trace.service";

vi.mock("react-i18next", async (importOriginal) => {
  const original = await importOriginal<typeof import("react-i18next")>();
  return { ...original, useTranslation: () => ({ t: (key: string) => key }) };
});
vi.mock("@/modules/bkn-trace/services/trace.service", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/modules/bkn-trace/services/trace.service")>();
  return { ...original, getAccessProfile: vi.fn() };
});
vi.mock("@/modules/bkn-trace/scenes/BknTraceRunsScene", () => ({ BknTraceRunsScene: () => <div>business-provenance-content</div> }));
vi.mock("@/modules/bkn-trace/scenes/BknTraceExplorerScene", () => ({ BknTraceAdvancedExplorerScene: () => <div>trace-analysis-content</div> }));

const baseProfile = {
  accessScopeFingerprint: "sha256:test", allowedLogCategories: [],
  businessProvenanceManagedNetworks: false, businessProvenanceOwn: false,
  globalLogSearch: false, logExport: false, logPolicyRead: false, logSensitiveFields: false,
  managementAudit: false, securityAudit: false, technicalTrace: false,
};

describe("observability capability pages", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => cleanup());

  it("业务溯源页面只消费服务端业务溯源能力", async () => {
    vi.mocked(getAccessProfile).mockResolvedValue({ ...baseProfile, businessProvenanceOwn: true });
    render(<BusinessProvenancePage />);
    expect(await screen.findByText("business-provenance-content")).not.toBeNull();
  });

  it("无业务溯源能力时显示统一拒绝态", async () => {
    vi.mocked(getAccessProfile).mockResolvedValue(baseProfile);
    render(<BusinessProvenancePage />);
    expect(await screen.findByText("bknTrace.errors.accessDenied")).not.toBeNull();
  });

  it("Trace 分析页面只消费 technicalTrace 能力", async () => {
    vi.mocked(getAccessProfile).mockResolvedValue({ ...baseProfile, technicalTrace: true });
    render(<TraceAnalysisPage />);
    expect(await screen.findByText("trace-analysis-content")).not.toBeNull();
  });
});
