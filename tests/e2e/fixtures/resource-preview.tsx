/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { App } from "antd";
import { createRoot } from "react-dom/client";

import "@/app/locales/i18n";
import "@/styles/global.css";
import { AppServicesProvider, AppServicesProviderBridge } from "@/framework/context/app-context";
import { createRuntimeConfig } from "@/framework/runtime/config";
import { ResourcePreviewPanel } from "@/modules/data-catalog/components/ResourcePreviewPanel";
import type { CatalogResource } from "@/modules/data-catalog/types/data-catalog";

// Mount the real panel with deterministic local data; no backend or resource writes are needed.
const params = new URLSearchParams(location.search);
const extraColumns = params.has("many") ? 10 : 0;
const whitespace = params.has("whitespace");
const longHeaders = params.has("long-headers");
const nameField = longHeaders
  ? "reporting_customer_profile_recent_review_request_comment_count"
  : "name";
const descriptionField = longHeaders
  ? "reporting_customer_profile_recent_review_request_comment_total"
  : "description";
const resource: CatalogResource = {
  id: "preview-layout-fixture",
  catalogId: "preview-layout-catalog",
  category: "table",
  name: "preview-layout",
  description: "",
  columnCount: 2 + extraColumns,
  rowCount: 3,
  sourceIdentifier: "preview-layout",
  localIndexStatus: "unavailable",
  operations: ["view_detail", "query_data"],
  updateTime: "-",
  expectedUpdateTime: 0,
  schema: [
    { name: nameField, type: "string" },
    {
      name: descriptionField,
      type: "text",
      ...(longHeaders
        ? {
            displayName: "客户档案最近审核请求评论总数的完整显示名称",
            description: "Read-only source field description",
          }
        : {}),
    },
    ...Array.from({ length: extraColumns }, (_, index) => ({
      name: `extra_${index}`,
      type: "integer",
    })),
  ],
};

const loadPreview = async () => ({
  rows: [
    {
      [nameField]: whitespace ? "\n\t " : "feat/bkn-safe/casdoor-sso",
      [descriptionField]: whitespace ? "\u00a0" : "宽列中可以完整显示的中文文本 mixed 👩🏽‍💻",
    },
    { [nameField]: "中文字段内容测试窄列溢出👩🏽‍💻", [descriptionField]: "e\u0301 中文 👨‍👩‍👧‍👦" },
    { [nameField]: "x".repeat(8_000), [descriptionField]: "long content" },
  ],
  total: 3,
});

createRoot(document.getElementById("root")!).render(
  <AppServicesProvider runtimeConfig={createRuntimeConfig()} updateLocale={async () => {}}>
    <App>
      <AppServicesProviderBridge>
        <main style={{ display: "flex", height: "100vh", padding: 24, boxSizing: "border-box" }}>
          <ResourcePreviewPanel active resource={resource} loadPreview={loadPreview} />
        </main>
      </AppServicesProviderBridge>
    </App>
  </AppServicesProvider>,
);
