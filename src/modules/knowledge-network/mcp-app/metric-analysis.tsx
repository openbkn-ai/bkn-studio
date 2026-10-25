/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import "@ant-design/v5-patch-for-react-19";
import "@/app/locales/i18n";
import "@/styles/global.css";

import { App } from "@modelcontextprotocol/ext-apps";
import { Alert, ConfigProvider, Spin, theme as antdTheme } from "antd";
import { createRoot } from "react-dom/client";
import { useEffect, useState } from "react";

import i18n from "@/app/locales/i18n";
import { ThemeContext } from "@/app/theme/theme-context";
import { objectMetricText } from "@/modules/knowledge-network/lib/object-metric-text";
import type {
  ObjectMetricDataV1,
  ObjectMetricDrillThroughV1,
  ObjectMetricQueryRequestV1,
} from "@/modules/knowledge-network/types/object-metric";

import { MetricAnalysisView } from "./MetricAnalysisView";
import { withMetricInteraction } from "./metric-interaction";

type MetricInput = {
  kn_id: string;
  metric_id: string;
  version: number;
  query: ObjectMetricQueryRequestV1;
  bkn_context?: Record<string, unknown>;
};

function metricResult(value: unknown): ObjectMetricDataV1 | undefined {
  if (!value || typeof value !== "object") return undefined;
  const candidate = value as Partial<ObjectMetricDataV1>;
  return candidate.model && Array.isArray(candidate.entries) && candidate.status
    ? (candidate as ObjectMetricDataV1)
    : undefined;
}

function drillResult(value: unknown): ObjectMetricDrillThroughV1 | undefined {
  if (!value || typeof value !== "object") return undefined;
  const candidate = value as Partial<ObjectMetricDrillThroughV1>;
  return Array.isArray(candidate.participants)
    ? (candidate as ObjectMetricDrillThroughV1)
    : undefined;
}

function toolError(result: { content?: Array<{ type: string; text?: string }> }): string {
  return (
    result.content?.find((item) => item.type === "text")?.text ?? objectMetricText("mcpCallFailed")
  );
}

function setLocale(locale?: string) {
  void i18n.changeLanguage((locale ?? navigator.language).startsWith("en") ? "en-US" : "zh-CN");
}

const app = new App({ name: "OpenBKN Object Metric Analysis", version: "1.0.0" });

export function MetricMcpApp() {
  const [input, setInput] = useState<MetricInput>();
  const [result, setResult] = useState<ObjectMetricDataV1>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [dark, setDark] = useState(() => window.matchMedia("(prefers-color-scheme: dark)").matches);

  useEffect(() => {
    setLocale();
    app.ontoolinput = ({ arguments: args }) => setInput(args as MetricInput | undefined);
    app.ontoolresult = (toolResult) => {
      if (toolResult.isError) {
        setError(toolError(toolResult));
        return;
      }
      const next = metricResult(toolResult.structuredContent);
      if (next) setResult(next);
      else setError(objectMetricText("mcpInvalidResult"));
    };
    app.onhostcontextchanged = (context) => {
      if (context.theme === "dark" || context.theme === "light") setDark(context.theme === "dark");
      if (context.locale) setLocale(context.locale);
    };
    void app
      .connect()
      .then(() => {
        const hostContext = app.getHostContext();
        const theme = hostContext?.theme;
        if (theme === "dark" || theme === "light") setDark(theme === "dark");
        if (hostContext?.locale) setLocale(hostContext.locale);
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : String(cause)));
    return () => {
      app.ontoolinput = undefined;
      app.ontoolresult = undefined;
      app.onhostcontextchanged = undefined;
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  }, [dark]);

  const nextPage = async () => {
    if (!input || !result?.next_cursor) return;
    setBusy(true);
    setError(undefined);
    try {
      const next = await withMetricInteraction(
        app,
        "Load the next page of published object metric results",
        async (context) => {
          const response = await app.callServerTool({
            name: "query_metric",
            arguments: {
              ...input,
              bkn_context: context,
              query: {
                ...input.query,
                page_size: input.query.page_size || 100,
                cursor: result.next_cursor,
              },
              response_format: "json",
            },
          });
          if (response.isError) throw new Error(toolError(response));
          const page = metricResult(response.structuredContent);
          if (!page) throw new Error(objectMetricText("mcpInvalidNextPage"));
          return page;
        },
        (page) => `Displayed ${page.entries.length} object metric result rows`,
      );
      setResult((current) =>
        current ? { ...next, entries: [...current.entries, ...next.entries] } : next,
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  const participants = async (
    bucketKey: string,
    cursor?: string,
  ): Promise<ObjectMetricDrillThroughV1> => {
    if (!input) throw new Error(objectMetricText("mcpMissingQuery"));
    return withMetricInteraction(
      app,
      "View participating instances for a published object metric result",
      async (context) => {
        const response = await app.callServerTool({
          name: "drill_through_metric",
          arguments: {
            ...input,
            bkn_context: context,
            bucket_key: bucketKey,
            cursor,
            page_size: 100,
            response_format: "json",
          },
        });
        if (response.isError) throw new Error(toolError(response));
        const next = drillResult(response.structuredContent);
        if (!next) throw new Error(objectMetricText("mcpInvalidParticipants"));
        return next;
      },
      (page) => `Displayed ${page.participants.length} participating object instances`,
    );
  };

  return (
    <ThemeContext.Provider value={dark ? "dark" : "light"}>
      <ConfigProvider
        theme={{ algorithm: dark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm }}
      >
        {result ? (
          <MetricAnalysisView
            busy={busy}
            error={error}
            onNextPage={input ? () => void nextPage() : undefined}
            onParticipants={
              input ? (entry, cursor) => participants(entry.bucket_key ?? "", cursor) : undefined
            }
            result={result}
          />
        ) : error ? (
          <Alert message={error} showIcon type="error" />
        ) : (
          <div style={{ padding: 24 }}>
            <Spin /> {objectMetricText("mcpWaiting")}
          </div>
        )}
      </ConfigProvider>
    </ThemeContext.Provider>
  );
}

const root = document.getElementById("root");
if (root) createRoot(root).render(<MetricMcpApp />);
