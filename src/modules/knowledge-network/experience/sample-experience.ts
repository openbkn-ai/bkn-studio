/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/**
 * Experience sets: the questions an installed sample offers with reference answers. The sample
 * service records the installed version's set (bkn-samples `experience-set.schema.json`) and
 * serves it for the knowledge network that installation created; a page offers the cases whose
 * `surfaces` name it.
 */

import { http } from "@/framework/request/http";

export type ExperienceSurface = "agent" | "query" | "graph";

export type ExperienceCase = {
  id: string;
  title: string;
  explanation: string;
  question: string;
  answer: string;
  surfaces: ExperienceSurface[];
  cypher: { query?: string; graph?: string };
};

export type SampleExperience = {
  knowledgeNetwork: string;
  sample: string;
  version: string;
  businessDate: string;
  cases: ExperienceCase[];
};

const SURFACES: readonly string[] = ["agent", "query", "graph"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

/** Reads one case; a case missing what the card shows is left out rather than shown half-empty. */
function parseCase(value: unknown): ExperienceCase | null {
  if (!isRecord(value)) return null;
  const id = text(value.id);
  const title = text(value.title);
  const explanation = text(value.explanation);
  const question = text(value.question);
  const answer = text(value.answer);
  if (!id || !title || !explanation || !question || !answer || !Array.isArray(value.surfaces)) {
    return null;
  }
  const surfaces = value.surfaces.filter(
    (item): item is ExperienceSurface => typeof item === "string" && SURFACES.includes(item),
  );
  const cypher = isRecord(value.cypher) ? value.cypher : {};
  return {
    id,
    title,
    explanation,
    question,
    answer,
    surfaces,
    cypher: {
      ...(text(cypher.query) ? { query: cypher.query as string } : {}),
      ...(text(cypher.graph) ? { graph: cypher.graph as string } : {}),
    },
  };
}

export function parseSampleExperience(value: unknown): SampleExperience | null {
  if (!isRecord(value) || !isRecord(value.experienceSet)) return null;
  const sample = text(value.sample);
  const spec = value.experienceSet.spec;
  if (!sample || !isRecord(spec) || !Array.isArray(spec.cases)) return null;
  const cases = spec.cases.map(parseCase).filter((item): item is ExperienceCase => item !== null);
  if (cases.length === 0) return null;
  return {
    knowledgeNetwork: typeof value.knowledgeNetwork === "string" ? value.knowledgeNetwork : "",
    sample,
    version: typeof value.version === "string" ? value.version : "",
    businessDate: typeof spec.businessDate === "string" ? spec.businessDate : "",
    cases,
  };
}

/** The cases one page offers, in the set's order; a query case needs its reference query. */
export function casesFor(
  experience: SampleExperience,
  surface: ExperienceSurface,
): ExperienceCase[] {
  return experience.cases.filter(
    (item) =>
      item.surfaces.includes(surface) &&
      (surface !== "query" || Boolean(item.cypher.query)) &&
      (surface !== "graph" || Boolean(item.cypher.graph)),
  );
}

/**
 * The experience set for this network, or null when no installed sample created it or its version
 * has none. Failures read as "none": the mode is an extra, never in the page's way.
 */
export async function loadSampleExperience(knId: string): Promise<SampleExperience | null> {
  try {
    const response = await http.get<unknown>(
      `/studio/samples/experience-sets/${encodeURIComponent(knId)}`,
      { skipErrorToast: true },
    );
    return parseSampleExperience(response.data);
  } catch {
    return null;
  }
}
