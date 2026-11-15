/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { AxiosProgressEvent } from "axios";
import { http } from "@/framework/request/http";
import { parsePrecisionPreservingJSON } from "@/framework/request/precision-safe-json";
import type { EvalOverview } from "./m0-run.service";

export type EvalOverviewProgress =
  | { section: "cases"; total: number }
  | { section: "resources"; overview: EvalOverview }
  | {
      section: "complete";
      rule_points: EvalOverview["rule_points"];
      rule_percent: number;
      read_issues?: EvalOverview["read_issues"];
    }
  | {
      section: "error";
      stage: "resources" | "rules";
      status: number;
      code: string;
      message: string;
      trace_id?: string;
    };
export type EvalOverviewProgressOptions = {
  signal?: AbortSignal;
  onProgress: (event: EvalOverviewProgress) => void;
};

export class EvalOverviewProgressError extends Error {
  constructor(public readonly event: Extract<EvalOverviewProgress, { section: "error" }>) {
    super(event.message);
    this.name = "EvalOverviewProgressError";
  }
}

/** Decode cumulative XHR text through the shared authenticated request client. */
export async function readEvalOverviewProgress(
  networkId: string,
  options: EvalOverviewProgressOptions,
): Promise<EvalOverview> {
  let contentType = "";
  let offset = 0;
  let snapshot: EvalOverview | undefined;
  let completed = false;
  let failure: Error | undefined;
  const consume = (text: string, final = false) => {
    if (failure || options.signal?.aborted) return;
    try {
      let end: number;
      while (
        (end = text.indexOf("\n", offset)) >= 0 ||
        (final && offset < text.length && (end = text.length) >= 0)
      ) {
        const line = text.slice(offset, end).trim();
        offset = end + 1;
        if (!line) continue;
        const event = JSON.parse(line) as EvalOverviewProgress;
        if (completed) throw new Error("Unexpected Eval overview frame after completion");
        if (event.section === "cases") {
          if (!Number.isInteger(event.total) || event.total < 0)
            throw new Error("Invalid Eval Case total");
        } else if (event.section === "resources") {
          if (
            snapshot ||
            !event.overview?.resources ||
            !event.overview?.cases ||
            !event.overview?.scope
          )
            throw new Error("Invalid Eval overview resource snapshot");
          snapshot = event.overview;
        } else if (event.section === "complete") {
          if (!snapshot || !event.rule_points || !Number.isFinite(event.rule_percent))
            throw new Error("Invalid Eval rule coverage snapshot");
          snapshot = {
            ...snapshot,
            rule_points: event.rule_points,
            coverage: { ...snapshot.coverage, rule_percent: event.rule_percent },
            read_issues: event.read_issues,
          };
          completed = true;
        } else if (event.section === "error") {
          throw new EvalOverviewProgressError(event);
        } else throw new Error("Invalid Eval overview progress frame");
        options.onProgress(event);
      }
    } catch (error) {
      failure = error instanceof Error ? error : new Error("Invalid Eval overview response");
    }
  };
  const response = await http.get<string>(
    `/bkn-backend/v1/knowledge-networks/${encodeURIComponent(networkId)}/evals/overview`,
    {
      headers: { Accept: "application/x-ndjson, application/json" },
      adapter: "xhr",
      responseType: "text",
      transformResponse: [(value: unknown) => value],
      signal: options.signal,
      skipErrorToast: true,
      onDownloadProgress: (event: AxiosProgressEvent) => {
        const progressEvent = event.event as Event | undefined;
        const xhr = progressEvent?.target as XMLHttpRequest | undefined;
        if (!xhr || xhr.status >= 400) return;
        contentType = xhr.getResponseHeader?.("Content-Type")?.toLowerCase() ?? "";
        if (contentType.includes("application/x-ndjson") && typeof xhr.responseText === "string")
          consume(xhr.responseText);
      },
    },
  );
  contentType = String(response.headers?.["content-type"] ?? contentType).toLowerCase();
  // This endpoint has two current representations. Complete JSON remains the
  // standard SDK response; it must not be parsed as a section frame.
  if (contentType.includes("application/json") || contentType.includes("+json")) {
    const overview: unknown = parsePrecisionPreservingJSON(response.data);
    if (!isCompleteOverview(overview)) throw new Error("Invalid Eval overview response");
    return overview;
  }
  consume(response.data, true);
  if (failure) throw failure;
  if (!completed || !snapshot) throw new Error("Incomplete Eval overview response");
  return snapshot;
}

function isCompleteOverview(value: unknown): value is EvalOverview {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const overview = value as Record<string, unknown>;
  return ["resources", "cases", "coverage", "rule_points", "scope"].every(
    (key) =>
      overview[key] !== null && typeof overview[key] === "object" && !Array.isArray(overview[key]),
  );
}
